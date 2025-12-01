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
}

export interface Message {
  id: string;
  userId: string;
  username: string;
  content: string;
  timestamp: number;
  videoTitle?: string;
  videoTimestamp?: number;
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
}

export interface AICompanion {
  name: string;
  personality: string;
  background: string;
  avatar: string;
  category?: string;
}

export interface Room {
  id: string;
  name: string;
  description?: string;
  privacy?: 'public' | 'private';
  maxUsers?: number;
  userCount: number;
  users: RoomUser[];
  videoState: any; // Using any for simplicity as it wasn't fully visible, but ideally should be typed
  currentVideo?: CurrentVideo;
  queue: VideoItem[];
  history: VideoItem[];
  messages: Message[];
  aiCompanions?: AICompanion[];
}
