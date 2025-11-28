import uuid
import random
import asyncio
from datetime import datetime
from typing import Dict, List
from app.models.room import RoomInternal, VideoState, CurrentVideo, User, Room

# In-memory storage
rooms: Dict[str, RoomInternal] = {}

def init_demo_rooms():
    # 創建永久測試房間
    test_room_id = "test-room-permanent"
    now = datetime.now().timestamp()
    
    test_room = RoomInternal(
        id=test_room_id,
        name="🧪 測試房間 (永久)",
        videoState=VideoState(
            url="https://www.youtube.com/watch?v=dQw4w9WgXcQ",
            playing=True,
            played=0,
            duration=212.0,  # Rick Astley - Never Gonna Give You Up 的長度
            playbackRate=1.0,
            lastUpdated=now
        )
    )
    
    test_room.currentVideo = CurrentVideo(
        videoId="dQw4w9WgXcQ",
        title="Rick Astley - Never Gonna Give You Up (Official Video)",
        channelTitle="Rick Astley",
        thumbnailUrl="https://img.youtube.com/vi/dQw4w9WgXcQ/mqdefault.jpg"
    )
    
    rooms[test_room_id] = test_room
    
    # 創建示範房間
    demo_rooms = [
        {
            "name": "Action Movies 🎬", 
            "url": "https://www.youtube.com/watch?v=oUFJJNQGwhk",
            "currentVideo": {
                "videoId": "oUFJJNQGwhk",
                "title": "Top Gun: Maverick Official Trailer",
                "channelTitle": "Paramount Pictures",
                "thumbnailUrl": "https://img.youtube.com/vi/oUFJJNQGwhk/mqdefault.jpg"
            },
            "mockUsers": [
                {"id": "mock-user-1", "username": "MovieFan123", "avatar": "https://api.dicebear.com/7.x/avataaars/svg?seed=MovieFan123"},
                {"id": "mock-user-2", "username": "ActionLover", "avatar": "https://api.dicebear.com/7.x/avataaars/svg?seed=ActionLover"},
                {"id": "mock-user-3", "username": "CinemaKing", "avatar": "https://api.dicebear.com/7.x/avataaars/svg?seed=CinemaKing"},
            ]
        },
        {
            "name": "Tech Talk 💻", 
            "url": "https://www.youtube.com/watch?v=jNgP6d9HraI",
            "currentVideo": {
                "videoId": "jNgP6d9HraI",
                "title": "The Future of AI and Technology",
                "channelTitle": "Tech Channel",
                "thumbnailUrl": "https://img.youtube.com/vi/jNgP6d9HraI/mqdefault.jpg"
            },
            "mockUsers": [
                {"id": "mock-user-8", "username": "TechGuru", "avatar": "https://api.dicebear.com/7.x/avataaars/svg?seed=TechGuru"},
                {"id": "mock-user-9", "username": "CodeMaster", "avatar": "https://api.dicebear.com/7.x/avataaars/svg?seed=CodeMaster"},
                {"id": "mock-user-10", "username": "DevPro", "avatar": "https://api.dicebear.com/7.x/avataaars/svg?seed=DevPro"},
            ]
        }
    ]

    for demo in demo_rooms:
        room_id = str(uuid.uuid4())
        now = datetime.now().timestamp()
        
        # 創建初始視頻狀態（假設播放中，隨機進度）
        initial_played = random.uniform(10, 60)  # 10-60秒的隨機進度
        new_room = RoomInternal(
            id=room_id,
            name=demo["name"],
            videoState=VideoState(
                url=demo["url"],
                playing=True,
                played=initial_played,
                duration=180.0,  # 假設3分鐘長度
                playbackRate=1.0,
                lastUpdated=now
            )
        )
        
        # Set current video
        if "currentVideo" in demo:
            new_room.currentVideo = CurrentVideo(**demo["currentVideo"])
        
        # Add mock users with random emotions
        emotions = ['Happy', 'Neutral', 'Sad', 'Surprise', 'Excited']
        for mock_user in demo.get("mockUsers", []):
            new_room.users[mock_user["id"]] = {
                "username": mock_user["username"],
                "avatar": mock_user["avatar"],
                "lastSeen": now,
                "emotion": random.choice(emotions)
            }
        
        rooms[room_id] = new_room

def cleanup_users(room: RoomInternal):
    now = datetime.now().timestamp()
    # Remove users inactive for more than 10 seconds (but keep mock users)
    room.users = {
        uid: info 
        for uid, info in room.users.items() 
        if (now - info['lastSeen'] < 10) or uid.startswith('mock-user-')
    }
    # Remove messages older than 15 seconds
    room.messages = [m for m in room.messages if now - m.timestamp < 15]

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
        lastUpdated=now
    )

    users_list = [
        User(
            id=uid,
            username=info['username'],
            avatar=info['avatar'],
            lastSeen=info['lastSeen'],
            emotion=info.get('emotion')
        )
        for uid, info in room.users.items()
    ]
    return Room(
        id=room.id,
        name=room.name,
        description=room.description,
        userCount=len(room.users),
        users=users_list,
        videoState=response_video_state,
        currentVideo=room.currentVideo,
        queue=room.queue,
        history=room.history,
        messages=room.messages
    )

async def update_mock_emotions():
    """Update mock user emotions and demo room playback every few seconds"""
    emotions = ['Happy', 'Neutral', 'Sad', 'Surprise', 'Excited', 'Thinking', 'Laughing']
    while True:
        await asyncio.sleep(random.uniform(3, 8))
        
        # 暫時停用自動刪除空房間的功能
        # Cleanup empty rooms (except demo rooms and permanent test room)
        # permanent_room_id = "test-room-permanent"
        # for room_id in list(rooms.keys()):
        #     if room_id == permanent_room_id:
        #         continue  # 永久測試房間不刪除
        #     
        #     room = rooms[room_id]
        #     cleanup_users(room)
        #     if len(room.users) == 0:
        #         del rooms[room_id]
        #         continue

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

# Initialize demo rooms on module load
init_demo_rooms()
