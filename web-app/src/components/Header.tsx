import React from 'react';
import { useNavigate } from 'react-router-dom';

interface HeaderProps {
  roomName?: string;
  userCount?: number;
  isLoggedIn?: boolean;
  userInfo?: { accountId: string; nickname: string; avatar: string };
  onLoginClick?: () => void;
  onLogout?: () => void;
  onPlaylistClick?: () => void;
  onChatClick?: () => void;
  onShareClick?: () => void;
  isCameraEnabled?: boolean;
  onToggleCamera?: () => void;
  isMicEnabled?: boolean;
  onToggleMic?: () => void;
}

const Header: React.FC<HeaderProps> = ({ 
  roomName, 
  userCount, 
  isLoggedIn = false, 
  userInfo, 
  onLoginClick, 
  onLogout,
  onPlaylistClick,
  onChatClick,
  onShareClick,
  isCameraEnabled,
  onToggleCamera,
  isMicEnabled,
  onToggleMic
}) => {
  const navigate = useNavigate();

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
               {onToggleMic && (
                 <button 
                   onClick={onToggleMic} 
                   className={`btn btn-circle btn-sm ${isMicEnabled ? 'btn-error text-white' : 'btn-ghost text-gray-400 hover:text-error'} tooltip tooltip-bottom`} 
                   data-tip={isMicEnabled ? "關閉麥克風" : "開啟麥克風 (VAD)"}
                 >
                   {isMicEnabled ? (
                     <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className="w-5 h-5">
                       <path d="M8.25 4.5a3.75 3.75 0 1 1 7.5 0v8.25a3.75 3.75 0 1 1-7.5 0V4.5Z" />
                       <path d="M6 10.5a.75.75 0 0 1 .75.75v1.5a5.25 5.25 0 1 0 10.5 0v-1.5a.75.75 0 0 1 1.5 0v1.5a6.751 6.751 0 0 1-6 6.709v2.291h3a.75.75 0 0 1 0 1.5h-7.5a.75.75 0 0 1 0-1.5h3v-2.291a6.751 6.751 0 0 1-6-6.709v-1.5A.75.75 0 0 1 6 10.5Z" />
                     </svg>
                   ) : (
                     <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-5 h-5">
                       <path strokeLinecap="round" strokeLinejoin="round" d="M12 18.75a6 6 0 0 0 6-6v-1.5m-6 7.5a6 6 0 0 1-6-6v-1.5m6 7.5v3.75m-3.75 0h7.5M12 15.75a3 3 0 0 1-3-3V4.5a3 3 0 1 1 6 0v8.25a3 3 0 0 1-3 3Z" />
                     </svg>
                   )}
                 </button>
               )}
               {onToggleCamera && (
                 <button 
                   onClick={onToggleCamera} 
                   className={`btn btn-circle btn-sm ${isCameraEnabled ? 'btn-primary text-white' : 'btn-ghost text-gray-400 hover:text-primary'} tooltip tooltip-bottom`} 
                   data-tip={isCameraEnabled ? "關閉鏡頭" : "連結鏡頭"}
                 >
                   {isCameraEnabled ? (
                     <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className="w-5 h-5">
                       <path d="M12 15a3 3 0 1 0 0-6 3 3 0 0 0 0 6Z" />
                       <path fillRule="evenodd" d="M1.323 11.447C2.811 6.976 7.028 3.75 12.001 3.75c4.97 0 9.185 3.223 10.675 7.69.12.362.12.752 0 1.113-1.487 4.471-5.705 7.697-10.677 7.697-4.97 0-9.186-3.223-10.675-7.69a1.762 1.762 0 0 1 0-1.113ZM17.25 12a5.25 5.25 0 1 1-10.5 0 5.25 5.25 0 0 1 10.5 0Z" clipRule="evenodd" />
                     </svg>
                   ) : (
                     <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-5 h-5">
                       <path strokeLinecap="round" strokeLinejoin="round" d="m15.75 10.5 4.72-4.72a.75.75 0 0 1 1.28.53v11.38a.75.75 0 0 1-1.28.53l-4.72-4.72M4.5 18.75h9a2.25 2.25 0 0 0 2.25-2.25v-9a2.25 2.25 0 0 0-2.25-2.25h-9A2.25 2.25 0 0 0 2.25 7.5v9a2.25 2.25 0 0 0 2.25 2.25Z" />
                       <path strokeLinecap="round" strokeLinejoin="round" d="M12 12h.008v.008H12V12Z" />
                     </svg>
                   )}
                 </button>
               )}
               <button onClick={onPlaylistClick} className="btn btn-ghost btn-circle btn-sm text-gray-400 hover:text-primary tooltip tooltip-bottom" data-tip="播放清單">
                 <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="w-5 h-5">
                   <path fillRule="evenodd" d="M2 4.75A.75.75 0 0 1 2.75 4h14.5a.75.75 0 0 1 0 1.5H2.75A.75.75 0 0 1 2 4.75Zm0 10.5a.75.75 0 0 1 .75-.75h7.5a.75.75 0 0 1 0 1.5h-7.5a.75.75 0 0 1-.75-.75ZM2 10a.75.75 0 0 1 .75-.75h14.5a.75.75 0 0 1 0 1.5H2.75A.75.75 0 0 1 2 10Z" clipRule="evenodd" />
                 </svg>
               </button>
               <button onClick={onChatClick} className="btn btn-ghost btn-circle btn-sm text-gray-400 hover:text-primary tooltip tooltip-bottom" data-tip="聊天室">
                 <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="w-5 h-5">
                   <path fillRule="evenodd" d="M10 2c-2.236 0-4.43.18-6.57.524C1.993 2.755 1 4.014 1 5.426v5.148c0 1.413.993 2.67 2.43 2.902.848.137 1.705.248 2.57.331v3.443a.75.75 0 0 0 1.28.53l3.58-3.579a.78.78 0 0 1 .527-.224 41.202 41.202 0 0 0 5.183-.5c1.437-.232 2.43-1.49 2.43-2.903V5.426c0-1.413-.993-2.67-2.43-2.902A41.289 41.289 0 0 0 10 2Z" clipRule="evenodd" />
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

        {isLoggedIn && userInfo ? (
          <div className="dropdown dropdown-end">
            <div tabIndex={0} role="button" className="btn btn-ghost btn-circle avatar">
              <div className="w-9 h-9 rounded-full ring ring-primary/50 ring-offset-base-100 ring-offset-2 hover:ring-primary transition-all">
                <img src={userInfo.avatar} alt={userInfo.nickname} />
              </div>
            </div>
            <ul tabIndex={0} className="dropdown-content z-[1] menu p-2 shadow-xl bg-[#1a1a1a] rounded-xl w-56 border border-white/10 mt-4">
              <li className="menu-title px-4 py-3 border-b border-white/5 mb-2">
                <div className="flex items-center gap-3">
                  <div className="avatar">
                    <div className="w-10 rounded-full">
                      <img src={userInfo.avatar} alt={userInfo.nickname} />
                    </div>
                  </div>
                  <div>
                    <p className="font-bold text-white text-sm">{userInfo.nickname}</p>
                    <p className="text-xs text-gray-500">@{userInfo.accountId}</p>
                  </div>
                </div>
              </li>
              <li>
                <button onClick={onLogout} className="text-red-400 hover:bg-red-500/10 hover:text-red-300 py-3">
                  <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="w-5 h-5">
                    <path fillRule="evenodd" d="M3 4.25A2.25 2.25 0 0 1 5.25 2h5.5A2.25 2.25 0 0 1 13 4.25v2a.75.75 0 0 1-1.5 0v-2a.75.75 0 0 0-.75-.75h-5.5a.75.75 0 0 0-.75.75v11.5c0 .414.336.75.75.75h5.5a.75.75 0 0 0 .75-.75v-2a.75.75 0 0 1 1.5 0v2A2.25 2.25 0 0 1 10.75 18h-5.5A2.25 2.25 0 0 1 3 15.75V4.25Z" clipRule="evenodd" />
                    <path fillRule="evenodd" d="M19 10a.75.75 0 0 0-.75-.75H8.704l1.048-.943a.75.75 0 1 0-1.004-1.114l-2.5 2.25a.75.75 0 0 0 0 1.114l2.5 2.25a.75.75 0 1 0 1.004-1.114l-1.048-.943h9.546A.75.75 0 0 0 19 10Z" clipRule="evenodd" />
                  </svg>
                  登出帳號
                </button>
              </li>
            </ul>
          </div>
        ) : (
          <button 
            onClick={onLoginClick} 
            className="btn btn-sm bg-white text-black hover:bg-gray-200 border-none gap-2 rounded-full px-5 font-medium"
          >
            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="w-4 h-4">
              <path fillRule="evenodd" d="M3 4.25A2.25 2.25 0 0 1 5.25 2h5.5A2.25 2.25 0 0 1 13 4.25v2a.75.75 0 0 1-1.5 0v-2a.75.75 0 0 0-.75-.75h-5.5a.75.75 0 0 0-.75.75v11.5c0 .414.336.75.75.75h5.5a.75.75 0 0 0 .75-.75v-2a.75.75 0 0 1 1.5 0v2A2.25 2.25 0 0 1 10.75 18h-5.5A2.25 2.25 0 0 1 3 15.75V4.25Z" clipRule="evenodd" />
              <path fillRule="evenodd" d="M6 10a.75.75 0 0 1 .75-.75h9.546l-1.048-.943a.75.75 0 1 1 1.004-1.114l2.5 2.25a.75.75 0 0 1 0 1.114l-2.5 2.25a.75.75 0 1 1-1.004-1.114l1.048-.943H6.75A.75.75 0 0 1 6 10Z" clipRule="evenodd" />
            </svg>
            登入 / 註冊
          </button>
        )}
      </div>
    </div>
  );
};

export default Header;
