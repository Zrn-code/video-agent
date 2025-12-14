import React, { useState, useEffect, useRef } from 'react';
import type { ForumThread, ForumComment } from '../types';

interface ForumProps {
  threads: ForumThread[];
  currentUser: { id: string; username: string };
  onCreateThread: (title: string, content: string) => void;
  onAddComment: (threadId: string, content: string) => void;
  onUpdateStatus: (threadId: string, status: string) => void;
}

const Forum: React.FC<ForumProps> = ({
  threads,
  currentUser,
  onCreateThread,
  onAddComment,
  onUpdateStatus
}) => {
  const [view, setView] = useState<'list' | 'create' | 'detail'>('list');
  const [selectedThreadId, setSelectedThreadId] = useState<string | null>(null);
  const [newThreadTitle, setNewThreadTitle] = useState('');
  const [newComment, setNewComment] = useState('');
  const commentsEndRef = useRef<HTMLDivElement>(null);

  const selectedThread = threads.find(t => t.id === selectedThreadId);

  useEffect(() => {
    if (view === 'detail' && selectedThread) {
      commentsEndRef.current?.scrollIntoView({ behavior: "smooth" });
    }
  }, [selectedThread?.comments.length, view]);

  const handleCreateThread = (e: React.FormEvent) => {
    e.preventDefault();
    if (newThreadTitle.trim()) {
      onCreateThread(newThreadTitle, '');  // content 設為空字符串
      setNewThreadTitle('');
      setView('list');
    }
  };

  const handleAddComment = (e: React.FormEvent) => {
    e.preventDefault();
    if (selectedThreadId && newComment.trim()) {
      onAddComment(selectedThreadId, newComment);
      setNewComment('');
    }
  };

  const formatTime = (timestamp: number) => {
    const date = new Date(timestamp * 1000);
    return date.toLocaleString([], { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' });
  };

  if (view === 'create') {
    return (
      <div className="flex flex-col h-full p-4">
        <div className="flex items-center mb-4">
          <button onClick={() => setView('list')} className="btn btn-ghost btn-sm btn-circle mr-2">
            <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
              <path fillRule="evenodd" d="M12.707 5.293a1 1 0 010 1.414L9.414 10l3.293 3.293a1 1 0 01-1.414 1.414l-4-4a1 1 0 010-1.414l4-4a1 1 0 011.414 0z" clipRule="evenodd" />
            </svg>
          </button>
          <h3 className="text-lg font-bold text-white">新增討論</h3>
        </div>
        <form onSubmit={handleCreateThread} className="flex flex-col gap-4">
          <input
            type="text"
            placeholder="標題"
            className="input input-bordered w-full bg-black/20"
            value={newThreadTitle}
            onChange={(e) => setNewThreadTitle(e.target.value)}
            required
          />
          <button type="submit" className="btn btn-primary w-full">創建討論</button>
        </form>
      </div>
    );
  }

  if (view === 'detail' && selectedThread) {
    return (
      <div className="flex flex-col h-full">
        <div className="flex items-center p-4 border-b border-white/10 bg-[#151618]">
          <button onClick={() => setView('list')} className="btn btn-ghost btn-sm btn-circle mr-2">
            <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
              <path fillRule="evenodd" d="M12.707 5.293a1 1 0 010 1.414L9.414 10l3.293 3.293a1 1 0 01-1.414 1.414l-4-4a1 1 0 010-1.414l4-4a1 1 0 011.414 0z" clipRule="evenodd" />
            </svg>
          </button>
          <div className="flex items-center gap-2 flex-1 min-w-0">
            {selectedThread.authorAvatar && (
              <img 
                src={selectedThread.authorAvatar} 
                alt={selectedThread.authorName}
                className="w-6 h-6 rounded-full"
              />
            )}
            <div className="flex-1 min-w-0">
              <h3 className="text-sm font-bold text-white truncate">
                {selectedThread.title}
              </h3>
              <div className="flex items-center gap-2 text-xs text-gray-400">
                <span>{selectedThread.authorName}</span>
                <span>•</span>
                <span>{formatTime(selectedThread.createdAt)}</span>
              </div>
            </div>
          </div>
          <div className="dropdown dropdown-end">
            <div tabIndex={0} role="button" className="btn btn-ghost btn-xs btn-circle">
              <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" viewBox="0 0 20 20" fill="currentColor">
                <path d="M6 10a2 2 0 11-4 0 2 2 0 014 0zM12 10a2 2 0 11-4 0 2 2 0 014 0zM16 12a2 2 0 100-4 2 2 0 000 4z" />
              </svg>
            </div>
            <ul tabIndex={0} className="dropdown-content z-[1] menu p-2 shadow bg-[#1a1a1a] rounded-box w-32 border border-white/10">
              <li><a onClick={() => onUpdateStatus(selectedThread.id, selectedThread.status === 'completed' ? 'open' : 'completed')}>
                {selectedThread.status === 'completed' ? '重新開啟' : '標記完成'}
              </a></li>
            </ul>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto p-4 custom-scrollbar">
          {selectedThread.content && selectedThread.content.trim() && (
            <div className="bg-white/5 rounded-lg p-3 mb-4">
              <p className="text-sm text-gray-200 whitespace-pre-wrap">{selectedThread.content}</p>
            </div>
          )}

          <div className="space-y-3">
            {selectedThread.comments.map((comment) => (
              <div key={comment.id} className="flex gap-2">
                {comment.avatar && (
                  <img 
                    src={comment.avatar} 
                    alt={comment.username}
                    className="w-8 h-8 rounded-full flex-shrink-0"
                  />
                )}
                <div className="flex-1 bg-black/20 rounded-lg p-2">
                  <div className="flex justify-between items-baseline mb-1">
                    <span className="text-xs font-bold text-gray-300">
                      {comment.username}
                    </span>
                    <span className="text-[10px] text-gray-500">{formatTime(comment.timestamp)}</span>
                  </div>
                  <p className="text-xs text-gray-300 whitespace-pre-wrap">{comment.content}</p>
                </div>
              </div>
            ))}
            <div ref={commentsEndRef} />
          </div>
        </div>

        <div className="p-3 border-t border-white/10 bg-[#151618]">
          <form onSubmit={handleAddComment} className="flex gap-2">
            <input
              type="text"
              placeholder="添加評論..."
              className="input input-sm input-bordered flex-1 bg-black/20"
              value={newComment}
              onChange={(e) => setNewComment(e.target.value)}
            />
            <button type="submit" className="btn btn-sm btn-primary btn-circle" disabled={!newComment.trim()}>
              <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" viewBox="0 0 20 20" fill="currentColor">
                <path fillRule="evenodd" d="M10.293 3.293a1 1 0 011.414 0l6 6a1 1 0 010 1.414l-6 6a1 1 0 01-1.414-1.414L14.586 11H3a1 1 0 110-2h11.586l-4.293-4.293a1 1 0 010-1.414z" clipRule="evenodd" />
              </svg>
            </button>
          </form>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full">
      <div className="p-3 border-b border-white/10 flex justify-between items-center bg-[#151618]">
        <h3 className="text-sm font-bold text-white">討論區</h3>
        <button onClick={() => setView('create')} className="btn btn-xs btn-primary gap-1">
          <svg xmlns="http://www.w3.org/2000/svg" className="h-3 w-3" viewBox="0 0 20 20" fill="currentColor">
            <path fillRule="evenodd" d="M10 3a1 1 0 011 1v5h5a1 1 0 110 2h-5v5a1 1 0 11-2 0v-5H4a1 1 0 110-2h5V4a1 1 0 011-1z" clipRule="evenodd" />
          </svg>
          新增
        </button>
      </div>
      <div className="flex-1 overflow-y-auto custom-scrollbar p-2 space-y-2">
        {threads.length === 0 ? (
          <div className="text-center text-gray-500 mt-10 text-sm">
            還沒有討論<br/>來開始一個吧！
          </div>
        ) : (
          threads.map((thread) => (
            <div 
              key={thread.id} 
              onClick={() => { setSelectedThreadId(thread.id); setView('detail'); }}
              className={`p-3 rounded-lg cursor-pointer transition-colors border border-white/5 hover:border-white/10 ${
                thread.status === 'completed' ? 'bg-green-900/10 opacity-70' : 'bg-white/5 hover:bg-white/10'
              }`}
            >
              <div className="flex justify-between items-start mb-1">
                <h4 className={`text-sm font-medium line-clamp-1 flex-1 ${thread.status === 'completed' ? 'text-gray-400 line-through' : 'text-white'}`}>
                  {thread.title}
                </h4>
                {thread.status === 'completed' && (
                  <span className="badge badge-xs badge-success badge-outline">完成</span>
                )}
              </div>
              {thread.content && thread.content.trim() && (
                <p className="text-xs text-gray-400 line-clamp-2 mb-2">{thread.content}</p>
              )}
              <div className="flex justify-between items-center text-[10px] text-gray-500">
                <span>{thread.authorName}</span>
                <div className="flex items-center gap-2">
                  <span>{thread.comments.length} 則留言</span>
                  <span>{formatTime(thread.updatedAt)}</span>
                </div>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
};

export default Forum;
