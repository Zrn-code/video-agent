import React, { useState, useEffect } from 'react';
import type { CurrentVideo, RoomUser } from '../types';

interface Room {
  id: string;
  name: string;
  userCount: number;
  users: RoomUser[];
  videoState: {
    url: string;
    playing: boolean;
  };
  currentVideo?: CurrentVideo;
}

interface RoomListProps {
  onJoinRoom: (roomId: string) => void;
  searchQuery?: string;
}

const RoomList: React.FC<RoomListProps> = ({ onJoinRoom, searchQuery = '' }) => {
  const [rooms, setRooms] = useState<Room[]>([]);
  const [isCreating, setIsCreating] = useState(false);
  const [newRoomName, setNewRoomName] = useState('');
  const [isLoading, setIsLoading] = useState(true);

  const filteredRooms = rooms.filter(room => 
    room.name.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const fetchRooms = async () => {
    try {
      const response = await fetch(`${import.meta.env.VITE_API_URL}/api/rooms`);
      if (response.ok) {
        const data = await response.json();
        setRooms(data);
      }
    } catch (error) {
      console.error('Failed to fetch rooms:', error);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchRooms();
    const interval = setInterval(fetchRooms, 5000); // Poll every 5 seconds
    return () => clearInterval(interval);
  }, []);

  const handleCreateRoom = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newRoomName.trim()) return;

    try {
      const response = await fetch(`${import.meta.env.VITE_API_URL}/api/rooms`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ name: newRoomName }),
      });

      if (response.ok) {
        setNewRoomName('');
        setIsCreating(false);
        fetchRooms();
      }
    } catch (error) {
      console.error('Failed to create room:', error);
    }
  };

  const getThumbnailUrl = (url: string) => {
    try {
      const videoId = url.split('v=')[1]?.split('&')[0];
      if (videoId) {
        return `https://img.youtube.com/vi/${videoId}/mqdefault.jpg`;
      }
    } catch (e) {
      return null;
    }
    return null;
  };

  const getEmotionEmoji = (emotion?: string) => {
    const emojiMap: Record<string, string> = {
      'Happy': '😊',
      'Sad': '😢',
      'Angry': '😠',
      'Surprise': '😲',
      'Neutral': '😐',
      'Excited': '🤩',
      'Thinking': '🤔',
      'Laughing': '😂'
    };
    return emotion ? emojiMap[emotion] || '😊' : '😊';
  };

  return (
    <div className="min-h-screen bg-gradient-to-b from-[#0f0f0f] to-[#141414] text-gray-100 p-6 pt-24">
      <div className="max-w-[1600px] mx-auto">
        <div className="flex justify-between items-end mb-8 border-b border-white/5 pb-6">
          <div>
            <h1 className="text-3xl font-bold mb-1">
              <span className="text-transparent bg-clip-text bg-gradient-to-r from-primary to-primary/60">共觀影伴</span>
            </h1>
            <p className="text-sm text-gray-400">Join a watch party or start your own</p>
          </div>
          <button 
            onClick={() => setIsCreating(true)}
            className="btn btn-primary btn-sm gap-2 rounded-full px-6 shadow-lg shadow-primary/20"
          >
            <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" viewBox="0 0 20 20" fill="currentColor">
              <path fillRule="evenodd" d="M10 3a1 1 0 011 1v5h5a1 1 0 110 2h-5v5a1 1 0 11-2 0v-5H4a1 1 0 110-2h5V4a1 1 0 011-1z" clipRule="evenodd" />
            </svg>
            Create Room
          </button>
        </div>

        {/* Create Room Modal */}
        {isCreating && (
          <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-50 backdrop-blur-sm">
            <div className="bg-[#1a1a1a] p-8 rounded-2xl w-full max-w-md border border-white/10 shadow-2xl">
              <h3 className="text-2xl font-bold mb-6">Create New Room</h3>
              <form onSubmit={handleCreateRoom}>
                <div className="form-control w-full mb-6">
                  <label className="label">
                    <span className="label-text text-gray-300">Room Name</span>
                  </label>
                  <input 
                    type="text" 
                    placeholder="e.g. Friday Night Horror" 
                    className="input input-bordered bg-black/50 border-white/20 focus:border-primary w-full"
                    value={newRoomName}
                    onChange={(e) => setNewRoomName(e.target.value)}
                    autoFocus
                  />
                </div>
                <div className="flex justify-end gap-3">
                  <button 
                    type="button" 
                    onClick={() => setIsCreating(false)}
                    className="btn btn-ghost hover:bg-white/10"
                  >
                    Cancel
                  </button>
                  <button 
                    type="submit" 
                    className="btn btn-primary"
                    disabled={!newRoomName.trim()}
                  >
                    Create
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}

        {isLoading ? (
          <div className="flex justify-center py-20">
            <span className="loading loading-spinner loading-lg text-primary"></span>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-6">
            {filteredRooms.map((room) => (
              <div 
                key={room.id} 
                onClick={() => onJoinRoom(room.id)}
                className="card bg-[#1e1e1e] shadow-lg hover:shadow-primary/20 transition-all duration-300 border border-white/5 group overflow-hidden hover:-translate-y-1 cursor-pointer"
              >
                <figure className="relative aspect-video bg-black">
                  {room.currentVideo ? (
                    <img 
                      src={room.currentVideo.thumbnailUrl} 
                      alt={room.currentVideo.title}
                      className="w-full h-full object-cover opacity-70 group-hover:opacity-100 transition-opacity duration-300"
                    />
                  ) : getThumbnailUrl(room.videoState.url) ? (
                    <img 
                      src={getThumbnailUrl(room.videoState.url)!} 
                      alt="Thumbnail" 
                      className="w-full h-full object-cover opacity-70 group-hover:opacity-100 transition-opacity duration-300"
                    />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center bg-neutral-900 text-neutral-700">
                      <svg xmlns="http://www.w3.org/2000/svg" className="h-12 w-12" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M14.752 11.168l-3.197-2.132A1 1 0 0010 9.87v4.263a1 1 0 001.555.832l3.197-2.132a1 1 0 000-1.664z" />
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                      </svg>
                    </div>
                  )}
                  <div className="absolute top-2 right-2 badge badge-sm badge-neutral bg-black/60 border-none backdrop-blur-md gap-1 text-xs">
                    <div className="w-1.5 h-1.5 rounded-full bg-green-500 animate-pulse"></div>
                    {room.userCount}
                  </div>
                  {room.videoState.playing && (
                    <div className="absolute top-2 left-2 badge badge-sm bg-red-500/80 border-none backdrop-blur-md gap-1 text-xs text-white">
                      <svg xmlns="http://www.w3.org/2000/svg" className="h-3 w-3" viewBox="0 0 20 20" fill="currentColor">
                        <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM9.555 7.168A1 1 0 008 8v4a1 1 0 001.555.832l3-2a1 1 0 000-1.664l-3-2z" clipRule="evenodd" />
                      </svg>
                      LIVE
                    </div>
                  )}
                  <div className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity duration-300 bg-black/20">
                    <div className="w-10 h-10 rounded-full bg-primary/90 flex items-center justify-center shadow-lg backdrop-blur-sm transform scale-90 group-hover:scale-100 transition-transform">
                      <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 text-white ml-0.5" viewBox="0 0 20 20" fill="currentColor">
                        <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM9.555 7.168A1 1 0 008 8v4a1 1 0 001.555.832l3-2a1 1 0 000-1.664l-3-2z" clipRule="evenodd" />
                      </svg>
                    </div>
                  </div>
                </figure>
                <div className="card-body p-4 gap-2">
                  <h2 className="card-title text-sm font-bold text-white group-hover:text-primary transition-colors line-clamp-1">
                    {room.name}
                  </h2>
                  {room.currentVideo ? (
                    <div className="text-xs text-gray-400 space-y-1">
                      <p className="line-clamp-1 flex items-center gap-1">
                        <svg xmlns="http://www.w3.org/2000/svg" className="h-3 w-3 flex-shrink-0" viewBox="0 0 20 20" fill="currentColor">
                          <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM9.555 7.168A1 1 0 008 8v4a1 1 0 001.555.832l3-2a1 1 0 000-1.664l-3-2z" clipRule="evenodd" />
                        </svg>
                        <span className="truncate">{room.currentVideo.title}</span>
                      </p>
                      <p className="text-gray-500 line-clamp-1">{room.currentVideo.channelTitle}</p>
                    </div>
                  ) : (
                    <p className="text-xs text-gray-500 line-clamp-1">沒有播放影片</p>
                  )}
                  {/* User avatars */}
                  {room.users && room.users.length > 0 && (
                    <div className="flex items-center gap-1 mt-1">
                      <div className="flex -space-x-2">
                        {room.users.slice(0, 4).map((user) => (
                          <div 
                            key={user.id}
                            className="relative w-6 h-6 rounded-full border-2 border-[#1e1e1e] overflow-hidden bg-gray-700"
                            title={user.username}
                          >
                            <img 
                              src={user.avatar} 
                              alt={user.username}
                              className="w-full h-full object-cover"
                            />
                            {user.emotion && (
                              <div className="absolute -bottom-0.5 -right-0.5 text-[10px] leading-none bg-black/80 rounded-full w-3.5 h-3.5 flex items-center justify-center">
                                {getEmotionEmoji(user.emotion)}
                              </div>
                            )}
                          </div>
                        ))}
                      </div>
                      {room.users.length > 4 && (
                        <span className="text-xs text-gray-500">+{room.users.length - 4}</span>
                      )}
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

export default RoomList;
