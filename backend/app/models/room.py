from pydantic import BaseModel
from typing import List, Optional, Dict

class VideoState(BaseModel):
    url: str = ""
    playing: bool = False
    played: float = 0.0
    duration: float = 0.0
    playbackRate: float = 1.0
    lastUpdated: float = 0.0
    lastUpdatedBy: Optional[str] = None

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

class AICompanion(BaseModel):
    name: str
    style: str
    catchphrase_1: Optional[str] = None
    catchphrase_2: Optional[str] = None
    avatar: str
    category: Optional[str] = "其他"

class Message(BaseModel):
    id: str
    userId: str
    username: str
    content: str
    timestamp: float
    videoTitle: Optional[str] = None
    videoTimestamp: Optional[float] = None

class User(BaseModel):
    id: str
    username: str
    avatar: str
    lastSeen: float
    emotion: Optional[str] = None
    isAi: bool = False

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
    aiCompanions: List[AICompanion] = []

class RoomInternal:
    def __init__(self, id, name, videoState, description=None, aiCompanions=None):
        self.id = id
        self.name = name
        self.description = description
        self.videoState = videoState
        self.currentVideo: Optional[CurrentVideo] = None
        self.users: Dict[str, Dict] = {} # user_id -> {username, avatar, last_heartbeat_timestamp, emotion, isAi}
        self.queue: List[VideoItem] = []
        self.history: List[VideoItem] = []
        self.messages: List[Message] = []
        self.aiCompanions = aiCompanions or []

    def to_dict(self):
        return {
            "id": self.id,
            "name": self.name,
            "description": self.description,
            "videoState": self.videoState.dict(),
            "currentVideo": self.currentVideo.dict() if self.currentVideo else None,
            "users": self.users,
            "queue": [v.dict() for v in self.queue],
            "history": [v.dict() for v in self.history],
            "messages": [m.dict() for m in self.messages],
            "aiCompanions": [c.dict() for c in self.aiCompanions] if self.aiCompanions else []
        }

    @classmethod
    def from_dict(cls, data):
        video_state = VideoState(**data["videoState"])
        ai_companions = [AICompanion(**c) for c in data.get("aiCompanions", [])]
        
        room = cls(
            id=data["id"],
            name=data["name"],
            videoState=video_state,
            description=data.get("description"),
            aiCompanions=ai_companions
        )
        
        if data.get("currentVideo"):
            room.currentVideo = CurrentVideo(**data["currentVideo"])
            
        room.users = data.get("users", {})
        room.queue = [VideoItem(**v) for v in data.get("queue", [])]
        room.history = [VideoItem(**v) for v in data.get("history", [])]
        room.messages = [Message(**m) for m in data.get("messages", [])]
        
        return room

class CreateRoomRequest(BaseModel):
    name: str
    description: Optional[str] = None
    initialPlaylist: Optional[List[VideoItem]] = []
    aiCompanions: Optional[List[AICompanion]] = []

class UpdateStateRequest(BaseModel):
    url: Optional[str] = None
    playing: Optional[bool] = None
    played: Optional[float] = None
    duration: Optional[float] = None
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
