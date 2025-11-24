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
  const [showAuthModal, setShowAuthModal] = useState(false);
  const [authMode, setAuthMode] = useState<'login' | 'register'>('login');
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [accountId, setAccountId] = useState('');
  const [authPassword, setAuthPassword] = useState('');
  const [authNickname, setAuthNickname] = useState('');
  const [authError, setAuthError] = useState('');
  const [username, setUsername] = useState('');
  const [avatar, setAvatar] = useState('');

  // Room state
  const [rooms, setRooms] = useState<Room[]>([]);
  const [isCreating, setIsCreating] = useState(false);
  const [newRoomName, setNewRoomName] = useState('');
  const [isLoading, setIsLoading] = useState(true);
  const [activeCategory, setActiveCategory] = useState('全部');

  // Mock data
  const categories = ['全部', '電影', '雜談', '音樂', '美食', '經典', '放鬆', '遊戲', '健康'];
  
  const scheduledRooms = [
    {
      id: 's1',
      title: '週三電影之夜 🎬',
      time: '週三 23:30',
      daysLeft: '2 天後',
      description: '每週三晚上 8 點，我們一起欣賞精選電影！這是一個固定的weekly活動，我們會播放經典科幻電影，歡迎所有電影愛好者加入。',
      image: 'https://images.unsplash.com/photo-1489599849927-2ee91cede3ba?q=80&w=2070&auto=format&fit=crop',
      playlistCount: 3,
      playlistImages: [
        'https://images.unsplash.com/photo-1536440136628-849c177e76a1?q=80&w=100&auto=format&fit=crop',
        'https://images.unsplash.com/photo-1517604931442-71053e3e2e3c?q=80&w=100&auto=format&fit=crop'
      ],
      reservedCount: 10,
      avatars: ['https://api.dicebear.com/7.x/avataaars/svg?seed=1', 'https://api.dicebear.com/7.x/avataaars/svg?seed=2', 'https://api.dicebear.com/7.x/avataaars/svg?seed=3']
    },
    {
      id: 's2',
      title: '美食紀錄片 🍜',
      time: '週四 18:30',
      daysLeft: '4 天後',
      description: '週六下午 3 點，探索世界美食文化！讓我們一起看紀錄片，探索世界各地的美食故事與烹飪秘訣。',
      image: 'https://images.unsplash.com/photo-1504674900247-0877df9cc836?q=80&w=2070&auto=format&fit=crop',
      playlistCount: 4,
      playlistImages: [
        'https://images.unsplash.com/photo-1546069901-ba9599a7e63c?q=80&w=100&auto=format&fit=crop',
        'https://images.unsplash.com/photo-1565299624946-b28f40a0ae38?q=80&w=100&auto=format&fit=crop',
        'https://images.unsplash.com/photo-1567620905732-2d1ec7ab7445?q=80&w=100&auto=format&fit=crop'
      ],
      reservedCount: 5,
      avatars: ['https://api.dicebear.com/7.x/avataaars/svg?seed=4', 'https://api.dicebear.com/7.x/avataaars/svg?seed=5']
    },
    {
      id: 's3',
      title: '週日早晨瑜伽 🧘‍♀️',
      time: '週五 12:30',
      daysLeft: '5 天後',
      description: '週日早上 9 點，一起做瑜伽開啟美好的一天！透過溫和的瑜伽練習，喚醒身體能量，為新的一週做好準備。',
      image: 'https://images.unsplash.com/photo-1544367563-121910aa662f?q=80&w=2070&auto=format&fit=crop',
      playlistCount: 3,
      playlistImages: [
        'https://images.unsplash.com/photo-1599901860904-17e6ed7083a0?q=80&w=100&auto=format&fit=crop',
        'https://images.unsplash.com/photo-1518611012118-696072aa579a?q=80&w=100&auto=format&fit=crop'
      ],
      reservedCount: 3,
      avatars: ['https://api.dicebear.com/7.x/avataaars/svg?seed=6', 'https://api.dicebear.com/7.x/avataaars/svg?seed=7']
    }
  ];

  // Check if user is logged in
  useEffect(() => {
    const storedAccountId = localStorage.getItem('video_agent_account_id');
    const storedUsername = localStorage.getItem('video_agent_username');
    const storedAvatar = localStorage.getItem('video_agent_avatar');
    if (storedAccountId) {
      setIsLoggedIn(true);
      setUsername(storedUsername || '');
      setAvatar(storedAvatar || '');
    }
  }, []);

  // Fetch rooms
  const fetchRooms = async () => {
    try {
      const response = await fetch('http://localhost:8000/api/rooms');
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
      const response = await fetch('http://localhost:8000/api/rooms', {
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

  const handleLogin = async () => {
    setAuthError('');
    try {
      const response = await fetch('http://localhost:8000/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ accountId, password: authPassword })
      });
      
      const data = await response.json();
      
      if (data.success) {
        localStorage.setItem('video_agent_userid', data.userId);
        localStorage.setItem('video_agent_account_id', data.accountId);
        localStorage.setItem('video_agent_username', data.nickname);
        localStorage.setItem('video_agent_avatar', data.avatar);
        
        setUsername(data.nickname);
        setAvatar(data.avatar);
        setIsLoggedIn(true);
        setShowAuthModal(false);
        setAuthPassword('');
      } else {
        setAuthError(data.message);
      }
    } catch (error) {
      setAuthError('登入失敗，請稍後再試');
    }
  };

  const handleRegister = async () => {
    setAuthError('');
    if (!accountId || !authPassword || !authNickname) {
      setAuthError('請填寫所有欄位');
      return;
    }
    try {
      const response = await fetch('http://localhost:8000/api/auth/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ accountId, password: authPassword, nickname: authNickname })
      });
      
      const data = await response.json();
      
      if (data.success) {
        localStorage.setItem('video_agent_userid', data.userId);
        localStorage.setItem('video_agent_account_id', data.accountId);
        localStorage.setItem('video_agent_username', data.nickname);
        localStorage.setItem('video_agent_avatar', data.avatar);
        
        setUsername(data.nickname);
        setAvatar(data.avatar);
        setIsLoggedIn(true);
        setShowAuthModal(false);
        setAuthPassword('');
        setAuthNickname('');
      } else {
        setAuthError(data.message);
      }
    } catch (error) {
      setAuthError('註冊失敗，請稍後再試');
    }
  };

  const handleLogout = () => {
    localStorage.removeItem('video_agent_account_id');
    setIsLoggedIn(false);
    setUsername('');
    setAvatar('');
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
      <Header 
        isLoggedIn={isLoggedIn}
        userInfo={isLoggedIn ? { accountId, nickname: username, avatar } : undefined}
        onLoginClick={() => setShowAuthModal(true)}
        onLogout={handleLogout}
      />
      
      {/* Create Room Button (Fixed Top Right) */}
      <div className="fixed top-4 right-24 z-50">
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

      <main className="max-w-[1400px] mx-auto px-6 pt-24">
        {/* Hero Section */}
        <div className="text-center mb-16">
           <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-[#1a1a2e] text-purple-400 text-xs font-medium mb-6 border border-purple-500/20">
             <span className="animate-pulse">✨</span> 與朋友一起享受觀影樂趣
           </div>
           <h1 className="text-4xl md:text-5xl font-bold mb-4 tracking-tight">探索觀影間</h1>
           <p className="text-gray-400 text-lg">加入直播房間、預約活動或創建自己的觀影空間</p>
        </div>

        {/* Scheduled Rooms */}
        <section className="mb-20">
          <div className="flex items-center justify-between mb-8">
             <div className="flex items-center gap-3">
               <div className="p-2 bg-[#1a1a1a] rounded-lg border border-white/5">
                 <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-5 h-5 text-purple-400">
                   <path strokeLinecap="round" strokeLinejoin="round" d="M6.75 3v2.25M17.25 3v2.25M3 18.75V7.5a2.25 2.25 0 0 1 2.25-2.25h13.5A2.25 2.25 0 0 1 21 7.5v11.25m-18 0A2.25 2.25 0 0 0 5.25 21h13.5A2.25 2.25 0 0 0 21 18.75m-18 0v-7.5A2.25 2.25 0 0 1 5.25 9h13.5A2.25 2.25 0 0 1 21 11.25v7.5" />
                 </svg>
               </div>
               <div>
                 <h2 className="text-xl font-bold">預約房間</h2>
                 <p className="text-xs text-gray-500 mt-0.5">固定時間的定期活動，點擊查看詳情並預約</p>
               </div>
             </div>
             <button className="text-sm text-gray-500 hover:text-white flex items-center gap-1 transition-colors">
               查看全部 
               <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="w-4 h-4">
                 <path fillRule="evenodd" d="M7.21 14.77a.75.75 0 0 1 .02-1.06L11.168 10 7.23 6.29a.75.75 0 1 1 1.04-1.08l4.5 4.25a.75.75 0 0 1 0 1.08l-4.5 4.25a.75.75 0 0 1-1.06-.02Z" clipRule="evenodd" />
               </svg>
             </button>
          </div>
          
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
             {scheduledRooms.map(room => (
               <div key={room.id} className="group bg-[#121212] rounded-2xl border border-white/5 overflow-hidden hover:border-purple-500/30 transition-all duration-300 hover:shadow-2xl hover:shadow-purple-900/10">
                 <div className="relative h-48 overflow-hidden">
                   <img src={room.image} alt={room.title} className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500" />
                   <div className="absolute inset-0 bg-gradient-to-t from-[#121212] to-transparent opacity-80"></div>
                   <div className="absolute top-4 left-4">
                     <span className="px-3 py-1 rounded-full bg-blue-500 text-white text-xs font-bold shadow-lg">
                       {room.time}
                     </span>
                   </div>
                   <div className="absolute bottom-4 left-4 right-4 flex justify-between items-end">
                     <span className="px-3 py-1 rounded-full bg-black/50 backdrop-blur-md border border-white/10 text-xs text-gray-300">
                       {room.daysLeft}
                     </span>
                     <button className="px-4 py-1.5 rounded-full bg-blue-600/20 hover:bg-blue-600 text-blue-400 hover:text-white text-xs font-medium border border-blue-500/30 transition-all flex items-center gap-1.5">
                       <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="w-3.5 h-3.5">
                         <path fillRule="evenodd" d="M10 18a8 8 0 1 0 0-16 8 8 0 0 0 0 16Zm.75-13.5a.75.75 0 0 0-1.5 0v5c0 .414.336.75.75.75l2.998 1.5a.75.75 0 0 0 .752-1.34l-2.5-1.25V4.5Z" clipRule="evenodd" />
                       </svg>
                       預約
                     </button>
                   </div>
                 </div>
                 <div className="p-5">
                   <h3 className="text-lg font-bold text-white mb-2 group-hover:text-purple-400 transition-colors">{room.title}</h3>
                   <p className="text-sm text-gray-400 line-clamp-2 mb-4 leading-relaxed">{room.description}</p>
                   
                   <div className="flex items-center gap-2 mb-4">
                     <div className="flex items-center gap-1 text-xs text-gray-500">
                       <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="w-4 h-4">
                         <path fillRule="evenodd" d="M2 4.75A.75.75 0 0 1 2.75 4h14.5a.75.75 0 0 1 0 1.5H2.75A.75.75 0 0 1 2 4.75Zm0 10.5a.75.75 0 0 1 .75-.75h7.5a.75.75 0 0 1 0 1.5h-7.5a.75.75 0 0 1-.75-.75ZM2 10a.75.75 0 0 1 .75-.75h14.5a.75.75 0 0 1 0 1.5H2.75A.75.75 0 0 1 2 10Z" clipRule="evenodd" />
                       </svg>
                       {room.playlistCount} 部影片
                     </div>
                     <div className="flex gap-1">
                       {room.playlistImages.map((img, i) => (
                         <div key={i} className="w-8 h-5 rounded overflow-hidden border border-white/10">
                           <img src={img} alt="" className="w-full h-full object-cover" />
                         </div>
                       ))}
                       {room.playlistCount > 2 && (
                         <div className="w-8 h-5 rounded bg-[#2a2a2a] flex items-center justify-center text-[10px] text-gray-500 border border-white/10">
                           +{room.playlistCount - 2}
                         </div>
                       )}
                     </div>
                   </div>

                   <div className="flex items-center justify-between pt-4 border-t border-white/5">
                     <div className="flex items-center gap-2 text-xs text-gray-500">
                       <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="w-4 h-4">
                         <path d="M7 8a3 3 0 1 0 0-6 3 3 0 0 0 0 6ZM14.5 9a2.5 2.5 0 1 0 0-5 2.5 2.5 0 0 0 0 5ZM1.615 16.428a1.224 1.224 0 0 1-.569-1.175 6.002 6.002 0 0 1 11.532-2.411 1.002 1.002 0 0 1-1.455 1.405 4.002 4.002 0 0 0-7.908 1.773.992.992 0 0 1-.909.56 1.002 1.002 0 0 1-.691-.152ZM14.427 15.539a6 6 0 0 1-6.66-1.63 1 1 0 1 1 1.414-1.414 4.002 4.002 0 0 0 5.535 1.098 1.002 1.002 0 1 1 .963 1.794 6.002 6.002 0 0 1-1.252.152Z" />
                       </svg>
                       {room.reservedCount} 人已預約
                     </div>
                     <div className="flex -space-x-2">
                       {room.avatars.map((avatar, i) => (
                         <div key={i} className="w-6 h-6 rounded-full border-2 border-[#121212] bg-gray-700 overflow-hidden">
                           <img src={avatar} alt="" className="w-full h-full" />
                         </div>
                       ))}
                       <div className="w-6 h-6 rounded-full border-2 border-[#121212] bg-[#2a2a2a] flex items-center justify-center text-[8px] text-gray-400">
                         +7
                       </div>
                     </div>
                   </div>
                 </div>
               </div>
             ))}
          </div>
        </section>

        {/* All Rooms */}
        <section>
           <div className="flex items-center gap-3 mb-6">
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

      {/* Login/Register Modal */}
      {showAuthModal && (
        <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-50 backdrop-blur-sm">
          <div className="bg-[#1a1a1a] p-8 rounded-2xl w-full max-w-md border border-white/10 shadow-2xl">
            <h3 className="text-2xl font-bold mb-6 text-white">
              {authMode === 'login' ? '登入帳號' : '註冊帳號'}
            </h3>
            
            {authError && (
              <div className="alert alert-error mb-4 text-sm">
                <span>{authError}</span>
              </div>
            )}

            <div className="space-y-4">
              <div className="form-control w-full">
                <label className="label">
                  <span className="label-text text-gray-300">帳號 ID</span>
                </label>
                <input 
                  type="text" 
                  placeholder="英文、數字和底線" 
                  className="input input-bordered bg-black/50 border-white/20 focus:border-purple-500 w-full text-white"
                  value={accountId}
                  onChange={(e) => setAccountId(e.target.value)}
                />
              </div>

              {authMode === 'register' && (
                <div className="form-control w-full">
                  <label className="label">
                    <span className="label-text text-gray-300">暱稱</span>
                  </label>
                  <input 
                    type="text" 
                    placeholder="輸入暱稱" 
                    className="input input-bordered bg-black/50 border-white/20 focus:border-purple-500 w-full text-white"
                    value={authNickname}
                    onChange={(e) => setAuthNickname(e.target.value)}
                  />
                </div>
              )}

              <div className="form-control w-full">
                <label className="label">
                  <span className="label-text text-gray-300">密碼</span>
                </label>
                <input 
                  type="password" 
                  placeholder="輸入密碼" 
                  className="input input-bordered bg-black/50 border-white/20 focus:border-purple-500 w-full text-white"
                  value={authPassword}
                  onChange={(e) => setAuthPassword(e.target.value)}
                />
              </div>
            </div>

            <div className="flex justify-between items-center mt-6">
              <button 
                onClick={() => setAuthMode(authMode === 'login' ? 'register' : 'login')}
                className="text-sm text-purple-400 hover:underline"
              >
                {authMode === 'login' ? '還沒有帳號？註冊' : '已有帳號？登入'}
              </button>
              <div className="flex gap-3">
                <button 
                  onClick={() => {
                    setShowAuthModal(false);
                    setAuthError('');
                    setAuthPassword('');
                    setAuthNickname('');
                    setAccountId('');
                  }}
                  className="btn btn-ghost hover:bg-white/10 text-gray-300"
                >
                  取消
                </button>
                <button 
                  onClick={authMode === 'login' ? handleLogin : handleRegister}
                  className="btn bg-purple-600 hover:bg-purple-700 text-white border-none"
                  disabled={!accountId || !authPassword || (authMode === 'register' && !authNickname)}
                >
                  {authMode === 'login' ? '登入' : '註冊'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default Lobby;
