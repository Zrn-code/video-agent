from fastapi import APIRouter, HTTPException, BackgroundTasks
from typing import List
import uuid
from datetime import datetime

from app.models.room import (
    Room, CreateRoomRequest, RoomInternal, VideoState, CurrentVideo, 
    HeartbeatRequest, ChatRequest, Message, UpdateStateRequest, VideoItem,
    AICompanion, ForumThread, ForumComment, CreateThreadRequest, CreateCommentRequest, UpdateThreadStatusRequest
)
from app.services.room_manager import rooms, get_room_response, cleanup_users, save_rooms
from app.services.connection_manager import manager
from app.services.ai_generator import generate_character_response, get_video_context_str, process_video
from app.services.script_manager import script_manager

router = APIRouter()

@router.get("/rooms", response_model=List[Room])
async def get_rooms():
    return [get_room_response(room) for room in rooms.values() if not room.isPrivate]

@router.post("/rooms", response_model=Room)
async def create_room(request: CreateRoomRequest):
    room_id = str(uuid.uuid4())
    now = datetime.now().timestamp()
    new_room = RoomInternal(
        id=room_id,
        name=request.name,
        description=request.description,
        videoState=VideoState(),
        aiCompanions=request.aiCompanions,
        isPrivate=request.isPrivate
    )
    new_room.createdAt = now
    new_room.lastRealUserSeenAt = now
    
    if request.aiCompanions:
        for companion in request.aiCompanions:
            # Check if script exists for this companion and the initial video
            has_script = False
            if request.initialPlaylist and len(request.initialPlaylist) > 0:
                first_video_id = request.initialPlaylist[0].videoId
                has_script = script_manager.has_script(first_video_id, companion.id)

            # Add AI companion as a user
            ai_user_id = f"ai-companion-{uuid.uuid4()}"
            new_room.users[ai_user_id] = {
                "id": companion.id,
                "username": companion.name,
                "avatar": companion.avatar,
                "lastSeen": now,
                "emotion": "neutral",
                "isAi": True,
                "style": companion.style,
                "personalities": companion.personalities,
                "language": companion.language,
                "catchphrase_1": companion.catchphrase_1,
                "catchphrase_2": companion.catchphrase_2,
                "joinedAt": now,
                "hasScript": has_script
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
    
    now = datetime.now().timestamp()
    rooms[room_id].users[request.userId] = {
        'username': request.username or 'Guest',
        'avatar': request.avatar or 'https://api.dicebear.com/7.x/avataaars/svg?seed=' + request.userId,
        'lastSeen': now,
        'joinedAt': now
    }
    
    # 更新最後真實用戶時間
    rooms[room_id].lastRealUserSeenAt = now
    
    # 如果還沒有房主，設置當前用戶為房主
    if not rooms[room_id].hostId:
        rooms[room_id].hostId = request.userId
    
    save_rooms()
    return get_room_response(rooms[room_id])

@router.post("/rooms/{room_id}/forum/threads", response_model=ForumThread)
async def create_forum_thread(room_id: str, request: CreateThreadRequest):
    if room_id not in rooms:
        raise HTTPException(status_code=404, detail="Room not found")
    
    now = datetime.now().timestamp()
    thread_id = str(uuid.uuid4())
    
    # 檢查作者是否為AI
    room = rooms[room_id]
    author = room.users.get(request.authorId)
    is_author_ai = author.get('isAi', False) if author else False
    
    new_thread = ForumThread(
        id=thread_id,
        title=request.title,
        content=request.content,
        authorId=request.authorId,
        authorName=request.authorName,
        authorIsAi=is_author_ai,
        authorAvatar=author.get('avatar') if author else None,
        createdAt=now,
        updatedAt=now,
        status="open",
        comments=[],
        isAutoCreated=False
    )
    
    rooms[room_id].forumThreads.append(new_thread)
    save_rooms()
    
    # Notify via WebSocket
    await manager.broadcast({
        "type": "forum_thread_created",
        "thread": new_thread.dict()
    }, room_id)
    
    return new_thread

@router.get("/rooms/{room_id}/forum/threads", response_model=List[ForumThread])
async def get_forum_threads(room_id: str):
    if room_id not in rooms:
        raise HTTPException(status_code=404, detail="Room not found")
    return rooms[room_id].forumThreads

@router.post("/rooms/{room_id}/forum/threads/{thread_id}/comments", response_model=ForumComment)
async def create_forum_comment(room_id: str, thread_id: str, request: CreateCommentRequest):
    if room_id not in rooms:
        raise HTTPException(status_code=404, detail="Room not found")
    
    room = rooms[room_id]
    thread = next((t for t in room.forumThreads if t.id == thread_id), None)
    if not thread:
        raise HTTPException(status_code=404, detail="Thread not found")
        
    now = datetime.now().timestamp()
    comment_id = str(uuid.uuid4())
    
    # 檢查用戶是否為AI
    user = room.users.get(request.userId)
    is_user_ai = user.get('isAi', False) if user else False
    
    new_comment = ForumComment(
        id=comment_id,
        userId=request.userId,
        username=request.username,
        content=request.content,
        timestamp=now,
        isAi=is_user_ai,
        avatar=user.get('avatar') if user else None
    )
    
    thread.comments.append(new_comment)
    thread.updatedAt = now
    save_rooms()
    
    await manager.broadcast({
        "type": "forum_comment_created",
        "threadId": thread_id,
        "comment": new_comment.dict()
    }, room_id)
    
    # 如果是真人發言且討論串狀態不是 completed，觸發 AI 自動回覆（只有一個 AI 回覆）
    if not is_user_ai and thread.status != "completed":
        ai_companions = [(uid, u) for uid, u in room.users.items() if u.get('isAi')]
        
        if ai_companions:
            # 選擇一個AI進行回覆（隨機選擇或選擇最近沒說話的）
            import random
            selected_ai = random.choice(ai_companions)
            ai_uid, ai_info = selected_ai
            
            try:
                # 構建討論串上下文
                thread_context = f"討論串標題: {thread.title}\n原始內容: {thread.content}\n"
                if thread.comments:
                    recent_comments = thread.comments[-3:]  # 最近3條評論
                    for c in recent_comments:
                        thread_context += f"{c.username}: {c.content}\n"
                
                # 使用討論串上下文作為 video_context_str
                video_context_str = f"討論串上下文:\n{thread_context}"
                
                ai_response_text = await generate_character_response(
                    ch_name=ai_info['username'],
                    ch_personality=ai_info.get('personalities') or ai_info.get('style', '友善的角色'),
                    ch_style=ai_info.get('style', '友善的角色'),
                    user_name=request.username,
                    user_input=request.content,
                    video_context_str=video_context_str
                )
                
                # 創建AI評論
                ai_comment_id = str(uuid.uuid4())
                ai_comment = ForumComment(
                    id=ai_comment_id,
                    userId=ai_uid,
                    username=ai_info['username'],
                    content=ai_response_text,
                    timestamp=datetime.now().timestamp(),
                    isAi=True,
                    avatar=ai_info.get('avatar')
                )
                
                thread.comments.append(ai_comment)
                thread.updatedAt = ai_comment.timestamp
                save_rooms()
                
                await manager.broadcast({
                    "type": "forum_comment_created",
                    "threadId": thread_id,
                    "comment": ai_comment.dict()
                }, room_id)
                
            except Exception as e:
                print(f"Failed to generate AI comment in forum: {e}")
    
    return new_comment

@router.put("/rooms/{room_id}/forum/threads/{thread_id}/status", response_model=ForumThread)
async def update_forum_thread_status(room_id: str, thread_id: str, request: UpdateThreadStatusRequest):
    if room_id not in rooms:
        raise HTTPException(status_code=404, detail="Room not found")
    
    room = rooms[room_id]
    thread = next((t for t in room.forumThreads if t.id == thread_id), None)
    if not thread:
        raise HTTPException(status_code=404, detail="Thread not found")
        
    thread.status = request.status
    thread.updatedAt = datetime.now().timestamp()
    save_rooms()
    
    await manager.broadcast({
        "type": "forum_thread_updated",
        "thread": thread.dict()
    }, room_id)
    
    return thread

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
    
    # AI Companion Response
    ai_companions = [(uid, u) for uid, u in room.users.items() if u.get('isAi')]
    if ai_companions:
        # Filter companions based on lastSpokenAt
        now_ts = datetime.now().timestamp()
        candidates = []
        for uid, info in ai_companions:
            last_spoken = info.get('lastSpokenAt', 0)
            if now_ts - last_spoken > 10:
                candidates.append((uid, info))
        
        selected_ai = None
        if candidates:
            import random
            selected_ai = random.choice(candidates)
        elif len(ai_companions) == 1:
            # Exception: if only one companion, allow it even if recently spoken
            selected_ai = ai_companions[0]
            
        if selected_ai:
            ai_uid, ai_info = selected_ai
        
            try:
                video_id = room.currentVideo.videoId if room.currentVideo else "unknown"
                video_context_str = get_video_context_str(video_id, current_played)

                response_text = await generate_character_response(
                    ch_name=ai_info['username'],
                    ch_personality=ai_info.get('personalities') or ai_info.get('style', '友善的角色'),
                    ch_style=ai_info.get('style', '友善的角色'),
                    user_name=request.username,
                    user_input=request.content,
                    video_context_str=video_context_str
                )
                
                # 判斷回應是否較長（超過100字或2句以上）
                is_long_response = len(response_text) > 50 
                
                if is_long_response:
                    # 創建討論串並發送提示訊息
                    thread_id = str(uuid.uuid4())
                    new_thread = ForumThread(
                        id=thread_id,
                        title=f"關於: {request.content[:30]}{'...' if len(request.content) > 30 else ''}",
                        content=response_text,
                        authorId=ai_uid,
                        authorName=ai_info['username'],
                        authorIsAi=True,
                        authorAvatar=ai_info.get('avatar'),
                        createdAt=now_ts,
                        updatedAt=now_ts,
                        status="open",
                        comments=[],
                        isAutoCreated=True,
                        originalMessageId=message.id
                    )
                    
                    room.forumThreads.append(new_thread)
                    
                    # 發送提示訊息到聊天室
                    hint_message = Message(
                        id=str(uuid.uuid4()),
                        userId=ai_uid,
                        username=ai_info['username'],
                        content=f"我的回應比較詳細，已經貼到討論串了喔！請到討論區查看～",
                        timestamp=now_ts,
                        videoTitle=video_title,
                        videoTimestamp=current_played
                    )
                    
                    room.users[ai_uid]['lastSpokenAt'] = now_ts
                    rooms[room_id].messages.append(hint_message)
                    save_rooms()
                    
                    # 廣播討論串創建和提示訊息
                    await manager.broadcast({
                        "type": "forum_thread_created",
                        "thread": new_thread.dict()
                    }, room_id)
                    
                    await manager.broadcast({
                        "type": "new_message",
                        "message": hint_message.dict()
                    }, room_id)
                else:
                    # 正常發送到聊天室
                    ai_message = Message(
                        id=str(uuid.uuid4()),
                        userId=ai_uid,
                        username=ai_info['username'],
                        content=response_text,
                        timestamp=now_ts,
                        videoTitle=video_title,
                        videoTimestamp=current_played
                    )
                    
                    # Update lastSpokenAt
                    room.users[ai_uid]['lastSpokenAt'] = ai_message.timestamp
                    
                    rooms[room_id].messages.append(ai_message)
                    save_rooms()
                    
                    await manager.broadcast({
                        "type": "new_message",
                        "message": ai_message.dict()
                    }, room_id)
            except Exception as e:
                print(f"Failed to generate AI response: {e}")

    return message

@router.post("/rooms/{room_id}/leave")
async def leave_room(room_id: str, request: HeartbeatRequest):
    if room_id not in rooms:
        raise HTTPException(status_code=404, detail="Room not found")
    
    room = rooms[room_id]
    is_host = room.hostId == request.userId
    
    if request.userId in room.users:
        del room.users[request.userId]
    
    # Host migration
    if is_host and room.users:
        # Filter for real users (not AI)
        real_users = [
            (uid, u) for uid, u in room.users.items() 
            if not u.get('isAi', False)
        ]
        
        if real_users:
            # Sort by joinedAt
            real_users.sort(key=lambda x: x[1].get('joinedAt', float('inf')))
            new_host_id = real_users[0][0]
            room.hostId = new_host_id
            
            # Broadcast update
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
                    for uid, info in room.users.items()
                ],
                "hostId": room.hostId
            }, room_id)
    
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
    
    room = rooms[room_id]
    current_state = room.videoState
    previous_played = current_state.played
    
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
    
    # Check for script triggers
    # Only trigger if playing, and played time advanced forward by a reasonable amount (e.g. < 5s)
    # This prevents triggering all events when seeking forward
    if (current_state.playing and 
        state.played is not None and 
        room.currentVideo and 
        previous_played < current_state.played and 
        (current_state.played - previous_played) < 5.0):
        
        # print(f"Checking triggers for {room.currentVideo.videoId}: {previous_played:.2f} -> {current_state.played:.2f}")
        
        events = script_manager.get_triggered_events(
            room.currentVideo.videoId, 
            previous_played, 
            current_state.played
        )
        
        if events:
            print(f"Found {len(events)} triggered events for video {room.currentVideo.videoId}")
            await script_manager.handle_triggered_events(room_id, room, events)
    
    save_rooms()
    return current_state

@router.post("/rooms/{room_id}/queue")
async def add_to_queue(room_id: str, video: VideoItem, background_tasks: BackgroundTasks):
    if room_id not in rooms:
        raise HTTPException(status_code=404, detail="Room not found")
    rooms[room_id].queue.append(video)
    save_rooms()
    
    # Trigger background processing
    background_tasks.add_task(process_video, video.videoId)
    
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
    
    # Check if companion already exists
    for u in room.users.values():
        if u.get('isAi') and u.get('username') == companion.name:
             raise HTTPException(status_code=400, detail="Companion already exists in the room")

    # Check if script exists for this companion and the current video
    has_script = False
    if room.currentVideo:
        has_script = script_manager.has_script(room.currentVideo.videoId, companion.id)

    # Add AI companion as a user
    ai_user_id = f"ai-companion-{uuid.uuid4()}"
    room.users[ai_user_id] = {
        "id": companion.id, # Store the companion ID (e.g. "1", "2") for script matching
        "username": companion.name,
        "avatar": companion.avatar,
        "lastSeen": datetime.now().timestamp(),
        "emotion": "neutral",
        "isAi": True,
        "style": companion.style,
        "personalities": companion.personalities,
        "language": companion.language,
        "catchphrase_1": companion.catchphrase_1,
        "catchphrase_2": companion.catchphrase_2,
        "addedBy": companion.addedBy,
        "addedByUsername": companion.addedByUsername,
        "hasScript": has_script
    }
    
    # Update room's aiCompanions field
    if room.aiCompanions is None:
        room.aiCompanions = []
    room.aiCompanions.append(companion)
    
    save_rooms()
    
    # Broadcast user update
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

    return get_room_response(room)

@router.delete("/rooms/{room_id}/ai-companion/{companion_name}")
async def remove_ai_companion(room_id: str, companion_name: str, userId: str):
    if room_id not in rooms:
        raise HTTPException(status_code=404, detail="Room not found")
    
    room = rooms[room_id]
    
    # Find the companion in users
    target_uid = None
    target_user = None
    for uid, u in room.users.items():
        if u.get('isAi') and u.get('username') == companion_name:
            target_uid = uid
            target_user = u
            break
            
    if not target_uid:
        raise HTTPException(status_code=404, detail="Companion not found")
        
    # Check ownership
    # Allow if user is the one who added it OR user is host
    if target_user.get('addedBy') != userId and room.hostId != userId:
        raise HTTPException(status_code=403, detail="Not authorized to remove this companion")
        
    # Remove from users
    del room.users[target_uid]
    
    # Remove from aiCompanions list
    if room.aiCompanions:
        room.aiCompanions = [c for c in room.aiCompanions if c.name != companion_name]
        
    save_rooms()
    
    # Broadcast user update
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
    
    return get_room_response(room)
