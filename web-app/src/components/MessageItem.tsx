import React, { useState } from 'react';
import { optimizeAvatarUrl, avatarSizes } from '../utils/imageOptimizer';
import type { Message, RoomUser } from '../types';

interface MessageItemProps {
  msg: Message;
  isMe: boolean;
  user?: RoomUser;
  avatar: string;
  formatTime: (timestamp: number) => string;
  formatVideoTime: (seconds: number) => string;
  spoilerPreference: 'show_all' | 'hide_spoilers';
}

const MessageItem: React.FC<MessageItemProps> = ({ 
  msg, 
  isMe, 
  user, 
  avatar, 
  formatTime, 
  formatVideoTime, 
  spoilerPreference 
}) => {
  const [isRevealed, setIsRevealed] = useState(false);
  const isSpoiler = msg.isSpoiler && spoilerPreference === 'hide_spoilers';

  return (
    <div className={`flex gap-3 ${isMe ? 'flex-row-reverse' : ''}`}>
      <div className="flex-shrink-0">
        <img src={optimizeAvatarUrl(avatar, avatarSizes.thumbnail)} alt={msg.username} loading="lazy" className="w-8 h-8 rounded-full bg-gray-700" />
      </div>
      <div className={`flex flex-col max-w-[80%] ${isMe ? 'items-end' : 'items-start'}`}>
        <div className="flex items-baseline gap-2 mb-1 max-w-full">
          <span className="text-xs font-medium text-gray-300 flex-shrink-0">{msg.username}</span>
          {msg.videoTitle ? (
            <span className="text-[10px] text-purple-400 truncate min-w-0" title={`${msg.videoTitle} @ ${formatVideoTime(msg.videoTimestamp || 0)}`}>
              {msg.videoTitle} <span className="text-gray-500">@ {formatVideoTime(msg.videoTimestamp || 0)}</span>
            </span>
          ) : (
            <span className="text-[10px] text-gray-500 flex-shrink-0">{formatTime(msg.timestamp)}</span>
          )}
        </div>
        
        {isSpoiler && !isRevealed ? (
           <div 
             className={`relative px-3 py-2 rounded-lg text-sm break-words cursor-pointer overflow-hidden group ${
               isMe 
                 ? 'bg-primary text-primary-content rounded-tr-none' 
                 : 'bg-gray-800 text-gray-300 rounded-tl-none'
             }`}
             onClick={() => setIsRevealed(true)}
           >
             <div className="filter blur-md select-none opacity-50">
               {msg.content}
             </div>
             <div className="absolute inset-0 flex flex-col items-center justify-center bg-black/20 group-hover:bg-black/10 transition-colors">
               <span className="text-xs font-bold text-white drop-shadow-md">⚠️ 劇透警告</span>
               <span className="text-[10px] text-white/80">點擊顯示</span>
             </div>
           </div>
        ) : (
          <div className={`px-3 py-2 rounded-lg text-sm break-words ${
            isMe 
              ? 'bg-primary text-primary-content rounded-tr-none' 
              : 'bg-gray-800 text-gray-300 rounded-tl-none'
          }`}>
            {msg.content}
            {msg.isSpoiler && (
               <span className="block text-[10px] text-yellow-500/80 mt-1 border-t border-white/10 pt-1">
                 ⚠️ 劇透內容
               </span>
            )}
          </div>
        )}
      </div>
    </div>
  );
};

export default MessageItem;
