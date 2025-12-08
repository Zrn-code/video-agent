import React, { useState, useRef, useEffect } from 'react';
import type { VideoItem, Message } from '../types';
import { optimizeAvatarUrl, avatarSizes } from '../utils/imageOptimizer';
import MessageItem from './MessageItem';

interface User {
  id: string;
  username: string;
  avatar: string;
  lastSeen: number;
  emotion?: string;
}

interface SidebarProps {
  currentUser: User;
  roomUsers: User[];
  messages: Message[];
  queue: VideoItem[];
  history: VideoItem[];
  searchResults: VideoItem[];
  activeTab: 'chat' | 'playlist';
  onTabChange: (tab: 'chat' | 'playlist') => void;
  onSendMessage: (content: string) => void;
  onUpdateProfile?: (username: string, avatar: string) => void;
  onPlay: (video: VideoItem) => void;
  onRemoveFromQueue: (index: number) => void;
  onAddToQueue: (video: VideoItem) => void;
  onSearch: (query: string) => void;
  hideChat?: boolean;
  spoilerPreference?: 'show_all' | 'hide_spoilers';
  mutedUserIds?: string[];
}


const Sidebar: React.FC<SidebarProps> = ({ 
  currentUser, 
  roomUsers, 
  messages, 
  queue,
  history,
  searchResults,
  activeTab,
  onTabChange,
  onSendMessage, 
  onUpdateProfile,
  onPlay,
  onRemoveFromQueue,
  onAddToQueue,
  onSearch,
  hideChat = false,
  spoilerPreference = 'show_all',
  mutedUserIds = []
}) => {
  const [chatInput, setChatInput] = useState('');
  const [searchInput, setSearchInput] = useState('');
  const [playlistView, setPlaylistView] = useState<'queue' | 'history'>('queue');
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  useEffect(() => {
    if (activeTab === 'chat') {
      scrollToBottom();
    }
  }, [messages, activeTab]);

  const handleSendChat = () => {
    if (chatInput.trim()) {
      onSendMessage(chatInput);
      setChatInput('');
    }
  };

  const handleSearch = () => {
    if (searchInput.trim()) {
      onSearch(searchInput);
    }
  };

  const formatTime = (timestamp: number) => {
    const date = new Date(timestamp * 1000);
    return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  };

  const formatVideoTime = (seconds: number) => {
    if (seconds === undefined || seconds === null) return '';
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  return (
    <div className="w-96 bg-[#1e1f22]/95 backdrop-blur-xl border-l border-white/10 flex flex-col h-full shadow-2xl rounded-l-3xl overflow-hidden my-2 mr-2">
      {/* Tabs */}
      <div className="flex border-b border-white/5 bg-[#151618]">
        {!hideChat && (
        <button
          className={`flex-1 py-4 text-sm font-bold transition-all relative ${
            activeTab === 'chat' 
              ? 'text-white' 
              : 'text-gray-500 hover:text-gray-300 hover:bg-white/5'
          }`}
          onClick={() => onTabChange('chat')}
        >
          聊天室
          {activeTab === 'chat' && (
            <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-primary shadow-[0_0_10px_rgba(168,85,247,0.5)]"></div>
          )}
        </button>
        )}
        <button
          className={`flex-1 py-4 text-sm font-bold transition-all relative ${
            activeTab === 'playlist' 
              ? 'text-white' 
              : 'text-gray-500 hover:text-gray-300 hover:bg-white/5'
          }`}
          onClick={() => onTabChange('playlist')}
        >
          播放清單
          {activeTab === 'playlist' && (
            <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-primary shadow-[0_0_10px_rgba(168,85,247,0.5)]"></div>
          )}
        </button>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-hidden relative">
        {activeTab === 'chat' ? (
          <div className="h-full flex flex-col">
            <div className="flex-1 overflow-y-auto p-4 space-y-4 custom-scrollbar">
              {messages
                .filter(msg => !mutedUserIds.includes(msg.userId))
                .map((msg) => {
                const isMe = msg.userId === currentUser.id;
                const user = roomUsers.find(u => u.id === msg.userId);
                const avatar = user?.avatar || `https://api.dicebear.com/7.x/avataaars/svg?seed=${msg.userId}`;
                
                return (
                  <MessageItem 
                    key={msg.id}
                    msg={msg}
                    isMe={isMe}
                    user={user}
                    avatar={avatar}
                    formatTime={formatTime}
                    formatVideoTime={formatVideoTime}
                    spoilerPreference={spoilerPreference}
                  />
                );
              })}
              <div ref={messagesEndRef} />
            </div>
            
            {/* Input Area */}
            <div className="p-4 bg-[#1e1f22]">
              <div className="flex items-center gap-2">
                <div className="flex-1 bg-[#2b2d31] rounded-full px-4 py-2.5 border border-[#3f4148] focus-within:border-purple-500/50 transition-colors flex items-center">
                  <input
                    type="text"
                    placeholder="聊聊吧..."
                    className="w-full bg-transparent text-white text-sm focus:outline-none placeholder-gray-500"
                    value={chatInput}
                    onChange={(e) => setChatInput(e.target.value)}
                    onKeyDown={(e) => e.key === 'Enter' && handleSendChat()}
                  />
                </div>
                <button 
                  onClick={handleSendChat}
                  className={`p-2.5 rounded-full transition-all duration-200 flex-shrink-0 ${
                    chatInput.trim() 
                      ? 'bg-purple-600 text-white hover:bg-purple-700 shadow-lg shadow-purple-900/20 transform hover:scale-105' 
                      : 'bg-[#2b2d31] text-gray-500 cursor-not-allowed'
                  }`}
                  disabled={!chatInput.trim()}
                >
                  <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className="w-5 h-5">
                    <path d="M3.478 2.405a.75.75 0 0 0-.926.94l2.432 7.905H13.5a.75.75 0 0 1 0 1.5H4.984l-2.432 7.905a.75.75 0 0 0 .926.94 60.519 60.519 0 0 0 18.445-8.986.75.75 0 0 0 0-1.218A60.517 60.517 0 0 0 3.478 2.405Z" />
                  </svg>
                </button>
              </div>
            </div>
          </div>
        ) : (
          <div className="h-full flex flex-col">
            {/* Search Bar */}
            <div className="p-3 bg-[#1e1f22] border-b border-white/5">
              <div className="relative">
                <input
                  type="text"
                  placeholder="搜尋 YouTube..."
                  className="w-full bg-[#2b2d31] text-white text-sm rounded-lg pl-9 pr-9 py-2 focus:outline-none focus:ring-1 focus:ring-purple-500"
                  value={searchInput}
                  onChange={(e) => setSearchInput(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
                />
                <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="w-4 h-4 absolute left-3 top-2.5 text-gray-500">
                  <path fillRule="evenodd" d="M9 3.5a5.5 5.5 0 1 0 0 11 5.5 5.5 0 0 0 0-11ZM2 9a7 7 0 1 1 12.452 4.391l3.328 3.329a.75.75 0 1 1-1.06 1.06l-3.329-3.328A7 7 0 0 1 2 9Z" clipRule="evenodd" />
                </svg>
                {(searchInput || searchResults.length > 0) && (
                  <button 
                    onClick={() => {
                      setSearchInput('');
                      onSearch('');
                    }}
                    className="absolute right-3 top-2.5 text-gray-500 hover:text-white"
                  >
                    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="w-4 h-4">
                      <path d="M6.28 5.22a.75.75 0 0 0-1.06 1.06L8.94 10l-3.72 3.72a.75.75 0 1 0 1.06 1.06L10 11.06l3.72 3.72a.75.75 0 1 0 1.06-1.06L11.06 10l3.72-3.72a.75.75 0 0 0-1.06-1.06L10 8.94 6.28 5.22Z" />
                    </svg>
                  </button>
                )}
              </div>
            </div>

            {/* Sub Tabs (Only if not searching) */}
            {searchResults.length === 0 && (
              <div className="flex border-b border-white/5 bg-[#1a1b1e]">
                <button
                  className={`flex-1 py-2 text-xs font-medium transition-colors ${playlistView === 'queue' ? 'text-purple-400 bg-white/5' : 'text-gray-500 hover:text-gray-300'}`}
                  onClick={() => setPlaylistView('queue')}
                >
                  待播清單 ({queue.length})
                </button>
                <button
                  className={`flex-1 py-2 text-xs font-medium transition-colors ${playlistView === 'history' ? 'text-purple-400 bg-white/5' : 'text-gray-500 hover:text-gray-300'}`}
                  onClick={() => setPlaylistView('history')}
                >
                  歷史紀錄 ({history.length})
                </button>
              </div>
            )}

            {/* List Content */}
            <div className="flex-1 overflow-y-auto p-2 custom-scrollbar">
              {searchResults.length > 0 ? (
                <div className="space-y-2">
                  <div className="px-2 py-1 text-xs font-bold text-gray-400 uppercase tracking-wider">搜尋結果</div>
                  {searchResults.map((item, index) => (
                    <div key={`${item.videoId}-${index}`} className="group flex gap-3 p-2 rounded-lg hover:bg-[#2b2d31] transition-colors border border-transparent hover:border-white/5">
                       <div className="relative w-24 aspect-video rounded overflow-hidden flex-shrink-0 cursor-pointer bg-black" onClick={() => onPlay(item)}>
                          <img src={item.thumbnailUrl} alt={item.title} className="w-full h-full object-cover" />
                          <div className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 bg-black/40 transition-opacity">
                            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="white" className="w-6 h-6"><path d="M8 5v14l11-7z" /></svg>
                          </div>
                       </div>
                       <div className="flex-1 min-w-0 flex flex-col justify-between py-0.5">
                          <h4 className="text-xs font-medium text-gray-200 line-clamp-2 leading-tight mb-0.5" title={item.title}>{item.title}</h4>
                          <div className="flex items-center justify-between mt-1">
                            <span className="text-[10px] text-gray-500">{item.channelTitle}</span>
                            <button 
                              onClick={(e) => {
                                e.stopPropagation();
                                onAddToQueue(item);
                                setSearchInput(''); // Clear search after adding
                                onSearch(''); // Clear results
                              }}
                              className="text-purple-400 hover:text-purple-300 text-xs font-medium px-2 py-0.5 rounded bg-purple-500/10 hover:bg-purple-500/20 transition-colors"
                            >
                              + 加入
                            </button>
                          </div>
                       </div>
                    </div>
                  ))}
                </div>
              ) : playlistView === 'queue' ? (
                queue.length === 0 ? (
                  <div className="flex flex-col items-center justify-center h-full text-gray-500 gap-2">
                    <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-10 h-10 opacity-50">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 12h16.5m-16.5 3.75h16.5M3.75 19.5h16.5M5.625 4.5h12.75a1.875 1.875 0 0 1 0 3.75H5.625a1.875 1.875 0 0 1 0-3.75Z" />
                    </svg>
                    <p className="text-sm">播放清單是空的</p>
                  </div>
                ) : (
                  <div className="space-y-2">
                    {queue.map((item, index) => (
                      <div key={`${item.videoId}-${index}`} className="group flex gap-3 p-2 rounded-lg hover:bg-[#2b2d31] transition-colors border border-transparent hover:border-white/5">
                         <div className="relative w-24 aspect-video rounded overflow-hidden flex-shrink-0 cursor-pointer bg-black" onClick={() => onPlay(item)}>
                            <img src={item.thumbnailUrl} alt={item.title} className="w-full h-full object-cover opacity-80 group-hover:opacity-100 transition-opacity" />
                            <div className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 bg-black/40 transition-opacity">
                              <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="white" className="w-6 h-6"><path d="M8 5v14l11-7z" /></svg>
                            </div>
                         </div>
                         <div className="flex-1 min-w-0 flex flex-col justify-between py-0.5">
                            <div>
                              <h4 className="text-xs font-medium text-gray-200 line-clamp-2 leading-tight mb-0.5" title={item.title}>{item.title}</h4>
                              <p className="text-[10px] text-gray-500 truncate">{item.channelTitle}</p>
                            </div>
                            <div className="flex items-center justify-between mt-1">
                              <span className="text-[10px] text-gray-600">By {item.addedBy || 'User'}</span>
                              <button 
                                onClick={(e) => {
                                  e.stopPropagation();
                                  onRemoveFromQueue(index);
                                }}
                                className="text-gray-600 hover:text-error opacity-0 group-hover:opacity-100 transition-opacity p-1"
                                title="Remove"
                              >
                                <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="w-3 h-3">
                                  <path d="M6.28 5.22a.75.75 0 0 0-1.06 1.06L8.94 10l-3.72 3.72a.75.75 0 1 0 1.06 1.06L10 11.06l3.72 3.72a.75.75 0 1 0 1.06-1.06L11.06 10l3.72-3.72a.75.75 0 0 0-1.06-1.06L10 8.94 6.28 5.22Z" />
                                </svg>
                              </button>
                            </div>
                         </div>
                      </div>
                    ))}
                  </div>
                )
              ) : (
                // History View
                history.length === 0 ? (
                  <div className="flex flex-col items-center justify-center h-full text-gray-500 gap-2">
                    <p className="text-sm">沒有歷史紀錄</p>
                  </div>
                ) : (
                  <div className="space-y-2">
                    {history.map((item, index) => (
                      <div key={`${item.videoId}-${index}`} className="group flex gap-3 p-2 rounded-lg hover:bg-[#2b2d31] transition-colors border border-transparent hover:border-white/5 opacity-75 hover:opacity-100">
                         <div className="relative w-24 aspect-video rounded overflow-hidden flex-shrink-0 cursor-pointer bg-black" onClick={() => onPlay(item)}>
                            <img src={item.thumbnailUrl} alt={item.title} className="w-full h-full object-cover grayscale group-hover:grayscale-0 transition-all" />
                            <div className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 bg-black/40 transition-opacity">
                              <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="white" className="w-6 h-6"><path d="M8 5v14l11-7z" /></svg>
                            </div>
                         </div>
                         <div className="flex-1 min-w-0 flex flex-col justify-between py-0.5">
                            <h4 className="text-xs font-medium text-gray-300 line-clamp-2 leading-tight mb-0.5" title={item.title}>{item.title}</h4>
                            <div className="flex items-center justify-between mt-1">
                              <span className="text-[10px] text-gray-600">{item.channelTitle}</span>
                              <button 
                                onClick={(e) => {
                                  e.stopPropagation();
                                  onAddToQueue(item);
                                }}
                                className="text-gray-500 hover:text-purple-400 opacity-0 group-hover:opacity-100 transition-opacity"
                                title="Add to Queue"
                              >
                                <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="w-4 h-4">
                                  <path d="M10.75 4.75a.75.75 0 0 0-1.5 0v4.5h-4.5a.75.75 0 0 0 0 1.5h4.5v4.5a.75.75 0 0 0 1.5 0v-4.5h4.5a.75.75 0 0 0 0-1.5h-4.5v-4.5Z" />
                                </svg>
                              </button>
                            </div>
                         </div>
                      </div>
                    ))}
                  </div>
                )
              )}
            </div>
          </div>
        )}
      </div>
      <style>{`
        .custom-scrollbar::-webkit-scrollbar {
          width: 4px;
        }
        .custom-scrollbar::-webkit-scrollbar-track {
          background: transparent;
        }
        .custom-scrollbar::-webkit-scrollbar-thumb {
          background: #2b2d31;
          border-radius: 2px;
        }
        .custom-scrollbar::-webkit-scrollbar-thumb:hover {
          background: #3f4148;
        }
      `}</style>
    </div>
  );
};

export default Sidebar;
