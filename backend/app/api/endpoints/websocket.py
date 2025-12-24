from fastapi import APIRouter, WebSocket, WebSocketDisconnect
from datetime import datetime
import uuid

from app.services.connection_manager import manager
from app.services.room_manager import rooms, save_rooms, assign_new_host
from app.services.script_manager import script_manager
from app.models.room import Message, CurrentVideo, VideoItem, AICompanion
from app.services.ai_generator import analyze_message, analyze_message_and_select_companions, get_video_context_str, generate_character_response

router = APIRouter()

async def handle_ai_response(room_id: str, ai_uid: str, ai_info: dict, user_name: str, user_content: str, video_title: str, context_type: str = "chat"):
    import asyncio
    
    # Set typing status
    if room_id in rooms and ai_uid in rooms[room_id].users:
        rooms[room_id].users[ai_uid]['emotion'] = '💬'
        await manager.broadcast({
            "type": "users_update",
            "users": [
                {
                    "id": uid,
                    "username": info['username'],
                    "avatar": info['avatar'],
                    "lastSeen": info['lastSeen'],
                    "emotion": info.get('emotion'),
                    "isAi": info.get('isAi', False),
                    "addedBy": info.get('addedBy'),
                    "addedByUsername": info.get('addedByUsername'),
                    "hasScript": info.get('hasScript', False)
                }
                for uid, info in rooms[room_id].users.items()
            ],
            "hostId": rooms[room_id].hostId
        }, room_id)

    await asyncio.sleep(0.5) # Reduced delay for chat

    try:
        video_id = "unknown"
        current_played = 0.0
        if room_id in rooms:
             if rooms[room_id].currentVideo:
                 video_id = rooms[room_id].currentVideo.videoId
             current_played = rooms[room_id].videoState.played

        video_context_str = get_video_context_str(video_id, current_played)

        response_text = await generate_character_response(
            ch_name=ai_info['username'],
            ch_personality=ai_info.get('personalities') or ai_info.get('style', '友善的角色'),
            ch_style=ai_info.get('style', '友善的角色'),
            user_name=user_name,
            user_input=user_content,
            video_context_str=video_context_str
        )
        
        if room_id in rooms:
            # Clear typing status
            if ai_uid in rooms[room_id].users:
                rooms[room_id].users[ai_uid]['emotion'] = None
            
            current_played = rooms[room_id].videoState.played
            
            ai_message = Message(
                id=str(uuid.uuid4()),
                userId=ai_uid,
                username=ai_info['username'],
                content=response_text,
                timestamp=datetime.now().timestamp(),
                videoTitle=video_title,
                videoTimestamp=current_played
            )
            
            rooms[room_id].messages.append(ai_message)
            # Keep only last 50 messages
            if len(rooms[room_id].messages) > 50:
                rooms[room_id].messages.pop(0)
            
            save_rooms()
            
            await manager.broadcast({
                "type": "new_message",
                "message": ai_message.dict()
            }, room_id)
            
            # Broadcast user update to clear emotion
            await manager.broadcast({
                "type": "users_update",
                "users": [
                    {
                        "id": uid,
                        "username": info['username'],
                        "avatar": info['avatar'],
                        "lastSeen": info['lastSeen'],
                        "emotion": info.get('emotion'),
                        "isAi": info.get('isAi', False),
                        "addedBy": info.get('addedBy'),
                        "addedByUsername": info.get('addedByUsername'),
                        "hasScript": info.get('hasScript', False)
                    }
                    for uid, info in rooms[room_id].users.items()
                ],
                "hostId": rooms[room_id].hostId
            }, room_id)

    except Exception as e:
        print(f"Error generating AI response: {e}")
        if room_id in rooms and ai_uid in rooms[room_id].users:
            rooms[room_id].users[ai_uid]['emotion'] = None

async def handle_group_ai_response(room_id: str, selected_ais: list, user_name: str, user_content: str, video_id: str, video_title: str, video_timestamp: float):
    import asyncio
    
    # Set typing status for all
    if room_id in rooms:
        for uid, info in selected_ais:
            if uid in rooms[room_id].users:
                rooms[room_id].users[uid]['emotion'] = '💬'
        
        await manager.broadcast({
            "type": "users_update",
            "users": [
                {
                    "id": uid,
                    "username": info['username'],
                    "avatar": info['avatar'],
                    "lastSeen": info['lastSeen'],
                    "emotion": info.get('emotion'),
                    "isAi": info.get('isAi', False),
                    "addedBy": info.get('addedBy'),
                    "addedByUsername": info.get('addedByUsername'),
                    "hasScript": info.get('hasScript', False)
                }
                for uid, info in rooms[room_id].users.items()
            ],
            "hostId": rooms[room_id].hostId
        }, room_id)

    try:
        # Step 2: Get video context
        video_context_str = get_video_context_str(video_id, video_timestamp)
        
        # Step 3: Generate responses
        for uid, info in selected_ais:
            # Generate for each
            response_text = await generate_character_response(
                ch_name=info['username'],
                ch_personality=info.get('personalities') or info.get('style', '友善的角色'),
                ch_style=info.get('style', '友善的角色'),
                user_name=user_name,
                user_input=user_content,
                video_context_str=video_context_str
            )
            
            if room_id in rooms:
                # Clear typing
                if uid in rooms[room_id].users:
                    rooms[room_id].users[uid]['emotion'] = None
                
                ai_message = Message(
                    id=str(uuid.uuid4()),
                    userId=uid,
                    username=info['username'],
                    content=response_text,
                    timestamp=datetime.now().timestamp(),
                    videoTitle=video_title,
                    videoTimestamp=video_timestamp
                )
                
                rooms[room_id].messages.append(ai_message)
                if len(rooms[room_id].messages) > 50:
                    rooms[room_id].messages.pop(0)
                
                save_rooms()
                
                await manager.broadcast({
                    "type": "new_message",
                    "message": ai_message.dict()
                }, room_id)
                
                await asyncio.sleep(0.2)

        # Final user update to clear emotions
        if room_id in rooms:
             await manager.broadcast({
                "type": "users_update",
                "users": [
                    {
                        "id": uid,
                        "username": info['username'],
                        "avatar": info['avatar'],
                        "lastSeen": info['lastSeen'],
                        "emotion": info.get('emotion'),
                        "isAi": info.get('isAi', False),
                        "addedBy": info.get('addedBy'),
                        "addedByUsername": info.get('addedByUsername'),
                        "hasScript": info.get('hasScript', False)
                    }
                    for uid, info in rooms[room_id].users.items()
                ],
                "hostId": rooms[room_id].hostId
            }, room_id)

    except Exception as e:
        print(f"Error in group AI response: {e}")
        if room_id in rooms:
            for uid, _ in selected_ais:
                if uid in rooms[room_id].users:
                    rooms[room_id].users[uid]['emotion'] = None

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
                now = datetime.now().timestamp()
                user_data = data.get("user", {})
                is_ai = user_data.get('isAi', False)
                
                # 保留原有的 joinedAt 時間戳（如果存在）
                existing_user = rooms[room_id].users.get(user_id)
                joined_at = existing_user.get('joinedAt') if existing_user else now
                
                rooms[room_id].users[user_id] = {
                    'username': user_data.get('username', 'Guest'),
                    'avatar': user_data.get('avatar', ''),
                    'lastSeen': now,
                    'emotion': user_data.get('emotion'),
                    'spoilerPreference': user_data.get('spoilerPreference', 'show_all'),
                    'isAi': is_ai,
                    'joinedAt': joined_at  # 保持原有的加入時間
                }
                
                # 更新最後真實用戶時間
                if not is_ai:
                    rooms[room_id].lastRealUserSeenAt = now
                
                # 如果還沒有房主且當前用戶不是AI，設置為房主
                if not rooms[room_id].hostId and not is_ai:
                    rooms[room_id].hostId = user_id
                    print(f"Setting initial host for room {room_id}: {user_id}")
                
                # Broadcast updated user list with hostId
                await manager.broadcast({
                    "type": "users_update",
                    "users": [
                        {
                            "id": uid,
                            "username": info['username'],
                            "avatar": info['avatar'],
                            "lastSeen": info['lastSeen'],
                            "emotion": info.get('emotion'),
                            "spoilerPreference": info.get('spoilerPreference', 'show_all'),
                            "isAi": info.get('isAi', False),
                            "addedBy": info.get('addedBy'),
                            "addedByUsername": info.get('addedByUsername'),
                            "hasScript": info.get('hasScript', False)
                        }
                        for uid, info in rooms[room_id].users.items()
                    ],
                    "hostId": rooms[room_id].hostId
                }, room_id)

            elif event_type == "emotion":
                emotion = data.get("emotion")
                from_camera = data.get("from_camera", False)  # 檢查是否來自相機
                
                print(f"📩 Emotion update: user={user_id}, emotion={emotion}, from_camera={from_camera}")
                
                if room_id in rooms and user_id in rooms[room_id].users:
                    old_emotion = rooms[room_id].users[user_id].get('emotion')
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
                                "emotion": info.get('emotion'),
                                "isAi": info.get('isAi', False),
                                "addedBy": info.get('addedBy'),
                                "addedByUsername": info.get('addedByUsername'),
                                "hasScript": info.get('hasScript', False)
                            }
                            for uid, info in rooms[room_id].users.items()
                        ],
                        "hostId": rooms[room_id].hostId
                    }, room_id)

                    # AI Response Logic (Only if emotion changed, is not None, and NOT from camera)
                    # 相機偵測的情緒不觸發 AI 回應
                    if emotion and old_emotion != emotion and not from_camera:
                        print(f"🤖 Emotion changed and not from camera, AI may respond")
                        ai_companions = [(uid, u) for uid, u in rooms[room_id].users.items() if u.get('isAi')]
                        if ai_companions:
                            # 隨機選擇一個 AI 影伴回復
                            import random
                            import asyncio
                            
                            ai_uid, ai_info = random.choice(ai_companions)
                            
                            user_info = rooms[room_id].users[user_id]
                            room = rooms[room_id]
                            video_title = room.currentVideo.title if room.currentVideo else None
                            current_played = room.videoState.played
                            
                            # 設置準備發言狀態（使用 emoji）
                            rooms[room_id].users[ai_uid]['emotion'] = '💬'
                            await manager.broadcast({
                                "type": "users_update",
                                "users": [
                                    {
                                        "id": uid,
                                        "username": info['username'],
                                        "avatar": info['avatar'],
                                        "lastSeen": info['lastSeen'],
                                        "emotion": info.get('emotion'),
                                        "isAi": info.get('isAi', False),
                                        "addedBy": info.get('addedBy'),
                                        "addedByUsername": info.get('addedByUsername'),
                                        "hasScript": info.get('hasScript', False)
                                    }
                                    for uid, info in rooms[room_id].users.items()
                                ],
                                "hostId": rooms[room_id].hostId
                            }, room_id)
                            
                            # 延遲 0.5 秒
                            await asyncio.sleep(0.5)
                            
                            try:
                                video_id = room.currentVideo.videoId if room.currentVideo else "unknown"
                                video_context_str = get_video_context_str(video_id, current_played)

                                response_text = await generate_character_response(
                                    ch_name=ai_info['username'],
                                    ch_personality=ai_info.get('personalities') or ai_info.get('style', '友善的角色'),
                                    ch_style=ai_info.get('style', '友善的角色'),
                                    user_name=user_info['username'],
                                    user_input=f"(展現情緒: {emotion})",
                                    video_context_str=video_context_str
                                )
                                
                                ai_message = Message(
                                    id=str(uuid.uuid4()),
                                    userId=ai_uid,
                                    username=ai_info['username'],
                                    content=response_text,
                                    timestamp=datetime.now().timestamp(),
                                    videoTitle=video_title,
                                    videoTimestamp=current_played
                                )
                                
                                rooms[room_id].messages.append(ai_message)
                                save_rooms()
                                
                                await manager.broadcast({
                                    "type": "new_message",
                                    "message": ai_message.dict()
                                }, room_id)
                                
                                # 清除準備發言狀態
                                rooms[room_id].users[ai_uid]['emotion'] = None
                                await manager.broadcast({
                                    "type": "users_update",
                                    "users": [
                                        {
                                            "id": uid,
                                            "username": info['username'],
                                            "avatar": info['avatar'],
                                            "lastSeen": info['lastSeen'],
                                            "emotion": info.get('emotion'),
                                            "isAi": info.get('isAi', False),
                                            "addedBy": info.get('addedBy'),
                                            "addedByUsername": info.get('addedByUsername'),
                                            "hasScript": info.get('hasScript', False)
                                        }
                                        for uid, info in rooms[room_id].users.items()
                                    ],
                                    "hostId": rooms[room_id].hostId
                                }, room_id)
                            except Exception as e:
                                print(f"Failed to generate AI response: {e}")
                                # 即使失敗也要清除準備發言狀態
                                rooms[room_id].users[ai_uid]['emotion'] = None
                    elif from_camera:
                        print(f"📸 Emotion from camera, AI will NOT respond")
                    else:
                        print(f"ℹ️ No AI response triggered (emotion unchanged or None)")

            elif event_type == "chat":
                content = data.get("content")
                username = data.get("username")
                
                room = rooms[room_id]
                video_title = room.currentVideo.title if room.currentVideo else None
                video_id = room.currentVideo.id if room.currentVideo else None
                current_played = room.videoState.played
                
                # Get AI companions
                ai_users = {uid: u for uid, u in room.users.items() if u.get('isAi')}
                ai_companions = []
                for u in ai_users.values():
                    try:
                        ai_companions.append(AICompanion(
                            name=u.get('username', 'Unknown'),
                            style=u.get('style', ''),
                            catchphrase_1=u.get('catchphrase_1'),
                            catchphrase_2=u.get('catchphrase_2'),
                            avatar=u.get('avatar', '')
                        ))
                    except:
                        pass

                # Analyze message
                analysis_result = await analyze_message_and_select_companions(content, video_title, ai_companions)
                
                is_spoiler = analysis_result.get("is_spoiler", False)
                spoiler_reason = analysis_result.get("reason")
                selected_names = analysis_result.get("selected_companions", [])
                
                message = Message(
                    id=str(uuid.uuid4()),
                    userId=user_id,
                    username=username,
                    content=content,
                    timestamp=datetime.now().timestamp(),
                    isSpoiler=is_spoiler,
                    spoilerReason=spoiler_reason
                )
                rooms[room_id].messages.append(message)
                # Keep only last 50 messages
                if len(rooms[room_id].messages) > 50:
                    rooms[room_id].messages.pop(0)
                    
                await manager.broadcast({
                    "type": "new_message",
                    "message": message.dict()
                }, room_id)

                # Trigger AI responses
                if selected_names:
                    selected_uids = []
                    for name in selected_names:
                        for uid, u in ai_users.items():
                            if u.get('username') == name:
                                selected_uids.append((uid, u))
                                break
                    
                    if selected_uids:
                        import asyncio
                        asyncio.create_task(handle_group_ai_response(
                            room_id, selected_uids, username, content, video_id, video_title, current_played
                        ))


            elif event_type == "video_state":
                # 只有房主才能控制視頻進度
                if rooms[room_id].hostId != user_id:
                    # 非房主用戶嘗試控制，忽略請求
                    continue
                    
                state = data.get("state")
                current_state = rooms[room_id].videoState
                previous_played = current_state.played
                is_seek = data.get("isSeek", False)  # 標記是否為跳轉操作
                
                # 檢測是否為跳轉（played 變化超過 2 秒）
                if state.get("played") is not None:
                    time_diff = abs(state["played"] - current_state.played)
                    if time_diff > 2.0 or is_seek:
                        # 這是一個跳轉操作，生成新的 seekId
                        seek_id = str(uuid.uuid4())
                        current_state.pendingSeekId = seek_id
                        rooms[room_id].seekAcknowledgments[seek_id] = set()
                        # 房主自己自動確認
                        rooms[room_id].seekAcknowledgments[seek_id].add(user_id)
                        print(f"Seek detected in room {room_id}: seekId={seek_id}, played={state['played']}")
                
                # 更新所有狀態
                if state.get("playing") is not None:
                    current_state.playing = state["playing"]
                if state.get("played") is not None:
                    current_state.played = state["played"]
                if state.get("duration") is not None:
                    current_state.duration = state["duration"]
                if state.get("playbackRate") is not None:
                    current_state.playbackRate = state["playbackRate"]
                
                # Check for script triggers
                # Only trigger if playing, and played time advanced forward by a reasonable amount (e.g. < 5s)
                # This prevents triggering all events when seeking forward
                
                # Check for script triggers
                # Only trigger if playing, and played time advanced forward by a reasonable amount (e.g. < 5s)
                # This prevents triggering all events when seeking forward
                if (current_state.playing and 
                    state.get("played") is not None and 
                    rooms[room_id].currentVideo and 
                    previous_played < current_state.played and 
                    (current_state.played - previous_played) < 5.0):
                    
                    events = script_manager.get_triggered_events(
                        rooms[room_id].currentVideo.videoId, 
                        previous_played, 
                        current_state.played
                    )
                    
                    if events:
                        print(f"Found {len(events)} triggered events for video {rooms[room_id].currentVideo.videoId}")
                        await script_manager.handle_triggered_events(room_id, rooms[room_id], events, save_callback=save_rooms)

                # 更新時間戳記
                current_state.lastUpdated = datetime.now().timestamp()
                current_state.lastUpdatedBy = user_id
                
                # 廣播給房間內所有其他用戶
                await manager.broadcast({
                    "type": "video_state_update",
                    "state": {
                        "playing": current_state.playing,
                        "played": current_state.played,
                        "duration": current_state.duration,
                        "playbackRate": current_state.playbackRate,
                        "lastUpdated": current_state.lastUpdated,
                        "lastUpdatedBy": current_state.lastUpdatedBy,
                        "pendingSeekId": current_state.pendingSeekId
                    },
                    "sender": user_id
                }, room_id)

            elif event_type == "seek_ack":
                # 用戶確認已完成跳轉同步
                seek_id = data.get("seekId")
                if not seek_id:
                    continue
                
                room = rooms[room_id]
                
                # 記錄此用戶已完成同步
                if seek_id in room.seekAcknowledgments:
                    room.seekAcknowledgments[seek_id].add(user_id)
                    
                    # 檢查是否所有非 AI 用戶都已確認
                    non_ai_users = [uid for uid, info in room.users.items() if not info.get('isAi', False)]
                    acked_users = room.seekAcknowledgments[seek_id]
                    
                    print(f"Seek ack from {user_id} for seekId={seek_id}. Acked: {len(acked_users)}/{len(non_ai_users)}")
                    
                    # 如果所有非 AI 用戶都已確認，自動恢復播放
                    if all(uid in acked_users for uid in non_ai_users):
                        print(f"All users synced for seekId={seek_id}, auto-resuming playback")
                        
                        # 清除 pendingSeekId
                        if room.videoState.pendingSeekId == seek_id:
                            room.videoState.pendingSeekId = None
                        
                        # 自動恢復播放
                        room.videoState.playing = True
                        room.videoState.lastUpdated = datetime.now().timestamp()
                        
                        # 廣播恢復播放
                        await manager.broadcast({
                            "type": "video_state_update",
                            "state": {
                                "playing": True,
                                "played": room.videoState.played,
                                "duration": room.videoState.duration,
                                "playbackRate": room.videoState.playbackRate,
                                "lastUpdated": room.videoState.lastUpdated,
                                "lastUpdatedBy": room.hostId,
                                "pendingSeekId": None
                            },
                            "sender": "system",
                            "autoResumed": True
                        }, room_id)
                        
                        # 清理舊的確認記錄
                        del room.seekAcknowledgments[seek_id]

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

                # Update hasScript for AI companions
                for uid, u_info in room.users.items():
                    if u_info.get('isAi'):
                        companion_id = u_info.get('id')
                        has_script = script_manager.has_script(video['videoId'], companion_id)
                        u_info['hasScript'] = has_script

                await manager.broadcast({
                    "type": "play_video_update",
                    "videoState": room.videoState.dict(),
                    "currentVideo": room.currentVideo.dict(),
                    "history": [v.dict() for v in room.history]
                }, room_id)
                
                # Broadcast user update to reflect hasScript change
                await manager.broadcast({
                    "type": "users_update",
                    "users": [
                        {
                            "id": uid,
                            "username": info['username'],
                            "avatar": info['avatar'],
                            "lastSeen": info['lastSeen'],
                            "emotion": info.get('emotion'),
                            "isAi": info.get('isAi', False),
                            "addedBy": info.get('addedBy'),
                            "addedByUsername": info.get('addedByUsername'),
                            "hasScript": info.get('hasScript', False)
                        }
                        for uid, info in room.users.items()
                    ],
                    "hostId": room.hostId
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
            was_host = (rooms[room_id].hostId == user_id)
            del rooms[room_id].users[user_id]
            
            # 如果離開的是房主，重新分配房主
            if was_host:
                new_host = assign_new_host(rooms[room_id])
                print(f"Host {user_id} left room {room_id}, new host: {new_host}")
            
            # Broadcast user left with updated hostId
            await manager.broadcast({
                "type": "users_update",
                "users": [
                    {
                        "id": uid,
                        "username": info['username'],
                        "avatar": info['avatar'],
                        "lastSeen": info['lastSeen'],
                        "emotion": info.get('emotion'),
                        "isAi": info.get('isAi', False),
                        "addedBy": info.get('addedBy'),
                        "addedByUsername": info.get('addedByUsername')
                    }
                    for uid, info in rooms[room_id].users.items()
                ],
                "hostId": rooms[room_id].hostId
            }, room_id)
            
            save_rooms()
