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
    url: str = "https://www.youtube.com/watch?v=oUFJJNQGwhk"
    playing: bool = False
    played: float = 0.0
    playbackRate: float = 1.0
    lastUpdated: float = 0.0

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
    userCount: int = 0
    users: List[User] = []
    videoState: VideoState
    queue: List[VideoItem] = []
    history: List[VideoItem] = []
    messages: List[Message] = []

class RoomInternal:
    def __init__(self, id, name, videoState):
        self.id = id
        self.name = name
        self.videoState = videoState
        self.users: Dict[str, Dict] = {} # user_id -> {username, avatar, last_heartbeat_timestamp}
        self.queue: List[VideoItem] = []
        self.history: List[VideoItem] = []
        self.messages: List[Message] = []

class CreateRoomRequest(BaseModel):
    name: str

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

class RegisterRequest(BaseModel):
    accountId: str  # Fixed account ID
    password: str
    nickname: str
    avatar: Optional[str] = None

class LoginRequest(BaseModel):
    accountId: str
    password: str

class UpdateProfileRequest(BaseModel):
    userId: str
    nickname: str
    avatar: str

class AuthResponse(BaseModel):
    success: bool
    message: str
    userId: Optional[str] = None
    accountId: Optional[str] = None
    nickname: Optional[str] = None
    avatar: Optional[str] = None

# In-memory storage
rooms: Dict[str, RoomInternal] = {}

# Initialize some demo rooms
demo_rooms = [
    {"name": "Action Movies 🎬", "url": "https://www.youtube.com/watch?v=oUFJJNQGwhk"},
    {"name": "Chill Vibes 🎵", "url": "https://www.youtube.com/watch?v=jfKfPfyJRdk"},
    {"name": "Tech Talk 💻", "url": "https://www.youtube.com/watch?v=jNgP6d9HraI"}
]

for demo in demo_rooms:
    room_id = str(uuid.uuid4())
    rooms[room_id] = RoomInternal(
        id=room_id,
        name=demo["name"],
        videoState=VideoState(url=demo["url"])
    )

# User database file
USERS_DB_FILE = "users_db.json"

def load_users_db():
    if not os.path.exists(USERS_DB_FILE):
        return {"users": {}}
    try:
        with open(USERS_DB_FILE, 'r', encoding='utf-8') as f:
            return json.load(f)
    except:
        return {"users": {}}

def save_users_db(db):
    with open(USERS_DB_FILE, 'w', encoding='utf-8') as f:
        json.dump(db, f, indent=2, ensure_ascii=False)

def hash_password(password: str) -> str:
    return hashlib.sha256(password.encode()).hexdigest()

def verify_password(password: str, hashed: str) -> bool:
    return hash_password(password) == hashed

def cleanup_users(room: RoomInternal):
    now = datetime.now().timestamp()
    # Remove users inactive for more than 10 seconds
    room.users = {uid: info for uid, info in room.users.items() if now - info['lastSeen'] < 10}
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
        userCount=len(room.users),
        users=users_list,
        videoState=room.videoState,
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
        videoState=VideoState()
    )
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
        
    return {"message": "Left room"}

@app.post("/api/users/profile")
async def update_user_profile(profile: UserProfile):
    # Store in localStorage on client side, just return success
    return {"status": "ok", "profile": profile}

@app.post("/api/auth/register", response_model=AuthResponse)
async def register(request: RegisterRequest):
    db = load_users_db()
    
    # Check if account ID already exists
    if request.accountId in db["users"]:
        return AuthResponse(
            success=False,
            message="此帳號 ID 已被註冊"
        )
    
    # Validate account ID (alphanumeric and underscores only)
    if not request.accountId.replace('_', '').isalnum():
        return AuthResponse(
            success=False,
            message="帳號 ID 只能包含英文、數字和底線"
        )
    
    # Create new user
    user_id = str(uuid.uuid4())
    avatar = request.avatar or f"https://api.dicebear.com/7.x/avataaars/svg?seed={request.accountId}"
    
    db["users"][request.accountId] = {
        "userId": user_id,
        "accountId": request.accountId,
        "password": hash_password(request.password),
        "nickname": request.nickname,
        "avatar": avatar,
        "createdAt": datetime.now().isoformat()
    }
    
    save_users_db(db)
    
    return AuthResponse(
        success=True,
        message="註冊成功",
        userId=user_id,
        accountId=request.accountId,
        nickname=request.nickname,
        avatar=avatar
    )

@app.post("/api/auth/login", response_model=AuthResponse)
async def login(request: LoginRequest):
    db = load_users_db()
    
    # Check if account exists
    if request.accountId not in db["users"]:
        return AuthResponse(
            success=False,
            message="帳號或密碼錯誤"
        )
    
    user = db["users"][request.accountId]
    
    # Verify password
    if not verify_password(request.password, user["password"]):
        return AuthResponse(
            success=False,
            message="帳號或密碼錯誤"
        )
    
    return AuthResponse(
        success=True,
        message="登入成功",
        userId=user["userId"],
        accountId=user["accountId"],
        nickname=user["nickname"],
        avatar=user["avatar"]
    )

@app.post("/api/auth/update-profile")
async def update_profile(request: UpdateProfileRequest):
    db = load_users_db()
    
    # Find user by userId
    user_account = None
    for account_id, user_data in db["users"].items():
        if user_data["userId"] == request.userId:
            user_account = account_id
            break
    
    if not user_account:
        raise HTTPException(status_code=404, detail="User not found")
    
    # Update profile
    db["users"][user_account]["nickname"] = request.nickname
    db["users"][user_account]["avatar"] = request.avatar
    
    save_users_db(db)
    
    return {
        "success": True,
        "message": "個人資料已更新",
        "nickname": request.nickname,
        "avatar": request.avatar
    }

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
    uvicorn.run(app, host="0.0.0.0", port=8000)
