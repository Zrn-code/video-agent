from fastapi import APIRouter, WebSocket, WebSocketDisconnect
from datetime import datetime
import uuid

from app.services.connection_manager import manager
from app.services.room_manager import rooms
from app.models.room import Message, CurrentVideo, VideoItem

router = APIRouter()

@router.websocket("/ws/{room_id}/{user_id}")
async def websocket_endpoint(websocket: WebSocket, room_id: str, user_id: str):
    await manager.connect(websocket, room_id)
    
    # Handle user join logic here if needed, or rely on client to send "join" message
    # For now, we assume the user is already "known" or we add them to the room if not
    if room_id not in rooms:
        # If room doesn't exist, we might want to close connection or create it?
        # For now, let's just close
        await websocket.close(code=4000, reason="Room not found")
        return

    try:
        while True:
            data = await websocket.receive_json()
            event_type = data.get("type")
            
            if event_type == "join":
                # Update user info
                user_data = data.get("user", {})
                rooms[room_id].users[user_id] = {
                    'username': user_data.get('username', 'Guest'),
                    'avatar': user_data.get('avatar', ''),
                    'lastSeen': datetime.now().timestamp(),
                    'emotion': user_data.get('emotion')
                }
                # Broadcast updated user list
                await manager.broadcast({
                    "type": "users_update",
                    "users": [
                        {
                            "id": uid,
                            "username": info['username'],
                            "avatar": info['avatar'],
                            "lastSeen": info['lastSeen'],
                            "emotion": info.get('emotion')
                        }
                        for uid, info in rooms[room_id].users.items()
                    ]
                }, room_id)

            elif event_type == "emotion":
                emotion = data.get("emotion")
                if user_id in rooms[room_id].users:
                    rooms[room_id].users[user_id]['emotion'] = emotion
                    rooms[room_id].users[user_id]['lastSeen'] = datetime.now().timestamp()
                    # Broadcast specific user update or full list? Full list is easier for now
                    await manager.broadcast({
                        "type": "users_update",
                        "users": [
                            {
                                "id": uid,
                                "username": info['username'],
                                "avatar": info['avatar'],
                                "lastSeen": info['lastSeen'],
                                "emotion": info.get('emotion')
                            }
                            for uid, info in rooms[room_id].users.items()
                        ]
                    }, room_id)

            elif event_type == "chat":
                content = data.get("content")
                username = data.get("username")
                message = Message(
                    id=str(uuid.uuid4()),
                    userId=user_id,
                    username=username,
                    content=content,
                    timestamp=datetime.now().timestamp()
                )
                rooms[room_id].messages.append(message)
                # Keep only last 50 messages
                if len(rooms[room_id].messages) > 50:
                    rooms[room_id].messages.pop(0)
                    
                await manager.broadcast({
                    "type": "new_message",
                    "message": message.dict()
                }, room_id)

            elif event_type == "video_state":
                state = data.get("state")
                current_state = rooms[room_id].videoState
                
                # 更新所有狀態
                if state.get("playing") is not None:
                    current_state.playing = state["playing"]
                if state.get("played") is not None:
                    current_state.played = state["played"]
                if state.get("duration") is not None:
                    current_state.duration = state["duration"]
                if state.get("playbackRate") is not None:
                    current_state.playbackRate = state["playbackRate"]
                
                # 更新時間戳記
                current_state.lastUpdated = datetime.now().timestamp()
                
                # 廣播給房間內所有其他用戶
                await manager.broadcast({
                    "type": "video_state_update",
                    "state": {
                        "playing": current_state.playing,
                        "played": current_state.played,
                        "duration": current_state.duration,
                        "playbackRate": current_state.playbackRate,
                        "lastUpdated": current_state.lastUpdated
                    },
                    "sender": user_id
                }, room_id)

            elif event_type == "play_video":
                video = data.get("video")
                room = rooms[room_id]
                room.videoState.url = f"https://www.youtube.com/watch?v={video['videoId']}"
                room.videoState.playing = True
                room.videoState.played = 0
                room.videoState.lastUpdated = datetime.now().timestamp()
                
                room.currentVideo = CurrentVideo(**video)
                room.history.insert(0, VideoItem(**video))
                if len(room.history) > 50:
                    room.history.pop()

                await manager.broadcast({
                    "type": "play_video_update",
                    "videoState": room.videoState.dict(),
                    "currentVideo": room.currentVideo.dict(),
                    "history": [v.dict() for v in room.history]
                }, room_id)

            elif event_type == "queue_add":
                video = data.get("video")
                rooms[room_id].queue.append(VideoItem(**video))
                await manager.broadcast({
                    "type": "queue_update",
                    "queue": [v.dict() for v in rooms[room_id].queue]
                }, room_id)

            elif event_type == "queue_remove":
                index = data.get("index")
                if 0 <= index < len(rooms[room_id].queue):
                    rooms[room_id].queue.pop(index)
                    await manager.broadcast({
                        "type": "queue_update",
                        "queue": [v.dict() for v in rooms[room_id].queue]
                    }, room_id)

    except WebSocketDisconnect:
        manager.disconnect(websocket, room_id)
        if room_id in rooms and user_id in rooms[room_id].users:
            del rooms[room_id].users[user_id]
            # Broadcast user left
            await manager.broadcast({
                "type": "users_update",
                "users": [
                    {
                        "id": uid,
                        "username": info['username'],
                        "avatar": info['avatar'],
                        "lastSeen": info['lastSeen'],
                        "emotion": info.get('emotion')
                    }
                    for uid, info in rooms[room_id].users.items()
                ]
            }, room_id)
