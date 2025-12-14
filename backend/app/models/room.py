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
    pendingSeekId: Optional[str] = None  # 追蹤當前等待同步的 seek 操作

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
    id: Optional[str] = None
    name: str
    personalities: Optional[str] = None
    style: str
    language: Optional[str] = "Traditional Chinese"
    catchphrase_1: Optional[str] = None
    catchphrase_2: Optional[str] = None
    avatar: str
    category: Optional[str] = "其他"
    addedBy: Optional[str] = None
    addedByUsername: Optional[str] = None

class Message(BaseModel):
    id: str
    userId: str
    username: str
    content: str
    timestamp: float
    videoTitle: Optional[str] = None
    videoTimestamp: Optional[float] = None
    isSpoiler: bool = False
    spoilerReason: Optional[str] = None

class ForumComment(BaseModel):
    id: str
    userId: str
    username: str
    content: str
    timestamp: float

class ForumThread(BaseModel):
    id: str
    title: str
    content: str
    authorId: str
    authorName: str
    createdAt: float
    updatedAt: float
    status: str = "open" # open, closed, completed
    comments: List[ForumComment] = []

class User(BaseModel):
    id: str
    username: str
    avatar: str
    lastSeen: float
    emotion: Optional[str] = None
    isAi: bool = False
    spoilerPreference: str = "show_all"  # "show_all" or "hide_spoilers"
    hasScript: bool = False

class Room(BaseModel):
    id: str
    name: str
    description: Optional[str] = None
    isPrivate: bool = False
    userCount: int = 0
    users: List[User] = []
    videoState: VideoState
    currentVideo: Optional[CurrentVideo] = None
    queue: List[VideoItem] = []
    history: List[VideoItem] = []
    messages: List[Message] = []
    forumThreads: List[ForumThread] = []
    aiCompanions: List[AICompanion] = []
    hostId: Optional[str] = None

class RoomInternal:
    def __init__(self, id, name, videoState, description=None, aiCompanions=None, isPrivate=False):
        self.id = id
        self.name = name
        self.description = description
        self.isPrivate = isPrivate
        self.videoState = videoState
        self.currentVideo: Optional[CurrentVideo] = None
        self.lastScriptTime: float = 0.0
        self.users: Dict[str, Dict] = {} # user_id -> {username, avatar, last_heartbeat_timestamp, emotion, isAi, joinedAt}
        self.queue: List[VideoItem] = []
        self.history: List[VideoItem] = []
        self.messages: List[Message] = []
        self.forumThreads: List[ForumThread] = []
        self.aiCompanions = aiCompanions or []
        self.hostId: Optional[str] = None  # 房主ID
        self.createdAt: float = 0.0  # 房間創建時間
        self.lastRealUserSeenAt: float = 0.0  # 最後一次有真實用戶的時間
        self.seekAcknowledgments: Dict[str, set] = {}  # seekId -> set of user_ids who acknowledged

    def to_dict(self):
        return {
            "id": self.id,
            "name": self.name,
            "description": self.description,
            "isPrivate": self.isPrivate,
            "videoState": self.videoState.dict(),
            "currentVideo": self.currentVideo.dict() if self.currentVideo else None,
            "users": self.users,
            "queue": [v.dict() for v in self.queue],
            "history": [v.dict() for v in self.history],
            "messages": [m.dict() for m in self.messages],
            "forumThreads": [t.dict() for t in self.forumThreads],
            "aiCompanions": [c.dict() for c in self.aiCompanions] if self.aiCompanions else [],
            "hostId": self.hostId,
            "createdAt": self.createdAt,
            "lastRealUserSeenAt": self.lastRealUserSeenAt
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
            aiCompanions=ai_companions,
            isPrivate=data.get("isPrivate", False)
        )
        
        if data.get("currentVideo"):
            room.currentVideo = CurrentVideo(**data["currentVideo"])
            
        room.users = data.get("users", {})
        room.queue = [VideoItem(**v) for v in data.get("queue", [])]
        room.history = [VideoItem(**v) for v in data.get("history", [])]
        room.messages = [Message(**m) for m in data.get("messages", [])]
        room.forumThreads = [ForumThread(**t) for t in data.get("forumThreads", [])]
        room.hostId = data.get("hostId")
        room.createdAt = data.get("createdAt", 0.0)
        room.lastRealUserSeenAt = data.get("lastRealUserSeenAt", 0.0)
        
        return room

class CreateRoomRequest(BaseModel):
    name: str
    description: Optional[str] = None
    isPrivate: bool = False
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

class CreateThreadRequest(BaseModel):
    title: str
    content: str
    authorId: str
    authorName: str

class CreateCommentRequest(BaseModel):
    content: str
    userId: str
    username: str

class UpdateThreadStatusRequest(BaseModel):
    status: str

class HeartbeatRequest(BaseModel):
    userId: str
    username: Optional[str] = None
    avatar: Optional[str] = None
    emotion: Optional[str] = None
