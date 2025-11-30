import { useState, useRef, useEffect, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import ReactPlayer from 'react-player';
import { FaceLandmarker, FilesetResolver } from "@mediapipe/tasks-vision";

import Sidebar from '../components/Sidebar';
import Header from '../components/Header';
import UserDock from '../components/UserDock';
import AICompanionSelector from '../components/AICompanionSelector';
import type { VideoItem, YouTubeVideo, Message, AICompanion } from '../types';

interface User {
  id: string;
  username: string;
  avatar: string;
  lastSeen: number;
  emotion?: string;
  isFocused?: boolean;
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

  const [roomUsers, setRoomUsers] = useState<User[]>([]);
  const [messages, setMessages] = useState<Message[]>([]);
  const [roomName, setRoomName] = useState<string>('');
  const [showSidebar, setShowSidebar] = useState(false);
  const [sidebarTab, setSidebarTab] = useState<'chat' | 'playlist'>('chat');

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
  
  const videoRef = useRef<HTMLVideoElement>(null);
  const [faceLandmarker, setFaceLandmarker] = useState<FaceLandmarker | null>(null);
  const [webcamRunning, setWebcamRunning] = useState(false);
  const [isCameraEnabled, setIsCameraEnabled] = useState(false);
  const [isMicEnabled, setIsMicEnabled] = useState(false);
  const [isRecording, setIsRecording] = useState(false);
  const [suggestions, setSuggestions] = useState<string[]>([]);

  const toggleRecording = async () => {
    if (isRecording) {
      // Stop "Recording"
      setIsRecording(false);
      // Show suggestions
      setSuggestions([
        "這部影片真有趣！"
      ]);
    } else {
      // Start "Recording" (Fake)
      setIsRecording(true);
      setSuggestions([]);
    }
  };

  const handleSuggestionClick = (text: string) => {
    handleSendMessage(text);
    setSuggestions([]);
  };

  const toggleCamera = async () => {
    if (isCameraEnabled) {
      setWebcamRunning(false);
      setIsCameraEnabled(false);
      if (videoRef.current && videoRef.current.srcObject) {
        const stream = videoRef.current.srcObject as MediaStream;
        stream.getTracks().forEach(track => track.stop());
        videoRef.current.srcObject = null;
      }
      setEmotion(undefined);
    } else {
      await startWebcam();
      setIsCameraEnabled(true);
    }
  };

  const toggleMic = async () => {
    // This function is called by Header mic button.
    // We can map it to toggleRecording or just toggle the state.
    // For now, let's make it toggle recording as well for consistency if the user clicks it.
    await toggleRecording();
    setIsMicEnabled(!isRecording); // Update UI state based on next state
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

  // Initialize MediaPipe FaceLandmarker
  useEffect(() => {
    const initMediaPipe = async () => {
      try {
        const filesetResolver = await FilesetResolver.forVisionTasks(
          "https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.3/wasm"
        );
        const landmarker = await FaceLandmarker.createFromOptions(filesetResolver, {
          baseOptions: {
            modelAssetPath: `https://storage.googleapis.com/mediapipe-models/face_landmarker/face_landmarker/float16/1/face_landmarker.task`,
            delegate: "GPU"
          },
          outputFaceBlendshapes: true,
          runningMode: "VIDEO",
          numFaces: 1
        });
        setFaceLandmarker(landmarker);
        // startWebcam(); // Manual start only
      } catch (error) {
        console.error("Error initializing MediaPipe:", error);
        // setModelError('Failed to load AI model');
      }
    };
    initMediaPipe();
  }, []);

  const startWebcam = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ video: true });
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        videoRef.current.addEventListener("loadeddata", predictWebcam);
        setWebcamRunning(true);
      }
    } catch (err) {
      console.error("Error accessing webcam:", err);
      // setModelError('Camera access denied');
    }
  };

  const predictWebcam = async () => {
    if (!faceLandmarker || !videoRef.current) return;
    
    // Ensure video dimensions are valid
    if (videoRef.current.videoWidth === 0 || videoRef.current.videoHeight === 0) {
      requestRef.current = requestAnimationFrame(predictWebcam);
      return;
    }

    let startTimeMs = performance.now();
    try {
      if (lastVideoTimeRef.current !== videoRef.current.currentTime) {
        lastVideoTimeRef.current = videoRef.current.currentTime;
        const results = faceLandmarker.detectForVideo(videoRef.current, startTimeMs);
        
        let rawEmotion = 'Neutral';
        let faceDetected = false;

        if (results.faceBlendshapes && results.faceBlendshapes.length > 0 && results.faceBlendshapes[0].categories) {
          faceDetected = true;
          const shapes = results.faceBlendshapes[0].categories;
          // Simple emotion mapping
          const getScore = (name: string) => shapes.find(s => s.categoryName === name)?.score || 0;
          
          const smile = (getScore('mouthSmileLeft') + getScore('mouthSmileRight')) / 2;
          const browDown = (getScore('browDownLeft') + getScore('browDownRight')) / 2;
          const browInnerUp = getScore('browInnerUp');
          const jawOpen = getScore('jawOpen');
          const mouthFrown = (getScore('mouthFrownLeft') + getScore('mouthFrownRight')) / 2;

          if (smile > 0.5) rawEmotion = 'Happy';
          else if (browDown > 0.5) rawEmotion = 'Angry';
          else if (browInnerUp > 0.5 && jawOpen > 0.3) rawEmotion = 'Surprise';
          else if (mouthFrown > 0.5) rawEmotion = 'Sad';
        }

        if (!faceDetected) {
          setEmotion(undefined);
        } else {
          const now = Date.now();

          // Stability Check
          if (rawEmotion === lastRawEmotionRef.current) {
             // Stable
          } else {
             lastRawEmotionRef.current = rawEmotion;
             emotionStabilityStartRef.current = now;
          }

          const stabilityDuration = now - emotionStabilityStartRef.current;

          // Trigger Hold (if non-neutral and stable > 0.5s)
          if (rawEmotion !== 'Neutral' && stabilityDuration > 500) {
             heldEmotionRef.current = rawEmotion;
             emotionHoldEndRef.current = now + 3000;
          }

          // Determine Display Emotion
          let finalEmotion = rawEmotion;
          if (now < emotionHoldEndRef.current && heldEmotionRef.current) {
             finalEmotion = heldEmotionRef.current;
          }
          
          if (finalEmotion !== emotion) {
             setEmotion(finalEmotion);
             // Emotion will be sent via heartbeat polling
          }
        }
      }
    } catch (error) {
      console.error("Error in predictWebcam:", error);
    }
    requestRef.current = requestAnimationFrame(predictWebcam);
  };

  useEffect(() => {
    if (webcamRunning && faceLandmarker) {
      requestRef.current = requestAnimationFrame(predictWebcam);
    }
    return () => {
      if (requestRef.current) cancelAnimationFrame(requestRef.current);
    };
  }, [webcamRunning, faceLandmarker]);



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
  
  const [queue, setQueue] = useState<VideoItem[]>([]);
  const [history, setHistory] = useState<VideoItem[]>([]);

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
        
        setQueue(roomData.queue || []);
        setHistory(roomData.history || []);
        setRoomUsers(roomData.users || []);
        setMessages(roomData.messages || []);
        
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
          setServerVideoState({
            played: roomData.videoState.played,
            lastUpdated: roomData.videoState.lastUpdated,
            playing: roomData.videoState.playing,
            playbackRate: roomData.videoState.playbackRate
          });
          
          // Seek to initial position
          if (playerRef.current && roomData.videoState.played > 0) {
            setTimeout(() => {
              if (playerRef.current) {
                playerRef.current.currentTime = roomData.videoState.played;
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

    const wsUrl = `${import.meta.env.VITE_API_URL.replace('http', 'ws')}/api/ws/${roomId}/${userId}`;
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
          emotion: emotionRef.current
        }
      }));
    };

    ws.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data);
        console.log('WebSocket message:', data);

        if (data.type === 'video_state_update' && data.sender !== userId) {
          // 接收其他用戶的播放狀態更新
          const serverState = data.state;
          
          // 更新本地狀態
          setState(prev => ({
            ...prev,
            playing: serverState.playing,
            playedSeconds: serverState.played,
            duration: serverState.duration || prev.duration,
            playbackRate: serverState.playbackRate
          }));

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
              playerRef.current.currentTime = currentServerTime;
              lastAutoSyncTimeRef.current = Date.now(); // 記錄自動同步時間
              // 不重置 lastSeekTimeRef，避免連鎖反應
            } else if (timeDiff > tolerance) {
              console.log(`WS Sync skipped: diff=${timeDiff.toFixed(2)}s but synced ${timeSinceLastAutoSync}ms ago`);
            }
          }
        } else if (data.type === 'users_update') {
          setRoomUsers(data.users || []);
        } else if (data.type === 'new_message') {
          setMessages(prev => [...prev, data.message]);
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

    // 播放進度發送（每 1 秒）
    const progressInterval = setInterval(() => {
      if (ws.readyState === WebSocket.OPEN && state.src && playerRef.current) {
        try {
          const currentTime = playerRef.current.currentTime || 0;
          const duration = playerRef.current.duration || 0;
          
          ws.send(JSON.stringify({
            type: 'video_state',
            state: {
              playing: state.playing,
              played: currentTime,
              duration: duration,
              playbackRate: state.playbackRate
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
      if (ws.readyState === WebSocket.OPEN) {
        ws.close();
      }
    };
  }, [roomId, userId, username, avatar, state.src, state.playing, state.playbackRate]);

  // 定時從 server 拉取最新播放狀態（每 1 秒）
  useEffect(() => {
    if (!roomId) return;

    const interval = setInterval(async () => {
      try {
        const res = await fetch(`${import.meta.env.VITE_API_URL}/api/rooms/${roomId}`);
        if (res.ok) {
          const data = await res.json();
          const serverState = data.videoState;
          
          setQueue(data.queue || []);
          setHistory(data.history || []);
          setMessages(data.messages || []);
          
          // 更新 server 視頻狀態用於顯示
          setServerVideoState({
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
              playerRef.current.currentTime = currentServerTime;
              lastAutoSyncTimeRef.current = Date.now(); // 記錄自動同步時間
              // 不重置 lastSeekTimeRef，避免連鎖反應
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
        
        setQueue(data.queue || []);
        setHistory(data.history || []);
        setRoomUsers(data.users || []);
        setMessages(data.messages || []);

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
          playerRef.current.currentTime = currentServerTime;
          lastSeekTimeRef.current = Date.now(); // 記錄手動同步時間
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

  // 通過 WebSocket 發送播放狀態更新
  const updateServerState = (updates: Partial<PlayerState> & { duration?: number }) => {
    if (!wsRef.current || wsRef.current.readyState !== WebSocket.OPEN) return;
    
    wsRef.current.send(JSON.stringify({
      type: 'video_state',
      state: {
        playing: updates.playing,
        played: updates.played || 0,
        duration: updates.duration || state.duration,
        playbackRate: updates.playbackRate || state.playbackRate
      }
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
        playbackRate: state.playbackRate
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

  const [showInviteModal, setShowInviteModal] = useState(false);
  const [selectedCompanionsToAdd, setSelectedCompanionsToAdd] = useState<AICompanion[]>([]);

  const handleAddCompanions = async () => {
    if (selectedCompanionsToAdd.length === 0) return;

    // Check room limit (6)
    if (roomUsers.length + selectedCompanionsToAdd.length > 6) {
      setSearchError('房間人數上限為 6 人 (含智慧影伴)');
      setTimeout(() => setSearchError(''), 3000);
      return;
    }

    try {
      for (const companion of selectedCompanionsToAdd) {
        await fetch(`${import.meta.env.VITE_API_URL}/api/rooms/${roomId}/ai-companion`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(companion)
        });
      }
      setShowInviteModal(false);
      setSelectedCompanionsToAdd([]);
    } catch (err) {
      console.error(err);
    }
  };

  return (
    <div className="flex flex-col h-screen bg-[#0f0f0f] text-white overflow-hidden font-sans selection:bg-primary selection:text-primary-content">
      <Header 
        roomName={roomName}
        userCount={roomUsers.length}
        onPlaylistClick={() => {
          setSidebarTab('playlist');
          setShowSidebar(true);
        }}
        onChatClick={() => {
          setSidebarTab('chat');
          setShowSidebar(true);
        }}
        onShareClick={() => {
          navigator.clipboard.writeText(window.location.href);
          setSearchError('連結已複製到剪貼簿！'); // Reuse searchError for toast
          setTimeout(() => setSearchError(''), 2000);
        }}
        isCameraEnabled={isCameraEnabled}
        onToggleCamera={toggleCamera}
        isMicEnabled={isMicEnabled}
        onToggleMic={toggleMic}
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
              currentUser={{ id: userId, username, avatar, lastSeen: Date.now() }}
              users={roomUsers}
              emotion={emotion}
              isFocused={isFocused}
              messages={messages}
              onInvite={() => setShowInviteModal(true)}
              onEmotionSelect={(selectedEmotion) => {
                setEmotion(selectedEmotion);
                emotionRef.current = selectedEmotion;
                // Send immediate update via WS if connected
                if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
                  wsRef.current.send(JSON.stringify({
                    type: 'emotion',
                    emotion: selectedEmotion
                  }));
                }
              }}
            />

            {/* Voice Input Control (Bottom Right of Main Stage) */}
            <div className="absolute bottom-6 right-6 z-50 flex items-center gap-4">
              {suggestions.length > 0 && (
                <div className="flex flex-col gap-2 animate-in slide-in-from-right-4 items-end">
                  {suggestions.map((text, index) => (
                    <button
                      key={index}
                      onClick={() => handleSuggestionClick(text)}
                      className="btn btn-sm bg-[#1a1a1a] border-white/10 text-white hover:bg-primary hover:border-primary shadow-xl"
                    >
                      {text}
                    </button>
                  ))}
                </div>
              )}
              <div className="flex flex-col items-end gap-2">
                <button
                  onClick={toggleRecording}
                  className={`btn btn-circle btn-lg shadow-xl border-white/10 transition-all ${isRecording ? 'btn-error animate-pulse' : 'btn-neutral'}`}
                  title={isRecording ? "Stop Recording" : "Start Recording"}
                >
                  {isRecording ? (
                    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className="w-8 h-8">
                      <path fillRule="evenodd" d="M4.5 7.5a3 3 0 0 1 3-3h9a3 3 0 0 1 3 3v9a3 3 0 0 1-3 3h-9a3 3 0 0 1-3-3v-9Z" clipRule="evenodd" />
                    </svg>
                  ) : (
                    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className="w-8 h-8">
                      <path d="M8.25 4.5a3.75 3.75 0 1 1 7.5 0v8.25a3.75 3.75 0 1 1-7.5 0V4.5Z" />
                      <path d="M6 10.5a.75.75 0 0 1 .75.75v1.5a5.25 5.25 0 1 0 10.5 0v-1.5a.75.75 0 0 1 1.5 0v1.5a6.751 6.751 0 0 1-6 6.509l.24 2.091h2.96a.75.75 0 0 1 0 1.5h-6.5a.75.75 0 0 1 0-1.5h2.96l.24-2.091A6.751 6.751 0 0 1 5.25 12.75v-1.5A.75.75 0 0 1 6 10.5Z" />
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
                   currentUser={{ id: userId, username, avatar, lastSeen: Date.now() }}
                   roomUsers={roomUsers}
                   messages={messages}
                   queue={queue}
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

      {/* Local Video Preview & AI Status (Hidden but active) */}
      <div className="fixed top-0 left-0 w-1 h-1 opacity-0 pointer-events-none -z-50">
        <video 
          ref={videoRef} 
          autoPlay 
          playsInline 
          muted 
          className="w-full h-full"
        />
      </div>



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
            <p className="text-gray-400 text-center mb-8">選擇一位或多位智慧影伴加入房間 (房間上限 6 人)</p>

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
                        <AICompanionSelector onSelect={setSelectedCompanionsToAdd} />
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
