import uuid
import random
import asyncio
import json
import os
from datetime import datetime
from typing import Dict, List
from app.models.room import RoomInternal, VideoState, CurrentVideo, User, Room
from app.services.script_manager import script_manager

# In-memory storage
rooms: Dict[str, RoomInternal] = {}
DB_FILE = "rooms_db.json"

# Load scripts on startup
script_manager.load_scripts()

def save_rooms():
    try:
        data = {rid: room.to_dict() for rid, room in rooms.items()}
        with open(DB_FILE, 'w', encoding='utf-8') as f:
            json.dump(data, f, ensure_ascii=False, indent=2)
    except Exception as e:
        print(f"Error saving rooms: {e}")

def load_rooms():
    if not os.path.exists(DB_FILE):
        return False
    
    try:
        with open(DB_FILE, 'r', encoding='utf-8') as f:
            data = json.load(f)
            
        rooms.clear()
        for rid, room_data in data.items():
            rooms[rid] = RoomInternal.from_dict(room_data)
        print(f"Loaded {len(rooms)} rooms from {DB_FILE}")
        return True
    except Exception as e:
        print(f"Error loading rooms: {e}")
        return False

def init_demo_rooms():
    # Try to load from file first
    if load_rooms() and len(rooms) > 0:
        return

    # 創建永久測試房間
    test_room_id = "test-room-permanent"
    now = datetime.now().timestamp()
    
    test_room = RoomInternal(
        id=test_room_id,
        name="🧪 測試房間 (永久)",
        videoState=VideoState(
            url="https://www.youtube.com/watch?v=dQw4w9WgXcQ",
            playing=False,
            played=0,
            duration=212.0,  # Rick Astley - Never Gonna Give You Up 的長度
            playbackRate=1.0,
            lastUpdated=now
        )
    )
    test_room.createdAt = now
    test_room.lastRealUserSeenAt = now
    
    test_room.currentVideo = CurrentVideo(
        videoId="dQw4w9WgXcQ",
        title="Rick Astley - Never Gonna Give You Up (Official Video)",
        channelTitle="Rick Astley",
        thumbnailUrl="https://img.youtube.com/vi/dQw4w9WgXcQ/mqdefault.jpg"
    )
    
    rooms[test_room_id] = test_room
    
    # Sample videos for variety
    sample_videos = [
        {
            "url": "https://www.youtube.com/watch?v=jfKfPfyJRdk",
            "videoId": "jfKfPfyJRdk",
            "title": "lofi hip hop radio - beats to relax/study to",
            "channelTitle": "Lofi Girl",
            "thumbnailUrl": "https://img.youtube.com/vi/jfKfPfyJRdk/mqdefault.jpg"
        },
        {
            "url": "https://www.youtube.com/watch?v=K4TOrB7at0Y",
            "videoId": "K4TOrB7at0Y",
            "title": "Relaxing Jazz Piano Radio - Slow Jazz Music",
            "channelTitle": "Cafe Music BGM",
            "thumbnailUrl": "https://img.youtube.com/vi/K4TOrB7at0Y/mqdefault.jpg"
        },
        {
            "url": "https://www.youtube.com/watch?v=5qap5aO4i9A",
            "videoId": "5qap5aO4i9A",
            "title": "lofi hip hop radio - beats to sleep/chill to",
            "channelTitle": "Lofi Girl",
            "thumbnailUrl": "https://img.youtube.com/vi/5qap5aO4i9A/mqdefault.jpg"
        },
        {
            "url": "https://www.youtube.com/watch?v=LXb3EKWsInQ",
            "videoId": "LXb3EKWsInQ",
            "title": "COSTA RICA IN 4K 60fps HDR (ULTRA HD)",
            "channelTitle": "Jacob + Katie Schwarz",
            "thumbnailUrl": "https://img.youtube.com/vi/LXb3EKWsInQ/mqdefault.jpg"
        },
        {
            "url": "https://www.youtube.com/watch?v=tO01J-M3g0U",
            "videoId": "tO01J-M3g0U",
            "title": "The Bull of Wall Street | The Wolf of Wall Street",
            "channelTitle": "Flashback FM",
            "thumbnailUrl": "https://img.youtube.com/vi/tO01J-M3g0U/mqdefault.jpg"
        }
    ]

    # Generate 5 rooms (Total 6 with the permanent one)
    for i in range(1, 6):
        room_id = f"test-room-{i}"
        video_info = sample_videos[i % len(sample_videos)]
        
        new_room = RoomInternal(
            id=room_id,
            name=f"測試房間 #{i:03d}",
            videoState=VideoState(
                url=video_info["url"],
                playing=False,
                played=0,
                duration=180.0,
                playbackRate=1.0,
                lastUpdated=now
            )
        )
        new_room.createdAt = now
        new_room.lastRealUserSeenAt = 0.0  # 初始為0，等待真實用戶加入
        
        new_room.currentVideo = CurrentVideo(
            videoId=video_info["videoId"],
            title=video_info["title"],
            channelTitle=video_info["channelTitle"],
            thumbnailUrl=video_info["thumbnailUrl"]
        )
        
        # Add some random mock users to make it look alive
        if random.random() > 0.3: # 70% chance to have users
            num_users = random.randint(1, 5)
            for j in range(num_users):
                user_id = f"mock-user-{i}-{j}"
                new_room.users[user_id] = {
                    "username": f"User_{random.randint(1000, 9999)}",
                    "avatar": f"https://api.dicebear.com/7.x/avataaars/svg?seed={user_id}",
                    "lastSeen": now,
                    "isAi": True  # 標記 mock 用戶為 AI，不算真實用戶
                }
        
        rooms[room_id] = new_room
    
    save_rooms()

def cleanup_users(room: RoomInternal):
    now = datetime.now().timestamp()
    # Remove users inactive for more than 10 seconds (but keep mock users and AI companions)
    
    users_to_remove = []
    for uid, info in room.users.items():
        # Skip mock users and AI
        if uid.startswith('mock-user-') or info.get('isAi', False):
            continue
            
        if now - info['lastSeen'] >= 10:
            users_to_remove.append(uid)
    
    if not users_to_remove:
        return

    host_removed = False
    for uid in users_to_remove:
        if room.hostId == uid:
            host_removed = True
        if uid in room.users:
            del room.users[uid]
        
    if host_removed:
        print(f"Host {room.hostId} timed out in room {room.id}, assigning new host...")
        assign_new_host(room)
    
    # Messages are now persisted, no cleanup based on time
    # room.messages = [m for m in room.messages if now - m.timestamp < 15]

def assign_new_host(room: RoomInternal):
    """為房間分配新的房主（最早加入的非AI用戶）"""
    # 找出所有非AI的真實用戶，按加入時間排序
    real_users = [
        (uid, info) 
        for uid, info in room.users.items() 
        if not info.get('isAi', False)
    ]
    
    if real_users:
        # 按加入時間排序，選擇最早加入的
        real_users.sort(key=lambda x: x[1].get('joinedAt', 0))
        new_host_id = real_users[0][0]
        room.hostId = new_host_id
        return new_host_id
    else:
        # 沒有真實用戶，清空房主
        room.hostId = None
        return None

def get_room_response(room: RoomInternal) -> Room:
    cleanup_users(room)
    
    # Extrapolate played time based on server state
    current_played = room.videoState.played
    now = datetime.now().timestamp()
    
    if room.videoState.playing and room.videoState.lastUpdated > 0:
        diff = now - room.videoState.lastUpdated
        if diff > 0:
            current_played += diff * room.videoState.playbackRate
    
    # Clamp to duration if available
    if room.videoState.duration > 0 and current_played > room.videoState.duration:
        current_played = room.videoState.duration

    response_video_state = VideoState(
        url=room.videoState.url,
        playing=room.videoState.playing,
        played=current_played,
        duration=room.videoState.duration,
        playbackRate=room.videoState.playbackRate,
        lastUpdated=now,
        lastUpdatedBy=room.videoState.lastUpdatedBy
    )

    users_list = []
    for uid, info in room.users.items():
        has_script = False
        if info.get('isAi', False) and room.currentVideo:
            # Check if this AI has a script for the current video
            # We need companion ID. It should be in info['id'] if we populated it correctly.
            # If not, we might need to rely on username or something else, but we added 'id' to info.
            companion_id = info.get('id')
            if companion_id:
                has_script = script_manager.has_script(room.currentVideo.videoId, companion_id)
        
        users_list.append(User(
            id=uid,
            username=info['username'],
            avatar=info['avatar'],
            lastSeen=info['lastSeen'],
            emotion=info.get('emotion'),
            isAi=info.get('isAi', False),
            hasScript=has_script
        ))
    
    return Room(
        id=room.id,
        name=room.name,
        description=room.description,
        userCount=len(users_list),
        users=users_list,
        videoState=response_video_state,
        currentVideo=room.currentVideo,
        queue=room.queue,
        history=room.history,
        messages=room.messages,
        forumThreads=room.forumThreads,
        aiCompanions=room.aiCompanions,
        hostId=room.hostId
    )

async def update_mock_emotions():
    """Update mock user emotions and demo room playback every few seconds"""
    emotions = ['Happy', 'Neutral', 'Sad', 'Surprise', 'Excited', 'Thinking', 'Laughing']
    while True:
        await asyncio.sleep(random.uniform(3, 8))
        
        # 檢查並關閉空房間（5分鐘無真實用戶）
        now = datetime.now().timestamp()
        permanent_room_id = "test-room-permanent"
        for room_id in list(rooms.keys()):
            if room_id == permanent_room_id:
                continue  # 永久測試房間不刪除
            
            room = rooms[room_id]
            cleanup_users(room)
            
            # 檢查是否有真實用戶
            has_real_users = any(not info.get('isAi', False) for info in room.users.values())
            
            if has_real_users:
                # 更新最後有真實用戶的時間
                room.lastRealUserSeenAt = now
            else:
                # 沒有真實用戶，檢查是否超過5分鐘
                # 如果 lastRealUserSeenAt 是 0，使用 createdAt 作為起始時間
                reference_time = room.lastRealUserSeenAt if room.lastRealUserSeenAt > 0 else room.createdAt
                
                if reference_time > 0 and (now - reference_time) > 300:  # 5分鐘 = 300秒
                    print(f"Closing empty room {room_id} after 5 minutes of no real users (last seen: {reference_time}, created: {room.createdAt})")
                    del rooms[room_id]
                    save_rooms()
                    continue

        for room in rooms.values():
            # Update mock users emotions
            for user_id, user_info in room.users.items():
                if user_id.startswith('mock-user-'):
                    # Randomly change emotion
                    if random.random() < 0.4:  # 40% chance to change
                        user_info['emotion'] = random.choice(emotions)
                        user_info['lastSeen'] = datetime.now().timestamp()
            
            # Update demo room playback state (for rooms with mock users)
            has_mock_users = any(uid.startswith('mock-user-') for uid in room.users.keys())
            if has_mock_users and room.videoState.playing:
                # Simulate playback progress
                now = datetime.now().timestamp()
                elapsed = now - room.videoState.lastUpdated
                room.videoState.played += elapsed * room.videoState.playbackRate
                room.videoState.lastUpdated = now
                
                # Loop if reached end
                if room.videoState.duration > 0 and room.videoState.played >= room.videoState.duration:
                    room.videoState.played = 0
        
        save_rooms()

async def update_ai_random_emotions():
    """每10-15秒為所有AI影伴隨機更新emoji狀態，顯示3秒後清除"""
    ai_emotions = ['😊', '😎', '🤔', '😴', '🎵', '👀', '💭', '✨']
    
    while True:
        # 每10-15秒隨機觸發一次
        await asyncio.sleep(random.uniform(10, 15))
        
        from app.services.connection_manager import manager
        
        for room_id, room in rooms.items():
            updated = False
            # 只更新AI影伴的狀態，但不干擾正在準備發言的AI
            for user_id, user_info in room.users.items():
                if user_info.get('isAi', False):
                    # 如果正在準備發言（💬），跳過
                    if user_info.get('emotion') == '💬':
                        continue
                    
                    # 50% 機率顯示隨機emoji
                    if random.random() < 0.5:
                        user_info['emotion'] = random.choice(ai_emotions)
                        user_info['lastSeen'] = datetime.now().timestamp()
                        updated = True
            
            # 如果有更新，廣播給房間內的所有用戶
            if updated:
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
                    ]
                }, room_id)
                
                # 3秒後清除這些emoji狀態
                await asyncio.sleep(3)
                
                for user_id, user_info in room.users.items():
                    if user_info.get('isAi', False) and user_info.get('emotion') != '💬':
                        user_info['emotion'] = None
                
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
                    ]
                }, room_id)
        
        save_rooms()

# Initialize demo rooms on module load
init_demo_rooms()
