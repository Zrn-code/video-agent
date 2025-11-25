import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import Header from '../components/Header';

interface Room {
  id: string;
  name: string;
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
  const [activeCategory, setActiveCategory] = useState('全部');

  // Mock data
  const categories = ['全部', '電影', '雜談', '音樂', '美食', '經典', '放鬆', '遊戲', '健康'];
  
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

  const handleCreateRoom = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newRoomName.trim()) return;

    try {
      const response = await fetch(`${import.meta.env.VITE_API_URL}/api/rooms`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
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
    <div className="min-h-screen bg-[#050505] text-white pb-20 font-sans">
      <Header />

      <main className="max-w-6xl mx-auto px-4 pt-20">
        {/* Hero Section Removed */}

        {/* All Rooms */}
        <section>
           <div className="flex items-center justify-between mb-6">
             <div className="flex items-center gap-3">
               <div className="p-2 bg-[#1a1a1a] rounded-lg border border-white/5">
                 <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-5 h-5 text-purple-400">
                   <path strokeLinecap="round" strokeLinejoin="round" d="m15.75 10.5 4.72-4.72a.75.75 0 0 1 1.28.53v11.38a.75.75 0 0 1-1.28.53l-4.72-4.72M4.5 18.75h9a2.25 2.25 0 0 0 2.25-2.25v-9a2.25 2.25 0 0 0-2.25-2.25h-9A2.25 2.25 0 0 0 2.25 7.5v9a2.25 2.25 0 0 0 2.25 2.25Z" />
                 </svg>
               </div>
               <div>
                 <h2 className="text-xl font-bold">所有房間</h2>
                 <p className="text-xs text-gray-500 mt-0.5">現在就加入，立即觀看</p>
               </div>
             </div>
             
             {/* Create Room Button */}
             <button 
               onClick={() => setIsCreating(true)}
               className="btn btn-sm bg-purple-600 hover:bg-purple-700 text-white border-none gap-2 rounded-lg shadow-lg shadow-purple-900/20"
             >
               <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="w-4 h-4">
                 <path d="M10.75 4.75a.75.75 0 0 0-1.5 0v4.5h-4.5a.75.75 0 0 0 0 1.5h4.5v4.5a.75.75 0 0 0 1.5 0v-4.5h4.5a.75.75 0 0 0 0-1.5h-4.5v-4.5Z" />
               </svg>
               創建房間
             </button>
           </div>
           
           {/* Categories */}
           <div className="flex gap-2 mb-8 overflow-x-auto pb-2 scrollbar-hide">
             {categories.map(cat => (
               <button 
                 key={cat} 
                 onClick={() => setActiveCategory(cat)}
                 className={`px-5 py-2 rounded-xl text-sm font-medium transition-all duration-200 whitespace-nowrap ${
                   activeCategory === cat 
                     ? 'bg-purple-600 text-white shadow-lg shadow-purple-900/20' 
                     : 'bg-[#1a1a1a] text-gray-400 hover:bg-[#252525] hover:text-gray-200 border border-white/5'
                 }`}
               >
                 {cat}
               </button>
             ))}
           </div>

           {/* Room Grid */}
           {isLoading ? (
             <div className="flex justify-center py-20">
               <span className="loading loading-spinner loading-lg text-purple-500"></span>
             </div>
           ) : (
             <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-6">
               {rooms.map((room, index) => {
                 const meta = getRoomMeta(index);
                 const thumbnailUrl = getThumbnailUrl(room.videoState.url);
                 
                 return (
                   <div 
                     key={room.id} 
                     onClick={() => handleJoinRoom(room.id)}
                     className="group bg-[#121212] rounded-2xl border border-white/5 overflow-hidden hover:border-purple-500/30 transition-all duration-300 hover:-translate-y-1 cursor-pointer"
                   >
                     <figure className="relative aspect-video bg-black">
                       {thumbnailUrl ? (
                         <img 
                           src={thumbnailUrl} 
                           alt="Thumbnail" 
                           className="w-full h-full object-cover opacity-80 group-hover:opacity-100 transition-opacity duration-300"
                         />
                       ) : (
                         <img 
                           src={meta.image} 
                           alt="Cover" 
                           className="w-full h-full object-cover opacity-80 group-hover:opacity-100 transition-opacity duration-300"
                         />
                       )}
                       
                       <div className="absolute top-3 left-3">
                         <span className="px-2 py-1 rounded-md bg-gray-900/80 backdrop-blur-sm text-[10px] font-medium text-gray-300 border border-white/10">
                           {meta.category}
                         </span>
                       </div>

                       <div className="absolute top-3 right-3">
                         <span className="flex items-center gap-1.5 px-2 py-1 rounded-full bg-red-500/90 text-white text-[10px] font-bold shadow-sm animate-pulse">
                           <span className="w-1.5 h-1.5 rounded-full bg-white"></span>
                           直播中
                         </span>
                       </div>
                       
                       <div className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity duration-300 bg-black/20">
                         <div className="w-12 h-12 rounded-full bg-white/10 backdrop-blur-md flex items-center justify-center border border-white/20 transform scale-90 group-hover:scale-100 transition-transform">
                           <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className="w-6 h-6 text-white">
                             <path d="M8 5v14l11-7z" />
                           </svg>
                         </div>
                       </div>
                     </figure>
                     
                     <div className="p-4">
                       <h3 className="text-base font-bold text-white mb-1 line-clamp-1 group-hover:text-purple-400 transition-colors">
                         {room.name}
                       </h3>
                       <p className="text-xs text-gray-500 mb-3 line-clamp-1">
                         {room.videoState.url ? '正在播放影片' : '等待播放中...'}
                       </p>
                       
                       <div className="flex items-center justify-between">
                         <div className="flex items-center gap-1.5 text-xs text-gray-400">
                           <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="w-3.5 h-3.5">
                             <path d="M7 8a3 3 0 1 0 0-6 3 3 0 0 0 0 6ZM14.5 9a2.5 2.5 0 1 0 0-5 2.5 2.5 0 0 0 0 5ZM1.615 16.428a1.224 1.224 0 0 1-.569-1.175 6.002 6.002 0 0 1 11.532-2.411 1.002 1.002 0 0 1-1.455 1.405 4.002 4.002 0 0 0-7.908 1.773.992.992 0 0 1-.909.56 1.002 1.002 0 0 1-.691-.152ZM14.427 15.539a6 6 0 0 1-6.66-1.63 1 1 0 1 1 1.414-1.414 4.002 4.002 0 0 0 5.535 1.098 1.002 1.002 0 1 1 .963 1.794 6.002 6.002 0 0 1-1.252.152Z" />
                           </svg>
                           {room.userCount} 人觀看中
                         </div>
                       </div>
                     </div>
                   </div>
                 );
               })}
             </div>
           )}
        </section>
      </main>

      {/* Create Room Modal */}
      {isCreating && (
        <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-50 backdrop-blur-sm">
          <div className="bg-[#1a1a1a] p-8 rounded-2xl w-full max-w-md border border-white/10 shadow-2xl">
            <h3 className="text-2xl font-bold mb-6 text-white">創建新房間</h3>
            <form onSubmit={handleCreateRoom}>
              <div className="form-control w-full mb-6">
                <label className="label">
                  <span className="label-text text-gray-300">房間名稱</span>
                </label>
                <input 
                  type="text" 
                  placeholder="例如：週五恐怖夜" 
                  className="input input-bordered bg-black/50 border-white/20 focus:border-purple-500 w-full text-white"
                  value={newRoomName}
                  onChange={(e) => setNewRoomName(e.target.value)}
                  autoFocus
                />
              </div>
              <div className="flex justify-end gap-3">
                <button 
                  type="button" 
                  onClick={() => setIsCreating(false)}
                  className="btn btn-ghost hover:bg-white/10 text-gray-300"
                >
                  取消
                </button>
                <button 
                  type="submit" 
                  className="btn bg-purple-600 hover:bg-purple-700 text-white border-none"
                  disabled={!newRoomName.trim()}
                >
                  創建
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default Lobby;
