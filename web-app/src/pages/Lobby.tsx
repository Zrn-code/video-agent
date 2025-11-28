import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import Header from '../components/Header';
import type { VideoItem, YouTubeVideo } from '../types';

interface Room {
  id: string;
  name: string;
  description?: string;
  userCount: number;
  videoState: {
    url: string;
    playing: boolean;
  };
}

const Lobby = () => {
  const navigate = useNavigate();
  // Room state
  const [rooms, setRooms] = useState<Room[]>([]);
  const [isCreating, setIsCreating] = useState(false);
  const [newRoomName, setNewRoomName] = useState('');
  const [isLoading, setIsLoading] = useState(true);

  // Create Room State
  const [step, setStep] = useState(1);
  const [newRoomDescription, setNewRoomDescription] = useState('');
  const [playlist, setPlaylist] = useState<VideoItem[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<YouTubeVideo[]>([]);
  const [isSearching, setIsSearching] = useState(false);

  // Fetch rooms
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
    const interval = setInterval(fetchRooms, 5000);
    return () => clearInterval(interval);
  }, []);

  const handleJoinRoom = (roomId: string) => {
    navigate(`/room/${roomId}`);
  };

  const searchYoutube = async (query: string) => {
    if (!query.trim()) return;
    setIsSearching(true);
    try {
      const response = await fetch(
        `${import.meta.env.VITE_API_URL}/api/youtube/search?q=${encodeURIComponent(query)}`
      );
      if (response.ok) {
        const data = await response.json();
        setSearchResults(data.items || []);
      }
    } catch (error) {
      console.error('Search failed:', error);
    } finally {
      setIsSearching(false);
    }
  };

  const addToPlaylist = (video: YouTubeVideo) => {
    const newItem: VideoItem = {
      videoId: video.id.videoId,
      title: video.snippet.title,
      channelTitle: video.snippet.channelTitle,
      thumbnailUrl: video.snippet.thumbnails.medium?.url || video.snippet.thumbnails.default.url
    };
    setPlaylist([...playlist, newItem]);
    setSearchResults([]); // Clear search results after adding
    setSearchQuery('');
  };

  const removeFromPlaylist = (index: number) => {
    setPlaylist(playlist.filter((_, i) => i !== index));
  };

  const handleCreateRoom = async () => {
    if (!newRoomName.trim()) return;

    try {
      const response = await fetch(`${import.meta.env.VITE_API_URL}/api/rooms`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          name: newRoomName,
          description: newRoomDescription,
          initialPlaylist: playlist 
        }),
      });

      if (response.ok) {
        const newRoom = await response.json();
        setNewRoomName('');
        setNewRoomDescription('');
        setPlaylist([]);
        setStep(1);
        setIsCreating(false);
        navigate(`/room/${newRoom.id}`);
      }
    } catch (error) {
      console.error('Failed to create room:', error);
    }
  };

  const getThumbnailUrl = (url: string) => {
    try {
      const videoId = url.split('v=')[1]?.split('&')[0];
      if (videoId) return `https://img.youtube.com/vi/${videoId}/mqdefault.jpg`;
    } catch (e) { return null; }
    return null;
  };

  // Helper to assign random category and image for demo
  const getRoomMeta = (index: number) => {
    const demoImages = [
      'https://images.unsplash.com/photo-1536440136628-849c177e76a1?q=80&w=1000&auto=format&fit=crop',
      'https://images.unsplash.com/photo-1501386761578-eac5c94b800a?q=80&w=1000&auto=format&fit=crop',
      'https://images.unsplash.com/photo-1511671782779-c97d3d27a1d4?q=80&w=1000&auto=format&fit=crop',
      'https://images.unsplash.com/photo-1470225620780-dba8ba36b745?q=80&w=1000&auto=format&fit=crop'
    ];
    const demoCategories = ['動漫', '音樂', '經典', '放鬆'];
    return {
      image: demoImages[index % demoImages.length],
      category: demoCategories[index % demoCategories.length]
    };
  };

  return (
    <div className="min-h-screen bg-[#050505] text-white pb-20 font-sans selection:bg-purple-500/30">
      <Header />

      {/* Hero Section */}
      <div className="relative min-h-screen flex items-center justify-center px-4 overflow-hidden">
        <div className="absolute top-0 left-1/2 -translate-x-1/2 w-full h-full max-w-7xl pointer-events-none">
          <div className="absolute top-20 left-1/4 w-96 h-96 bg-purple-600/20 rounded-full blur-[120px] animate-pulse" />
          <div className="absolute bottom-20 right-1/4 w-96 h-96 bg-blue-600/10 rounded-full blur-[120px]" />
        </div>

        <div className="relative max-w-4xl mx-auto text-center space-y-8 z-10">
          <h1 className="text-5xl md:text-7xl font-bold tracking-tight">
            <span className="bg-clip-text text-transparent bg-gradient-to-r from-white via-gray-200 to-gray-400">
              與朋友一起
            </span>
            <br />
            <span className="bg-clip-text text-transparent bg-gradient-to-r from-purple-400 to-pink-400">
              享受觀影時刻
            </span>
          </h1>
          <p className="text-lg md:text-xl text-gray-400 max-w-2xl mx-auto leading-relaxed">
            建立您的專屬放映室，同步觀看 YouTube 影片，即時語音聊天。
            <br className="hidden md:block" />
            無論距離多遠，此刻我們都在一起。
          </p>
          
          <div className="flex flex-col sm:flex-row items-center justify-center gap-4 pt-4">
            <button 
              onClick={() => setIsCreating(true)}
              className="btn btn-lg bg-white text-black hover:bg-gray-200 border-none rounded-full px-8 shadow-xl shadow-white/10 hover:scale-105 transition-transform duration-200"
            >
              <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className="w-6 h-6 mr-2">
                <path fillRule="evenodd" d="M12 3.75a.75.75 0 0 1 .75.75v6.75h6.75a.75.75 0 0 1 0 1.5h-6.75v6.75a.75.75 0 0 1-1.5 0v-6.75H4.5a.75.75 0 0 1 0-1.5h6.75V4.5a.75.75 0 0 1 .75-.75Z" clipRule="evenodd" />
              </svg>
              創建房間
            </button>
            <button 
              onClick={() => document.getElementById('rooms-section')?.scrollIntoView({ behavior: 'smooth' })}
              className="btn btn-lg btn-ghost text-white hover:bg-white/10 rounded-full px-8 group"
            >
              開始探索
              <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-5 h-5 ml-2 group-hover:translate-y-1 transition-transform">
                <path strokeLinecap="round" strokeLinejoin="round" d="m19.5 8.25-7.5 7.5-7.5-7.5" />
              </svg>
            </button>
          </div>
        </div>
      </div>

      <main id="rooms-section" className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-20 min-h-screen">
        {/* Categories & Filter Removed */}

        {/* Room Grid */}
        {isLoading ? (
           <div className="flex flex-col items-center justify-center py-32 space-y-4">
             <span className="loading loading-spinner loading-lg text-purple-500"></span>
             <p className="text-gray-500 animate-pulse">正在尋找精彩房間...</p>
           </div>
        ) : (
           <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-6 gap-4">
             {rooms.map((room, index) => {
               const meta = getRoomMeta(index);
               const thumbnailUrl = getThumbnailUrl(room.videoState.url);
               
               return (
                 <div 
                   key={room.id} 
                   onClick={() => handleJoinRoom(room.id)}
                   className="group relative bg-[#121212] rounded-xl overflow-hidden border border-white/5 hover:border-purple-500/50 transition-all duration-300 hover:-translate-y-1 hover:shadow-lg hover:shadow-purple-900/10 cursor-pointer"
                 >
                   {/* Image Container */}
                   <div className="relative aspect-video overflow-hidden">
                     <div className="absolute inset-0 bg-gradient-to-t from-[#121212] via-transparent to-transparent z-10 opacity-60" />
                     
                     {thumbnailUrl ? (
                       <img 
                         src={thumbnailUrl} 
                         alt="Thumbnail" 
                         className="w-full h-full object-cover transform group-hover:scale-105 transition-transform duration-500"
                       />
                     ) : (
                       <img 
                         src={meta.image} 
                         alt="Cover" 
                         className="w-full h-full object-cover transform group-hover:scale-105 transition-transform duration-500"
                       />
                     )}
                     
                     {/* Badges */}
                     <div className="absolute top-2 left-2 z-20 flex gap-2">
                       <span className="px-2 py-0.5 rounded text-[10px] font-medium bg-black/60 backdrop-blur-md text-white border border-white/10">
                         {meta.category}
                       </span>
                     </div>

                     <div className="absolute top-2 right-2 z-20">
                       <span className="flex items-center gap-1 px-2 py-0.5 rounded bg-red-500/90 backdrop-blur-md text-white text-[10px] font-bold shadow-lg shadow-red-900/20">
                         <span className="relative flex h-1.5 w-1.5">
                           <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-white opacity-75"></span>
                           <span className="relative inline-flex rounded-full h-1.5 w-1.5 bg-white"></span>
                         </span>
                         LIVE
                       </span>
                     </div>
                     
                     {/* Play Overlay */}
                     <div className="absolute inset-0 z-20 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-all duration-300 bg-black/20 backdrop-blur-[1px]">
                       <div className="w-10 h-10 rounded-full bg-white text-black flex items-center justify-center transform scale-50 group-hover:scale-100 transition-all duration-300 shadow-xl">
                         <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className="w-5 h-5 ml-0.5">
                           <path fillRule="evenodd" d="M4.5 5.653c0-1.426 1.529-2.33 2.779-1.643l11.54 6.348c1.295.712 1.295 2.573 0 3.285L7.28 19.991c-1.25.687-2.779-.217-2.779-1.643V5.653Z" clipRule="evenodd" />
                         </svg>
                       </div>
                     </div>
                   </div>
                   
                   {/* Content */}
                   <div className="p-3 relative z-20">
                     <h3 className="text-sm font-bold text-white mb-1.5 line-clamp-1 group-hover:text-purple-400 transition-colors">
                       {room.name}
                     </h3>
                     
                     <p className="text-xs text-gray-400 line-clamp-2 mb-3 h-8 leading-relaxed">
                       {room.description || '這個房間還沒有描述...'}
                     </p>
                     
                     <div className="flex items-center justify-between pt-2 border-t border-white/5">
                       <div className="flex -space-x-1.5 overflow-hidden">
                         {[...Array(Math.min(3, room.userCount || 1))].map((_, i) => (
                           <div key={i} className="inline-block h-4 w-4 rounded-full ring-1 ring-[#121212] bg-gray-800 flex items-center justify-center text-[8px] text-gray-400">
                             {String.fromCharCode(65 + i)}
                           </div>
                         ))}
                       </div>
                       
                       <div className="flex items-center gap-1 text-[10px] font-medium text-gray-500">
                         <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="w-3 h-3">
                           <path d="M7 8a3 3 0 1 0 0-6 3 3 0 0 0 0 6ZM14.5 9a2.5 2.5 0 1 0 0-5 2.5 2.5 0 0 0 0 5ZM1.615 16.428a1.224 1.224 0 0 1-.569-1.175 6.002 6.002 0 0 1 11.532-2.411 1.002 1.002 0 0 1-1.455 1.405 4.002 4.002 0 0 0-7.908 1.773.992.992 0 0 1-.909.56 1.002 1.002 0 0 1-.691-.152ZM14.427 15.539a6 6 0 0 1-6.66-1.63 1 1 0 1 1 1.414-1.414 4.002 4.002 0 0 0 5.535 1.098 1.002 1.002 0 1 1 .963 1.794 6.002 6.002 0 0 1-1.252.152Z" />
                         </svg>
                         {room.userCount}
                       </div>
                     </div>
                   </div>
                 </div>
               );
             })}
           </div>
        )}
      </main>

      {/* Create Room Modal */}
      {isCreating && (
        <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-50 backdrop-blur-md p-4">
          <div className="bg-[#121212] rounded-3xl w-full max-w-2xl border border-white/10 shadow-2xl max-h-[90vh] overflow-hidden flex flex-col animate-in fade-in zoom-in-95 duration-200">
            {/* Modal Header */}
            <div className="p-6 border-b border-white/5 flex justify-between items-center bg-white/5">
              <div>
                <h3 className="text-xl font-bold text-white">
                  {step === 1 ? '創建新房間' : '設定播放清單'}
                </h3>
                <p className="text-sm text-gray-400 mt-1">
                  {step === 1 ? '設定房間的基本資訊' : '預先加入一些影片讓大家觀看'}
                </p>
              </div>
              <div className="flex items-center gap-2 text-xs font-mono text-gray-500 bg-black/20 px-3 py-1 rounded-full">
                Step {step}/2
              </div>
            </div>
            
            {/* Modal Body */}
            <div className="p-6 overflow-y-auto custom-scrollbar flex-1">
              {step === 1 ? (
                <div className="space-y-6 animate-in slide-in-from-right-4 duration-300">
                  {/* Step 1: Room Details */}
                  <div className="form-control w-full">
                    <label className="label">
                      <span className="label-text text-gray-300 font-medium">房間名稱</span>
                    </label>
                    <input 
                      type="text" 
                      placeholder="例如：週五恐怖夜" 
                      className="input input-lg bg-black/50 border-white/10 focus:border-purple-500 w-full text-white rounded-xl transition-all focus:bg-black/80"
                      value={newRoomName}
                      onChange={(e) => setNewRoomName(e.target.value)}
                      autoFocus
                    />
                  </div>
                  <div className="form-control w-full">
                    <label className="label">
                      <span className="label-text text-gray-300 font-medium">房間描述 (選填)</span>
                    </label>
                    <textarea 
                      placeholder="介紹一下這個房間..." 
                      className="textarea textarea-lg bg-black/50 border-white/10 focus:border-purple-500 w-full text-white h-32 rounded-xl transition-all focus:bg-black/80 resize-none"
                      value={newRoomDescription}
                      onChange={(e) => setNewRoomDescription(e.target.value)}
                    />
                  </div>
                </div>
              ) : (
                <div className="space-y-6 animate-in slide-in-from-right-4 duration-300">
                  {/* Step 2: Playlist Builder */}
                  <div className="space-y-4">
                    <div className="flex justify-between items-end">
                      <label className="label pb-0 px-0">
                        <span className="label-text text-gray-300 font-medium">初始播放清單</span>
                      </label>
                      <span className="text-xs text-purple-400 font-medium bg-purple-500/10 px-2 py-1 rounded-md">
                        已加入 {playlist.length} 部影片
                      </span>
                    </div>
                    
                    {/* Search */}
                    <div className="relative group">
                      <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                        <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 text-gray-500 group-focus-within:text-purple-500 transition-colors" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                        </svg>
                      </div>
                      <input 
                        type="text" 
                        placeholder="搜尋 YouTube 影片..." 
                        className="input input-bordered pl-10 bg-black/50 border-white/10 focus:border-purple-500 w-full text-white rounded-xl"
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        onKeyDown={(e) => e.key === 'Enter' && searchYoutube(searchQuery)}
                        autoFocus
                      />
                      <button 
                        onClick={() => searchYoutube(searchQuery)}
                        className="absolute right-2 top-2 btn btn-sm btn-ghost text-gray-400 hover:text-white"
                        disabled={isSearching}
                      >
                        {isSearching ? <span className="loading loading-spinner loading-xs"></span> : '搜尋'}
                      </button>
                    </div>

                    {/* Search Results */}
                    {searchResults.length > 0 && (
                      <div className="bg-black/30 rounded-xl p-2 max-h-60 overflow-y-auto space-y-2 border border-white/10 custom-scrollbar">
                        {searchResults.map((video) => (
                          <div key={video.id.videoId} className="flex gap-3 p-2 hover:bg-white/5 rounded-lg group transition-colors">
                            <div className="relative flex-shrink-0">
                              <img 
                                src={video.snippet.thumbnails.default.url} 
                                alt={video.snippet.title} 
                                className="w-32 h-20 object-cover rounded-lg shadow-sm"
                              />
                              <div className="absolute inset-0 bg-black/0 group-hover:bg-black/20 transition-colors rounded-lg" />
                            </div>
                            <div className="flex-1 min-w-0 flex flex-col justify-center">
                              <h4 className="text-sm font-medium text-white line-clamp-2 mb-1">{video.snippet.title}</h4>
                              <p className="text-xs text-gray-400 truncate">{video.snippet.channelTitle}</p>
                            </div>
                            <div className="flex items-center px-2">
                              <button 
                                onClick={() => addToPlaylist(video)}
                                className="btn btn-sm btn-primary rounded-lg opacity-0 group-hover:opacity-100 transition-all translate-x-2 group-hover:translate-x-0"
                              >
                                加入
                              </button>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}

                    {/* Current Playlist */}
                    {playlist.length > 0 ? (
                      <div className="bg-black/30 rounded-xl p-2 max-h-48 overflow-y-auto space-y-2 border border-white/10 custom-scrollbar">
                        {playlist.map((video, index) => (
                          <div key={`${video.videoId}-${index}`} className="flex gap-3 p-2 hover:bg-white/5 rounded-lg group items-center transition-colors">
                            <span className="text-gray-600 text-xs font-mono w-6 text-center">{index + 1}</span>
                            <img 
                              src={video.thumbnailUrl} 
                              alt={video.title} 
                              className="w-16 h-10 object-cover rounded-md opacity-70 group-hover:opacity-100 transition-opacity"
                            />
                            <div className="flex-1 min-w-0">
                              <h4 className="text-sm font-medium text-gray-300 group-hover:text-white truncate transition-colors">{video.title}</h4>
                            </div>
                            <button 
                              onClick={() => removeFromPlaylist(index)}
                              className="btn btn-xs btn-ghost text-gray-500 hover:text-red-400 opacity-0 group-hover:opacity-100 transition-opacity"
                            >
                              <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="w-4 h-4">
                                <path d="M6.28 5.22a.75.75 0 0 0-1.06 1.06L8.94 10l-3.72 3.72a.75.75 0 1 0 1.06 1.06L10 11.06l3.72 3.72a.75.75 0 1 0 1.06-1.06L11.06 10l3.72-3.72a.75.75 0 0 0-1.06-1.06L10 8.94 6.28 5.22Z" />
                              </svg>
                            </button>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <div className="flex flex-col items-center justify-center py-12 text-gray-500 border border-dashed border-white/10 rounded-xl bg-white/5">
                        <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-8 h-8 mb-2 opacity-50">
                          <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 14.25v-2.625a3.375 3.375 0 0 0-3.375-3.375h-1.5A1.125 1.125 0 0 1 13.5 7.125v-1.5a3.375 3.375 0 0 0-3.375-3.375H8.25m0 12.75h7.5m-7.5 3H12M10.5 2.25H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 0 0-9-9Z" />
                        </svg>
                        <p className="text-sm">尚未加入任何影片</p>
                      </div>
                    )}
                  </div>
                </div>
              )}
            </div>

            {/* Modal Footer */}
            <div className="p-6 border-t border-white/5 bg-black/20 flex justify-end gap-3">
              <button 
                type="button" 
                onClick={() => {
                  setIsCreating(false);
                  setStep(1);
                  setNewRoomName('');
                  setNewRoomDescription('');
                  setPlaylist([]);
                }}
                className="btn btn-ghost hover:bg-white/10 text-gray-400 hover:text-white"
              >
                取消
              </button>
              
              {step === 1 ? (
                <button 
                  onClick={() => setStep(2)}
                  className="btn bg-white text-black hover:bg-gray-200 border-none px-8 rounded-xl font-bold"
                  disabled={!newRoomName.trim()}
                >
                  下一步
                </button>
              ) : (
                <>
                  <button 
                    onClick={() => setStep(1)}
                    className="btn btn-ghost hover:bg-white/10 text-white"
                  >
                    上一步
                  </button>
                  <button 
                    onClick={handleCreateRoom}
                    className="btn bg-purple-600 hover:bg-purple-700 text-white border-none px-6 rounded-xl shadow-lg shadow-purple-900/20"
                  >
                    創建房間 ({playlist.length} 影片)
                  </button>
                </>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default Lobby;
