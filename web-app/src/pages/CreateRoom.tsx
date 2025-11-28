import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import Header from '../components/Header';
import type { VideoItem, YouTubeVideo } from '../types';

const CreateRoom = () => {
  const navigate = useNavigate();
  
  // Create Room State
  const [newRoomName, setNewRoomName] = useState('');
  const [newRoomDescription, setNewRoomDescription] = useState('');
  const [playlist, setPlaylist] = useState<VideoItem[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<YouTubeVideo[]>([]);
  const [isSearching, setIsSearching] = useState(false);

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
        navigate(`/room/${newRoom.id}`);
      }
    } catch (error) {
      console.error('Failed to create room:', error);
    }
  };

  return (
    <div className="h-screen bg-[#050505] text-white font-sans selection:bg-purple-500/30 flex flex-col overflow-hidden">
      <Header />

      <main className="flex-1 w-full mx-auto px-4 sm:px-6 lg:px-8 py-6 flex flex-col lg:flex-row gap-6 min-h-0 pt-24">
        
        {/* Column 1: Room Info */}
        <div className="w-full lg:w-80 flex flex-col gap-6 flex-shrink-0">
          <div>
            <button 
              onClick={() => navigate('/')}
              className="btn btn-ghost btn-sm gap-2 text-gray-400 hover:text-white pl-0 mb-2"
            >
              <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="w-5 h-5">
                <path fillRule="evenodd" d="M17 10a.75.75 0 0 1-.75.75H5.612l4.158 3.96a.75.75 0 1 1-1.04 1.08l-5.5-5.25a.75.75 0 0 1 0-1.08l5.5-5.25a.75.75 0 1 1 1.04 1.08L5.612 9.25H16.25A.75.75 0 0 1 17 10Z" clipRule="evenodd" />
              </svg>
              返回大廳
            </button>
            <h1 className="text-2xl font-bold">創建新房間</h1>
            <p className="text-gray-400 mt-1 text-sm">
              設定房間資訊並加入影片
            </p>
          </div>

          <div className="space-y-4">
            <div className="form-control w-full">
              <label className="label py-1">
                <span className="label-text text-gray-300 font-medium">房間名稱</span>
              </label>
              <input 
                type="text" 
                placeholder="例如：週五恐怖夜" 
                className="input input-md bg-[#121212] border-white/10 focus:border-purple-500 w-full text-white rounded-xl transition-all focus:bg-black"
                value={newRoomName}
                onChange={(e) => setNewRoomName(e.target.value)}
                autoFocus
              />
            </div>
            <div className="form-control w-full">
              <label className="label py-1">
                <span className="label-text text-gray-300 font-medium">房間描述 (選填)</span>
              </label>
              <textarea 
                placeholder="介紹一下這個房間..." 
                className="textarea textarea-md bg-[#121212] border-white/10 focus:border-purple-500 w-full text-white h-32 rounded-xl transition-all focus:bg-black resize-none"
                value={newRoomDescription}
                onChange={(e) => setNewRoomDescription(e.target.value)}
              />
            </div>
          </div>

          <div className="mt-auto">
            <button 
              onClick={handleCreateRoom}
              className="btn btn-lg bg-purple-600 hover:bg-purple-700 text-white border-none w-full rounded-xl shadow-lg shadow-purple-900/20"
              disabled={!newRoomName.trim()}
            >
              創建房間 ({playlist.length})
            </button>
          </div>
        </div>

        {/* Column 2: Search */}
        <div className="flex-1 flex flex-col min-h-0 bg-[#121212] rounded-3xl border border-white/5 overflow-hidden">
          <div className="p-4 border-b border-white/5 bg-white/[0.02]">
            <h3 className="font-medium text-white mb-3">搜尋影片</h3>
            <div className="relative group">
              <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 text-gray-500 group-focus-within:text-purple-500 transition-colors" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                </svg>
              </div>
              <input 
                type="text" 
                placeholder="輸入關鍵字搜尋..." 
                className="input input-sm pl-9 bg-black/40 border-white/10 focus:border-purple-500 w-full text-white rounded-lg"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && searchYoutube(searchQuery)}
              />
              <button 
                onClick={() => searchYoutube(searchQuery)}
                className="absolute right-1 top-1 btn btn-xs btn-ghost text-gray-400 hover:text-white"
                disabled={isSearching}
              >
                {isSearching ? <span className="loading loading-spinner loading-xs"></span> : 'Go'}
              </button>
            </div>
          </div>

          <div className="flex-1 overflow-y-auto custom-scrollbar p-3">
            {searchResults.length > 0 ? (
              <div className="space-y-3">
                {searchResults.map((video) => (
                  <div key={video.id.videoId} className="flex gap-3 p-2 hover:bg-white/5 rounded-lg group transition-colors border border-transparent hover:border-white/5 bg-white/[0.02]">
                    <div className="relative flex-shrink-0 w-28 aspect-video">
                      <img 
                        src={video.snippet.thumbnails.medium?.url || video.snippet.thumbnails.default.url} 
                        alt={video.snippet.title} 
                        className="w-full h-full object-cover rounded-md shadow-sm"
                      />
                    </div>
                    <div className="flex-1 min-w-0 flex flex-col">
                      <h4 className="text-sm font-medium text-white line-clamp-2 mb-1 group-hover:text-purple-400 transition-colors leading-tight">{video.snippet.title}</h4>
                      <p className="text-xs text-gray-400 truncate mb-auto">{video.snippet.channelTitle}</p>
                      <div className="flex justify-end mt-1">
                        <button 
                          onClick={() => addToPlaylist(video)}
                          className="btn btn-xs btn-primary rounded opacity-0 group-hover:opacity-100 transition-all"
                        >
                          加入
                        </button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="h-full flex flex-col items-center justify-center text-gray-500 space-y-2">
                <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-8 h-8 opacity-30">
                  <path strokeLinecap="round" strokeLinejoin="round" d="m21 21-5.197-5.197m0 0A7.5 7.5 0 1 0 5.196 5.196a7.5 7.5 0 0 0 10.607 10.607Z" />
                </svg>
                <p className="text-xs">搜尋結果將顯示於此</p>
              </div>
            )}
          </div>
        </div>

        {/* Column 3: Playlist */}
        <div className="flex-1 flex flex-col min-h-0 bg-[#121212] rounded-3xl border border-white/5 overflow-hidden">
          <div className="p-4 border-b border-white/5 bg-white/[0.02] flex justify-between items-center h-[68px]">
            <h3 className="font-medium text-white">已選清單</h3>
            <span className="text-xs bg-white/10 px-2 py-1 rounded-full text-gray-300">{playlist.length} 部影片</span>
          </div>

          <div className="flex-1 overflow-y-auto custom-scrollbar p-3">
            {playlist.length > 0 ? (
              <div className="space-y-2">
                {playlist.map((video, index) => (
                  <div key={`${video.videoId}-${index}`} className="flex gap-3 p-2 hover:bg-white/5 rounded-lg group items-center transition-colors border border-transparent hover:border-white/5 bg-white/[0.02]">
                    <span className="text-gray-500 text-xs font-mono w-5 text-center flex-shrink-0">{index + 1}</span>
                    <div className="relative w-20 aspect-video flex-shrink-0">
                      <img 
                        src={video.thumbnailUrl} 
                        alt={video.title} 
                        className="w-full h-full object-cover rounded-md opacity-80 group-hover:opacity-100 transition-opacity"
                      />
                    </div>
                    <div className="flex-1 min-w-0">
                      <h4 className="text-sm font-medium text-gray-300 group-hover:text-white truncate transition-colors">{video.title}</h4>
                      <p className="text-xs text-gray-500 truncate">{video.channelTitle}</p>
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
              <div className="h-full flex flex-col items-center justify-center text-gray-500 space-y-2">
                <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-8 h-8 opacity-30">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 14.25v-2.625a3.375 3.375 0 0 0-3.375-3.375h-1.5A1.125 1.125 0 0 1 13.5 7.125v-1.5a3.375 3.375 0 0 0-3.375-3.375H8.25m0 12.75h7.5m-7.5 3H12M10.5 2.25H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 0 0-9-9Z" />
                </svg>
                <p className="text-xs">清單目前是空的</p>
              </div>
            )}
          </div>
        </div>
      </main>
    </div>
  );
};

export default CreateRoom;
