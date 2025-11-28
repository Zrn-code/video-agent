from fastapi import FastAPI, HTTPException, UploadFile, File
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from typing import List, Optional, Dict
import uuid
from datetime import datetime, timedelta
import json
import hashlib
import os
import shutil
from dotenv import load_dotenv
from google import genai
import requests
import random
import asyncio

# Load environment variables
load_dotenv()

# Configure Gemini
GOOGLE_API_KEY = os.getenv("GOOGLE_API_KEY")
YOUTUBE_API_KEY = os.getenv("YOUTUBE_API_KEY")
if GOOGLE_API_KEY:
    client = genai.Client(api_key=GOOGLE_API_KEY)

app = FastAPI()

# Configure CORS
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # In production, replace with specific origins
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Models
class VideoState(BaseModel):
    url: str = ""
    playing: bool = False
    played: float = 0.0
    playbackRate: float = 1.0
    lastUpdated: float = 0.0

class CurrentVideo(BaseModel):
    videoId: str
    title: str
    channelTitle: str
    thumbnailUrl: str

class VideoItem(BaseModel):
    videoId: str
    title: str
    channelTitle: str
    thumbnailUrl: str
    addedBy: Optional[str] = None

class Message(BaseModel):
    id: str
    userId: str
    username: str
    content: str
    timestamp: float

class User(BaseModel):
    id: str
    username: str
    avatar: str
    lastSeen: float
    emotion: Optional[str] = None

class Room(BaseModel):
    id: str
    name: str
    description: Optional[str] = None
    userCount: int = 0
    users: List[User] = []
    videoState: VideoState
    currentVideo: Optional[CurrentVideo] = None
    queue: List[VideoItem] = []
    history: List[VideoItem] = []
    messages: List[Message] = []

class RoomInternal:
    def __init__(self, id, name, videoState, description=None):
        self.id = id
        self.name = name
        self.description = description
        self.videoState = videoState
        self.currentVideo: Optional[CurrentVideo] = None
        self.users: Dict[str, Dict] = {} # user_id -> {username, avatar, last_heartbeat_timestamp}
        self.queue: List[VideoItem] = []
        self.history: List[VideoItem] = []
        self.messages: List[Message] = []

class CreateRoomRequest(BaseModel):
    name: str
    description: Optional[str] = None
    initialPlaylist: Optional[List[VideoItem]] = []

class UpdateStateRequest(BaseModel):
    url: Optional[str] = None
    playing: Optional[bool] = None
    played: Optional[float] = None
    playbackRate: Optional[float] = None

class ChatRequest(BaseModel):
    userId: str
    username: str
    content: str

class UserProfile(BaseModel):
    userId: str
    username: str
    avatar: str

class HeartbeatRequest(BaseModel):
    userId: str
    username: Optional[str] = None
    avatar: Optional[str] = None
    emotion: Optional[str] = None

# In-memory storage
rooms: Dict[str, RoomInternal] = {}

# Initialize some demo rooms with mock users
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
        "name": "Chill Vibes 🎵", 
        "url": "https://www.youtube.com/watch?v=jfKfPfyJRdk",
        "currentVideo": {
            "videoId": "jfKfPfyJRdk",
            "title": "Lofi Hip Hop Radio - Beats to Relax/Study",
            "channelTitle": "Lofi Girl",
            "thumbnailUrl": "https://img.youtube.com/vi/jfKfPfyJRdk/mqdefault.jpg"
        },
        "mockUsers": [
            {"id": "mock-user-4", "username": "ChillVibes", "avatar": "https://api.dicebear.com/7.x/avataaars/svg?seed=ChillVibes"},
            {"id": "mock-user-5", "username": "StudyBuddy", "avatar": "https://api.dicebear.com/7.x/avataaars/svg?seed=StudyBuddy"},
            {"id": "mock-user-6", "username": "RelaxMode", "avatar": "https://api.dicebear.com/7.x/avataaars/svg?seed=RelaxMode"},
            {"id": "mock-user-7", "username": "LofiLover", "avatar": "https://api.dicebear.com/7.x/avataaars/svg?seed=LofiLover"},
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
    new_room = RoomInternal(
        id=room_id,
        name=demo["name"],
        videoState=VideoState(url=demo["url"])
    )
    
    # Set current video
    if "currentVideo" in demo:
        new_room.currentVideo = CurrentVideo(**demo["currentVideo"])
    
    # Add mock users with random emotions
    now = datetime.now().timestamp()
    emotions = ['Happy', 'Neutral', 'Sad', 'Surprise', 'Excited']
    for mock_user in demo.get("mockUsers", []):
        new_room.users[mock_user["id"]] = {
            "username": mock_user["username"],
            "avatar": mock_user["avatar"],
            "lastSeen": now,
            "emotion": random.choice(emotions)
        }
    
    rooms[room_id] = new_room

# Background task to update mock user emotions
async def update_mock_emotions():
    """Update mock user emotions every 3-8 seconds"""
    emotions = ['Happy', 'Neutral', 'Sad', 'Surprise', 'Excited', 'Thinking', 'Laughing']
    while True:
        await asyncio.sleep(random.uniform(3, 8))
        
        # Cleanup empty rooms (except demo rooms which might have mock users)
        # We need to iterate over a copy of keys because we might delete items
        for room_id in list(rooms.keys()):
            room = rooms[room_id]
            cleanup_users(room)
            # If room has no users and is not a demo room (demo rooms have mock users, so they won't be empty unless we strip mock users)
            # Actually, cleanup_users keeps mock users. So if len(users) == 0, it's truly empty.
            if len(room.users) == 0:
                del rooms[room_id]
                continue

        for room in rooms.values():
            for user_id, user_info in room.users.items():
                if user_id.startswith('mock-user-'):
                    # Randomly change emotion
                    if random.random() < 0.4:  # 40% chance to change
                        user_info['emotion'] = random.choice(emotions)
                        user_info['lastSeen'] = datetime.now().timestamp()

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
        videoState=room.videoState,
        currentVideo=room.currentVideo,
        queue=room.queue,
        history=room.history,
        messages=room.messages
    )

@app.get("/api/rooms", response_model=List[Room])
async def get_rooms():
    return [get_room_response(room) for room in rooms.values()]

@app.post("/api/rooms", response_model=Room)
async def create_room(request: CreateRoomRequest):
    room_id = str(uuid.uuid4())
    new_room = RoomInternal(
        id=room_id,
        name=request.name,
        description=request.description,
        videoState=VideoState()
    )
    
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
    return get_room_response(new_room)

@app.get("/api/rooms/{room_id}", response_model=Room)
async def get_room(room_id: str):
    if room_id not in rooms:
        raise HTTPException(status_code=404, detail="Room not found")
    return get_room_response(rooms[room_id])

@app.post("/api/rooms/{room_id}/join")
async def join_room(room_id: str, request: HeartbeatRequest):
    if room_id not in rooms:
        raise HTTPException(status_code=404, detail="Room not found")
    
    rooms[room_id].users[request.userId] = {
        'username': request.username or 'Guest',
        'avatar': request.avatar or 'https://api.dicebear.com/7.x/avataaars/svg?seed=' + request.userId,
        'lastSeen': datetime.now().timestamp()
    }
    return get_room_response(rooms[room_id])

@app.post("/api/rooms/{room_id}/heartbeat")
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

@app.post("/api/rooms/{room_id}/chat")
async def send_chat(room_id: str, request: ChatRequest):
    if room_id not in rooms:
        raise HTTPException(status_code=404, detail="Room not found")
    
    message = Message(
        id=str(uuid.uuid4()),
        userId=request.userId,
        username=request.username,
        content=request.content,
        timestamp=datetime.now().timestamp()
    )
    
    rooms[room_id].messages.append(message)
    return message

@app.post("/api/rooms/{room_id}/leave")
async def leave_room(room_id: str, request: HeartbeatRequest):
    if room_id not in rooms:
        raise HTTPException(status_code=404, detail="Room not found")
    
    if request.userId in rooms[room_id].users:
        del rooms[room_id].users[request.userId]
    
    # If room is empty, delete it
    if len(rooms[room_id].users) == 0:
        del rooms[room_id]
        return {"message": "Left room and room deleted"}
        
    return {"message": "Left room"}

@app.put("/api/rooms/{room_id}/state")
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
    if state.playbackRate is not None:
        current_state.playbackRate = state.playbackRate
        
    current_state.lastUpdated = datetime.now().timestamp()
    
    return current_state

@app.post("/api/rooms/{room_id}/queue")
async def add_to_queue(room_id: str, video: VideoItem):
    if room_id not in rooms:
        raise HTTPException(status_code=404, detail="Room not found")
    rooms[room_id].queue.append(video)
    return rooms[room_id].queue

@app.delete("/api/rooms/{room_id}/queue/{index}")
async def remove_from_queue(room_id: str, index: int):
    if room_id not in rooms:
        raise HTTPException(status_code=404, detail="Room not found")
    if index < 0 or index >= len(rooms[room_id].queue):
        raise HTTPException(status_code=400, detail="Invalid queue index")
    
    removed = rooms[room_id].queue.pop(index)
    return {"message": "Removed from queue", "video": removed}

@app.post("/api/rooms/{room_id}/play")
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
        
    return get_room_response(room)

@app.get("/api/youtube/search")
async def search_youtube(q: str):
    if not YOUTUBE_API_KEY:
        raise HTTPException(status_code=500, detail="YouTube API Key not configured")
    
    try:
        url = "https://www.googleapis.com/youtube/v3/search"
        params = {
            "part": "snippet",
            "maxResults": 12,
            "q": q,
            "type": "video",
            "key": YOUTUBE_API_KEY
        }
        response = requests.get(url, params=params)
        if response.status_code != 200:
             error_msg = response.json().get("error", {}).get("message", "YouTube API Error")
             raise HTTPException(status_code=response.status_code, detail=error_msg)
        
        return response.json()
    except HTTPException as he:
        raise he
    except Exception as e:
        print(f"YouTube Search Error: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@app.post("/api/asr")
async def asr(file: UploadFile = File(...)):
    if not GOOGLE_API_KEY:
        raise HTTPException(status_code=500, detail="Google API Key not configured")
    
    try:
        # Save uploaded file temporarily
        temp_filename = f"temp_{uuid.uuid4()}.wav"
        with open(temp_filename, "wb") as buffer:
            shutil.copyfileobj(file.file, buffer)
            
        try:
            # Upload to Gemini
            # Note: In a real app, you might want to manage file lifecycle better
            # For short clips, we can try passing data directly if supported, 
            # but upload_file is the standard way for media in GenAI SDK.
            uploaded_file = genai.upload_file(temp_filename)
            
            # Generate content
            model = genai.GenerativeModel("gemini-2.0-flash")
            response = model.generate_content(
                [uploaded_file, "Transcribe this audio exactly as spoken. Do not add any other text."],
            )
            
            # Cleanup
            # genai.delete_file(uploaded_file.name) # Optional: clean up cloud file
            
            return {"text": response.text}
            
        finally:
            # Clean up local file
            if os.path.exists(temp_filename):
                os.remove(temp_filename)
                
    except Exception as e:
        print(f"ASR Error: {e}")
        raise HTTPException(status_code=500, detail=str(e))

if __name__ == "__main__":
    import uvicorn
    # Start background task for mock emotions
    import threading
    def run_async_task():
        asyncio.run(update_mock_emotions())
    
    emotion_thread = threading.Thread(target=run_async_task, daemon=True)
    emotion_thread.start()
    
    uvicorn.run(app, host="0.0.0.0", port=8000)
