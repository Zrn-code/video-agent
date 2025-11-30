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
            playing=False,
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
                    "lastSeen": now
                }
        
        rooms[room_id] = new_room

def cleanup_users(room: RoomInternal):
    now = datetime.now().timestamp()
    # Remove users inactive for more than 10 seconds (but keep mock users and AI companions)
    room.users = {
        uid: info 
        for uid, info in room.users.items() 
        if (now - info['lastSeen'] < 10) or uid.startswith('mock-user-') or info.get('isAi', False)
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
            emotion=info.get('emotion'),
            isAi=info.get('isAi', False)
        )
        for uid, info in room.users.items()
    ]
    
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
        aiCompanion=room.aiCompanion
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
