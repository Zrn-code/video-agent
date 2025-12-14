export interface YouTubeVideo {
  id: { videoId: string };
  snippet: {
    title: string;
    description: string;
    channelTitle: string;
    thumbnails: {
      high?: { url: string };
      medium?: { url: string };
      default: { url: string };
    };
  };
}

export interface VideoItem {
  videoId: string;
  title: string;
  channelTitle: string;
  thumbnailUrl: string;
  addedBy?: string;
  hasTranscript?: boolean;
  hasSummary?: boolean;
}

export interface Message {
  id: string;
  userId: string;
  username: string;
  content: string;
  timestamp: number;
  videoTitle?: string;
  videoTimestamp?: number;
  isSpoiler?: boolean;
  spoilerReason?: string;
}

export interface CurrentVideo {
  videoId: string;
  title: string;
  channelTitle: string;
  thumbnailUrl: string;
}

export interface RoomUser {
  id: string;
  username: string;
  avatar: string;
  emotion?: string;
  isAi?: boolean;
  spoilerPreference?: 'show_all' | 'hide_spoilers';
  addedBy?: string;
  hasScript?: boolean;
}

export interface ForumComment {
  id: string;
  userId: string;
  username: string;
  content: string;
  timestamp: number;
  isAi?: boolean;
  avatar?: string;
}

export interface ForumThread {
  id: string;
  title: string;
  content: string;
  authorId: string;
  authorName: string;
  createdAt: number;
  updatedAt: number;
  status: 'open' | 'closed' | 'completed';
  comments: ForumComment[];
  isAutoCreated?: boolean;
  originalMessageId?: string;
  authorIsAi?: boolean;
  authorAvatar?: string;
}

export interface AICompanion {
  name: string;
  style: string;
  catchphrase_1?: string;
  catchphrase_2?: string;
  avatar: string;
  category?: string;
  addedBy?: string;
}

export interface Room {
  id: string;
  name: string;
  description?: string;
  isPrivate?: boolean;
  userCount: number;
  users: RoomUser[];
  videoState: any; // Using any for simplicity as it wasn't fully visible, but ideally should be typed
  currentVideo?: CurrentVideo;
  queue: VideoItem[];
  history: VideoItem[];
  messages: Message[];
  aiCompanions?: AICompanion[];
  hostId?: string;
}
