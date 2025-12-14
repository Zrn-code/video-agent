import React, { useState, useRef, useEffect, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import ReactPlayer from 'react-player';
import { getWsBaseUrl } from '../utils/env';

import Sidebar from '../components/Sidebar';
import Header from '../components/Header';
import UserDock from '../components/UserDock';
import AICompanionSelector from '../components/AICompanionSelector';
import type { VideoItem, YouTubeVideo, Message, AICompanion, ForumThread } from '../types';

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

const Room = () => {
  const { roomId } = useParams<{ roomId: string }>();
  const navigate = useNavigate();

  const playerRef = useRef<HTMLVideoElement | null>(null);
  const urlInputRef = useRef<HTMLInputElement | null>(null);
  const searchInputRef = useRef<HTMLInputElement | null>(null);
  const wsRef = useRef<WebSocket | null>(null);
  const lastSeekTimeRef = useRef<number>(0); // 記錄最近一次跳轉或狀態變化時間
  const isUserSeekingRef = useRef<boolean>(false); // 記錄用戶是否正在操作
  const lastAutoSyncTimeRef = useRef<number>(0); // 記錄上次自動同步時間，防止頻繁同步
  const hasInitialSeekedRef = useRef<boolean>(false); // 記錄是否已經初始化 seek 過
  const isAutoSyncingRef = useRef<boolean>(false); // 記錄是否正在進行自動同步（接收房主更新）
  const pendingSeekIdRef = useRef<string | null>(null); // 追蹤當前等待確認的 seek ID
  const roomUsersRef = useRef<User[]>([]); // 儲存最新的用戶列表
  const hostIdRef = useRef<string | undefined>(undefined); // 儲存最新的房主ID
  const queueRef = useRef<VideoItem[]>([]); // 儲存最新的播放列表
  const historyRef = useRef<VideoItem[]>([]); // 儲存最新的歷史記錄
  const messagesRef = useRef<Message[]>([]); // 儲存最新的消息列表
  const serverVideoStateRef = useRef<{played: number; lastUpdated: number; playing: boolean; playbackRate: number; lastUpdatedBy?: string} | undefined>(undefined);
  const [currentVideo, setCurrentVideo] = useState<VideoItem | undefined>(undefined);
  const currentVideoRef = useRef<VideoItem | undefined>(undefined);

  const setPlayerRef = useCallback((player: HTMLVideoElement) => {
    if (!player) return;
    playerRef.current = player;
  }, []);

  const [userId] = useState<string>(() => {
    const stored = localStorage.getItem('video_agent_userid');
    if (stored) return stored;
    const newId = 'user-' + Math.random().toString(36).substr(2, 9);
    localStorage.setItem('video_agent_userid', newId);
    return newId;
  });

  const [username, setUsername] = useState<string>(() => {
    return localStorage.getItem('video_agent_username') || 'Guest';
  });

  const [avatar, setAvatar] = useState<string>(() => {
    return localStorage.getItem('video_agent_avatar') || `https://api.dicebear.com/7.x/avataaars/svg?seed=${userId}`;
  });

  const [spoilerPreference] = useState<string>(() => {
    return localStorage.getItem('video_agent_spoiler_preference') || 'show_all';
  });

  const [mutedUserIds, setMutedUserIds] = useState<string[]>(() => {
    const stored = localStorage.getItem('video_agent_muted_users');
    return stored ? JSON.parse(stored) : [];
  });

  const toggleMuteUser = (targetUserId: string) => {
    setMutedUserIds(prev => {
      const newMuted = prev.includes(targetUserId) 
        ? prev.filter(id => id !== targetUserId)
        : [...prev, targetUserId];
      localStorage.setItem('video_agent_muted_users', JSON.stringify(newMuted));
      return newMuted;
    });
  };

  const [roomUsers, setRoomUsers] = useState<User[]>([]);
  const [messages, setMessages] = useState<Message[]>([]);
  const [roomName, setRoomName] = useState<string>('');
  const [hostId, setHostId] = useState<string | undefined>(undefined);
  
  // Camera states
  const [isCameraEnabled, setIsCameraEnabled] = useState(false);
  const [cameraEmotion, setCameraEmotion] = useState<{emotion: string; emoji: string; score: number} | undefined>(undefined);
  const videoElementRef = useRef<HTMLVideoElement | null>(null);
  const cameraWsRef = useRef<WebSocket | null>(null);
  const cameraIntervalRef = useRef<number | null>(null);
  const lastEmotionUpdateRef = useRef<number>(0);
  
  // Debug camera emotion changes
  useEffect(() => {
    console.log('🔄 Camera emotion state changed:', cameraEmotion);
  }, [cameraEmotion]);

  // Debug script availability
  useEffect(() => {
    const aiUsers = roomUsers.filter(u => u.isAi);
    if (aiUsers.length > 0) {
      console.log('🤖 AI Companions status:', aiUsers.map(u => ({
        name: u.username,
        hasScript: u.hasScript
      })));
    }
  }, [roomUsers]);
  
  useEffect(() => {
    console.log('🎥 Camera enabled state changed:', isCameraEnabled);
  }, [isCameraEnabled]);
  
  // 更新用戶列表的優化函數
  const updateRoomUsers = React.useCallback((newUsers: User[]) => {
    // 比較用戶列表是否真的有變化（基於用戶ID而不是索引）
    if (roomUsersRef.current.length !== newUsers.length) {
      roomUsersRef.current = newUsers;
      setRoomUsers(newUsers);
      return;
    }
    
    // 創建用戶映射來比較
    const currentMap = new Map(roomUsersRef.current.map(u => [u.id, u]));
    const hasChanged = newUsers.some(newUser => {
      const currentUser = currentMap.get(newUser.id);
      if (!currentUser) return true;
      return currentUser.username !== newUser.username ||
             currentUser.avatar !== newUser.avatar ||
             currentUser.emotion !== newUser.emotion ||
             currentUser.isAi !== newUser.isAi;
    });
    
    if (hasChanged) {
      roomUsersRef.current = newUsers;
      setRoomUsers(newUsers);
    }
  }, []);
  
  // 更新房主ID的優化函數
  const updateHostId = React.useCallback((newHostId: string | undefined) => {
    if (hostIdRef.current !== newHostId) {
      hostIdRef.current = newHostId;
      setHostId(newHostId);
    }
  }, []);
  
  // 更新播放列表的優化函數
  const updateQueue = React.useCallback((newQueue: VideoItem[]) => {
    if (queueRef.current.length !== newQueue.length ||
        queueRef.current.some((item, idx) => item.videoId !== newQueue[idx]?.videoId)) {
      queueRef.current = newQueue;
      setQueue(newQueue);
    }
  }, []);
  
  // 更新歷史記錄的優化函數
  const updateHistory = React.useCallback((newHistory: VideoItem[]) => {
    if (historyRef.current.length !== newHistory.length ||
        historyRef.current.some((item, idx) => item.videoId !== newHistory[idx]?.videoId)) {
      historyRef.current = newHistory;
      setHistory(newHistory);
    }
  }, []);
  
  // 更新消息列表的優化函數
  const updateMessages = React.useCallback((newMessages: Message[]) => {
    if (messagesRef.current.length !== newMessages.length ||
        messagesRef.current[messagesRef.current.length - 1]?.id !== newMessages[newMessages.length - 1]?.id) {
      messagesRef.current = newMessages;
      setMessages(newMessages);
    }
  }, []);
  
  // 更新 server 視頻狀態的優化函數
  const updateServerVideoState = React.useCallback((newState: {played: number; lastUpdated: number; playing: boolean; playbackRate: number; lastUpdatedBy?: string}) => {
    const current = serverVideoStateRef.current;
    if (!current ||
        Math.abs(current.played - newState.played) > 0.1 ||
        current.playing !== newState.playing ||
        current.playbackRate !== newState.playbackRate ||
        current.lastUpdatedBy !== newState.lastUpdatedBy) {
      serverVideoStateRef.current = newState;
      setServerVideoState(newState);
    }
  }, []);
  const [showSidebar, setShowSidebar] = useState(false);
  const [sidebarTab, setSidebarTab] = useState<'chat' | 'playlist' | 'forum'>('chat');
  const [showInviteModal, setShowInviteModal] = useState(false);
  const [forumThreads, setForumThreads] = useState<ForumThread[]>([]);

  // 優化的回調函數，確保引用穩定
  const handleInvite = React.useCallback(() => {
    setShowInviteModal(true);
  }, []);
  
  const handleEmotionSelect = React.useCallback((selectedEmotion: string) => {
    setEmotion(selectedEmotion);
    emotionRef.current = selectedEmotion;
    // Send immediate update via WS if connected
    if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify({
        type: 'emotion',
        emotion: selectedEmotion
      }));
    }
    
    // 3秒後自動清除情緒
    setTimeout(() => {
      setEmotion(undefined);
      emotionRef.current = undefined;
      if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
        wsRef.current.send(JSON.stringify({
          type: 'emotion',
          emotion: undefined
        }));
      }
    }, 3000);
  }, []);

  // 缓存 Header 的 props 避免不必要的重新渲染
  const userCount = React.useMemo(() => roomUsers.length, [roomUsers.length]);
  
  const handlePlaylistClick = React.useCallback(() => {
    if (showSidebar && sidebarTab === 'playlist') {
      setShowSidebar(false);
    } else {
      setSidebarTab('playlist');
      setShowSidebar(true);
    }
  }, [showSidebar, sidebarTab]);

  const handleChatClick = React.useCallback(() => {
    if (showSidebar && sidebarTab === 'chat') {
      setShowSidebar(false);
    } else {
      setSidebarTab('chat');
      setShowSidebar(true);
    }
  }, [showSidebar, sidebarTab]);

  const handleForumClick = React.useCallback(() => {
    if (showSidebar && sidebarTab === 'forum') {
      setShowSidebar(false);
    } else {
      setSidebarTab('forum');
      setShowSidebar(true);
    }
  }, [showSidebar, sidebarTab]);

  // Camera toggle handler
  const handleCameraToggle = React.useCallback(async () => {
    if (isCameraEnabled) {
      // Stop camera
      if (cameraWsRef.current) {
        cameraWsRef.current.close();
        cameraWsRef.current = null;
      }
      if (cameraIntervalRef.current) {
        clearInterval(cameraIntervalRef.current);
        cameraIntervalRef.current = null;
      }
      if (videoElementRef.current && videoElementRef.current.srcObject) {
        const stream = videoElementRef.current.srcObject as MediaStream;
        stream.getTracks().forEach(track => track.stop());
        videoElementRef.current.srcObject = null;
      }
      setIsCameraEnabled(false);
      setCameraEmotion(undefined);
      // 清除相機偵測的情緒，並廣播給其他使用者
      setEmotion(undefined);
      emotionRef.current = undefined;
      if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
        wsRef.current.send(JSON.stringify({
          type: 'emotion',
          emotion: undefined,
          from_camera: true
        }));
      }
      console.log('📹 Camera stopped');
    } else {
      // Start camera
      console.log('📹 Starting camera...');
      try {
        console.log('🎥 Requesting camera access...');
        const stream = await navigator.mediaDevices.getUserMedia({ video: true });
        console.log('✅ Camera access granted');
        
        if (videoElementRef.current) {
          videoElementRef.current.srcObject = stream;
          await videoElementRef.current.play();
          console.log('✅ Video element playing');
        }
        
        // Connect to camera websocket
        const wsBaseUrl = getWsBaseUrl();
        const wsUrl = `${wsBaseUrl}/api/ws/camera/${roomId}/${userId}`;
        console.log('🔌 Connecting to camera WebSocket:', wsUrl);
        const ws = new WebSocket(wsUrl);
        cameraWsRef.current = ws;
        
        ws.onopen = () => {
          console.log('✅ Camera WebSocket connected');
          console.log('📹 Starting to send camera frames every second...');
          
          // Start sending frames every second
          const interval = setInterval(() => {
            if (videoElementRef.current && ws.readyState === WebSocket.OPEN) {
              const video = videoElementRef.current;
              console.log('📸 Capturing frame - Video dimensions:', video.videoWidth, 'x', video.videoHeight);
              
              if (video.videoWidth === 0 || video.videoHeight === 0) {
                console.warn('⚠️ Video dimensions are 0, skipping frame');
                return;
              }
              
              const canvas = document.createElement('canvas');
              canvas.width = video.videoWidth;
              canvas.height = video.videoHeight;
              const ctx = canvas.getContext('2d');
              if (ctx) {
                ctx.drawImage(video, 0, 0);
                canvas.toBlob((blob) => {
                  if (blob) {
                    console.log('🖼️ Frame captured, size:', blob.size, 'bytes');
                    const reader = new FileReader();
                    reader.onloadend = () => {
                      const base64 = (reader.result as string).split(',')[1];
                      console.log('📤 Sending frame to server, base64 length:', base64.length);
                      ws.send(JSON.stringify({
                        type: 'camera_frame',
                        frame: base64
                      }));
                    };
                    reader.readAsDataURL(blob);
                  }
                }, 'image/jpeg', 0.8);
              }
            } else {
              if (!videoElementRef.current) {
                console.warn('⚠️ Video element not found');
              }
              if (ws.readyState !== WebSocket.OPEN) {
                console.warn('⚠️ WebSocket not open, state:', ws.readyState);
              }
            }
          }, 1000);
          cameraIntervalRef.current = interval as unknown as number;
        };
        
        ws.onmessage = (event) => {
          const data = JSON.parse(event.data);
          console.log('📸 Camera WebSocket received:', data);
          
          if (data.type === 'emotion_result') {
            console.log('🎭 Emotion result:', data.result);
            
            const now = Date.now();
            // Check cooldown: if an emotion was set less than 2 seconds ago, ignore updates
            if (now - lastEmotionUpdateRef.current < 2000) {
               console.log('⏳ Emotion update ignored due to cooldown');
               return;
            }

            if (data.result) {
              const emotionData = {
                emotion: data.result.emotion,
                emoji: data.result.emoji,
                score: data.result.score
              };
              console.log('✅ Setting camera emotion:', emotionData);
              setCameraEmotion(emotionData);
              
              // 同時更新 emotion 狀態，這樣 UserDock 會顯示
              setEmotion(data.result.emoji);
              emotionRef.current = data.result.emoji;
              
              // Update timestamp only when setting a valid emotion
              lastEmotionUpdateRef.current = now;
              
              // 將情緒透過 WebSocket 廣播給其他使用者
              // 標記為 from_camera，讓 AI 不要回應
              if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
                console.log('📡 Broadcasting emotion to other users:', data.result.emoji);
                wsRef.current.send(JSON.stringify({
                  type: 'emotion',
                  emotion: data.result.emoji,
                  from_camera: true
                }));
              }
            } else {
              console.log('⚠️ No emotion detected (no face or low confidence)');
              // 如果沒有偵測到臉部或情緒被過濾，清除狀態
              setCameraEmotion(undefined);
              setEmotion(undefined);
              emotionRef.current = undefined;
              
              // 廣播清除情緒
              if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
                wsRef.current.send(JSON.stringify({
                  type: 'emotion',
                  emotion: null,
                  from_camera: true
                }));
              }
            }
          }
        };
        
        ws.onerror = (error) => {
          console.error('❌ Camera WebSocket error:', error);
        };
        
        ws.onclose = (event) => {
          console.log('🔌 Camera WebSocket closed - Code:', event.code, 'Reason:', event.reason);
        };
        
        setIsCameraEnabled(true);
        console.log('✅ Camera enabled successfully');
      } catch (error) {
        console.error('❌ Error accessing camera:', error);
        if (error instanceof Error) {
          console.error('Error name:', error.name);
          console.error('Error message:', error.message);
        }
        alert('無法存取相機: ' + (error instanceof Error ? error.message : String(error)));
      }
    }
  }, [isCameraEnabled, roomId, userId]);

  // Clean up camera on unmount
  useEffect(() => {
    return () => {
      if (cameraWsRef.current) {
        cameraWsRef.current.close();
      }
      if (cameraIntervalRef.current) {
        clearInterval(cameraIntervalRef.current);
      }
      if (videoElementRef.current && videoElementRef.current.srcObject) {
        const stream = videoElementRef.current.srcObject as MediaStream;
        stream.getTracks().forEach(track => track.stop());
      }
    };
  }, []);

  const handleShareClick = React.useCallback(async () => {
    try {
      const url = window.location.href;
      
      if (navigator.clipboard && navigator.clipboard.writeText) {
        await navigator.clipboard.writeText(url);
        setSearchError('✅ 連結已複製到剪貼簿！');
      } else {
        const textArea = document.createElement('textarea');
        textArea.value = url;
        textArea.style.position = 'fixed';
        textArea.style.left = '-999999px';
        textArea.style.top = '-999999px';
        document.body.appendChild(textArea);
        textArea.focus();
        textArea.select();
        
        try {
          const successful = document.execCommand('copy');
          if (successful) {
            setSearchError('✅ 連結已複製到剪貼簿！');
          } else {
            setSearchError('❌ 複製失敗，請手動複製連結');
          }
        } catch (err) {
          console.error('Failed to copy:', err);
          setSearchError('❌ 複製失敗，請手動複製連結');
        } finally {
          document.body.removeChild(textArea);
        }
      }
      
      setTimeout(() => setSearchError(''), 3000);
    } catch (error) {
      console.error('Failed to copy URL:', error);
      setSearchError('❌ 複製失敗，請手動複製連結');
      setTimeout(() => setSearchError(''), 3000);
    }
  }, []);

  // Emotion & Focus Detection State
  const [emotion, setEmotion] = useState<string | undefined>(undefined);
  const emotionRef = useRef<string | undefined>(undefined);
  
  // Emotion Smoothing Refs
  const lastRawEmotionRef = useRef<string>('Neutral');
  const emotionStabilityStartRef = useRef<number>(0);
  const emotionHoldEndRef = useRef<number>(0);
  const heldEmotionRef = useRef<string | undefined>(undefined);

  const [isFocused, setIsFocused] = useState(true);
  const isFocusedRef = useRef(true);
  
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);
  const [isMicEnabled, setIsMicEnabled] = useState(false);
  const [isRecording, setIsRecording] = useState(false);
  const [isProcessingAudio, setIsProcessingAudio] = useState(false);
  const [inputText, setInputText] = useState('');
  const [isInputBarExpanded, setIsInputBarExpanded] = useState(false);
  const [showEmojiMenu, setShowEmojiMenu] = useState(false);
  const [suggestions, setSuggestions] = useState<string[]>([]);

  const handleEmojiSelect = (selectedEmotion: string) => {
    // 如果相機正在運行，不允許手動選擇 emoji（由相機自動控制）
    if (isCameraEnabled) {
      console.log('⚠️ Camera is running, emoji selection disabled');
      return;
    }
    
    setEmotion(selectedEmotion);
    emotionRef.current = selectedEmotion;
    // Send immediate update via WS if connected
    if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify({
        type: 'emotion',
        emotion: selectedEmotion
      }));
    }
    setShowEmojiMenu(false);
    
    // 手動選擇的 emoji 3秒後自動清除
    setTimeout(() => {
      // 只有在相機沒有運行時才清除（避免覆蓋相機偵測的情緒）
      if (!isCameraEnabled) {
        setEmotion(undefined);
        emotionRef.current = undefined;
        if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
          wsRef.current.send(JSON.stringify({
            type: 'emotion',
            emotion: undefined
          }));
        }
      }
    }, 3000);
  };

  const startRecording = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mediaRecorder = new MediaRecorder(stream);
      mediaRecorderRef.current = mediaRecorder;
      audioChunksRef.current = [];

      mediaRecorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
          audioChunksRef.current.push(event.data);
        }
      };

      mediaRecorder.onstop = async () => {
        const audioBlob = new Blob(audioChunksRef.current, { type: 'audio/wav' });
        await handleAudioUpload(audioBlob);
        
        // Stop all tracks
        stream.getTracks().forEach(track => track.stop());
      };

      mediaRecorder.start();
      setIsRecording(true);
      setIsMicEnabled(true);
    } catch (error) {
      console.error('Error accessing microphone:', error);
      alert('無法存取麥克風');
    }
  };

  const stopRecording = () => {
    if (mediaRecorderRef.current && isRecording) {
      mediaRecorderRef.current.stop();
      setIsRecording(false);
      setIsMicEnabled(false);
    }
  };

  const handleAudioUpload = async (audioBlob: Blob) => {
    setIsProcessingAudio(true);
    try {
      const formData = new FormData();
      formData.append('file', audioBlob, 'recording.wav');

      const response = await fetch(`${import.meta.env.VITE_API_URL}/api/asr`, {
        method: 'POST',
        body: formData,
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({ detail: 'Unknown error' }));
        throw new Error(errorData.detail || 'Audio upload failed');
      }

      const data = await response.json();
      if (data.text) {
        setInputText(prev => prev + (prev ? ' ' : '') + data.text);
      }
    } catch (error) {
      console.error('Error uploading audio:', error);
    } finally {
      setIsProcessingAudio(false);
    }
  };

  const toggleMic = async () => {
    if (isRecording) {
      stopRecording();
    } else {
      await startRecording();
    }
  };

  const handleSuggestionClick = (text: string) => {
    handleSendMessage(text);
    setSuggestions([]);
  };

  const lastVideoTimeRef = useRef(-1);
  const requestRef = useRef<number>(0);

  useEffect(() => {
    emotionRef.current = emotion;
  }, [emotion]);

  useEffect(() => {
    const onFocus = () => { setIsFocused(true); isFocusedRef.current = true; };
    const onBlur = () => { 
      // If the active element is an iframe (like YouTube), don't consider it a blur/sleep
      if (document.activeElement instanceof HTMLIFrameElement) {
        return;
      }
      setIsFocused(false); 
      isFocusedRef.current = false; 
    };
    window.addEventListener('focus', onFocus);
    window.addEventListener('blur', onBlur);
    return () => {
      window.removeEventListener('focus', onFocus);
      window.removeEventListener('blur', onBlur);
    };
  }, []);




  const initialState = {
    src: undefined,
    pip: false,
    playing: false,
    controls: true,
    light: false,
    played: 0,
    loaded: 0,
    duration: 0,
    playbackRate: 1.0,
    loop: false,
    seeking: false,
    loadedSeconds: 0,
    playedSeconds: 0,
  };

  type PlayerState = Omit<typeof initialState, 'src'> & {
    src?: string;
  };

  const [state, setState] = useState<PlayerState>(initialState);
  const [serverVideoState, setServerVideoState] = useState<{
    played: number;
    lastUpdated: number;
    playing: boolean;
    playbackRate: number;
    lastUpdatedBy?: string;
  } | undefined>(undefined);

  const [searchResults, setSearchResults] = useState<YouTubeVideo[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [searchError, setSearchError] = useState<string>('');
  const [hostControlWarning, setHostControlWarning] = useState<string>('');
  
  const [queue, setQueue] = useState<VideoItem[]>([]);
  const [history, setHistory] = useState<VideoItem[]>([]);

  // Refs for stable access in WebSocket effect
  const latestStateRef = useRef(state);
  const latestHostIdRef = useRef(hostId);

  useEffect(() => {
    latestStateRef.current = state;
    latestHostIdRef.current = hostId;
  }, [state, hostId]);

  // 創建穩定的 currentUser 對象
  const currentUser = React.useMemo(() => ({
    id: userId,
    username,
    avatar,
    lastSeen: Date.now(),
    emotion: emotion // 加入 emotion 狀態
  }), [userId, username, avatar, emotion]);

  // 當 src 變更時，重置初始化 seek 標記
  useEffect(() => {
    if (state.src) {
      hasInitialSeekedRef.current = false;
    }
  }, [state.src]);

  // Room Management
  useEffect(() => {
    const joinRoom = async () => {
      if (!roomId) return;
      try {
        // Fetch room details first
        const roomRes = await fetch(`${import.meta.env.VITE_API_URL}/api/rooms/${roomId}`);
        if (!roomRes.ok) throw new Error('Room not found');
        const roomData = await roomRes.json();
        
        setRoomName(roomData.name || 'Unknown Room');

        // Join room via HTTP
        await fetch(`${import.meta.env.VITE_API_URL}/api/rooms/${roomId}/join`, { 
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ userId, username, avatar })
        });
        
        updateQueue(roomData.queue || []);
        setHistory(roomData.history || []);
        updateRoomUsers(roomData.users || []);
        updateMessages(roomData.messages || []);
        updateHostId(roomData.hostId);
        setForumThreads(roomData.forumThreads || []);
        
        // Sync initial state
        if (roomData.videoState.url) {
          setState(prev => ({
            ...prev,
            src: roomData.videoState.url,
            playing: roomData.videoState.playing,
            playedSeconds: roomData.videoState.played,
            playbackRate: roomData.videoState.playbackRate,
            duration: roomData.videoState.duration || 0
          }));
          updateServerVideoState({
            played: roomData.videoState.played,
            lastUpdated: roomData.videoState.lastUpdated,
            playing: roomData.videoState.playing,
            playbackRate: roomData.videoState.playbackRate
          });
          
          // Seek to initial position
          if (playerRef.current && roomData.videoState.played > 0) {
            setTimeout(() => {
              if (playerRef.current) {
                isAutoSyncingRef.current = true; // 標記為自動同步
                playerRef.current.currentTime = roomData.videoState.played;
                setTimeout(() => {
                  isAutoSyncingRef.current = false;
                }, 100);
              }
            }, 500);
          }
        }

      } catch (error) {
        console.error('Failed to join room:', error);
        setSearchError('Failed to join room');
        navigate('/');
      }
    };

    joinRoom();

    return () => {
      // Cleanup/Leave room
      if (roomId) {
        fetch(`${import.meta.env.VITE_API_URL}/api/rooms/${roomId}/leave`, { 
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ userId })
        }).catch(console.error);
      }
    };
  }, [roomId, userId, navigate]);

  // WebSocket 連接和播放進度同步
  useEffect(() => {
    if (!roomId || !userId) return;

    const wsUrl = `${getWsBaseUrl()}/api/ws/${roomId}/${userId}`;
    const ws = new WebSocket(wsUrl);
    wsRef.current = ws;

    ws.onopen = () => {
      console.log('WebSocket connected');
      // 發送加入訊息
      ws.send(JSON.stringify({
        type: 'join',
        user: {
          username,
          avatar,
          emotion: emotionRef.current,
          spoilerPreference
        }
      }));
    };

    ws.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data);
        // console.log('WebSocket message:', data); // Reduce log noise

        if (data.type === 'video_state_update' && data.sender !== userId) {
          // 接收其他用戶的播放狀態更新
          const serverState = data.state;
          
          // 檢查是否有新的 seek 操作
          if (serverState.pendingSeekId && serverState.pendingSeekId !== pendingSeekIdRef.current) {
            pendingSeekIdRef.current = serverState.pendingSeekId;
            console.log(`New seek detected: ${serverState.pendingSeekId}`);
          }
          
          // 只在狀態真正改變時才更新（避免不必要的重新渲染）
          setState(prev => {
            const hasChanges = 
              prev.playing !== serverState.playing ||
              Math.abs(prev.playedSeconds - serverState.played) > 0.1 ||
              Math.abs(prev.duration - (serverState.duration || 0)) > 0.1 ||
              prev.playbackRate !== serverState.playbackRate;
            
            if (!hasChanges) {
              return prev; // 沒有變化，返回原狀態避免重新渲染
            }
            
            return {
              ...prev,
              playing: serverState.playing,
              playedSeconds: serverState.played,
              duration: serverState.duration || prev.duration,
              playbackRate: serverState.playbackRate
            };
          });

          // 計算當前伺服器時間（只有播放中才外推，WebSocket延遲小）
          let currentServerTime = serverState.played;
          if (serverState.playing && serverState.lastUpdated) {
            const now = Date.now();
            const serverTimestamp = serverState.lastUpdated * 1000;
            const timeSinceUpdate = (now - serverTimestamp) / 1000;
            const playbackRate = serverState.playbackRate || 1.0;
            
            // WebSocket 延遲通常很小，只外推少量時間
            if (timeSinceUpdate < 2) { // 只在2秒內外推
              currentServerTime = serverState.played + (timeSinceUpdate * playbackRate);
              if (serverState.duration && currentServerTime > serverState.duration) {
                currentServerTime = serverState.duration;
              }
            }
          }

          // 同步播放器
          if (playerRef.current && !isUserSeekingRef.current) {
            const currentTime = playerRef.current.currentTime;
            const timeDiff = Math.abs(currentTime - currentServerTime);
            
            // 固定容忍度：1.5 秒
            const tolerance = 1.5;
            
            // 防抖動：至少間隔 2 秒才能再次自動同步
            const timeSinceLastAutoSync = Date.now() - lastAutoSyncTimeRef.current;
            const canAutoSync = timeSinceLastAutoSync > 2000;
            
            // 如果時間差超過容忍度，且允許同步，進行 seek
            if (timeDiff > tolerance && canAutoSync) {
              console.log(`WS Sync to ${currentServerTime.toFixed(2)}s (server: ${serverState.played.toFixed(2)}s, diff: ${timeDiff.toFixed(2)}s, tolerance: ${tolerance}s)`);
              isAutoSyncingRef.current = true; // 標記為自動同步
              playerRef.current.currentTime = currentServerTime;
              lastAutoSyncTimeRef.current = Date.now(); // 記錄自動同步時間
              
              // 當 seek 完成後發送確認
              const sendSeekAck = () => {
                if (pendingSeekIdRef.current && ws.readyState === WebSocket.OPEN) {
                  console.log(`Sending seek_ack for ${pendingSeekIdRef.current}`);
                  ws.send(JSON.stringify({
                    type: 'seek_ack',
                    seekId: pendingSeekIdRef.current
                  }));
                }
                isAutoSyncingRef.current = false;
                playerRef.current?.removeEventListener('seeked', sendSeekAck);
              };
              
              playerRef.current.addEventListener('seeked', sendSeekAck, { once: true });
              
              // 備用：如果 seeked 事件沒觸發，100ms 後清除標記
              setTimeout(() => {
                if (isAutoSyncingRef.current) {
                  sendSeekAck();
                }
              }, 100);
            } else if (timeDiff > tolerance) {
              console.log(`WS Sync skipped: diff=${timeDiff.toFixed(2)}s but synced ${timeSinceLastAutoSync}ms ago`);
            }
          }
        } else if (data.type === 'users_update') {
          updateRoomUsers(data.users || []);
          if (data.hostId !== undefined) {
            updateHostId(data.hostId);
          }
        } else if (data.type === 'new_message') {
          const newMessages = [...messagesRef.current, data.message];
          messagesRef.current = newMessages;
          setMessages(newMessages);
        } else if (data.type === 'forum_thread_created') {
          setForumThreads(prev => [data.thread, ...prev]);
        } else if (data.type === 'forum_thread_updated') {
          setForumThreads(prev => prev.map(t => t.id === data.thread.id ? data.thread : t));
        } else if (data.type === 'forum_comment_created') {
          setForumThreads(prev => prev.map(t => {
            if (t.id === data.threadId) {
              return { ...t, comments: [...t.comments, data.comment] };
            }
            return t;
          }));
        }
      } catch (error) {
        console.error('Failed to parse WebSocket message:', error);
      }
    };

    ws.onerror = (error) => {
      console.error('WebSocket error:', error);
    };

    ws.onclose = () => {
      console.log('WebSocket disconnected');
    };

    // 心跳和表情更新（每 2 秒）
    const heartbeatInterval = setInterval(() => {
      if (ws.readyState === WebSocket.OPEN) {
        ws.send(JSON.stringify({
          type: 'emotion',
          emotion: emotionRef.current
        }));
      }
    }, 2000);

    // 播放進度發送（每 1 秒）- 只有房主才發送
    const progressInterval = setInterval(() => {
      const currentState = latestStateRef.current;
      const currentHostId = latestHostIdRef.current;
      
      if (ws.readyState === WebSocket.OPEN && currentState.src && playerRef.current && currentHostId === userId) {
        try {
          const currentTime = playerRef.current.currentTime || 0;
          const duration = playerRef.current.duration || 0;
          
          ws.send(JSON.stringify({
            type: 'video_state',
            state: {
              playing: currentState.playing,
              played: currentTime,
              duration: duration,
              playbackRate: currentState.playbackRate
            }
          }));
        } catch (error) {
          console.error('Error sending progress:', error);
        }
      }
    }, 1000);

    return () => {
      clearInterval(heartbeatInterval);
      clearInterval(progressInterval);
      ws.close(); // Always close
    };
  }, [roomId, userId, username, avatar]); // Removed state dependencies

  // 定時從 server 拉取最新播放狀態（每 1 秒）
  useEffect(() => {
    if (!roomId) return;

    const interval = setInterval(async () => {
      try {
        const res = await fetch(`${import.meta.env.VITE_API_URL}/api/rooms/${roomId}`);
        if (res.ok) {
          const data = await res.json();
          const serverState = data.videoState;
          
          updateQueue(data.queue || []);
          
          // Update current video
          if (JSON.stringify(currentVideoRef.current) !== JSON.stringify(data.currentVideo)) {
             currentVideoRef.current = data.currentVideo;
             setCurrentVideo(data.currentVideo);
          }
          
          updateHistory(data.history || []);
          updateMessages(data.messages || []);
          setForumThreads(data.forumThreads || []);
          
          // 更新用戶列表和房主信息（但不要在 WebSocket 連接正常時覆蓋）
          if (data.users) {
            updateRoomUsers(data.users);
          }
          if (data.hostId !== undefined) {
            updateHostId(data.hostId);
          }
          
          // 更新 server 視頻狀態用於顯示
          updateServerVideoState({
            played: serverState.played,
            lastUpdated: serverState.lastUpdated,
            playing: serverState.playing,
            playbackRate: serverState.playbackRate,
            lastUpdatedBy: serverState.lastUpdatedBy
          });

          // 計算當前伺服器時間（只有播放中才外推）
          let currentServerTime = serverState.played;
          if (serverState.playing) {
            const now = Date.now();
            const serverTimestamp = serverState.lastUpdated * 1000;
            const timeSinceUpdate = (now - serverTimestamp) / 1000;
            const playbackRate = serverState.playbackRate || 1.0;
            currentServerTime = serverState.played + (timeSinceUpdate * playbackRate);
            if (serverState.duration && currentServerTime > serverState.duration) {
              currentServerTime = serverState.duration;
            }
          }

          // 同步播放狀態
          if (serverState.url && serverState.url !== state.src) {
            setState(prev => ({
              ...prev,
              src: serverState.url,
              playing: serverState.playing,
              playbackRate: serverState.playbackRate,
              duration: serverState.duration || prev.duration
            }));
          } else if (playerRef.current && !isUserSeekingRef.current) {
            // 如果是自己更新的狀態，則忽略同步（避免回朔）
            if (serverState.lastUpdatedBy === userId) {
               return;
            }

            const currentTime = playerRef.current.currentTime || 0;
            const timeDiff = Math.abs(currentTime - currentServerTime);
            
            // 固定容忍度：1.5 秒
            const tolerance = 1.5;
            
            // 防抖動：至少間隔 2 秒才能再次自動同步
            const timeSinceLastAutoSync = Date.now() - lastAutoSyncTimeRef.current;
            const canAutoSync = timeSinceLastAutoSync > 2000;
            
            // 同步 duration 如果 server 有更新的值
            if (serverState.duration && serverState.duration !== state.duration) {
              setState(prev => ({ ...prev, duration: serverState.duration }));
            }
            
            // 只有時間差異大於容忍度且允許同步才強制同步，避免頻繁跳動
            if (timeDiff > tolerance && canAutoSync) {
              console.log(`HTTP Sync: diff=${timeDiff.toFixed(2)}s, tolerance=${tolerance}s, seeking to ${currentServerTime.toFixed(2)}s`);
              isAutoSyncingRef.current = true;
              playerRef.current.currentTime = currentServerTime;
              lastAutoSyncTimeRef.current = Date.now(); // 記錄自動同步時間
              
              // 當 seek 完成後發送確認
              const sendSeekAck = () => {
                if (serverState.pendingSeekId && wsRef.current?.readyState === WebSocket.OPEN) {
                  console.log(`Sending seek_ack for ${serverState.pendingSeekId} (HTTP sync)`);
                  wsRef.current.send(JSON.stringify({
                    type: 'seek_ack',
                    seekId: serverState.pendingSeekId
                  }));
                  pendingSeekIdRef.current = serverState.pendingSeekId;
                }
                isAutoSyncingRef.current = false;
                playerRef.current?.removeEventListener('seeked', sendSeekAck);
              };
              
              playerRef.current.addEventListener('seeked', sendSeekAck, { once: true });
              
              // 備用：如果 seeked 事件沒觸發
              setTimeout(() => {
                if (isAutoSyncingRef.current) {
                  sendSeekAck();
                }
              }, 100);
            } else if (timeDiff > tolerance) {
              console.log(`HTTP Sync skipped: diff=${timeDiff.toFixed(2)}s but synced ${timeSinceLastAutoSync}ms ago`);
            }
            
            // 同步播放/暫停狀態
            if (state.playing !== serverState.playing) {
              setState(prev => ({ ...prev, playing: serverState.playing }));
            }
          }
        }
      } catch (error) {
        console.error('Failed to sync room state:', error);
      }
    }, 1000); // 1秒

    return () => clearInterval(interval);
  }, [roomId, state.src, state.playing]);

  const syncToRoom = async () => {
    if (!roomId) {
      console.error('syncToRoom: roomId is null');
      return;
    }
    
    console.log('syncToRoom: Starting sync...');
    
    try {
      const res = await fetch(`${import.meta.env.VITE_API_URL}/api/rooms/${roomId}`);
      console.log('syncToRoom: Response status:', res.status);
      
      if (res.ok) {
        const data = await res.json();
        const serverState = data.videoState;
        
        console.log('syncToRoom: Server state:', serverState);
        console.log('syncToRoom: playerRef.current:', playerRef.current);
        
        updateQueue(data.queue || []);
        updateHistory(data.history || []);
        updateRoomUsers(data.users || []);
        updateMessages(data.messages || []);
        
        // 更新房主信息
        if (data.hostId !== undefined) {
          updateHostId(data.hostId);
        }

        // 計算當前伺服器應該的播放時間（考慮時間外推）
        let currentServerTime = serverState.played;
        if (serverState.playing && serverState.lastUpdated) {
          const now = Date.now() / 1000; // 轉換為秒
          const timeSinceUpdate = now - serverState.lastUpdated;
          currentServerTime = serverState.played + (timeSinceUpdate * serverState.playbackRate);
          
          // 如果有 duration，確保不超過影片長度
          if (serverState.duration > 0 && currentServerTime > serverState.duration) {
            currentServerTime = serverState.duration;
          }
        }

        console.log('syncToRoom: Calculated server time - played:', serverState.played, 'extrapolated:', currentServerTime);

        setState(prev => ({
          ...prev,
          src: serverState.url,
          playing: serverState.playing,
          playbackRate: serverState.playbackRate,
          duration: serverState.duration || prev.duration
        }));
        
        if (playerRef.current) {
          console.log('syncToRoom: Seeking to', currentServerTime, 'seconds');
          isAutoSyncingRef.current = true; // 標記為自動同步
          playerRef.current.currentTime = currentServerTime;
          lastSeekTimeRef.current = Date.now(); // 記錄手動同步時間
          setTimeout(() => {
            isAutoSyncingRef.current = false;
          }, 100);
        } else {
          console.error('syncToRoom: playerRef.current is null!');
        }
      } else {
        console.error('syncToRoom: Response not ok:', res.status);
      }
    } catch (error) {
      console.error('syncToRoom: Failed to sync:', error);
    }
  };

  // 通過 WebSocket 發送播放狀態更新 - 只有房主才能控制
  const updateServerState = (updates: Partial<PlayerState> & { duration?: number; isSeek?: boolean }) => {
    if (!wsRef.current || wsRef.current.readyState !== WebSocket.OPEN) return;
    if (hostId !== userId) {
      console.log('Not host, cannot update video state');
      return; // 非房主不能控制
    }
    
    wsRef.current.send(JSON.stringify({
      type: 'video_state',
      state: {
        playing: updates.playing,
        played: updates.played || 0,
        duration: updates.duration || state.duration,
        playbackRate: updates.playbackRate || state.playbackRate
      },
      isSeek: updates.isSeek || false
    }));
  };

  // 播放進度同步已整合到心跳邏輯中

  // YouTube 搜尋功能
  const performSearch = async (queryOverride?: string) => {
    // Allow clearing search results by passing empty string
    if (queryOverride === '') {
      setSearchResults([]);
      setSearchError('');
      return;
    }

    const query = queryOverride || searchInputRef.current?.value.trim();
    
    if (!query) {
      setSearchError('請輸入搜尋關鍵字！');
      return;
    }

    // API Key is now handled by backend
    // if (!apiKey) { ... }

    setIsSearching(true);
    setSearchError('');
    setSearchResults([]);
    setSidebarTab('playlist');

    try {
      const response = await fetch(
        `${import.meta.env.VITE_API_URL}/api/youtube/search?q=${encodeURIComponent(query)}`
      );

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.detail || '搜尋失敗');
      }

      const data = await response.json();
      
      if (data.items && data.items.length > 0) {
        setSearchResults(data.items);
      } else {
        setSearchError('找不到相關影片，請試試其他關鍵字');
      }
    } catch (error) {
      setSearchError(`錯誤: ${error instanceof Error ? error.message : '搜尋失敗'}`);
      console.error('Search error:', error);
    } finally {
      setIsSearching(false);
    }
  };

  const handleLoadCustomUrl = () => {
    if (urlInputRef.current?.value) {
      setState(prevState => ({ ...prevState, src: urlInputRef.current?.value }));
    }
  };

  const addToQueue = async (video: VideoItem) => {
    if (!roomId) return;
    try {
      await fetch(`${import.meta.env.VITE_API_URL}/api/rooms/${roomId}/queue`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(video)
      });
      // Switch to queue tab to show feedback
      setSidebarTab('playlist');
      // 立即刷新隊列
      syncToRoom();
    } catch (error) {
      console.error('Failed to add to queue:', error);
    }
  };

  const removeFromQueue = async (index: number) => {
    if (!roomId) return;
    try {
      await fetch(`${import.meta.env.VITE_API_URL}/api/rooms/${roomId}/queue/${index}`, {
        method: 'DELETE'
      });
      // 立即刷新隊列
      syncToRoom();
    } catch (error) {
      console.error('Failed to remove from queue:', error);
    }
  };

  const playVideo = async (video: VideoItem) => {
    if (!roomId) return;
    try {
      const res = await fetch(`${import.meta.env.VITE_API_URL}/api/rooms/${roomId}/play`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(video)
      });
      if (res.ok) {
        const data = await res.json();
        setState(prev => ({
          ...prev,
          src: data.videoState.url,
          playing: true,
          played: 0
        }));
        setHistory(data.history);
      }
    } catch (error) {
      console.error('Failed to play video:', error);
    }
  };

  const handlePlayerReady = () => {
    console.log('onReady');
    // 只在初次載入且時間差距較大時 seek 到伺服器時間
    if (!hasInitialSeekedRef.current && playerRef.current && serverVideoState?.played && serverVideoState.played > 0) {
      const currentTime = playerRef.current.currentTime || 0;
      const timeDiff = Math.abs(currentTime - serverVideoState.played);
      
      // 只有時間差 > 1.5 秒才 seek，避免無限迴圈
      if (timeDiff > 1.5) {
        console.log(`Initial seek: from ${currentTime.toFixed(2)}s to ${serverVideoState.played.toFixed(2)}s (diff: ${timeDiff.toFixed(2)}s)`);
        playerRef.current.currentTime = serverVideoState.played;
        hasInitialSeekedRef.current = true;
        lastSeekTimeRef.current = Date.now();
      } else {
        console.log(`Skipping initial seek: diff ${timeDiff.toFixed(2)}s < 1.5s`);
        hasInitialSeekedRef.current = true; // 仍然標記為已 seek，避免重複檢查
      }
    }
  };

  const handlePlay = () => {
    if (hostId !== userId) {
      // 非房主不能控制，靜默忽略
      return;
    }
    console.log('onPlay');
    setState(prevState => ({ ...prevState, playing: true }));
    lastSeekTimeRef.current = Date.now(); // 記錄播放狀態變化時間，避免立即同步
    // Send current time when resuming playback
    if (playerRef.current) {
      const currentTime = playerRef.current.currentTime || 0;
      const duration = playerRef.current.duration || 0;
      updateServerState({ 
        playing: true, 
        played: currentTime,
        duration: duration,
        playbackRate: state.playbackRate
      });
    } else {
      updateServerState({ playing: true });
    }
  };

  const handlePause = () => {
    if (hostId !== userId) {
      // 非房主不能控制，靜默忽略
      return;
    }
    console.log('onPause');
    setState(prevState => ({ ...prevState, playing: false }));
    lastSeekTimeRef.current = Date.now(); // 記錄暫停狀態變化時間，避免立即同步
    // Send current time when pausing
    if (playerRef.current) {
      const currentTime = playerRef.current.currentTime || 0;
      const duration = playerRef.current.duration || 0;
      updateServerState({ 
        playing: false, 
        played: currentTime,
        duration: duration,
        playbackRate: state.playbackRate
      });
    } else {
      updateServerState({ playing: false });
    }
  };

  const handleProgress = (progress: any) => {
    if (state.seeking) return;
    setState(prevState => ({
      ...prevState,
      ...progress
    }));
  };

  const handleTimeUpdate = () => {
    const player = playerRef.current;
    if (!player || state.seeking) return;

    if (!player.duration) return;

    setState(prevState => ({
      ...prevState,
      playedSeconds: player.currentTime,
      played: player.currentTime / player.duration,
    }));
  };

  const handleEnded = () => {
    console.log('onEnded');
    setState(prevState => ({ ...prevState, playing: prevState.loop }));
  };

  const handleSeeking = () => {
    // 如果是自動同步觸發的，不顯示警告
    if (isAutoSyncingRef.current) {
      return;
    }
    
    if (hostId !== userId) {
      // 非房主不能控制，靜默忽略
      return;
    }
    console.log('onSeeking');
    setState(prevState => ({ ...prevState, seeking: true }));
    isUserSeekingRef.current = true; // 標記用戶正在操作
  };

  const handleDurationChange = () => {
    const player = playerRef.current;
    if (!player) return;

    const duration = player.duration || 0;
    const currentTime = player.currentTime || 0;
    console.log('onDurationChange', duration);
    setState(prevState => ({ ...prevState, duration }));
    
    // Send duration and current state to server immediately
    updateServerState({
      src: state.src,
      playing: state.playing,
      played: currentTime,
      duration: duration,
      playbackRate: state.playbackRate
    });
  };

  const handleSeeked = () => {
    // 如果是自動同步觸發的，不顯示警告
    if (isAutoSyncingRef.current) {
      return;
    }
    
    if (hostId !== userId) {
      // 非房主不能控制，靜默忽略
      return;
    }
    console.log('onSeeked');
    setState(prevState => ({ ...prevState, seeking: false }));
    
    // 記錄跳轉時間，用於後續判斷是否要放寬同步
    lastSeekTimeRef.current = Date.now();
    isUserSeekingRef.current = false;
    
    // Send current position to server immediately after seek with fresh timestamp
    if (playerRef.current) {
      const currentTime = playerRef.current.currentTime || 0;
      const duration = playerRef.current.duration || 0;
      console.log('Seek completed, sending time:', currentTime, 'duration:', duration);
      updateServerState({ 
        src: state.src,
        played: currentTime,
        playing: state.playing,
        duration: duration,
        playbackRate: state.playbackRate,
        isSeek: true  // 標記這是一個跳轉操作
      });
    }
  };

  const handleSendMessage = async (content: string) => {
    if (!roomId) return;
    
    try {
      await fetch(`${import.meta.env.VITE_API_URL}/api/rooms/${roomId}/chat`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          userId,
          username,
          content
        })
      });
    } catch (error) {
      console.error('Failed to send message:', error);
    }
  };

  const handleStartRoom = async () => {
    if (queue.length > 0) {
      await playVideo(queue[0]);
    } else {
      setSearchError('請至少選擇一個影片');
    }
  };

  const {
    src,
    playing,
    controls,
    light,
    loop,
    played,
    loaded,
    duration,
    playbackRate,
    pip,
  } = state;

  // Audio Player Ref for Review
  // const audioRef = useRef<HTMLAudioElement>(null);
  /*
  useEffect(() => {
    if (pendingAudioUrl && audioRef.current) {
      audioRef.current.src = pendingAudioUrl;
      audioRef.current.load();
    }
  }, [pendingAudioUrl]);
  */

  const [selectedCompanionsToAdd, setSelectedCompanionsToAdd] = useState<AICompanion[]>([]);

  const handleAddCompanions = async () => {
    if (selectedCompanionsToAdd.length === 0) return;

    try {
      for (const companion of selectedCompanionsToAdd) {
        await fetch(`${import.meta.env.VITE_API_URL}/api/rooms/${roomId}/ai-companion`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ ...companion, addedBy: userId })
        });
      }
      setShowInviteModal(false);
      setSelectedCompanionsToAdd([]);
    } catch (err) {
      console.error(err);
    }
  };

  const handleRemoveCompanion = async (companionName: string) => {
    if (!roomId) return;
    try {
      await fetch(`${import.meta.env.VITE_API_URL}/api/rooms/${roomId}/ai-companion/${encodeURIComponent(companionName)}?userId=${userId}`, {
        method: 'DELETE'
      });
    } catch (err) {
      console.error('Failed to remove companion:', err);
    }
  };

  const handleCreateThread = async (title: string, content: string) => {
    try {
      await fetch(`${import.meta.env.VITE_API_URL}/api/rooms/${roomId}/forum/threads`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ title, content, authorId: userId, authorName: username })
      });
    } catch (error) {
      console.error('Error creating thread:', error);
    }
  };

  const handleAddComment = async (threadId: string, content: string) => {
    try {
      await fetch(`${import.meta.env.VITE_API_URL}/api/rooms/${roomId}/forum/threads/${threadId}/comments`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ content, userId, username })
      });
    } catch (error) {
      console.error('Error adding comment:', error);
    }
  };

  const handleUpdateThreadStatus = async (threadId: string, status: string) => {
    try {
      await fetch(`${import.meta.env.VITE_API_URL}/api/rooms/${roomId}/forum/threads/${threadId}/status`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status })
      });
    } catch (error) {
      console.error('Error updating thread status:', error);
    }
  };

  return (
    <div className="flex flex-col h-screen bg-[#0f0f0f] text-white overflow-hidden font-sans selection:bg-primary selection:text-primary-content">
      <Header 
        roomName={roomName}
        userCount={userCount}
        onPlaylistClick={handlePlaylistClick}
        onChatClick={handleChatClick}
        onForumClick={handleForumClick}
        onShareClick={handleShareClick}
        onCameraToggle={handleCameraToggle}
        isCameraEnabled={isCameraEnabled}
        cameraEmotion={cameraEmotion}
        serverVideoState={serverVideoState}
        currentTime={state.playedSeconds}
      />

      <div className="flex flex-1 pt-16 overflow-hidden relative bg-black">
        
        {/* Ambilight Background Layer */}
        <div className="absolute inset-0 z-0 overflow-hidden pointer-events-none">
            {src && (
                <div className="absolute inset-0 bg-primary/20 blur-[100px] opacity-20 scale-110 transition-opacity duration-1000" />
            )}
        </div>

        {/* Main Layout Container */}
        <div className="relative z-10 w-full h-full flex">
          
          {/* Left Side: Video + Dock */}
          <div className="flex-1 flex flex-col relative min-w-0 transition-all duration-300">
            
            {/* Main Stage - Video Area */}
            <div className="flex-1 flex flex-col items-center justify-center min-h-0 pb-20 pt-4 transition-all duration-300">
            
              {/* Video Container */}
              <div className="w-full max-w-[95%] aspect-video max-h-[95%] relative shadow-2xl bg-black rounded-xl overflow-hidden ring-1 ring-white/10 group">
              {!src ? (
                 // Setup View (Empty Room)
                 <div className="relative w-full h-full flex flex-col bg-[#0f0f0f] p-8 overflow-hidden">
                    <div className="max-w-5xl w-full mx-auto flex flex-col h-full">
                       <h1 className="text-3xl font-bold mb-2 text-white">開始你的房間</h1>
                       <p className="text-gray-400 mb-6">搜尋並加入影片到播放清單，完成後點擊「開始播放」</p>
                       
                       {/* Search Bar */}
                       <div className="flex gap-2 mb-6">
                          <div className="relative flex-1">
                             <input
                                ref={searchInputRef}
                                type="text"
                                placeholder="搜尋 YouTube 影片..."
                                className="w-full bg-[#1a1a1a] border border-white/10 rounded-lg px-4 py-3 pl-10 text-white focus:outline-none focus:border-primary transition-colors"
                                onKeyDown={(e) => e.key === 'Enter' && performSearch()}
                             />
                             <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="w-5 h-5 absolute left-3 top-3.5 text-gray-500">
                               <path fillRule="evenodd" d="M9 3.5a5.5 5.5 0 1 0 0 11 5.5 5.5 0 0 0 0-11ZM2 9a7 7 0 1 1 12.452 4.391l3.328 3.329a.75.75 0 1 1-1.06 1.06l-3.329-3.328A7 7 0 0 1 2 9Z" clipRule="evenodd" />
                             </svg>
                          </div>
                          <button 
                             onClick={() => performSearch()}
                             className="btn btn-primary px-6"
                             disabled={isSearching}
                          >
                             {isSearching ? <span className="loading loading-spinner loading-sm"></span> : '搜尋'}
                          </button>
                       </div>

                       <div className="flex-1 flex gap-6 min-h-0">
                          {/* Search Results */}
                          <div className="flex-1 bg-[#1a1a1a] rounded-xl border border-white/5 flex flex-col overflow-hidden">
                             <div className="p-4 border-b border-white/5 font-medium text-gray-300">搜尋結果</div>
                             <div className="flex-1 overflow-y-auto p-4 space-y-3 custom-scrollbar">
                                {searchResults.length > 0 ? (
                                   searchResults.map((item, index) => (
                                      <div key={`${item.id.videoId}-${index}`} className="flex gap-3 p-2 rounded-lg hover:bg-white/5 group">
                                         <div className="w-32 aspect-video bg-black rounded overflow-hidden flex-shrink-0 relative">
                                            <img src={item.snippet.thumbnails.medium?.url} alt={item.snippet.title} className="w-full h-full object-cover" />
                                         </div>
                                         <div className="flex-1 min-w-0 flex flex-col justify-between">
                                            <h3 className="text-sm font-medium text-white line-clamp-2" title={item.snippet.title}>{item.snippet.title}</h3>
                                            <div className="flex justify-between items-end">
                                               <span className="text-xs text-gray-500">{item.snippet.channelTitle}</span>
                                               <button 
                                                  onClick={() => addToQueue({
                                                     videoId: item.id.videoId,
                                                     title: item.snippet.title,
                                                     channelTitle: item.snippet.channelTitle,
                                                     thumbnailUrl: item.snippet.thumbnails.medium?.url || item.snippet.thumbnails.default.url,
                                                     addedBy: username
                                                  })}
                                                  className="btn btn-xs btn-ghost text-primary hover:bg-primary/10"
                                               >
                                                  + 加入清單
                                               </button>
                                            </div>
                                         </div>
                                      </div>
                                   ))
                                ) : (
                                   <div className="h-full flex flex-col items-center justify-center text-gray-500">
                                      <p>輸入關鍵字搜尋影片</p>
                                   </div>
                                )}
                             </div>
                          </div>

                          {/* Queue Preview */}
                          <div className="w-80 bg-[#1a1a1a] rounded-xl border border-white/5 flex flex-col overflow-hidden">
                             <div className="p-4 border-b border-white/5 font-medium text-gray-300 flex justify-between items-center">
                                <span>待播清單</span>
                                <span className="text-xs bg-white/10 px-2 py-0.5 rounded-full">{queue.length}</span>
                             </div>
                             <div className="flex-1 overflow-y-auto p-4 space-y-3 custom-scrollbar">
                                {queue.length > 0 ? (
                                   queue.map((item, index) => (
                                      <div key={`${item.videoId}-${index}`} className="flex gap-3 p-2 rounded-lg bg-white/5">
                                         <div className="w-20 aspect-video bg-black rounded overflow-hidden flex-shrink-0">
                                            <img src={item.thumbnailUrl} alt={item.title} className="w-full h-full object-cover" />
                                         </div>
                                         <div className="flex-1 min-w-0">
                                            <h3 className="text-xs font-medium text-white line-clamp-2 mb-1">{item.title}</h3>
                                            <button 
                                               onClick={() => removeFromQueue(index)}
                                               className="text-[10px] text-red-400 hover:text-red-300"
                                            >
                                               移除
                                            </button>
                                         </div>
                                      </div>
                                   ))
                                ) : (
                                   <div className="h-full flex flex-col items-center justify-center text-gray-500 text-sm">
                                      <p>清單是空的</p>
                                   </div>
                                )}
                             </div>
                             <div className="p-4 border-t border-white/5">
                                <button 
                                   onClick={handleStartRoom}
                                   className="btn btn-primary w-full shadow-lg shadow-primary/20"
                                   disabled={queue.length === 0}
                                >
                                   開始播放 ({queue.length})
                                </button>
                             </div>
                          </div>
                       </div>
                    </div>
                 </div>
              ) : (
                 // Player Section
                 <>
                    {/* Host Control Warning */}
                    {hostControlWarning && (
                      <div className="absolute top-4 left-1/2 -translate-x-1/2 z-50 animate-in fade-in slide-in-from-top-2 duration-300">
                        <div className="bg-yellow-500/90 text-black px-6 py-3 rounded-lg shadow-xl font-medium flex items-center gap-2">
                          <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="w-5 h-5">
                            <path fillRule="evenodd" d="M8.485 2.495c.673-1.167 2.357-1.167 3.03 0l6.28 10.875c.673 1.167-.17 2.625-1.516 2.625H3.72c-1.347 0-2.189-1.458-1.515-2.625L8.485 2.495ZM10 5a.75.75 0 0 1 .75.75v3.5a.75.75 0 0 1-1.5 0v-3.5A.75.75 0 0 1 10 5Zm0 9a1 1 0 1 0 0-2 1 1 0 0 0 0 2Z" clipRule="evenodd" />
                          </svg>
                          {hostControlWarning}
                        </div>
                      </div>
                    )}
                    
                    <ReactPlayer
                      ref={setPlayerRef}
                      className="react-player"
                      width="100%"
                      height="100%"
                      src={src}
                      pip={pip}
                      playing={playing}
                      controls={controls}
                      light={light}
                      loop={loop}
                      playbackRate={playbackRate}
                      volume={undefined}
                      muted={undefined}
                      onReady={handlePlayerReady}
                      onPlay={handlePlay}
                      onPause={handlePause}
                      onSeeking={handleSeeking}
                      onSeeked={handleSeeked}
                      onEnded={handleEnded}
                      onProgress={handleProgress}
                      onDurationChange={handleDurationChange}
                      onTimeUpdate={handleTimeUpdate}
                    />
                    
                    {/* Sync Button Overlay Removed */}
                 </>
              )}
            </div>
            </div>

            {/* UserDock (Seating Area) - Fixed at bottom of this section */}
            <UserDock 
              currentUser={currentUser}
              users={roomUsers}
              emotion={emotion}
              isFocused={isFocused}
              messages={messages}
              hostId={hostId}
              mutedUserIds={mutedUserIds}
              onToggleMute={toggleMuteUser}
              onInvite={handleInvite}
              onEmotionSelect={handleEmotionSelect}
              onRemoveCompanion={handleRemoveCompanion}
            />

            {/* Controls: Text Input, Voice, Emoji */}
            <div className="absolute bottom-6 right-6 z-50 flex flex-col items-end gap-4 pointer-events-none">
              
              {/* Emoji Button (Independent) - 相機開啟時隱藏 */}
              {!isCameraEnabled && (
              <div className="relative pointer-events-auto">
                 {showEmojiMenu && (
                    <div className="absolute bottom-full right-0 mb-4 animate-in fade-in slide-in-from-bottom-2 duration-200">
                      <div className="bg-[#1e1f22] border border-white/10 rounded-2xl p-2 shadow-xl flex gap-2">
                        {['😂', '😭', '😯', '😠', '❤️', '👍'].map(emoji => (
                          <button 
                            key={emoji}
                            onClick={() => handleEmojiSelect(emoji)}
                            className="w-10 h-10 flex items-center justify-center text-xl hover:bg-white/10 rounded-xl transition-colors"
                          >
                            {emoji}
                          </button>
                        ))}
                      </div>
                    </div>
                 )}
                 <button
                    onClick={() => setShowEmojiMenu(!showEmojiMenu)}
                    className="btn btn-circle btn-lg bg-[#1a1a1a]/90 backdrop-blur-md border border-white/10 shadow-2xl hover:bg-primary hover:text-white hover:border-primary transition-all"
                    title="發送表情"
                 >
                    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className="w-6 h-6">
                      <path fillRule="evenodd" d="M12 2.25c-5.385 0-9.75 4.365-9.75 9.75s4.365 9.75 9.75 9.75 9.75-4.365 9.75-9.75S17.385 2.25 12 2.25Zm-2.625 6c-.54 0-.828.419-.936.634a1.96 1.96 0 0 0-.189.866c0 .298.059.605.189.866.108.215.395.634.936.634.54 0 .828-.419.936-.634.13-.26.189-.568.189-.866 0-.298-.059-.605-.189-.866-.108-.215-.395-.634-.936-.634Zm4.314.634c.108-.215.395-.634.936-.634.54 0 .828.419.936.634.13.26.189.568.189.866 0 .298-.059.605-.189.866-.108.215-.395.634-.936.634-.54 0-.828-.419-.936-.634a1.96 1.96 0 0 1-.189-.866c0-.298.059-.605.189-.866Zm2.023 6.828a.75.75 0 1 0-1.06-1.06 3.75 3.75 0 0 1-5.304 0 .75.75 0 0 0-1.06 1.06 5.25 5.25 0 0 0 7.424 0Z" clipRule="evenodd" />
                    </svg>
                 </button>
              </div>
              )}

              {/* Expandable Input Bar Container */}
              <div className="flex items-center justify-end pointer-events-auto relative">
                
                {/* Expandable Input Bar */}
                <div className={`flex items-center gap-2 bg-[#1a1a1a]/90 backdrop-blur-md p-2 rounded-2xl border border-white/10 shadow-2xl transition-all duration-300 origin-right ${isInputBarExpanded ? 'w-[500px] opacity-100 mr-2' : 'w-0 opacity-0 overflow-hidden p-0 border-0'}`}>
                  
                  {/* Text Input */}
                  <input
                    type="text"
                    value={inputText}
                    onChange={(e) => setInputText(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' && inputText.trim()) {
                        handleSendMessage(inputText);
                        setInputText('');
                      }
                    }}
                    placeholder="輸入訊息..."
                    className="flex-1 bg-transparent border-none focus:outline-none text-white px-4 py-2 min-w-0"
                  />
                  
                  {/* Send Button (only if text) */}
                  {inputText.trim() && (
                    <button
                      onClick={() => {
                        handleSendMessage(inputText);
                        setInputText('');
                      }}
                      className="btn btn-circle btn-sm btn-primary text-white"
                    >
                      <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="w-4 h-4">
                        <path d="M3.105 2.289a.75.75 0 0 0-.826.95l1.414 4.925A1.5 1.5 0 0 0 5.135 9.25h6.115a.75.75 0 0 1 0 1.5H5.135a1.5 1.5 0 0 0-1.442 1.086l-1.414 4.926a.75.75 0 0 0 .826.95 28.896 28.896 0 0 0 15.293-7.154.75.75 0 0 0 0-1.115A28.897 28.897 0 0 0 3.105 2.289Z" />
                      </svg>
                    </button>
                  )}

                  <div className="w-px h-8 bg-white/10 mx-1"></div>

                  {/* Voice Button */}
                  <button
                    onClick={toggleMic}
                    className={`btn btn-circle btn-md transition-all ${isRecording ? 'btn-error animate-pulse text-white' : 'btn-ghost text-gray-400 hover:text-white'}`}
                    title={isRecording ? "停止錄音" : "開始錄音"}
                  >
                    {isProcessingAudio ? (
                      <span className="loading loading-spinner loading-xs"></span>
                    ) : isRecording ? (
                      <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className="w-5 h-5">
                        <path fillRule="evenodd" d="M4.5 7.5a3 3 0 0 1 3-3h9a3 3 0 0 1 3 3v9a3 3 0 0 1-3 3h-9a3 3 0 0 1-3-3v-9Z" clipRule="evenodd" />
                      </svg>
                    ) : (
                      <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className="w-5 h-5">
                        <path d="M8.25 4.5a3.75 3.75 0 1 1 7.5 0v8.25a3.75 3.75 0 1 1-7.5 0V4.5Z" />
                        <path d="M6 10.5a.75.75 0 0 1 .75.75v1.5a5.25 5.25 0 1 0 10.5 0v-1.5a.75.75 0 0 1 1.5 0v1.5a6.751 6.751 0 0 1-6 6.509l.24 2.091h2.96a.75.75 0 0 1 0 1.5h-6.5a.75.75 0 0 1 0-1.5h2.96l.24-2.091A6.751 6.751 0 0 1 5.25 12.75v-1.5A.75.75 0 0 1 6 10.5Z" />
                      </svg>
                    )}
                  </button>
                </div>

                {/* Toggle Button (Input) */}
                <button
                  onClick={() => setIsInputBarExpanded(!isInputBarExpanded)}
                  className={`btn btn-circle btn-lg bg-[#1a1a1a]/90 backdrop-blur-md border border-white/10 shadow-2xl hover:bg-primary hover:text-white hover:border-primary transition-all ${isInputBarExpanded ? 'btn-neutral' : ''}`}
                >
                  {isInputBarExpanded ? (
                    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="w-6 h-6">
                      <path d="M6.28 5.22a.75.75 0 0 0-1.06 1.06L8.94 10l-3.72 3.72a.75.75 0 1 0 1.06 1.06L10 11.06l3.72 3.72a.75.75 0 1 0 1.06-1.06L11.06 10l3.72-3.72a.75.75 0 0 0-1.06-1.06L10 8.94 6.28 5.22Z" />
                    </svg>
                  ) : (
                    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className="w-6 h-6">
                      <path d="M21.731 2.269a2.625 2.625 0 0 0-3.712 0l-1.157 1.157 3.712 3.712 1.157-1.157a2.625 2.625 0 0 0 0-3.712ZM19.513 8.199l-3.712-3.712-12.15 12.15a5.25 5.25 0 0 0-1.32 2.214l-.8 2.685a.75.75 0 0 0 .933.933l2.685-.8a5.25 5.25 0 0 0 2.214-1.32L19.513 8.2Z" />
                    </svg>
                  )}
                </button>
              </div>

            </div>
          </div>

          {/* Sidebar (History/Chat/Playlist) - Sliding Panel */}
          <div className={`${showSidebar ? 'w-96 opacity-100 translate-x-0' : 'w-0 opacity-0 translate-x-full'} transition-all duration-300 ease-in-out overflow-hidden`}>
             <div className="w-96 h-full flex flex-col relative">
                <button 
                  onClick={() => setShowSidebar(false)} 
                  className="absolute top-2 right-4 z-50 btn btn-ghost btn-xs btn-circle text-gray-400 hover:text-white bg-black/20"
                >
                  ✕
                </button>
                <Sidebar 
                   currentUser={currentUser}
                   roomUsers={roomUsers}
                   messages={messages}
                   queue={queue}
                   currentVideo={currentVideo}
                   history={history}
                   searchResults={searchResults.map(video => ({
                     videoId: video.id.videoId,
                     title: video.snippet.title,
                     channelTitle: video.snippet.channelTitle,
                     thumbnailUrl: video.snippet.thumbnails.medium?.url || video.snippet.thumbnails.default.url
                   }))}
                   activeTab={sidebarTab}
                   onTabChange={setSidebarTab}
                   onSendMessage={handleSendMessage}
                   onPlay={playVideo}
                   onRemoveFromQueue={removeFromQueue}
                   onAddToQueue={addToQueue}
                   onSearch={performSearch}
                   onUpdateProfile={(newUsername, newAvatar) => {
                     setUsername(newUsername);
                     setAvatar(newAvatar);
                     localStorage.setItem('video_agent_username', newUsername);
                     localStorage.setItem('video_agent_avatar', newAvatar);
                   }}
                   hideChat={false}
                   spoilerPreference={spoilerPreference as 'show_all' | 'hide_spoilers'}
                   mutedUserIds={mutedUserIds}
                   forumThreads={forumThreads}
                   onCreateThread={handleCreateThread}
                   onAddComment={handleAddComment}
                   onUpdateThreadStatus={handleUpdateThreadStatus}
                 />
             </div>
          </div>
        </div>

      </div>

      {/* Developer / Debug Toggle (Hidden in a corner) */}
      <div className="fixed bottom-24 right-84 z-50 opacity-0 hover:opacity-100 transition-opacity">
           <div className="dropdown dropdown-top dropdown-end">
              <div tabIndex={0} role="button" className="btn btn-circle btn-xs btn-ghost text-gray-700 hover:text-white">
                <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-4 h-4">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M17.25 6.75 22.5 12l-5.25 5.25m-10.5 0L1.5 12l5.25-5.25m7.5-3-4.5 16.5" />
                </svg>
              </div>
              <div tabIndex={0} className="dropdown-content z-[1] menu p-2 shadow bg-[#1a1a1a] rounded-box w-80 border border-white/10 mb-2">
                <div className="p-2">
                  <h3 className="font-bold text-xs text-gray-400 mb-2">Debug Info</h3>
                  <div className="grid grid-cols-2 gap-2 text-xs font-mono text-gray-500">
                    <div>played: {played.toFixed(2)}</div>
                    <div>loaded: {loaded.toFixed(2)}</div>
                    <div>duration: {duration}</div>
                  </div>
                  <div className="divider my-1"></div>
                  <div className="join w-full">
                    <input
                      ref={urlInputRef}
                      type="text"
                      placeholder="Custom URL..."
                      className="input input-bordered input-xs join-item bg-black/50 w-full"
                    />
                    <button onClick={handleLoadCustomUrl} className="btn btn-xs btn-primary join-item">Load</button>
                  </div>
                </div>
              </div>
           </div>
      </div>

      {/* Hidden camera video element */}
      <video 
        ref={videoElementRef}
        className="fixed top-0 left-0 w-1 h-1 opacity-0 pointer-events-none -z-50"
        autoPlay
        muted
      />
      
      {/* Camera emotion display - moved to Header */}



      {/* Invite / Add AI Modal */}
      {showInviteModal && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/80 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="bg-[#1e1f22] border border-white/10 rounded-2xl p-6 w-full max-w-4xl max-h-[90vh] overflow-y-auto shadow-2xl relative animate-in zoom-in-95 duration-200">
            <button 
              onClick={() => setShowInviteModal(false)}
              className="absolute top-4 right-4 btn btn-circle btn-sm btn-ghost text-gray-400 hover:text-white"
            >
              ✕
            </button>
            
            <h2 className="text-2xl font-bold text-white mb-2 text-center">加入智慧影伴</h2>
            <p className="text-gray-400 text-center mb-8">選擇一位或多位智慧影伴加入房間</p>

            <div className="flex flex-col gap-8">
                {/* AI Selector */}
                <div>
                    <div className="flex justify-between items-center mb-4">
                        <h3 className="text-lg font-medium text-white">選擇智慧影伴</h3>
                        <button 
                            onClick={handleAddCompanions}
                            disabled={selectedCompanionsToAdd.length === 0}
                            className="btn btn-primary btn-sm"
                        >
                            加入選取的夥伴 ({selectedCompanionsToAdd.length})
                        </button>
                    </div>
                    <div className="max-h-[60vh] overflow-y-auto custom-scrollbar">
                        <AICompanionSelector 
                            onSelect={setSelectedCompanionsToAdd} 
                            existingCompanionNames={roomUsers.filter(u => u.isAi).map(u => u.username)}
                        />
                    </div>
                </div>
            </div>
          </div>
        </div>
      )}

      {/* Toast Notifications */}
      {searchError && (
        <div className="toast toast-end toast-bottom z-50 mb-20 mr-80">
          <div className="alert alert-info text-sm shadow-lg bg-[#1a1a1a] border border-white/10 text-white">
            <span>{searchError}</span>
            <button onClick={() => setSearchError('')} className="btn btn-ghost btn-xs">✕</button>
          </div>
        </div>
      )}


    </div>
  );
};

export default Room;
