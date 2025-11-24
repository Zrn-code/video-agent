import React, { useState } from 'react';
import type { VideoItem, YouTubeVideo } from '../types';

interface RoomTabsProps {
  activeTab: 'search' | 'queue' | 'history';
  setActiveTab: (tab: 'search' | 'queue' | 'history') => void;
  searchResults: YouTubeVideo[];
  queue: VideoItem[];
  history: VideoItem[];
  onPlay: (video: VideoItem) => void;
  onAddToQueue: (video: VideoItem) => void;
  onRemoveFromQueue: (index: number) => void;
  onSearch: (query: string) => void;
}

const RoomTabs: React.FC<RoomTabsProps> = ({
  activeTab,
  setActiveTab,
  searchResults,
  queue,
  history,
  onPlay,
  onAddToQueue,
  onRemoveFromQueue,
  onSearch,
}) => {
  const [localSearchQuery, setLocalSearchQuery] = useState('');

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    onSearch(localSearchQuery);
  };

  return (
    <div className="w-full bg-[#0f0f0f] p-8">
       <div className="max-w-7xl mx-auto">
         {/* Tabs Header */}
         <div className="flex items-center justify-between mb-8 border-b border-white/10 pb-4">
            <div className="flex gap-6">
              <button 
                onClick={() => setActiveTab('search')}
                className={`btn btn-sm gap-2 ${activeTab === 'search' ? 'btn-primary' : 'btn-ghost text-gray-400 hover:text-white'}`}
              >
                <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" /></svg>
                Search
              </button>
              <button 
                onClick={() => setActiveTab('queue')}
                className={`btn btn-sm gap-2 ${activeTab === 'queue' ? 'btn-primary' : 'btn-ghost text-gray-400 hover:text-white'}`}
              >
                <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" /></svg>
                Queue <span className="badge badge-sm badge-ghost ml-1">{queue.length}</span>
              </button>
              <button 
                onClick={() => setActiveTab('history')}
                className={`btn btn-sm gap-2 ${activeTab === 'history' ? 'btn-primary' : 'btn-ghost text-gray-400 hover:text-white'}`}
              >
                <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
                History <span className="badge badge-sm badge-ghost ml-1">{history.length}</span>
              </button>
            </div>
         </div>

         {/* Tab Content */}
         <div className="min-h-[300px]">
           {activeTab === 'search' && (
             <>
               <form onSubmit={handleSearch} className="mb-6 flex gap-2">
                 <input 
                   type="text" 
                   placeholder="Search YouTube..." 
                   className="input input-bordered w-full bg-[#1a1a1a] border-white/10 focus:border-primary text-white"
                   value={localSearchQuery}
                   onChange={(e) => setLocalSearchQuery(e.target.value)}
                 />
                 <button type="submit" className="btn btn-primary">
                   Search
                 </button>
               </form>
               {searchResults.length > 0 ? (
                 <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-6">
                    {searchResults.map((video) => {
                      const videoId = video.id.videoId;
                      const snippet = video.snippet;
                      const thumbnail = snippet.thumbnails.high?.url || snippet.thumbnails.medium?.url || snippet.thumbnails.default.url;
                      const videoItem: VideoItem = {
                        videoId,
                        title: snippet.title,
                        channelTitle: snippet.channelTitle,
                        thumbnailUrl: thumbnail,
                        addedBy: 'You'
                      };

                      return (
                        <div 
                          key={videoId} 
                          className="group relative bg-[#1a1a1a] rounded-xl overflow-hidden hover:scale-105 transition-all duration-300 shadow-lg hover:shadow-primary/20 border border-white/5 hover:border-primary/50"
                        >
                          <div className="aspect-video relative cursor-pointer" onClick={() => onPlay(videoItem)}>
                            <img src={thumbnail} alt={snippet.title} className="w-full h-full object-cover opacity-80 group-hover:opacity-100 transition-opacity" />
                            <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity flex items-end p-4">
                               <span className="text-white text-xs font-bold btn-primary px-2 py-1 rounded">Play Now</span>
                            </div>
                          </div>
                          <div className="p-4">
                            <h3 className="font-bold text-sm line-clamp-2 text-gray-100 mb-1 group-hover:text-primary transition-colors">{snippet.title}</h3>
                            <p className="text-xs text-gray-500 flex items-center gap-1 mb-3">
                              {snippet.channelTitle}
                            </p>
                            <button 
                              onClick={(e) => {
                                e.stopPropagation();
                                onAddToQueue(videoItem);
                              }}
                              className="btn btn-xs btn-outline w-full hover:btn-primary"
                            >
                              Add to Queue
                            </button>
                          </div>
                        </div>
                      );
                    })}
                 </div>
               ) : (
                  <div className="text-center py-20">
                    <div className="text-gray-500 mb-4 text-6xl opacity-20">🔍</div>
                    <p className="text-gray-400 text-lg">Search for movies, music, or videos to start watching together.</p>
                  </div>
               )}
             </>
           )}

           {activeTab === 'queue' && (
             <div className="space-y-4">
                {queue.length === 0 ? (
                  <div className="text-center py-20 text-gray-500">Queue is empty</div>
                ) : (
                  queue.map((item, index) => (
                    <div key={`${item.videoId}-${index}`} className="flex items-center gap-4 bg-[#1a1a1a] p-4 rounded-xl border border-white/5 hover:border-white/10 transition-colors group">
                       <div className="relative w-40 aspect-video rounded-lg overflow-hidden flex-shrink-0 cursor-pointer" onClick={() => onPlay(item)}>
                          <img src={item.thumbnailUrl} alt={item.title} className="w-full h-full object-cover" />
                          <div className="absolute inset-0 bg-black/50 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="white" className="w-8 h-8"><path d="M8 5v14l11-7z" /></svg>
                          </div>
                       </div>
                       <div className="flex-1 min-w-0">
                          <h3 className="font-bold text-white truncate">{item.title}</h3>
                          <p className="text-sm text-gray-500">{item.channelTitle}</p>
                          <p className="text-xs text-gray-600 mt-1">Added by {item.addedBy || 'User'}</p>
                       </div>
                       <button 
                         onClick={() => onRemoveFromQueue(index)}
                         className="btn btn-ghost btn-sm text-gray-500 hover:text-error"
                       >
                         <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>
                       </button>
                    </div>
                  ))
                )}
             </div>
           )}

           {activeTab === 'history' && (
             <div className="space-y-4">
                {history.length === 0 ? (
                  <div className="text-center py-20 text-gray-500">No history yet</div>
                ) : (
                  history.map((item, index) => (
                    <div key={`${item.videoId}-${index}`} className="flex items-center gap-4 bg-[#1a1a1a] p-4 rounded-xl border border-white/5 opacity-75 hover:opacity-100 transition-opacity">
                       <div className="relative w-40 aspect-video rounded-lg overflow-hidden flex-shrink-0 cursor-pointer" onClick={() => onPlay(item)}>
                          <img src={item.thumbnailUrl} alt={item.title} className="w-full h-full object-cover grayscale group-hover:grayscale-0" />
                       </div>
                       <div className="flex-1 min-w-0">
                          <h3 className="font-bold text-white truncate">{item.title}</h3>
                          <p className="text-sm text-gray-500">{item.channelTitle}</p>
                       </div>
                       <button 
                         onClick={() => onAddToQueue(item)}
                         className="btn btn-ghost btn-sm text-primary hover:bg-primary/10"
                       >
                         Add to Queue
                       </button>
                    </div>
                  ))
                )}
             </div>
           )}
         </div>
       </div>
    </div>
  );
};

export default RoomTabs;
