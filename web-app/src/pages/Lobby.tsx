import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import Header from '../components/Header';


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
  const [isLoading, setIsLoading] = useState(true);

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


    </div>
  );
};

export default Lobby;
