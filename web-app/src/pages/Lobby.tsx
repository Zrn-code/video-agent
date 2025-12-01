import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import Header from '../components/Header';
import AICompanionManager from '../components/AICompanionManager';
import type { Room } from '../types';
import { optimizeAvatarUrl, avatarSizes } from '../utils/imageOptimizer';

const RoomTimeDisplay = ({ videoState }: { videoState: any }) => {
  const [currentTime, setCurrentTime] = useState(videoState.played);

  useEffect(() => {
    // 如果正在播放，實時更新播放時間
    if (videoState.playing) {
      const updateTime = () => {
        const now = Date.now() / 1000;
        const elapsed = now - videoState.lastUpdated;
        const newTime = videoState.played + (elapsed * videoState.playbackRate);
        setCurrentTime(newTime);
      };

      updateTime();
      const interval = setInterval(updateTime, 100); // 每100ms更新一次
      return () => clearInterval(interval);
    } else {
      setCurrentTime(videoState.played);
    }
  }, [videoState.playing, videoState.played, videoState.lastUpdated, videoState.playbackRate]);

  const formatTime = (seconds: number) => {
    if (!seconds || isNaN(seconds)) return '00:00';
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  return (
    <div className="flex items-center gap-2">
      <div className={`w-1.5 h-1.5 rounded-full ${videoState.playing ? 'bg-green-500 animate-pulse' : 'bg-yellow-500'}`}></div>
      <span className="text-xs font-mono text-gray-400">
        {formatTime(currentTime)} / {formatTime(videoState.duration)}
      </span>
    </div>
  );
};

const JoinRoomModal = ({ room, onClose, onJoin }: { room: Room; onClose: () => void; onJoin: (nickname: string, avatar: string) => void }) => {
  const [nickname, setNickname] = useState(() => localStorage.getItem('video_agent_username') || '');
  const [avatar, setAvatar] = useState(() => localStorage.getItem('video_agent_avatar') || `https://api.dicebear.com/7.x/avataaars/svg?seed=${Math.random()}`);
  const [showPlaylist, setShowPlaylist] = useState(false);

  const randomizeAvatar = () => {
    setAvatar(`https://api.dicebear.com/7.x/avataaars/svg?seed=${Math.random().toString(36).substr(2, 9)}`);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-fade-in">
      <div className="bg-[#1a1a1a] rounded-2xl w-full max-w-md overflow-hidden border border-white/10 shadow-2xl transform transition-all scale-100">
        {/* Header */}
        <div className="p-6 border-b border-white/5 bg-gradient-to-r from-purple-900/20 to-blue-900/20">
          <h2 className="text-2xl font-bold text-white mb-1">{room.name}</h2>
          <div className="flex items-center gap-2 text-sm text-gray-400">
            <span className="flex items-center gap-1">
              <div className={`w-2 h-2 rounded-full ${room.videoState?.playing ? 'bg-green-500' : 'bg-yellow-500'}`} />
              {room.videoState?.playing ? '播放中' : '暫停中'}
            </span>
            <span>•</span>
            <span>{room.userCount} 人在線</span>
          </div>
        </div>

        <div className="p-6 space-y-6">
          {/* Room Info Preview */}
          <div className="space-y-3">
            <h3 className="text-xs font-bold text-gray-500 uppercase tracking-wider">正在播放</h3>
            {room.currentVideo ? (
              <div className="flex gap-3 bg-white/5 p-3 rounded-lg border border-white/5">
                <img src={optimizeAvatarUrl(room.currentVideo.thumbnailUrl, avatarSizes.small)} alt="Thumbnail" loading="lazy" className="w-20 h-12 object-cover rounded" />
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-white truncate">{room.currentVideo.title}</p>
                  <p className="text-xs text-gray-400 truncate">{room.currentVideo.channelTitle}</p>
                </div>
              </div>
            ) : (
              <div className="text-sm text-gray-500 italic">目前沒有播放影片</div>
            )}
            
            {room.queue && room.queue.length > 0 && (
              <div className="pt-2">
                <button 
                  onClick={() => setShowPlaylist(!showPlaylist)}
                  className="text-xs text-purple-400 hover:text-purple-300 flex items-center gap-1 transition-colors"
                >
                  {showPlaylist ? '隱藏播放清單' : `查看播放清單 (${room.queue.length})`}
                  <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className={`w-4 h-4 transition-transform ${showPlaylist ? 'rotate-180' : ''}`}>
                    <path fillRule="evenodd" d="M5.23 7.21a.75.75 0 011.06.02L10 11.168l3.71-3.938a.75.75 0 111.08 1.04l-4.25 4.5a.75.75 0 01-1.08 0l-4.25-4.5a.75.75 0 01.02-1.06z" clipRule="evenodd" />
                  </svg>
                </button>
                
                {showPlaylist && (
                  <div className="mt-2 pl-2 border-l-2 border-white/10 space-y-2 max-h-32 overflow-y-auto custom-scrollbar">
                    {room.queue.map((video, idx) => (
                      <div key={idx} className="text-xs text-gray-400 truncate flex gap-2">
                        <span className="text-gray-600 w-4">{idx + 1}.</span>
                        <span className="truncate">{video.title}</span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>

          {/* User Setup */}
          <div className="space-y-4 pt-4 border-t border-white/5">
            <h3 className="text-xs font-bold text-gray-500 uppercase tracking-wider">加入身分設定</h3>
            <div className="flex items-center gap-4">
              <button 
                onClick={randomizeAvatar}
                className="relative group w-16 h-16 rounded-full overflow-hidden border-2 border-white/10 hover:border-purple-500 transition-colors"
                title="點擊更換頭像"
              >
                <img src={optimizeAvatarUrl(avatar, avatarSizes.small)} alt="Avatar" loading="lazy" className="w-full h-full object-cover bg-gray-800" />
                <div className="absolute inset-0 bg-black/50 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                  <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="w-5 h-5 text-white">
                    <path fillRule="evenodd" d="M15.312 11.424a5.5 5.5 0 0 1-9.201 2.466l-.312-.311h-2.433a2.5 2.5 0 0 0-2.45 2.534 6.002 6.002 0 0 1 13.943-2.28l.453-.709ZM6 8.5a2 2 0 1 1-4 0 2 2 0 0 1 4 0Z" clipRule="evenodd" />
                  </svg>
                </div>
              </button>
              <div className="flex-1">
                <input
                  type="text"
                  value={nickname}
                  onChange={(e) => setNickname(e.target.value)}
                  placeholder="輸入您的暱稱..."
                  className="w-full bg-black/20 border border-white/10 rounded-lg px-4 py-2.5 text-white placeholder-gray-500 focus:outline-none focus:border-purple-500 transition-colors"
                />
              </div>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="p-6 pt-0 flex gap-3">
          <button 
            onClick={onClose}
            className="flex-1 px-4 py-3 rounded-xl font-medium text-gray-400 hover:bg-white/5 hover:text-white transition-colors"
          >
            取消
          </button>
          <button 
            onClick={() => onJoin(nickname, avatar)}
            disabled={!nickname.trim()}
            className="flex-1 px-4 py-3 rounded-xl font-bold text-white bg-gradient-to-r from-purple-600 to-blue-600 hover:from-purple-500 hover:to-blue-500 disabled:opacity-50 disabled:cursor-not-allowed shadow-lg shadow-purple-900/20 transition-all hover:scale-[1.02]"
          >
            進入房間
          </button>
        </div>
      </div>
    </div>
  );
};

const Lobby = () => {
  const navigate = useNavigate();
  // Room state
  const [rooms, setRooms] = useState<Room[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [selectedRoom, setSelectedRoom] = useState<Room | null>(null);
  
  // Pagination state
  const [currentPage, setCurrentPage] = useState(1);
  const [roomsPerPage, setRoomsPerPage] = useState(10);

  useEffect(() => {
    const handleResize = () => {
      const width = window.innerWidth;
      if (width >= 1280) { // xl: 5 cols
        setRoomsPerPage(20);
      } else if (width >= 1024) { // lg: 4 cols
        setRoomsPerPage(16);
      } else if (width >= 768) { // md: 3 cols
        setRoomsPerPage(12);
      } else { // 2 cols
        setRoomsPerPage(10);
      }
    };

    handleResize();
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  // Fetch rooms
  const fetchRooms = async () => {
    try {
      const response = await fetch(`${import.meta.env.VITE_API_URL}/api/rooms`);
      if (response.ok) {
        const data = await response.json();
        // console.log('Fetched rooms:', data.length, 'rooms');
        setRooms(data);
      } else {
        console.error('Failed to fetch rooms, status:', response.status);
      }
    } catch (error) {
      console.error('Failed to fetch rooms:', error);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchRooms();
    const interval = setInterval(fetchRooms, 2000); // 放寬到2秒，避免過於頻繁
    return () => clearInterval(interval);
  }, []);

  const handleCardClick = (room: Room) => {
    setSelectedRoom(room);
  };

  const handleConfirmJoin = (nickname: string, avatar: string) => {
    if (!selectedRoom) return;
    
    // Save user info
    localStorage.setItem('video_agent_username', nickname);
    localStorage.setItem('video_agent_avatar', avatar);
    
    // Navigate
    navigate(`/room/${selectedRoom.id}`);
  };

  const getThumbnailUrl = (url: string) => {
    try {
      const videoId = url.split('v=')[1]?.split('&')[0];
      if (videoId) return `https://img.youtube.com/vi/${videoId}/hqdefault.jpg`;
    } catch (e) { return null; }
    return null;
  };

  // Pagination Logic
  const indexOfLastRoom = currentPage * roomsPerPage;
  const indexOfFirstRoom = indexOfLastRoom - roomsPerPage;
  const currentRooms = rooms.slice(indexOfFirstRoom, indexOfLastRoom);
  const totalPages = Math.ceil(rooms.length / roomsPerPage);

  useEffect(() => {
    if (currentPage > totalPages && totalPages > 0) {
      setCurrentPage(totalPages);
    }
  }, [totalPages, currentPage]);

  const nextPage = () => setCurrentPage(prev => Math.min(prev + 1, totalPages));
  const prevPage = () => setCurrentPage(prev => Math.max(prev - 1, 1));

  return (
    <div className="h-screen w-full overflow-y-scroll snap-y snap-mandatory bg-[#050505] text-white font-sans selection:bg-purple-500/30 scroll-smooth scrollbar-hidden">
      <Header />

      {/* Hero Section */}
      <div className="relative h-screen w-full flex items-center justify-center px-4 overflow-hidden snap-start shrink-0">
        <div className="absolute top-0 left-1/2 -translate-x-1/2 w-full h-full max-w-7xl pointer-events-none">
          <div className="absolute top-20 left-1/4 w-96 h-96 bg-purple-600/20 rounded-full blur-[120px] animate-pulse" />
          <div className="absolute bottom-20 right-1/4 w-96 h-96 bg-blue-600/10 rounded-full blur-[120px]" />
        </div>

        <div className="relative max-w-4xl mx-auto text-center space-y-8 z-10">
          <h1 className="text-5xl md:text-7xl font-bold tracking-tight">
            <span className="bg-clip-text text-transparent bg-gradient-to-r from-white via-gray-200 to-gray-400">
              隨時隨地，溫暖相伴
            </span>
            <br />
            <span className="bg-clip-text text-transparent bg-gradient-to-r from-purple-400 to-pink-400">
              您的專屬智慧影伴
            </span>
          </h1>
          <p className="text-lg md:text-xl text-gray-400 max-w-2xl mx-auto leading-relaxed">
            告別獨自觀影的孤單，享受有人分享的喜悅。
            <br className="hidden md:block" />
            在這裡，每一個精彩瞬間都有回應，讓陪伴成為最溫暖的日常。
          </p>
          
          <div className="flex flex-col sm:flex-row items-center justify-center gap-4 pt-4">
            <button 
              onClick={() => navigate('/create')}
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

      <main id="rooms-section" className="h-screen w-full max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-20 pb-4 snap-start shrink-0 flex flex-col">
        
        <div className="mb-4 flex items-end justify-between">
          <div className="space-y-2">
            <h2 className="text-3xl font-bold text-white">探索放映室</h2>
            <p className="text-gray-400">尋找您的觀影夥伴，共享歡樂時光，不再感到孤單</p>
          </div>
          <button 
            onClick={() => navigate('/create')}
            className="hidden md:flex items-center gap-2 px-4 py-2 bg-white/10 hover:bg-white/20 text-white rounded-full transition-colors border border-white/10"
          >
            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className="w-5 h-5">
              <path fillRule="evenodd" d="M12 3.75a.75.75 0 0 1 .75.75v6.75h6.75a.75.75 0 0 1 0 1.5h-6.75v6.75a.75.75 0 0 1-1.5 0v-6.75H4.5a.75.75 0 0 1 0-1.5h6.75V4.5a.75.75 0 0 1 .75-.75Z" clipRule="evenodd" />
            </svg>
            創建房間
          </button>
        </div>

        {/* Room Grid */}
        <div className="flex-1 flex flex-col min-h-0">
        {isLoading ? (
           <div className="flex flex-col items-center justify-center h-full space-y-4">
             <span className="loading loading-spinner loading-lg text-purple-500"></span>
             <p className="text-gray-500 animate-pulse">正在尋找精彩房間...</p>
           </div>
        ) : (
           <>
             <div className="flex-1 overflow-y-auto min-h-0 pr-2 custom-scrollbar">
               <div 
                 key={currentPage}
                 className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-4 pb-4 animate-fade-in"
               >
               {currentRooms.map((room) => {
                 const thumbnailUrl = getThumbnailUrl(room.videoState.url);
                 
                 return (
                   <div 
                     key={room.id} 
                     onClick={() => handleCardClick(room)}
                     className="group relative bg-[#121212] rounded-xl overflow-hidden border border-white/5 hover:border-purple-500/50 transition-all duration-300 hover:-translate-y-1 hover:shadow-lg hover:shadow-purple-900/10 cursor-pointer"
                   >
                     {/* Image Container */}
                     <div className="relative aspect-video overflow-hidden">
                       <div className="absolute inset-0 bg-gradient-to-t from-[#121212] via-transparent to-transparent z-10 opacity-60" />
                       
                       {thumbnailUrl ? (
                         <img 
                           src={optimizeAvatarUrl(thumbnailUrl, 600, 85)} 
                           alt="Thumbnail"
                           loading="lazy" 
                           className="w-full h-full object-cover transform group-hover:scale-105 transition-transform duration-500"
                         />
                       ) : (
                         <div className="w-full h-full bg-gray-900 flex items-center justify-center">
                           <span className="text-gray-700 text-4xl font-bold opacity-20">ROOM</span>
                         </div>
                       )}
                       
                       <div className="absolute top-2 right-2 z-20 flex flex-col items-end gap-1">
                         {room.videoState.url && (
                            <div className="bg-black/60 backdrop-blur-md rounded-full px-3 py-1 border border-white/10">
                              <RoomTimeDisplay videoState={room.videoState} />
                            </div>
                         )}
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
                       <h3 className="text-sm font-bold text-white mb-3 line-clamp-1 group-hover:text-purple-400 transition-colors">
                         {room.name}
                       </h3>
                       
                       <div className="flex items-center justify-between pt-2 border-t border-white/5">
                         <div className="flex -space-x-1.5 overflow-hidden pl-1">
                           {room.users && room.users.length > 0 ? (
                             room.users.slice(0, 4).map((user, i) => (
                               <img 
                                 key={i} 
                                 src={optimizeAvatarUrl(user.avatar, avatarSizes.thumbnail)} 
                                 alt={user.username}
                                 loading="lazy"
                                 className="inline-block h-5 w-5 rounded-full ring-2 ring-[#121212] bg-gray-800 object-cover"
                                 title={user.username}
                               />
                             ))
                           ) : (
                             <div className="h-5 w-5 rounded-full ring-2 ring-[#121212] bg-gray-800 flex items-center justify-center text-[8px] text-gray-500">
                               0
                             </div>
                           )}
                           {room.users && room.users.length > 4 && (
                             <div className="h-5 w-5 rounded-full ring-2 ring-[#121212] bg-gray-800 flex items-center justify-center text-[8px] text-gray-400 font-medium">
                               +{room.users.length - 4}
                             </div>
                           )}
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

             </div>

             {/* Pagination Controls */}
             {totalPages > 0 && (
               <div className="flex justify-center items-center gap-4 pt-2 pb-4 shrink-0 border-t border-white/5">
                 <button 
                   onClick={prevPage} 
                   disabled={currentPage === 1}
                   className="p-2 rounded-full bg-white/5 hover:bg-white/10 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
                 >
                   <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-6 h-6">
                     <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 19.5 8.25 12l7.5-7.5" />
                   </svg>
                 </button>
                 
                 <span className="text-sm font-medium text-gray-400">
                   第 {currentPage} 頁，共 {totalPages} 頁
                 </span>
                 
                 <button 
                   onClick={nextPage} 
                   disabled={currentPage === totalPages}
                   className="p-2 rounded-full bg-white/5 hover:bg-white/10 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
                 >
                   <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-6 h-6">
                     <path strokeLinecap="round" strokeLinejoin="round" d="m8.25 4.5 7.5 7.5-7.5 7.5" />
                   </svg>
                 </button>
               </div>
             )}
           </>
        )}
        </div>
      </main>

      {/* AI Companion Section */}
      <section className="h-screen w-full bg-[#0a0a0a] snap-start shrink-0 overflow-hidden">
        <AICompanionManager />
      </section>

      {/* Join Room Modal */}
      {selectedRoom && (
        <JoinRoomModal 
          room={selectedRoom} 
          onClose={() => setSelectedRoom(null)} 
          onJoin={handleConfirmJoin} 
        />
      )}
    </div>
  );
};

export default Lobby;
