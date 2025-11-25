import React, { useEffect, useState, useRef } from 'react';
import type { Message } from '../types';

interface User {
  id: string;
  username: string;
  avatar: string;
  lastSeen: number;
  emotion?: string;
  isFocused?: boolean;
}

interface UserDockProps {
  users: User[];
  currentUser: User;
  emotion?: string;
  isFocused?: boolean;
  messages: Message[];
  onInvite?: () => void;
}

const getEmotionEmoji = (emotion?: string) => {
  switch (emotion) {
    case 'Happy': return '😊';
    case 'Sad': return '😢';
    case 'Surprise': return '😲';
    case 'Angry': return '😠';
    case 'Neutral': return '😐';
    case 'Excited': return '🤩';
    case 'Thinking': return '🤔';
    case 'Laughing': return '😂';
    default: return null;
  }
};

const UserSeat: React.FC<{
  user: User;
  isMe: boolean;
  activeMessage: string | null;
  emotion?: string;
  isFocused?: boolean;
}> = ({ user, isMe, activeMessage, emotion, isFocused }) => {
  const [visibleEmoji, setVisibleEmoji] = useState<string | null>(null);
  const prevEmotionRef = useRef<string | undefined>(emotion);

  useEffect(() => {
    if (emotion !== prevEmotionRef.current) {
      const emoji = getEmotionEmoji(emotion);
      if (emoji) {
        setVisibleEmoji(emoji);
        const timer = setTimeout(() => {
          setVisibleEmoji(null);
        }, 3000);
        prevEmotionRef.current = emotion;
        return () => clearTimeout(timer);
      }
      prevEmotionRef.current = emotion;
    }
  }, [emotion]);

  return (
    <div className="relative flex flex-col items-center group pointer-events-auto transition-all duration-300 ease-out">
      
      {/* Chat Bubble - Positioned higher */}
      {activeMessage && (
        <div className="absolute bottom-[105%] mb-2 animate-in fade-in slide-in-from-bottom-2 duration-300 z-30 w-64 flex justify-center">
          <div className="relative bg-[#2b2d31] text-gray-100 px-3 py-2 rounded-2xl shadow-xl border border-white/10">
            <p className="text-xs font-medium leading-snug break-words text-center">{activeMessage}</p>
            {/* Bubble Tail */}
            <div className="absolute -bottom-2 left-1/2 -translate-x-1/2 w-4 h-4 bg-[#2b2d31] border-r border-b border-white/10 rotate-45"></div>
          </div>
        </div>
      )}

      {/* User Card (Discord Stream Style) */}
      <div className={`relative w-36 h-16 bg-[#1e1f22] rounded-xl overflow-hidden border-2 transition-all duration-300 shadow-2xl
        ${activeMessage ? 'border-green-500' : 'border-transparent group-hover:border-white/20'}
        ${isFocused === false ? 'opacity-60 grayscale' : 'opacity-100'}
      `}>
        
        {/* Avatar Container */}
        <div className="absolute inset-0 flex items-center justify-center">
           <div className="relative">
             <img 
              src={user.avatar} 
              alt={user.username}
              className={`w-10 h-10 rounded-full object-cover border-2 border-[#2b2d31] shadow-lg ${activeMessage ? 'scale-110' : 'scale-100'} transition-transform duration-300`}
            />
            
            {/* Emotion Overlay (Animated) */}
            {visibleEmoji && (
               <div className="absolute inset-0 flex items-center justify-center bg-black/60 backdrop-blur-sm rounded-full z-10 animate-in fade-in zoom-in duration-300">
                  <span className="text-2xl animate-bounce">{visibleEmoji}</span>
               </div>
            )}
           </div>
        </div>

        {/* Status Indicator (Sleeping only) */}
        {isFocused === false && (
          <div className="absolute top-1 right-1 bg-black/60 backdrop-blur-md rounded-full px-1 py-0.5 flex items-center gap-1 border border-white/10">
             <span className="text-xs">💤</span>
          </div>
        )}
        
        {/* Name Tag Overlay */}
        <div className="absolute bottom-0 left-0 right-0 p-1 bg-gradient-to-t from-black/80 to-transparent flex justify-center opacity-0 group-hover:opacity-100 transition-opacity duration-300">
          <span className="text-[10px] text-white font-bold shadow-black drop-shadow-md truncate">
            {isMe ? '我' : user.username}
          </span>
        </div>
      </div>
    </div>
  );
};

const UserDock: React.FC<UserDockProps> = ({ 
  users, 
  currentUser, 
  emotion, 
  isFocused, 
  messages, 
  onInvite 
}) => {
  // Merge current user emotion and focus status
  const displayUsers = users.map(u => 
    u.id === currentUser.id ? { ...u, emotion: emotion || u.emotion, isFocused: isFocused } : u
  );
  
  // Ensure current user is in the list if not already (for local preview)
  if (!displayUsers.find(u => u.id === currentUser.id)) {
    displayUsers.unshift({ ...currentUser, emotion, isFocused });
  }

  // Helper to get active message for a user
  const getActiveMessage = (userId: string) => {
    // Find the latest message from this user
    const userMessages = messages.filter(m => m.userId === userId);
    const lastMessage = userMessages[userMessages.length - 1];
    
    if (!lastMessage) return null;

    // Check if it's within the last 5 seconds
    const now = Date.now() / 1000;
    if (now - lastMessage.timestamp < 5) {
      return lastMessage.content;
    }
    return null;
  };

  // Force re-render every second to update message visibility (fade out)
  const [, setTick] = useState(0);
  useEffect(() => {
    const timer = setInterval(() => setTick(t => t + 1), 1000);
    return () => clearInterval(timer);
  }, []);

  return (
    <div className="absolute bottom-0 left-0 right-0 h-20 flex items-end justify-center gap-3 px-10 pb-2 z-20 pointer-events-none">
      {/* Seating Area Background Gradient */}
      <div className="absolute inset-x-0 bottom-0 h-32 bg-gradient-to-t from-black via-black/90 to-transparent -z-10" />

      {displayUsers.map((user) => {
        const isMe = user.id === currentUser.id;
        const userEmotion = isMe ? emotion : user.emotion;
        const userFocused = isMe ? isFocused : user.isFocused;
        const activeMessage = getActiveMessage(user.id);
        
        return (
          <UserSeat 
            key={user.id}
            user={user}
            isMe={isMe}
            activeMessage={activeMessage}
            emotion={userEmotion}
            isFocused={userFocused}
          />
        );
      })}
      
      {/* Invite Button (Card Style) */}
      <button 
        onClick={onInvite}
        className="relative w-36 h-16 bg-[#1e1f22]/50 rounded-xl border-2 border-dashed border-white/10 flex flex-col items-center justify-center gap-1 group pointer-events-auto hover:bg-[#1e1f22] hover:border-white/30 transition-all"
      >
        <div className="w-8 h-8 rounded-full bg-white/5 flex items-center justify-center group-hover:bg-white/10 transition-colors">
          <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="w-4 h-4 text-gray-400 group-hover:text-white">
            <path d="M10.75 4.75a.75.75 0 0 0-1.5 0v4.5h-4.5a.75.75 0 0 0 0 1.5h4.5v4.5a.75.75 0 0 0 1.5 0v-4.5h4.5a.75.75 0 0 0 0-1.5h-4.5v-4.5Z" />
          </svg>
        </div>
        <span className="text-[10px] text-gray-500 font-medium group-hover:text-gray-300">邀請朋友</span>
      </button>
    </div>
  );
};

export default UserDock;
