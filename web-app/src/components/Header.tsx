import React from 'react';
import { useNavigate } from 'react-router-dom';

interface HeaderProps {
  roomName?: string;
  userCount?: number;
  onPlaylistClick?: () => void;
  onChatClick?: () => void;
  onShareClick?: () => void;
  serverVideoState?: {
    played: number;
    lastUpdated: number;
    playing: boolean;
    playbackRate: number;
  };
  currentTime?: number;
}

const HeaderComponent: React.FC<HeaderProps> = ({ 
  roomName, 
  userCount, 
  onPlaylistClick,
  onChatClick,
  onShareClick,
  serverVideoState,
  currentTime
}) => {
  const navigate = useNavigate();
  const [serverTime, setServerTime] = React.useState<string>('00:00');

  React.useEffect(() => {
    if (!serverVideoState) return;

    const updateTime = () => {
      const now = Date.now() / 1000;
      let current = serverVideoState.played;
      
      if (serverVideoState.playing) {
        const diff = now - serverVideoState.lastUpdated;
        current += diff * serverVideoState.playbackRate;
      }
      
      const minutes = Math.floor(current / 60);
      const seconds = Math.floor(current % 60);
      setServerTime(`${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`);
    };

    updateTime();
    const interval = setInterval(updateTime, 100);
    return () => clearInterval(interval);
  }, [serverVideoState]);

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  return (
    <div className="h-16 bg-[#0f0f0f]/80 backdrop-blur-md border-b border-white/5 flex items-center justify-between px-6 fixed top-0 right-0 left-0 z-50 transition-all duration-300">
      {/* Left: Logo or Back & Room Info */}
      <div className="flex items-center gap-4">
        {roomName ? (
          <>
            <button 
              onClick={() => navigate('/')}
              className="btn btn-ghost btn-sm text-gray-400 hover:text-white gap-2"
            >
              <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="w-5 h-5">
                <path fillRule="evenodd" d="M17 10a.75.75 0 0 1-.75.75H5.612l4.158 3.96a.75.75 0 1 1-1.048 1.08l-5.5-5.25a.75.75 0 0 1 0-1.08l5.5-5.25a.75.75 0 1 1 1.048 1.08L5.612 9.25H16.25A.75.75 0 0 1 17 10Z" clipRule="evenodd" />
              </svg>
              返回大廳
            </button>
            <div className="h-6 w-px bg-white/10 mx-2"></div>
            <h1 className="text-white font-medium text-lg">{roomName}</h1>
            {(serverVideoState || currentTime !== undefined) && (
              <div className="ml-4 px-3 py-1 rounded-full bg-white/5 border border-white/10 text-xs font-mono text-gray-400 flex items-center gap-2">
                <div className={`w-1.5 h-1.5 rounded-full ${serverVideoState?.playing ? 'bg-green-500 animate-pulse' : 'bg-yellow-500'}`}></div>
                Time: {currentTime !== undefined ? formatTime(currentTime) : serverTime}
              </div>
            )}
          </>
        ) : (
          <div className="flex items-center gap-3 cursor-pointer group" onClick={() => navigate('/')}>
            <div className="w-9 h-9 bg-gradient-to-tr from-primary to-purple-600 rounded-xl flex items-center justify-center shadow-lg shadow-primary/20 group-hover:scale-105 transition-transform">
              <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className="w-5 h-5 text-white">
                <path d="M4.5 4.5a3 3 0 0 0-3 3v9a3 3 0 0 0 3 3h8.25a3 3 0 0 0 3-3v-9a3 3 0 0 0-3-3H4.5ZM19.94 18.75l-2.69-2.69V7.94l2.69-2.69c.944-.945 2.56-.276 2.56 1.065v11.38c0 1.341-1.617 2.01-2.56 1.065Z" />
              </svg>
            </div>
            <span className="text-xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-white to-gray-400 group-hover:from-white group-hover:to-white transition-all">
              共觀影伴
            </span>
          </div>
        )}
      </div>

      {/* Right: User Count & Profile */}
      <div className="flex items-center gap-4">
        {roomName && (
          <>
            {userCount !== undefined && (
              <div className="hidden md:flex items-center gap-2 text-gray-400 text-sm bg-[#1a1a1a] px-3 py-1.5 rounded-full border border-white/5">
                <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="w-4 h-4">
                  <path d="M7 8a3 3 0 1 0 0-6 3 3 0 0 0 0 6ZM14.5 9a2.5 2.5 0 1 0 0-5 2.5 2.5 0 0 0 0 5ZM1.615 16.428a1.224 1.224 0 0 1-.569-1.175 6.002 6.002 0 0 1 11.532-2.411 1.002 1.002 0 0 1-1.455 1.405 4.002 4.002 0 0 0-7.908 1.773.992.992 0 0 1-.909.56 1.002 1.002 0 0 1-.691-.152ZM14.427 15.539a6 6 0 0 1-6.66-1.63 1 1 0 1 1 1.414-1.414 4.002 4.002 0 0 0 5.535 1.098 1.002 1.002 0 1 1 .963 1.794 6.002 6.002 0 0 1-1.252.152Z" />
                </svg>
                <span>{userCount} 人在線</span>
              </div>
            )}

            <div className="flex items-center gap-2">
               {onChatClick && (
               <button onClick={onChatClick} className="btn btn-ghost btn-circle btn-sm text-gray-400 hover:text-primary tooltip tooltip-bottom" data-tip="聊天室">
                 <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="w-5 h-5">
                   <path fillRule="evenodd" d="M10 2c-2.236 0-4.43.18-6.57.524C1.993 2.755 1 4.014 1 5.426v5.148c0 1.413.993 2.67 2.43 2.902.848.137 1.705.248 2.57.331v3.443a.75.75 0 0 0 1.28.53l3.58-3.579a.78.78 0 0 1 .527-.224 41.202 41.202 0 0 0 5.183-.5c1.437-.232 2.43-1.49 2.43-2.903V5.426c0-1.413-.993-2.67-2.43-2.902A41.289 41.289 0 0 0 10 2Z" clipRule="evenodd" />
                 </svg>
               </button>
               )}
               <button onClick={onPlaylistClick} className="btn btn-ghost btn-circle btn-sm text-gray-400 hover:text-primary tooltip tooltip-bottom" data-tip="播放清單">
                 <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="w-5 h-5">
                   <path fillRule="evenodd" d="M2 4.75A.75.75 0 0 1 2.75 4h14.5a.75.75 0 0 1 0 1.5H2.75A.75.75 0 0 1 2 4.75Zm0 10.5a.75.75 0 0 1 .75-.75h7.5a.75.75 0 0 1 0 1.5h-7.5a.75.75 0 0 1-.75-.75ZM2 10a.75.75 0 0 1 .75-.75h14.5a.75.75 0 0 1 0 1.5H2.75A.75.75 0 0 1 2 10Z" clipRule="evenodd" />
                 </svg>
               </button>
               <button onClick={onShareClick} className="btn btn-ghost btn-circle btn-sm text-gray-400 hover:text-primary tooltip tooltip-bottom" data-tip="分享房間">
                 <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="w-5 h-5">
                   <path d="M13 4.5a2.5 2.5 0 1 1 .702 1.737L6.97 9.604a2.518 2.518 0 0 1 0 .792l6.733 3.367a2.5 2.5 0 1 1-.671 1.341l-6.733-3.367a2.5 2.5 0 1 1 0-3.475l6.733-3.366A2.52 2.52 0 0 1 13 4.5Z" />
                 </svg>
               </button>
            </div>
          </>
        )}


      </div>
    </div>
  );
};

const Header = React.memo(HeaderComponent, (prevProps, nextProps) => {
  // 自定义比较函数，只在真正需要的 props 改变时才重新渲染
  return (
    prevProps.roomName === nextProps.roomName &&
    prevProps.userCount === nextProps.userCount &&
    prevProps.onPlaylistClick === nextProps.onPlaylistClick &&
    prevProps.onChatClick === nextProps.onChatClick &&
    prevProps.onShareClick === nextProps.onShareClick &&
    prevProps.onToggleCamera === nextProps.onToggleCamera &&
    prevProps.currentTime === nextProps.currentTime &&
    prevProps.serverVideoState?.played === nextProps.serverVideoState?.played &&
    prevProps.serverVideoState?.playing === nextProps.serverVideoState?.playing &&
    prevProps.serverVideoState?.playbackRate === nextProps.serverVideoState?.playbackRate
  );
});

export default Header;
