import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import Header from '../components/Header';
import AICompanionSelector from '../components/AICompanionSelector';
import type { VideoItem, YouTubeVideo, AICompanion } from '../types';
import { optimizeAvatarUrl, avatarSizes } from '../utils/imageOptimizer';

const CreateRoom = () => {
  const navigate = useNavigate();
  
  // User State
  const [userId] = useState<string>(() => {
    const stored = localStorage.getItem('video_agent_userid');
    if (stored) return stored;
    const newId = 'user-' + Math.random().toString(36).substr(2, 9);
    localStorage.setItem('video_agent_userid', newId);
    return newId;
  });

  const [userName, setUserName] = useState<string>(() => {
    return localStorage.getItem('video_agent_username') || '';
  });

  const [userAvatar, setUserAvatar] = useState<string>(() => {
    return localStorage.getItem('video_agent_avatar') || `https://api.dicebear.com/7.x/avataaars/svg?seed=${userId}`;
  });

  // Create Room State
  const [step, setStep] = useState(1);
  const [newRoomName, setNewRoomName] = useState('');
  const [roomPrivacy, setRoomPrivacy] = useState<'public' | 'private'>('public');
  const [maxUsers, setMaxUsers] = useState<number>(6);
  const [playlist, setPlaylist] = useState<VideoItem[]>([]);
  const [selectedCompanions, setSelectedCompanions] = useState<AICompanion[]>([]);
  
  // Search State
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<YouTubeVideo[]>([]);
  const [isSearching, setIsSearching] = useState(false);

  // Save user info when it changes
  useEffect(() => {
    if (userName) localStorage.setItem('video_agent_username', userName);
    if (userAvatar) localStorage.setItem('video_agent_avatar', userAvatar);
  }, [userName, userAvatar]);

  const randomizeAvatar = () => {
    const newSeed = Math.random().toString(36).substr(2, 9);
    setUserAvatar(`https://api.dicebear.com/7.x/avataaars/svg?seed=${newSeed}`);
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
  };

  const removeFromPlaylist = (index: number) => {
    setPlaylist(playlist.filter((_, i) => i !== index));
  };

  const handleNextStep = () => {
    if (step === 1) {
      if (!newRoomName.trim() || !userName.trim()) return;
      setStep(2);
    } else if (step === 2) {
      if (playlist.length === 0) return;
      setStep(3);
    }
  };

  const handleCreateRoom = async () => {
    if (!newRoomName.trim()) return;

    try {
      const response = await fetch(`${import.meta.env.VITE_API_URL}/api/rooms`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          name: newRoomName,
          privacy: roomPrivacy,
          maxUsers: maxUsers,
          initialPlaylist: playlist,
          aiCompanions: selectedCompanions
        }),
      });

      if (response.ok) {
        const newRoom = await response.json();
        navigate(`/room/${newRoom.id}`);
      }
    } catch (error) {
      console.error('Failed to create room:', error);
    }
  };

  const stepTitles = {
    1: { title: "設定身份與房間", subtitle: "首先，請設定您的暱稱與房間名稱" },
    2: { title: "建立播放清單", subtitle: "搜尋並加入您想觀看的 YouTube 影片" },
    3: { title: "選擇智慧影伴", subtitle: "智慧影伴將會陪您一起觀看影片，並根據性格做出反應" }
  };

  return (
    <div className="h-screen bg-[#050505] text-white font-sans selection:bg-purple-500/30 flex flex-col overflow-hidden">
      <Header />

      <main className="flex-1 flex flex-col min-h-0 pt-24 px-4 sm:px-6 lg:px-8">
        <div className="w-full max-w-7xl mx-auto h-full flex flex-col relative animate-fade-in">
          
          {/* Page Header */}
          <div className="pb-6 flex justify-between items-end border-b border-white/5 mb-6">
            <div>
              <h1 className="text-3xl font-bold text-white tracking-tight">{stepTitles[step as 1|2|3].title}</h1>
              <p className="text-gray-400 mt-2 text-lg">{stepTitles[step as 1|2|3].subtitle}</p>
            </div>
            
            {/* Step Indicator */}
            <div className="flex items-center gap-3 pb-2">
              {[1, 2, 3].map(i => (
                <button 
                  key={i}
                  onClick={() => i < step ? setStep(i) : null}
                  className={`h-2.5 rounded-full transition-all duration-300 ${
                    step === i ? 'w-12 bg-purple-500 shadow-[0_0_15px_rgba(168,85,247,0.5)]' : 
                    step > i ? 'w-3 bg-purple-900/50 cursor-pointer hover:bg-purple-700' : 'w-3 bg-white/5'
                  }`}
                  title={`Step ${i}`}
                />
              ))}
            </div>
          </div>

          {/* Main Content Body */}
          <div className="flex-1 min-h-0 relative">
            
            {/* Step 1: Identity & Room Settings */}
            {step === 1 && (
                <div className="h-full flex flex-col gap-5 animate-fade-in">
                    {/* Top Section: User Identity */}
                    <div className="bg-gradient-to-br from-purple-900/20 via-[#121212] to-blue-900/20 rounded-2xl border border-white/10 p-6 shadow-2xl">
                        <div className="flex items-center gap-6">
                            {/* Avatar */}
                            <div className="flex-shrink-0">
                                <div className="relative group">
                                    <div className="w-24 h-24 rounded-full overflow-hidden border-4 border-purple-500/30 group-hover:border-purple-500/60 transition-all duration-500 bg-gradient-to-br from-purple-900/50 to-blue-900/50 shadow-2xl shadow-purple-500/20">
                                        <img src={optimizeAvatarUrl(userAvatar, avatarSizes.small)} alt="Avatar" loading="lazy" className="w-full h-full object-cover" />
                                    </div>
                                    <button 
                                        onClick={randomizeAvatar} 
                                        className="absolute -bottom-1 -right-1 w-8 h-8 bg-gradient-to-br from-purple-600 to-blue-600 rounded-full flex items-center justify-center shadow-xl hover:scale-110 transition-transform border-2 border-[#121212]"
                                        title="隨機頭像"
                                    >
                                        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="w-4 h-4 text-white">
                                            <path fillRule="evenodd" d="M15.312 11.424a5.5 5.5 0 0 1-9.201 2.466l-.312-.311h2.433a.75.75 0 0 0 0-1.5H3.989a.75.75 0 0 0-.75.75v4.242a.75.75 0 0 0 1.5 0v-2.43l.31.31a7 7 0 0 0 11.712-3.138.75.75 0 0 0-1.449-.39Zm1.23-3.723a.75.75 0 0 0 .219-.53V2.929a.75.75 0 0 0-1.5 0V5.36l-.31-.31A7 7 0 0 0 3.239 8.188a.75.75 0 1 0 1.448.389A5.5 5.5 0 0 1 13.89 6.11l.311.31h-2.432a.75.75 0 0 0 0 1.5h4.243a.75.75 0 0 0 .53-.219Z" clipRule="evenodd" />
                                        </svg>
                                    </button>
                                </div>
                            </div>

                            {/* User Info */}
                            <div className="flex-1">
                                <label className="block font-bold text-purple-400 mb-2 uppercase tracking-wide">您的身份</label>
                                <input 
                                    type="text" 
                                    placeholder="輸入您的暱稱..." 
                                    className="input bg-black/40 border-white/10 focus:border-purple-500/50 focus:bg-black/60 w-full rounded-xl text-lg transition-all h-12 px-5 placeholder:text-gray-600 font-medium" 
                                    value={userName} 
                                    onChange={(e) => setUserName(e.target.value)} 
                                />
                                <p className="text-xs text-gray-500 mt-1.5 flex items-center gap-1">
                                    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="w-3.5 h-3.5">
                                        <path fillRule="evenodd" d="M18 10a8 8 0 1 1-16 0 8 8 0 0 1 16 0Zm-7-4a1 1 0 1 1-2 0 1 1 0 0 1 2 0ZM9 9a.75.75 0 0 0 0 1.5h.253a.25.25 0 0 1 .244.304l-.459 2.066A1.75 1.75 0 0 0 10.747 15H11a.75.75 0 0 0 0-1.5h-.253a.25.25 0 0 1-.244-.304l.459-2.066A1.75 1.75 0 0 0 9.253 9H9Z" clipRule="evenodd" />
                                    </svg>
                                    這個名稱會顯示給房間內的其他成員
                                </p>
                            </div>
                        </div>
                    </div>

                    {/* Bottom Section: Room Settings */}
                    <div className="bg-[#121212] rounded-2xl border border-white/10 p-6 shadow-xl flex-1 min-h-0">
                        <div className="space-y-6">
                            {/* Room Info Section */}
                            <div>
                                <div className="flex items-center gap-2 mb-5">
                                    <div className="w-9 h-9 rounded-xl bg-purple-500/20 flex items-center justify-center">
                                        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="w-5 h-5 text-purple-400">
                                            <path fillRule="evenodd" d="M4.25 2A2.25 2.25 0 0 0 2 4.25v11.5A2.25 2.25 0 0 0 4.25 18h11.5A2.25 2.25 0 0 0 18 15.75V4.25A2.25 2.25 0 0 0 15.75 2H4.25Zm4.03 6.28a.75.75 0 0 0-1.06-1.06L4.97 9.47a.75.75 0 0 0 0 1.06l2.25 2.25a.75.75 0 0 0 1.06-1.06L6.56 10l1.72-1.72Zm4.5-1.06a.75.75 0 1 0-1.06 1.06L13.44 10l-1.72 1.72a.75.75 0 1 0 1.06 1.06l2.25-2.25a.75.75 0 0 0 0-1.06l-2.25-2.25Z" clipRule="evenodd" />
                                        </svg>
                                    </div>
                                    <h3 className="text-base font-bold text-xl text-white">房間設定</h3>
                                </div>
                                
                                <div className="grid grid-cols-2 gap-5">
                                    <div className="form-control">
                                        <label className="label pb-1.5">
                                            <span className="label-text text-gray-400 font-medium">房間名稱</span>
                                            <span className="label-text-alt text-purple-400 text-xs">必填</span>
                                        </label>
                                        <input 
                                            type="text" 
                                            placeholder="例如：週五電影夜 🎬" 
                                            className="input bg-black/40 border-white/10 focus:border-purple-500/50 w-full rounded-xl transition-all px-4 h-20 text-sm" 
                                            value={newRoomName} 
                                            onChange={(e) => setNewRoomName(e.target.value)} 
                                        />
                                    </div>

                                    <div className="form-control">
                                        <label className="label pb-2">
                                            <span className="label-text text-gray-400 font-medium">隱私設定</span>
                                        </label>
                                        <div className="grid grid-cols-2 gap-2">
                                            <button
                                                onClick={() => setRoomPrivacy('public')}
                                                className={`relative p-3 rounded-xl border-2 transition-all group ${
                                                    roomPrivacy === 'public'
                                                        ? 'border-purple-500 bg-purple-500/10'
                                                        : 'border-white/10 bg-white/5 hover:border-white/20'
                                                }`}
                                            >
                                                <div className="flex flex-col items-center gap-1">
                                                    <div className={`w-8 h-8 rounded-lg flex items-center justify-center transition-colors ${
                                                        roomPrivacy === 'public' ? 'bg-purple-500/20' : 'bg-white/5'
                                                    }`}>
                                                        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className={`w-4 h-4 ${roomPrivacy === 'public' ? 'text-purple-400' : 'text-gray-400'}`}>
                                                            <path d="M10 9a3 3 0 1 0 0-6 3 3 0 0 0 0 6ZM6 8a2 2 0 1 1-4 0 2 2 0 0 1 4 0ZM1.49 15.326a.78.78 0 0 1-.358-.442 3 3 0 0 1 4.308-3.516 6.484 6.484 0 0 0-1.905 3.959c-.023.222-.014.442.025.654a4.97 4.97 0 0 1-2.07-.655ZM16.44 15.98a4.97 4.97 0 0 0 2.07-.654.78.78 0 0 0 .357-.442 3 3 0 0 0-4.308-3.517 6.484 6.484 0 0 1 1.907 3.96 2.32 2.32 0 0 1-.026.654ZM18 8a2 2 0 1 1-4 0 2 2 0 0 1 4 0ZM5.304 16.19a.844.844 0 0 1-.277-.71 5 5 0 0 1 9.947 0 .843.843 0 0 1-.277.71A6.975 6.975 0 0 1 10 18a6.974 6.974 0 0 1-4.696-1.81Z" />
                                                        </svg>
                                                    </div>
                                                    <span className={`text-s font-medium ${roomPrivacy === 'public' ? 'text-white' : 'text-gray-400'}`}>公開</span>
                                                </div>
                                                {roomPrivacy === 'public' && (
                                                    <div className="absolute top-1.5 right-1.5 w-4 h-4 bg-purple-500 rounded-full flex items-center justify-center">
                                                        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="w-2.5 h-2.5 text-white">
                                                            <path fillRule="evenodd" d="M16.704 4.153a.75.75 0 0 1 .143 1.052l-8 10.5a.75.75 0 0 1-1.127.075l-4.5-4.5a.75.75 0 0 1 1.06-1.06l3.894 3.893 7.48-9.817a.75.75 0 0 1 1.05-.143Z" clipRule="evenodd" />
                                                        </svg>
                                                    </div>
                                                )}
                                            </button>
                                            <button
                                                onClick={() => setRoomPrivacy('private')}
                                                className={`relative p-3 rounded-xl border-2 transition-all group ${
                                                    roomPrivacy === 'private'
                                                        ? 'border-purple-500 bg-purple-500/10'
                                                        : 'border-white/10 bg-white/5 hover:border-white/20'
                                                }`}
                                            >
                                                <div className="flex flex-col items-center gap-1">
                                                    <div className={`w-8 h-8 rounded-lg flex items-center justify-center transition-colors ${
                                                        roomPrivacy === 'private' ? 'bg-purple-500/20' : 'bg-white/5'
                                                    }`}>
                                                        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className={`w-4 h-4 ${roomPrivacy === 'private' ? 'text-purple-400' : 'text-gray-400'}`}>
                                                            <path fillRule="evenodd" d="M10 1a4.5 4.5 0 0 0-4.5 4.5V9H5a2 2 0 0 0-2 2v6a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2v-6a2 2 0 0 0-2-2h-.5V5.5A4.5 4.5 0 0 0 10 1Zm3 8V5.5a3 3 0 1 0-6 0V9h6Z" clipRule="evenodd" />
                                                        </svg>
                                                    </div>
                                                    <span className={`text-s font-medium ${roomPrivacy === 'private' ? 'text-white' : 'text-gray-400'}`}>私密</span>
                                                </div>
                                                {roomPrivacy === 'private' && (
                                                    <div className="absolute top-1.5 right-1.5 w-4 h-4 bg-purple-500 rounded-full flex items-center justify-center">
                                                        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="w-2.5 h-2.5 text-white">
                                                            <path fillRule="evenodd" d="M16.704 4.153a.75.75 0 0 1 .143 1.052l-8 10.5a.75.75 0 0 1-1.127.075l-4.5-4.5a.75.75 0 0 1 1.06-1.06l3.894 3.893 7.48-9.817a.75.75 0 0 1 1.05-.143Z" clipRule="evenodd" />
                                                        </svg>
                                                    </div>
                                                )}
                                            </button>
                                        </div>
                                    </div>
                                </div>
                            </div>

                            {/* Divider */}
                            <div className="h-px bg-white/10"></div>

                            {/* Room Capacity Section */}
                            <div>
                                <div className="flex items-center gap-2 mb-5">
                                    <div className="w-9 h-9 rounded-xl bg-blue-500/20 flex items-center justify-center">
                                        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="w-5 h-5 text-blue-400">
                                            <path d="M10 9a3 3 0 1 0 0-6 3 3 0 0 0 0 6ZM6 8a2 2 0 1 1-4 0 2 2 0 0 1 4 0ZM1.49 15.326a.78.78 0 0 1-.358-.442 3 3 0 0 1 4.308-3.516 6.484 6.484 0 0 0-1.905 3.959c-.023.222-.014.442.025.654a4.97 4.97 0 0 1-2.07-.655ZM16.44 15.98a4.97 4.97 0 0 0 2.07-.654.78.78 0 0 0 .357-.442 3 3 0 0 0-4.308-3.517 6.484 6.484 0 0 1 1.907 3.96 2.32 2.32 0 0 1-.026.654ZM18 8a2 2 0 1 1-4 0 2 2 0 0 1 4 0ZM5.304 16.19a.844.844 0 0 1-.277-.71 5 5 0 0 1 9.947 0 .843.843 0 0 1-.277.71A6.975 6.975 0 0 1 10 18a6.974 6.974 0 0 1-4.696-1.81Z" />
                                        </svg>
                                    </div>
                                    <h3 className="text-base font-bold text-xl text-white">人數上限</h3>
                                </div>

                                <div className="flex items-center gap-6">
                                    {/* Visual Counter */}
                                    <div className="bg-gradient-to-br from-blue-500/10 to-purple-500/10 rounded-xl p-6 border border-blue-500/20 flex-shrink-0">
                                        <div className="text-center">
                                            <div className="text-5xl font-bold text-transparent bg-clip-text bg-gradient-to-br from-blue-400 to-purple-400">
                                                {maxUsers}
                                            </div>
                                            <div className="text-xs text-gray-400 mt-1.5 whitespace-nowrap">最多可容納人數</div>
                                        </div>
                                    </div>

                                    {/* Controls */}
                                    <div className="flex-1 space-y-4">
                                        {/* Quick Select Buttons */}
                                        <div className="grid grid-cols-3 gap-2">
                                            {[2, 6, 10].map(num => (
                                                <button
                                                    key={num}
                                                    onClick={() => setMaxUsers(num)}
                                                    className={`py-2.5 px-3 rounded-lg text-sm font-medium transition-all ${
                                                        maxUsers === num
                                                            ? 'bg-blue-500 text-white shadow-lg shadow-blue-500/30'
                                                            : 'bg-white/5 text-gray-400 hover:bg-white/10'
                                                    }`}
                                                >
                                                    {num}人
                                                </button>
                                            ))}
                                        </div>

                                        {/* Slider */}
                                        <div className="w-full">
                                            <input
                                                type="range"
                                                min="2"
                                                max="10"
                                                value={maxUsers}
                                                onChange={(e) => setMaxUsers(Number(e.target.value))}
                                                className="range range-primary range-sm w-full"
                                                step="1"
                                            />
                                            <div className="flex justify-between text-xs text-gray-500 mt-1.5 px-1">
                                                <span>2</span>
                                                <span>4</span>
                                                <span>6</span>
                                                <span>8</span>
                                                <span>10</span>
                                            </div>
                                        </div>

                                        
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {/* Step 2: Playlist */}
            {step === 2 && (
                <div className="h-full flex gap-8 animate-fade-in">
                    {/* Left: Search */}
                    <div className="flex-1 flex flex-col bg-[#121212] rounded-3xl border border-white/5 overflow-hidden shadow-xl">
                        <div className="p-5 border-b border-white/5 bg-white/[0.02]">
                            <div className="relative group">
                                <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
                                    <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 text-gray-500 group-focus-within:text-purple-500 transition-colors" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                                    </svg>
                                </div>
                                <input type="text" placeholder="搜尋 YouTube 影片..." className="input input-lg pl-12 bg-black/20 border-white/5 focus:border-purple-500/50 w-full text-white rounded-2xl transition-all" value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && searchYoutube(searchQuery)} autoFocus />
                                <button onClick={() => searchYoutube(searchQuery)} className="absolute right-3 top-3 btn btn-sm btn-ghost text-gray-400 hover:text-white" disabled={isSearching}>
                                    {isSearching ? <span className="loading loading-spinner loading-xs"></span> : '搜尋'}
                                </button>
                            </div>
                        </div>
                        <div className="flex-1 overflow-y-auto custom-scrollbar p-4">
                            {searchResults.length > 0 ? (
                                <div className="space-y-4">
                                    {searchResults.map((video) => (
                                        <div key={video.id.videoId} className="flex gap-4 p-4 hover:bg-white/5 rounded-2xl group transition-all border border-transparent hover:border-white/5 bg-white/[0.02]">
                                            <div className="relative flex-shrink-0 w-40 aspect-video">
                                                <img src={video.snippet.thumbnails.medium?.url || video.snippet.thumbnails.default.url} alt={video.snippet.title} className="w-full h-full object-cover rounded-xl shadow-lg" />
                                            </div>
                                            <div className="flex-1 min-w-0 flex flex-col justify-between py-1">
                                                <div>
                                                    <h4 className="text-base font-medium text-white line-clamp-2 mb-1 group-hover:text-purple-400 transition-colors leading-snug">{video.snippet.title}</h4>
                                                    <p className="text-sm text-gray-400 truncate">{video.snippet.channelTitle}</p>
                                                </div>
                                                <div className="flex justify-end">
                                                    <button onClick={() => addToPlaylist(video)} className="btn btn-sm btn-primary rounded-xl opacity-0 group-hover:opacity-100 transition-all transform translate-x-4 group-hover:translate-x-0 shadow-lg shadow-purple-500/20">加入清單</button>
                                                </div>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            ) : (
                                <div className="h-full flex flex-col items-center justify-center text-gray-500 space-y-4">
                                    <div className="w-20 h-20 rounded-full bg-white/5 flex items-center justify-center">
                                        <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-10 h-10 opacity-50">
                                            <path strokeLinecap="round" strokeLinejoin="round" d="m21 21-5.197-5.197m0 0A7.5 7.5 0 1 0 5.196 5.196a7.5 7.5 0 0 0 10.607 10.607Z" />
                                        </svg>
                                    </div>
                                    <p className="text-base font-medium">輸入關鍵字開始搜尋影片</p>
                                </div>
                            )}
                        </div>
                    </div>
                    {/* Right: Playlist */}
                    <div className="flex-1 flex flex-col bg-[#121212] rounded-3xl border border-white/5 overflow-hidden shadow-xl">
                        <div className="p-5 border-b border-white/5 bg-white/[0.02] flex justify-between items-center">
                            <h3 className="font-medium text-white flex items-center gap-3 text-lg">
                                <div className="w-8 h-8 rounded-lg bg-purple-500/10 flex items-center justify-center">
                                    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="w-5 h-5 text-purple-500">
                                        <path fillRule="evenodd" d="M2 10a8 8 0 1 1 16 0 8 8 0 0 1-16 0Zm6.39-2.9a.75.75 0 0 1 .76-.04l3.36 1.7a.75.75 0 0 1 0 1.34l-3.36 1.7a.75.75 0 0 1-1.12-.67V7.75a.75.75 0 0 1 .36-.65Z" clipRule="evenodd" />
                                    </svg>
                                </div>
                                播放清單
                            </h3>
                            <span className="badge badge-neutral badge-lg border-white/5">{playlist.length} 部影片</span>
                        </div>
                        <div className="flex-1 overflow-y-auto custom-scrollbar p-4">
                            {playlist.length > 0 ? (
                                <div className="space-y-3">
                                    {playlist.map((video, index) => (
                                        <div key={`${video.videoId}-${index}`} className="flex gap-4 p-3 hover:bg-white/5 rounded-2xl group items-center transition-colors border border-transparent hover:border-white/5 bg-white/[0.02]">
                                            <span className="text-gray-500 text-sm font-mono w-8 text-center flex-shrink-0">{index + 1}</span>
                                            <div className="relative w-32 aspect-video flex-shrink-0">
                                                <img src={video.thumbnailUrl} alt={video.title} className="w-full h-full object-cover rounded-xl opacity-80 group-hover:opacity-100 transition-opacity" />
                                            </div>
                                            <div className="flex-1 min-w-0">
                                                <h4 className="text-base font-medium text-gray-300 group-hover:text-white truncate transition-colors">{video.title}</h4>
                                                <p className="text-sm text-gray-500 truncate">{video.channelTitle}</p>
                                            </div>
                                            <button onClick={() => removeFromPlaylist(index)} className="btn btn-sm btn-square btn-ghost text-gray-500 hover:text-red-400 opacity-0 group-hover:opacity-100 transition-all">
                                                <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="w-5 h-5">
                                                    <path d="M6.28 5.22a.75.75 0 0 0-1.06 1.06L8.94 10l-3.72 3.72a.75.75 0 1 0 1.06 1.06L10 11.06l3.72 3.72a.75.75 0 1 0 1.06-1.06L11.06 10l3.72-3.72a.75.75 0 0 0-1.06-1.06L10 8.94 6.28 5.22Z" />
                                                </svg>
                                            </button>
                                        </div>
                                    ))}
                                </div>
                            ) : (
                                <div className="h-full flex flex-col items-center justify-center text-gray-500 space-y-4">
                                    <div className="w-20 h-20 rounded-full bg-white/5 flex items-center justify-center">
                                        <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-10 h-10 opacity-50">
                                            <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 14.25v-2.625a3.375 3.375 0 0 0-3.375-3.375h-1.5A1.125 1.125 0 0 1 13.5 7.125v-1.5a3.375 3.375 0 0 0-3.375-3.375H8.25m0 12.75h7.5m-7.5 3H12M10.5 2.25H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 0 0-9-9Z" />
                                        </svg>
                                    </div>
                                    <p className="text-base font-medium">從左側搜尋並加入影片</p>
                                </div>
                            )}
                        </div>
                    </div>
                </div>
            )}

            {/* Step 3: AI Companion */}
            {step === 3 && (
                <div className="h-full overflow-y-auto custom-scrollbar animate-fade-in">
                    <AICompanionSelector onSelect={setSelectedCompanions} />
                </div>
            )}
          </div>

          {/* Footer Actions */}
          <div className="py-6 flex justify-between items-center mt-4">
            <button 
                onClick={() => setStep(Math.max(1, step - 1))}
                className={`btn btn-ghost btn-lg rounded-2xl text-gray-400 hover:text-white hover:bg-white/5 ${step === 1 ? 'invisible' : ''}`}
            >
                <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="w-5 h-5 mr-2">
                    <path fillRule="evenodd" d="M17 10a.75.75 0 0 1-.75.75H5.612l4.158 3.96a.75.75 0 1 1-1.04 1.08l-5.5-5.25a.75.75 0 0 1 0-1.08l5.5-5.25a.75.75 0 1 1 1.04 1.08L5.612 9.25H16.25A.75.75 0 0 1 17 10Z" clipRule="evenodd" />
                </svg>
                上一步

            </button>
            
            <button 
                onClick={step === 3 ? handleCreateRoom : handleNextStep}
                disabled={
                    (step === 1 && (!newRoomName.trim() || !userName.trim())) ||
                    (step === 2 && playlist.length === 0)
                }
                className="btn btn-primary btn-lg rounded-2xl px-10 shadow-xl shadow-purple-900/20 min-w-[180px] text-lg hover:scale-105 transition-transform disabled:opacity-50 disabled:cursor-not-allowed"
            >
                {step === 1 && "下一步"}
                {step === 2 && "下一步"}
                {step === 3 && "完成創建"}
                <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="w-5 h-5 ml-2">
                    <path fillRule="evenodd" d="M3 10a.75.75 0 0 1 .75-.75h10.638L10.23 5.29a.75.75 0 1 1 1.04-1.08l5.5 5.25a.75.75 0 0 1 0 1.08l-5.5 5.25a.75.75 0 1 1-1.04-1.08l4.158-3.96H3.75A.75.75 0 0 1 3 10Z" clipRule="evenodd" />
                </svg>
            </button>
          </div>

        </div>
      </main>
    </div>
  );
};

export default CreateRoom;
