import React, { useEffect, useState, useRef } from 'react';
import type { Message } from '../types';

interface User {
  id: string;
  username: string;
  avatar: string;
  lastSeen: number;
  emotion?: string;
  isFocused?: boolean;
  isAi?: boolean;
  addedBy?: string;
  addedByUsername?: string;
  hasScript?: boolean;
}

interface UserDockProps {
  users: User[];
  currentUser: User;
  emotion?: string;
  isFocused?: boolean;
  messages: Message[];
  hostId?: string;
  onInvite?: () => void;
  onEmotionSelect?: (emotion: string) => void;
  mutedUserIds?: string[];
  onToggleMute?: (userId: string) => void;
  onRemoveCompanion?: (companionName: string) => void;
}

const getEmotionEmoji = (emotion?: string, isAi?: boolean) => {
  if (!emotion) return null;

  // 檢查是否為直接的 emoji (適用於 AI 和一般用戶)
  const emojiRegex = /[\u{1F300}-\u{1F9FF}]|[\u{2600}-\u{26FF}]|[\u{2700}-\u{27BF}]/u;
  if (emojiRegex.test(emotion)) {
    return emotion;
  }
  
  // 標準情緒映射
  switch (emotion) {
    case 'Happy': return '😊';
    case 'Sad': return '😭';
    case 'Surprise': return '😯';
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
  isHost: boolean;
  activeMessage: string | null;
  lastMessage: string | null;
  emotion?: string;
  isFocused?: boolean;
  onEmotionSelect?: (emotion: string) => void;
  isMuted?: boolean;
  onToggleMute?: (userId: string) => void;
  canRemove?: boolean;
  onRemove?: () => void;
  addedByUsername?: string;
}> = React.memo(({ user, isMe, isHost, activeMessage, lastMessage, emotion, isMuted, onToggleMute, canRemove, onRemove, addedByUsername }) => {
  const [visibleEmoji, setVisibleEmoji] = useState<string | null>(() => getEmotionEmoji(emotion, user.isAi));
  const [showHistory, setShowHistory] = useState(false);

  useEffect(() => {
    const emoji = getEmotionEmoji(emotion, user.isAi);
    setVisibleEmoji(emoji || null);
  }, [emotion, user.isAi]);

  const messageToDisplay = isMuted 
    ? (activeMessage ? '...' : null) 
    : (activeMessage || (showHistory ? lastMessage : null));

  // 處理點擊對話框關閉
  const handleBubbleClick = (e: React.MouseEvent) => {
    e.stopPropagation(); // 防止事件冒泡
    setShowHistory(false); // 關閉歷史訊息顯示
  };

  return (
    <div className="relative flex flex-col items-center group pointer-events-auto transition-all duration-300 ease-out">
      
      {/* Chat Bubble - Positioned higher */}
      {messageToDisplay && (
        <div className="absolute bottom-[105%] mb-2 animate-in fade-in slide-in-from-bottom-2 duration-300 z-30 w-64 flex justify-center">
          <div 
            onClick={handleBubbleClick}
            className={`relative ${isMuted ? 'bg-gray-700/80' : 'bg-[#2b2d31]'} text-gray-100 px-3 py-2 rounded-2xl shadow-xl border border-white/10 cursor-pointer hover:bg-[#313338] transition-colors`}
            title="點擊關閉"
          >
            <p className={`text-xs font-medium leading-snug break-words text-center ${isMuted ? 'text-gray-400 italic tracking-widest' : ''}`}>
              {messageToDisplay}
            </p>
            {/* Bubble Tail */}
            <div className={`absolute -bottom-2 left-1/2 -translate-x-1/2 w-4 h-4 ${isMuted ? 'bg-gray-700/80' : 'bg-[#2b2d31]'} border-r border-b border-white/10 rotate-45`}></div>
          </div>
        </div>
      )}

      {/* User Card (Discord Stream Style) */}
      <div 
        className={`relative w-36 h-16 bg-[#1e1f22] rounded-xl overflow-hidden border-2 transition-all duration-300 shadow-2xl
        ${messageToDisplay ? 'border-green-500' : 'border-transparent group-hover:border-white/20'}
        ${isMe ? 'cursor-pointer hover:ring-2 hover:ring-primary/50' : 'cursor-pointer hover:ring-2 hover:ring-white/20'}
        ${user.isAi ? 'border-purple-500/30' : ''}
        ${isMuted ? 'opacity-50 grayscale' : ''}
        `}
        onClick={() => setShowHistory(!showHistory)}
      >
        {/* Remove Button Overlay */}
        {canRemove && onRemove && (
          <button
            onClick={(e) => {
              e.stopPropagation();
              if (window.confirm(`確定要移除 ${user.username} 嗎？`)) {
                onRemove();
              }
            }}
            className="absolute top-1 left-1 z-20 p-1 rounded-full bg-black/50 hover:bg-red-500/80 transition-colors text-gray-400 hover:text-white opacity-0 group-hover:opacity-100"
            title="移除影伴"
          >
            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="w-3 h-3">
              <path d="M6.28 5.22a.75.75 0 0 0-1.06 1.06L8.94 10l-3.72 3.72a.75.75 0 1 0 1.06 1.06L10 11.06l3.72 3.72a.75.75 0 1 0 1.06-1.06L11.06 10l3.72-3.72a.75.75 0 0 0-1.06-1.06L10 8.94 6.28 5.22Z" />
            </svg>
          </button>
        )}

        {/* Mute Button Overlay */}
        {!isMe && onToggleMute && (
          <button
            onClick={(e) => {
              e.stopPropagation();
              onToggleMute(user.id);
            }}
            className={`absolute top-1 right-1 z-20 p-1 rounded-full bg-black/50 hover:bg-black/80 transition-colors ${isMuted ? 'text-red-500' : 'text-gray-400 opacity-0 group-hover:opacity-100'}`}
            title={isMuted ? "Unmute" : "Mute"}
          >
            {isMuted ? (
              <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="w-3 h-3">
                <path d="M9.383 3.076A1 1 0 0 1 10 4v12a1 1 0 0 1-1.707.707L4.586 13H2a1 1 0 0 1-1-1V8a1 1 0 0 1 1-1h2.586l3.707-3.707a1 1 0 0 1 1.09-.217ZM12.293 7.293a1 1 0 0 1 1.414 0L15 8.586l1.293-1.293a1 1 0 1 1 1.414 1.414L16.414 10l1.293 1.293a1 1 0 0 1-1.414 1.414L15 11.414l-1.293 1.293a1 1 0 0 1-1.414-1.414L13.586 10l-1.293-1.293a1 1 0 0 1 0-1.414Z" />
              </svg>
            ) : (
              <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="w-3 h-3">
                <path d="M9.383 3.076A1 1 0 0 1 10 4v12a1 1 0 0 1-1.707.707L4.586 13H2a1 1 0 0 1-1-1V8a1 1 0 0 1 1-1h2.586l3.707-3.707a1 1 0 0 1 1.09-.217ZM14.657 2.929a1 1 0 0 1 1.414 0A9.972 9.972 0 0 1 19 10a9.972 9.972 0 0 1-2.929 7.071 1 1 0 0 1-1.414-1.414A7.971 7.971 0 0 0 17 10c0-2.21-.894-4.208-2.343-5.657a1 1 0 0 1 0-1.414Zm-2.829 2.828a1 1 0 0 1 1.415 0A5.983 5.983 0 0 1 15 10a5.984 5.984 0 0 1-1.757 4.243 1 1 0 0 1-1.415-1.415A3.984 3.984 0 0 0 13 10a3.983 3.983 0 0 0-1.172-2.828 1 1 0 0 1 0-1.415Z" />
              </svg>
            )}
          </button>
        )}
        
        {/* Script Indicator */}
        {user.hasScript && (
          <div className="absolute bottom-1 right-1 z-20 p-0.5 rounded-full bg-blue-500/80 text-white" title="此影伴有對應此影片的腳本">
            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="w-3 h-3">
              <path fillRule="evenodd" d="M4.5 2A1.5 1.5 0 0 0 3 3.5v13A1.5 1.5 0 0 0 4.5 18h11a1.5 1.5 0 0 0 1.5-1.5V7.621a1.5 1.5 0 0 0-.44-1.06l-4.12-4.122A1.5 1.5 0 0 0 11.378 2H4.5Zm2.25 8.5a.75.75 0 0 0 0 1.5h6.5a.75.75 0 0 0 0-1.5h-6.5Zm0 3a.75.75 0 0 0 0 1.5h6.5a.75.75 0 0 0 0-1.5h-6.5Z" clipRule="evenodd" />
            </svg>
          </div>
        )}

        {/* Avatar Container */}
        <div className="absolute inset-0 flex items-center justify-center">
           <div className="relative">
             <img 
              src={user.avatar} 
              alt={user.username}
              className={`w-10 h-10 rounded-full object-cover border-2 ${user.isAi ? 'border-purple-500/50' : 'border-[#2b2d31]'} shadow-lg ${activeMessage ? 'scale-110' : 'scale-100'} transition-transform duration-300`}
            />
            
            {/* Host Badge */}
            {isHost && (
              <div className="absolute -top-2 -right-2 px-1.5 py-0.5 bg-gradient-to-r from-yellow-500 to-amber-500 rounded text-[9px] font-bold text-white shadow-lg z-20 border border-yellow-400" title="房主">
                房主
              </div>
            )}
            
            {/* Emotion Overlay (Animated) */}
            {visibleEmoji && (
               <div className="absolute inset-0 flex items-center justify-center bg-black/60 backdrop-blur-sm rounded-full z-10 animate-in fade-in zoom-in duration-300">
                  <span className="text-2xl animate-bounce">{visibleEmoji}</span>
               </div>
            )}
           </div>
        </div>
        
        {/* Name Tag Overlay */}
        <div className="absolute bottom-0 left-0 right-0 p-1 bg-gradient-to-t from-black/80 to-transparent flex flex-col items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity duration-300">
          <span className="text-[10px] text-white font-bold shadow-black drop-shadow-md truncate">
            {isHost && <span className="text-yellow-400 mr-0.5">[房主]</span>}
            {isMe ? '我' : user.username}
          </span>
          {user.isAi && addedByUsername && (
             <span className="text-[8px] text-gray-400 shadow-black drop-shadow-md truncate">
               by {addedByUsername}
             </span>
          )}
        </div>
      </div>
    </div>
  );
}, (prevProps, nextProps) => {
  // 自定義比較函數，只在真正需要時才重新渲染
  return prevProps.user.id === nextProps.user.id &&
         prevProps.user.avatar === nextProps.user.avatar &&
         prevProps.user.username === nextProps.user.username &&
         prevProps.isHost === nextProps.isHost &&
         prevProps.isMe === nextProps.isMe &&
         prevProps.activeMessage === nextProps.activeMessage &&
         prevProps.emotion === nextProps.emotion &&
         prevProps.isMuted === nextProps.isMuted &&
         prevProps.canRemove === nextProps.canRemove &&
         prevProps.addedByUsername === nextProps.addedByUsername;
});

const UserDock: React.FC<UserDockProps> = (props) => {
  const { users, currentUser, emotion, isFocused, messages, hostId, onInvite, onRemoveCompanion } = props;

  const MAX_VISIBLE_OTHERS = 5;
  const [visibleIds, setVisibleIds] = useState<string[]>([]);
  const [showHiddenList, setShowHiddenList] = useState(false);
  const lastActiveRef = useRef<Map<string, number>>(new Map());

  // Update last active time and promote hidden users
  useEffect(() => {
    if (messages.length === 0) return;
    const lastMsg = messages[messages.length - 1];
    const senderId = lastMsg.userId;
    
    lastActiveRef.current.set(senderId, Date.now());

    if (senderId === currentUser.id) return;

    // If sender is not visible, promote them
    if (!visibleIds.includes(senderId)) {
        const userExists = users.find(u => u.id === senderId);
        if (userExists) {
             setVisibleIds(prev => {
                 if (prev.length < MAX_VISIBLE_OTHERS) {
                     return [senderId, ...prev];
                 }
                 
                 // Find least active to remove
                 let candidateId = prev[0];
                 let minTime = Infinity;

                 for (const id of prev) {
                     const time = lastActiveRef.current.get(id) || 0;
                     if (time < minTime) {
                         minTime = time;
                         candidateId = id;
                     }
                 }
                 
                 // Remove least active, add new to front
                 return [senderId, ...prev.filter(id => id !== candidateId)];
             });
        }
    }
  }, [messages, currentUser.id]);

  // Sync visibleIds with users list
  useEffect(() => {
      setVisibleIds(prev => {
          const currentOtherIds = users.filter(u => u.id !== currentUser.id).map(u => u.id);
          
          // Remove left users
          let newVisible = prev.filter(id => currentOtherIds.includes(id));
          
          // Fill up
          if (newVisible.length < MAX_VISIBLE_OTHERS) {
              const remaining = currentOtherIds.filter(id => !newVisible.includes(id));
              const toAdd = remaining.slice(0, MAX_VISIBLE_OTHERS - newVisible.length);
              newVisible = [...newVisible, ...toAdd];
          }
          
          if (newVisible.length !== prev.length || !newVisible.every((id, i) => id === prev[i])) {
              return newVisible;
          }
          return prev;
      });
  }, [users, currentUser.id]);

  const displayUsers = React.useMemo(() => {
    const list: User[] = [];
    
    // 1. Current User (Always first)
    const me = users.find(u => u.id === currentUser.id) || currentUser;
    list.push({
        ...me,
        emotion: emotion || me.emotion,
        isFocused: isFocused
    });

    // 2. Visible Others
    visibleIds.forEach(id => {
        const u = users.find(user => user.id === id);
        if (u) list.push(u);
    });
    
    return list;
  }, [users, currentUser.id, emotion, isFocused, visibleIds]);

  const hiddenUsers = React.useMemo(() => {
      return users.filter(u => u.id !== currentUser.id && !visibleIds.includes(u.id));
  }, [users, currentUser.id, visibleIds]);

  // 緩存消息映射，避免每次都重新計算
  const userMessagesMap = React.useMemo(() => {
    const now = Date.now() / 1000;
    const map = new Map<string, {active: string | null; last: string | null}>();
    
    displayUsers.forEach(user => {
      const userMessages = messages.filter(m => m.userId === user.id);
      const lastMessage = userMessages[userMessages.length - 1];
      
      if (!lastMessage) {
        map.set(user.id, {active: null, last: null});
        return;
      }
      
      const messageAge = now - lastMessage.timestamp;
      const active = messageAge < 5 ? lastMessage.content : null;
      const last = lastMessage.content;
      
      map.set(user.id, {active, last});
    });
    
    return map;
  }, [messages, displayUsers]);

  return (
    <div className="absolute bottom-0 left-0 right-0 h-20 flex items-end justify-center gap-3 px-10 pb-2 z-20 pointer-events-none">
      {/* Seating Area Background Gradient */}
      <div className="absolute inset-x-0 bottom-0 h-32 bg-gradient-to-t from-black via-black/90 to-transparent -z-10" />

      {displayUsers.map((user) => {
        const isMe = user.id === currentUser.id;
        const isHost = user.id === hostId;
        const userEmotion = isMe ? emotion : user.emotion;
        const userFocused = isMe ? isFocused : user.isFocused;
        const isMuted = props.mutedUserIds?.includes(user.id);
        
        // 從緩存的映射中獲取消息
        const messageData = userMessagesMap.get(user.id) || {active: null, last: null};
        // 即使被靜音，也傳遞消息內容，但在 UserSeat 中處理顯示邏輯
        const activeMessage = messageData.active;
        const lastMessage = messageData.last;
        
        const canRemove = user.isAi && onRemoveCompanion && (
          user.addedBy === currentUser.id || hostId === currentUser.id
        );

        let addedByUsername = user.addedByUsername;
        if (!addedByUsername && user.isAi && user.addedBy) {
           const addedByUser = users.find(u => u.id === user.addedBy);
           addedByUsername = addedByUser ? addedByUser.username : (user.addedBy === currentUser.id ? '我' : undefined);
        }
        
        return (
          <UserSeat 
            key={user.id}
            user={user}
            isMe={isMe}
            isHost={isHost}
            activeMessage={activeMessage}
            lastMessage={lastMessage}
            emotion={userEmotion}
            isFocused={userFocused}
            onEmotionSelect={undefined}
            isMuted={isMuted}
            onToggleMute={props.onToggleMute}
            canRemove={canRemove}
            onRemove={() => onRemoveCompanion && onRemoveCompanion(user.username)}
            addedByUsername={addedByUsername}
          />
        );
      })}
      
      {/* Hidden Users Indicator */}
      {hiddenUsers.length > 0 && (
        <div className="relative flex flex-col items-center group pointer-events-auto">
            <button 
                onClick={() => setShowHiddenList(!showHiddenList)}
                className="relative w-36 h-16 bg-[#1e1f22] rounded-xl border-2 border-transparent hover:border-white/20 flex items-center justify-center transition-all shadow-2xl group overflow-hidden"
            >
                <div className="w-10 h-10 rounded-full bg-white/5 flex items-center justify-center border-2 border-white/10 group-hover:border-white/30 transition-colors">
                    <span className="text-sm font-bold text-gray-400 group-hover:text-white">+{hiddenUsers.length}</span>
                </div>
                
                <div className="absolute bottom-0 left-0 right-0 p-1 bg-gradient-to-t from-black/80 to-transparent flex justify-center opacity-0 group-hover:opacity-100 transition-opacity duration-300">
                    <span className="text-[10px] text-gray-400 font-bold">其他成員</span>
                </div>
            </button>
            
            {/* Hidden List Popup */}
            {showHiddenList && (
                <div className="absolute bottom-full mb-4 left-1/2 -translate-x-1/2 bg-[#1e1f22] border border-white/10 rounded-xl p-2 w-56 max-h-64 overflow-y-auto shadow-xl z-50">
                    <div className="flex justify-between items-center px-2 mb-2 border-b border-white/5 pb-2">
                        <span className="text-xs text-gray-400">其他成員</span>
                        <button onClick={() => setShowHiddenList(false)} className="text-gray-400 hover:text-white">✕</button>
                    </div>
                    <div className="flex flex-col gap-1">
                        {hiddenUsers.map(u => {
                            const isMuted = props.mutedUserIds?.includes(u.id);
                            const canRemove = u.isAi && onRemoveCompanion && (
                                u.addedBy === currentUser.id || hostId === currentUser.id
                            );

                            return (
                                <div key={u.id} className="flex items-center justify-between p-2 hover:bg-white/5 rounded-lg transition-colors group/item">
                                    <div className="flex items-center gap-2 overflow-hidden">
                                        <div className="w-8 h-8 rounded-full overflow-hidden bg-white/5 flex-shrink-0 relative">
                                            <img src={u.avatar} alt={u.username} className={`w-full h-full object-cover ${isMuted ? 'grayscale opacity-50' : ''}`} />
                                            {isMuted && (
                                                <div className="absolute inset-0 flex items-center justify-center bg-black/50">
                                                    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="w-4 h-4 text-red-500">
                                                        <path d="M9.383 3.076A1 1 0 0 1 10 4v12a1 1 0 0 1-1.707.707L4.586 13H2a1 1 0 0 1-1-1V8a1 1 0 0 1 1-1h2.586l3.707-3.707a1 1 0 0 1 1.09-.217ZM12.293 7.293a1 1 0 0 1 1.414 0L15 8.586l1.293-1.293a1 1 0 1 1 1.414 1.414L16.414 10l1.293 1.293a1 1 0 0 1-1.414 1.414L15 11.414l-1.293 1.293a1 1 0 0 1-1.414-1.414L13.586 10l-1.293-1.293a1 1 0 0 1 0-1.414Z" />
                                                    </svg>
                                                </div>
                                            )}
                                        </div>
                                        <span className={`text-sm truncate max-w-[80px] ${isMuted ? 'text-gray-500' : 'text-gray-200'}`}>{u.username}</span>
                                    </div>
                                    
                                    <div className="flex items-center gap-1 opacity-0 group-hover/item:opacity-100 transition-opacity">
                                        {/* Mute Button */}
                                        {props.onToggleMute && u.id !== currentUser.id && (
                                            <button
                                                onClick={(e) => {
                                                    e.stopPropagation();
                                                    props.onToggleMute?.(u.id);
                                                }}
                                                className="p-1.5 rounded-lg hover:bg-white/10 text-gray-400 hover:text-white transition-colors"
                                                title={isMuted ? "取消靜音" : "靜音"}
                                            >
                                                {isMuted ? (
                                                    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="w-4 h-4 text-red-400">
                                                        <path d="M9.383 3.076A1 1 0 0 1 10 4v12a1 1 0 0 1-1.707.707L4.586 13H2a1 1 0 0 1-1-1V8a1 1 0 0 1 1-1h2.586l3.707-3.707a1 1 0 0 1 1.09-.217ZM12.293 7.293a1 1 0 0 1 1.414 0L15 8.586l1.293-1.293a1 1 0 1 1 1.414 1.414L16.414 10l1.293 1.293a1 1 0 0 1-1.414 1.414L15 11.414l-1.293 1.293a1 1 0 0 1-1.414-1.414L13.586 10l-1.293-1.293a1 1 0 0 1 0-1.414Z" />
                                                    </svg>
                                                ) : (
                                                    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="w-4 h-4">
                                                        <path d="M9.383 3.076A1 1 0 0 1 10 4v12a1 1 0 0 1-1.707.707L4.586 13H2a1 1 0 0 1-1-1V8a1 1 0 0 1 1-1h2.586l3.707-3.707a1 1 0 0 1 1.09-.217ZM14.657 2.929a1 1 0 0 1 1.414 0A9.972 9.972 0 0 1 19 10a9.972 9.972 0 0 1-2.929 7.071 1 1 0 0 1-1.414-1.414A7.971 7.971 0 0 0 17 10c0-2.21-.894-4.208-2.343-5.657a1 1 0 0 1 0-1.414Zm-2.829 2.828a1 1 0 0 1 1.415 0A5.983 5.983 0 0 1 15 10a5.984 5.984 0 0 1-1.757 4.243 1 1 0 0 1-1.415-1.415A3.984 3.984 0 0 0 13 10a3.983 3.983 0 0 0-1.172-2.828 1 1 0 0 1 0-1.415Z" />
                                                    </svg>
                                                )}
                                            </button>
                                        )}

                                        {/* Remove Button */}
                                        {canRemove && (
                                            <button
                                                onClick={(e) => {
                                                    e.stopPropagation();
                                                    if (window.confirm(`確定要移除 ${u.username} 嗎？`)) {
                                                        onRemoveCompanion?.(u.username);
                                                    }
                                                }}
                                                className="p-1.5 rounded-lg hover:bg-red-500/20 text-gray-400 hover:text-red-400 transition-colors"
                                                title="移除"
                                            >
                                                <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="w-4 h-4">
                                                    <path d="M6.28 5.22a.75.75 0 0 0-1.06 1.06L8.94 10l-3.72 3.72a.75.75 0 1 0 1.06 1.06L10 11.06l3.72 3.72a.75.75 0 1 0 1.06-1.06L11.06 10l3.72-3.72a.75.75 0 0 0-1.06-1.06L10 8.94 6.28 5.22Z" />
                                                </svg>
                                            </button>
                                        )}
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                </div>
            )}
        </div>
      )}

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
        <span className="text-[10px] text-gray-500 font-medium group-hover:text-gray-300">加入影伴</span>
      </button>
    </div>
  );
};

// 使用 React.memo 優化，只在 props 真正改變時才重新渲染
export default React.memo(UserDock, (prevProps, nextProps) => {
  // 比較基本 props
  if (prevProps.hostId !== nextProps.hostId) return false;
  if (prevProps.currentUser.id !== nextProps.currentUser.id) return false;
  if (prevProps.emotion !== nextProps.emotion) return false;
  if (prevProps.isFocused !== nextProps.isFocused) return false;
  if (prevProps.users.length !== nextProps.users.length) return false;
  
  // 比較用戶列表 - 使用 Map 按 ID 比較，不依賴順序
  const prevUserMap = new Map(prevProps.users.map(u => [u.id, u]));
  for (const nextUser of nextProps.users) {
    const prevUser = prevUserMap.get(nextUser.id);
    if (!prevUser ||
        prevUser.username !== nextUser.username ||
        prevUser.avatar !== nextUser.avatar ||
        prevUser.emotion !== nextUser.emotion ||
        prevUser.isAi !== nextUser.isAi) {
      return false;
    }
  }
  
  // 比較消息列表 - 只比較最後一條消息的 ID 和時間戳
  if (prevProps.messages.length !== nextProps.messages.length) return false;
  if (prevProps.messages.length > 0 && nextProps.messages.length > 0) {
    const prevLast = prevProps.messages[prevProps.messages.length - 1];
    const nextLast = nextProps.messages[nextProps.messages.length - 1];
    if (prevLast.id !== nextLast.id || prevLast.timestamp !== nextLast.timestamp) {
      return false;
    }
  }

  // 比較靜音列表
  const prevMuted = prevProps.mutedUserIds || [];
  const nextMuted = nextProps.mutedUserIds || [];
  if (prevMuted.length !== nextMuted.length) return false;
  // 簡單比較內容是否相同（假設順序可能不同，但通常是 append/remove）
  const prevMutedSet = new Set(prevMuted);
  for (const id of nextMuted) {
      if (!prevMutedSet.has(id)) return false;
  }
  
  return true; // 沒有變化，跳過重新渲染
});
