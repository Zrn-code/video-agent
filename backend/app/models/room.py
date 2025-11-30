from pydantic import BaseModel
from typing import List, Optional, Dict

class VideoState(BaseModel):
    url: str = ""
    playing: bool = False
    played: float = 0.0
    duration: float = 0.0
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

class AICompanion(BaseModel):
    name: str
    personality: str
    background: str
    avatar: str
    category: Optional[str] = "其他"

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
