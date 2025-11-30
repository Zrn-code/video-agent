from fastapi import APIRouter, HTTPException
from typing import List
import uuid
from datetime import datetime

from app.models.room import (
    Room, CreateRoomRequest, RoomInternal, VideoState, CurrentVideo, 
    HeartbeatRequest, ChatRequest, Message, UpdateStateRequest, VideoItem,
    AICompanion
)
from app.services.room_manager import rooms, get_room_response, cleanup_users, save_rooms
from app.services.connection_manager import manager

router = APIRouter()

@router.get("/rooms", response_model=List[Room])
async def get_rooms():
    return [get_room_response(room) for room in rooms.values()]

@router.post("/rooms", response_model=Room)
async def create_room(request: CreateRoomRequest):
    room_id = str(uuid.uuid4())
    new_room = RoomInternal(
        id=room_id,
        name=request.name,
        description=request.description,
        videoState=VideoState(),
        aiCompanions=request.aiCompanions
    )
    
    if request.aiCompanions:
        for companion in request.aiCompanions:
            # Add AI companion as a user
            ai_user_id = f"ai-companion-{uuid.uuid4()}"
            new_room.users[ai_user_id] = {
                "username": companion.name,
                "avatar": companion.avatar,
                "lastSeen": datetime.now().timestamp(),
                "emotion": "neutral",
                "isAi": True,
                "personality": companion.personality,
                "background": companion.background
            }
    
    if request.initialPlaylist:
        new_room.queue = request.initialPlaylist
        # Automatically play the first video if playlist is not empty
        if len(new_room.queue) > 0:
            first_video = new_room.queue[0]
            new_room.currentVideo = CurrentVideo(
                videoId=first_video.videoId,
                title=first_video.title,
                channelTitle=first_video.channelTitle,
                thumbnailUrl=first_video.thumbnailUrl
            )
            new_room.videoState.url = f"https://www.youtube.com/watch?v={first_video.videoId}"
            # Remove first video from queue as it is now playing
            new_room.queue.pop(0)

    rooms[room_id] = new_room
    save_rooms()
    return get_room_response(new_room)

@router.get("/rooms/{room_id}", response_model=Room)
async def get_room(room_id: str):
    if room_id not in rooms:
        raise HTTPException(status_code=404, detail="Room not found")
    return get_room_response(rooms[room_id])

@router.post("/rooms/{room_id}/join")
async def join_room(room_id: str, request: HeartbeatRequest):
    if room_id not in rooms:
        raise HTTPException(status_code=404, detail="Room not found")
    
    rooms[room_id].users[request.userId] = {
        'username': request.username or 'Guest',
        'avatar': request.avatar or 'https://api.dicebear.com/7.x/avataaars/svg?seed=' + request.userId,
        'lastSeen': datetime.now().timestamp()
    }
    save_rooms()
    return get_room_response(rooms[room_id])

@router.post("/rooms/{room_id}/heartbeat")
async def heartbeat(room_id: str, request: HeartbeatRequest):
    if room_id not in rooms:
        raise HTTPException(status_code=404, detail="Room not found")
    
    if request.userId in rooms[room_id].users:
        rooms[room_id].users[request.userId]['lastSeen'] = datetime.now().timestamp()
        if request.username:
            rooms[room_id].users[request.userId]['username'] = request.username
        if request.avatar:
            rooms[room_id].users[request.userId]['avatar'] = request.avatar
        if request.emotion:
            rooms[room_id].users[request.userId]['emotion'] = request.emotion
    else:
        rooms[room_id].users[request.userId] = {
            'username': request.username or 'Guest',
            'avatar': request.avatar or 'https://api.dicebear.com/7.x/avataaars/svg?seed=' + request.userId,
            'lastSeen': datetime.now().timestamp(),
            'emotion': request.emotion
        }
    
    # Clean up old messages
    cleanup_users(rooms[room_id])
    
    return {
        "status": "ok", 
        "userCount": len(rooms[room_id].users),
        "users": [
            {
                "id": uid,
                "username": info['username'],
                "avatar": info['avatar'],
                "lastSeen": info['lastSeen'],
                "emotion": info.get('emotion')
            }
            for uid, info in rooms[room_id].users.items()
        ],
        "messages": rooms[room_id].messages
    }

@router.post("/rooms/{room_id}/chat")
async def send_chat(room_id: str, request: ChatRequest):
    if room_id not in rooms:
        raise HTTPException(status_code=404, detail="Room not found")
    
    room = rooms[room_id]
    
    # Calculate current video timestamp
    current_played = room.videoState.played
    now = datetime.now().timestamp()
    
    if room.videoState.playing and room.videoState.lastUpdated > 0:
        diff = now - room.videoState.lastUpdated
        if diff > 0:
            current_played += diff * room.videoState.playbackRate
            
    # Clamp to duration if available
    if room.videoState.duration > 0 and current_played > room.videoState.duration:
        current_played = room.videoState.duration

    video_title = room.currentVideo.title if room.currentVideo else None
    
    message = Message(
        id=str(uuid.uuid4()),
        userId=request.userId,
        username=request.username,
        content=request.content,
        timestamp=now,
        videoTitle=video_title,
        videoTimestamp=current_played
    )
    
    rooms[room_id].messages.append(message)
    save_rooms()
    
    await manager.broadcast({
        "type": "new_message",
        "message": message.dict()
    }, room_id)
    
    return message

@router.post("/rooms/{room_id}/leave")
async def leave_room(room_id: str, request: HeartbeatRequest):
    if room_id not in rooms:
        raise HTTPException(status_code=404, detail="Room not found")
    
    if request.userId in rooms[room_id].users:
        del rooms[room_id].users[request.userId]
    
    save_rooms()

    # 暫時停用自動刪除空房間的功能
    # If room is empty, delete it
    # if len(rooms[room_id].users) == 0:
    #     del rooms[room_id]
    #     return {"message": "Left room and room deleted"}
        
    return {"message": "Left room"}

@router.put("/rooms/{room_id}/state")
async def update_room_state(room_id: str, state: UpdateStateRequest):
    if room_id not in rooms:
        raise HTTPException(status_code=404, detail="Room not found")
    
    current_state = rooms[room_id].videoState
    
    if state.url is not None:
        current_state.url = state.url
    if state.playing is not None:
        current_state.playing = state.playing
    if state.played is not None:
        current_state.played = state.played
    if state.duration is not None:
        current_state.duration = state.duration
    if state.playbackRate is not None:
        current_state.playbackRate = state.playbackRate
        
    current_state.lastUpdated = datetime.now().timestamp()
    
    save_rooms()
    return current_state

@router.post("/rooms/{room_id}/queue")
async def add_to_queue(room_id: str, video: VideoItem):
    if room_id not in rooms:
        raise HTTPException(status_code=404, detail="Room not found")
    rooms[room_id].queue.append(video)
    save_rooms()
    return rooms[room_id].queue

@router.delete("/rooms/{room_id}/queue/{index}")
async def remove_from_queue(room_id: str, index: int):
    if room_id not in rooms:
        raise HTTPException(status_code=404, detail="Room not found")
    if index < 0 or index >= len(rooms[room_id].queue):
        raise HTTPException(status_code=400, detail="Invalid queue index")
    
    removed = rooms[room_id].queue.pop(index)
    save_rooms()
    return {"message": "Removed from queue", "video": removed}

@router.post("/rooms/{room_id}/play")
async def play_video(room_id: str, video: VideoItem):
    if room_id not in rooms:
        raise HTTPException(status_code=404, detail="Room not found")
    
    room = rooms[room_id]
    
    # Update current state
    room.videoState.url = f"https://www.youtube.com/watch?v={video.videoId}"
    room.videoState.playing = True
    room.videoState.played = 0
    room.videoState.lastUpdated = datetime.now().timestamp()
    
    # Update current video
    room.currentVideo = CurrentVideo(
        videoId=video.videoId,
        title=video.title,
        channelTitle=video.channelTitle,
        thumbnailUrl=video.thumbnailUrl
    )
    
    # Add to history (avoid duplicates at the top of the stack if possible, or just push)
    # Let's just push for now
    room.history.insert(0, video)
    if len(room.history) > 50: # Keep history size manageable
        room.history.pop()
        
    save_rooms()
    return get_room_response(room)

@router.post("/rooms/{room_id}/ai-companion")
async def add_ai_companion(room_id: str, companion: AICompanion):
    if room_id not in rooms:
        raise HTTPException(status_code=404, detail="Room not found")
    
    room = rooms[room_id]
    
    # Add AI companion as a user
    ai_user_id = f"ai-companion-{uuid.uuid4()}"
    room.users[ai_user_id] = {
        "username": companion.name,
        "avatar": companion.avatar,
        "lastSeen": datetime.now().timestamp(),
        "emotion": "neutral",
        "isAi": True,
        "personality": companion.personality,
        "background": companion.background
    }
    
    # Update room's aiCompanions field
    if room.aiCompanions is None:
        room.aiCompanions = []
    room.aiCompanions.append(companion)
    
    save_rooms()
    return get_room_response(room)
