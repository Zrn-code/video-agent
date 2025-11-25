import { useState, useRef, useCallback, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import ReactPlayer from 'react-player';
import { FaceLandmarker, FilesetResolver } from "@mediapipe/tasks-vision";

import Sidebar from '../components/Sidebar';
import Header from '../components/Header';
import UserDock from '../components/UserDock';
import type { VideoItem, YouTubeVideo, Message } from '../types';

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
  const playerRef = useRef<any>(null);
  const urlInputRef = useRef<HTMLInputElement | null>(null);
  const searchInputRef = useRef<HTMLInputElement | null>(null);

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
  const [modelError, setModelError] = useState<string>('');
  const [isCameraEnabled, setIsCameraEnabled] = useState(false);
  const [isMicEnabled, setIsMicEnabled] = useState(false);
  const [isRecording, setIsRecording] = useState(false);
  const [mediaRecorder, setMediaRecorder] = useState<MediaRecorder | null>(null);
  const [recordedAudioUrl, setRecordedAudioUrl] = useState<string | null>(null);

  const toggleRecording = async () => {
    if (isRecording) {
      // Stop Recording
      if (mediaRecorder && mediaRecorder.state !== 'inactive') {
        mediaRecorder.stop();
        setIsRecording(false);
        setMediaRecorder(null);
        console.log("Recording stopped");
      }
    } else {
      // Start Recording
      try {
        const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
        const recorder = new MediaRecorder(stream);
        const chunks: Blob[] = [];

        recorder.ondataavailable = (e) => {
          if (e.data.size > 0) {
            chunks.push(e.data);
          }
        };

        recorder.onstop = () => {
          const audioBlob = new Blob(chunks, { type: 'audio/wav' });
          console.log("Recording finished", audioBlob);
          const url = URL.createObjectURL(audioBlob);
          setRecordedAudioUrl(url);
          // Here you would typically send the blob to the backend
          stream.getTracks().forEach(track => track.stop());
        };

        recorder.start();
        setMediaRecorder(recorder);
        setIsRecording(true);
        console.log("Recording started");
      } catch (err) {
        console.error("Error accessing microphone:", err);
        setIsMicEnabled(false);
      }
    }
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
        setModelError('Failed to load AI model');
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
      setModelError('Camera access denied');
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
          
          setEmotion(finalEmotion);
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
  const [searchResults, setSearchResults] = useState<YouTubeVideo[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [searchError, setSearchError] = useState<string>('');
  
  const [queue, setQueue] = useState<VideoItem[]>([]);
  const [history, setHistory] = useState<VideoItem[]>([]);
  const [currentVideo, setCurrentVideo] = useState<VideoItem | null>(null);
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

        // Join room
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
            played: roomData.videoState.played,
            playbackRate: roomData.videoState.playbackRate
          }));
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

  // Heartbeat Loop
  useEffect(() => {
    if (!roomId) return;

    const interval = setInterval(async () => {
      try {
        const res = await fetch(`${import.meta.env.VITE_API_URL}/api/rooms/${roomId}/heartbeat`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ userId, username, avatar, emotion: emotionRef.current, isFocused: isFocusedRef.current })
        });
        
        if (res.ok) {
          const data = await res.json();
          // Update room users list in realtime
          if (data.users) {
            setRoomUsers(data.users);
          }
          if (data.messages) {
            setMessages(data.messages);
          }
        }
      } catch (error) {
        console.error('Heartbeat failed:', error);
      }
    }, 1000);

    return () => clearInterval(interval);
  }, [roomId, userId, username, avatar]);

  const syncToRoom = async () => {
    if (!roomId) return;
    try {
      const res = await fetch(`${import.meta.env.VITE_API_URL}/api/rooms/${roomId}`);
      if (res.ok) {
        const data = await res.json();
        const serverState = data.videoState;
        
        setQueue(data.queue || []);
        setHistory(data.history || []);
        setRoomUsers(data.users || []);
        setMessages(data.messages || []);

        setState(prev => ({
          ...prev,
          src: serverState.url,
          playing: serverState.playing,
          playbackRate: serverState.playbackRate
        }));
        
        if (playerRef.current && serverState.played > 0) {
           playerRef.current.seekTo(serverState.played);
        }
      }
    } catch (error) {
      console.error('Sync failed:', error);
    }
  };

  // Update server state when local state changes (debounced or on specific events)
  const updateServerState = async (updates: Partial<PlayerState>) => {
    if (!roomId) return;
    
    try {
      await fetch(`${import.meta.env.VITE_API_URL}/api/rooms/${roomId}/state`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          url: updates.src,
          playing: updates.playing,
          played: updates.played,
          playbackRate: updates.playbackRate
        })
      });
    } catch (error) {
      console.error('Failed to update server state:', error);
    }
  };

  // YouTube 搜尋功能
  const performSearch = async (queryOverride?: string) => {
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
      // Optimistic update or wait for sync
      syncToRoom();
      // Switch to queue tab to show feedback
      setSidebarTab('playlist');
    } catch (error) {
      console.error('Failed to add to queue:', error);
    }
  };

  const removeFromQueue = async (index: number) => {
    if (!roomId) return;
    try {
      await fetch(`${import.meta.env.VITE_API_URL}/api/rooms/${roomId}/queue/${index}`, { method: 'DELETE' });
      syncToRoom();
    } catch (error) {
      console.error('Failed to remove from queue:', error);
    }
  };

  const playVideo = async (video: VideoItem) => {
    if (!roomId) return;
    try {
      await fetch(`${import.meta.env.VITE_API_URL}/api/rooms/${roomId}/play`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(video)
      });
      setCurrentVideo(video);
      syncToRoom();
    } catch (error) {
      console.error('Failed to play video:', error);
    }
  };

  const handlePlay = () => {
    console.log('onPlay');
    setState(prevState => ({ ...prevState, playing: true }));
    updateServerState({ playing: true });
  };

  const handlePause = () => {
    console.log('onPause');
    setState(prevState => ({ ...prevState, playing: false }));
    updateServerState({ playing: false });
  };

  const handleProgress = () => {
    const player = playerRef.current;
    if (!player || state.seeking || !player.buffered?.length) return;

    setState(prevState => ({
      ...prevState,
      loadedSeconds: player.buffered?.end(player.buffered?.length - 1),
      loaded: player.buffered?.end(player.buffered?.length - 1) / player.duration,
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

  const handleDurationChange = () => {
    const player = playerRef.current;
    if (!player) return;

    console.log('onDurationChange', player.duration);
    setState(prevState => ({ ...prevState, duration: player.duration }));
  };

  const setPlayerRef = useCallback((player: HTMLVideoElement) => {
    if (!player) return;
    playerRef.current = player;
  }, []);

  const handleLeaveRoom = () => {
    navigate('/');
  };



  const handleSendMessage = async (content: string) => {
    if (!roomId) return;
    
    // Optimistic update
    const newMessage: Message = {
      id: 'temp-' + Date.now(),
      userId,
      username,
      content,
      timestamp: Date.now() / 1000
    };
    setMessages(prev => [...prev, newMessage]);

    try {
      await fetch(`${import.meta.env.VITE_API_URL}/api/rooms/${roomId}/chat`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId, username, content })
      });
      // No need to update local state immediately, heartbeat will pick it up
      // But for better UX we could optimistically add it
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
    playedSeconds,
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
                      onPlay={handlePlay}
                      onPause={handlePause}
                      onEnded={handleEnded}
                      onProgress={handleProgress}
                      onDurationChange={handleDurationChange}
                      onTimeUpdate={handleTimeUpdate}
                    />
                    
                    {/* Sync Button Overlay */}
                    <div className="absolute top-6 right-6 opacity-0 group-hover:opacity-100 transition-opacity z-20">
                       <button onClick={syncToRoom} className="btn btn-sm bg-black/60 border-white/10 text-white hover:btn-primary backdrop-blur-md gap-2 shadow-xl">
                          <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                          </svg>
                          Sync to Room
                       </button>
                    </div>
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
              onInvite={() => {
                 navigator.clipboard.writeText(window.location.href);
                 setSearchError('連結已複製！');
                 setTimeout(() => setSearchError(''), 2000);
              }}
            />

            {/* Voice Input Control (Bottom Right of Main Stage) */}
            <div className="absolute bottom-6 right-6 z-50 flex items-center gap-4">
              {recordedAudioUrl && (
                <div className="bg-[#1a1a1a] p-2 rounded-full border border-white/10 shadow-xl flex items-center gap-2 animate-in slide-in-from-right-4">
                  <audio src={recordedAudioUrl} controls className="h-8 w-48" />
                  <button 
                    onClick={() => { 
                      URL.revokeObjectURL(recordedAudioUrl); 
                      setRecordedAudioUrl(null); 
                    }} 
                    className="btn btn-circle btn-xs btn-ghost text-gray-400 hover:text-white"
                  >
                    ✕
                  </button>
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
