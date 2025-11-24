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
}
