import { useState, useEffect } from 'react';
import { optimizeAvatarUrl, avatarSizes } from '../utils/imageOptimizer';

export interface Companion {
  id: string;
  name: string;
  avatar: string;
  style: string;
  catchphrase_1?: string;
  catchphrase_2?: string;
  voice: string;
}

const AICompanionManager = () => {
  const [companions, setCompanions] = useState<Companion[]>([]);
  const [presetCompanions, setPresetCompanions] = useState<Companion[]>([]);
  const [customCompanions, setCustomCompanions] = useState<Companion[]>([]);
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [isDetailModalOpen, setIsDetailModalOpen] = useState(false);
  const [selectedCompanion, setSelectedCompanion] = useState<Companion | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isGenerating, setIsGenerating] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  
  // Form state for creation
  const [createPrompt, setCreatePrompt] = useState('');
  
  // Form state for editing
  const [editForm, setEditForm] = useState({
    name: '',
    style: '',
    catchphrase_1: '',
    catchphrase_2: ''
  });

  // Fetch preset companions from server
  useEffect(() => {
    const fetchPresets = async () => {
      try {
        const response = await fetch(`${import.meta.env.VITE_API_URL}/api/ai/presets`);
        if (response.ok) {
          const data = await response.json();
          const presets = data.map((c: any, index: number) => ({
            id: `preset-${index}`,
            name: c.name,
            avatar: c.avatar,
            style: c.style,
            catchphrase_1: c.catchphrase_1,
            catchphrase_2: c.catchphrase_2,
            voice: 'default'
          }));
          setPresetCompanions(presets);
        } else {
          console.error('Failed to fetch preset companions, status:', response.status);
        }
      } catch (e) {
        console.error('Failed to fetch preset companions', e);
      } finally {
        setIsLoading(false);
      }
    };
    fetchPresets();
  }, []);

  // Load custom companions from localStorage
  useEffect(() => {
    const saved = localStorage.getItem('my_custom_companions');
    if (saved) {
      try {
        const custom = JSON.parse(saved);
        setCustomCompanions(custom);
      } catch (e) {
        console.error('Failed to parse custom companions', e);
      }
    }
  }, []);

  // Combine preset and custom companions
  useEffect(() => {
    setCompanions([...presetCompanions, ...customCompanions]);
  }, [presetCompanions, customCompanions]);

  const saveCustomCompanions = (newCustomCompanions: Companion[]) => {
    setCustomCompanions(newCustomCompanions);
    localStorage.setItem('my_custom_companions', JSON.stringify(newCustomCompanions));
  };

  const handleCreateNew = () => {
    setCreatePrompt('');
    setIsCreateModalOpen(true);
  };

  const handleViewDetails = (companion: Companion) => {
    setSelectedCompanion(companion);
    setEditForm({
      name: companion.name,
      style: companion.style,
      catchphrase_1: companion.catchphrase_1 || '',
      catchphrase_2: companion.catchphrase_2 || ''
    });
    setIsEditing(false);
    setIsDetailModalOpen(true);
  };

  const handleDelete = (id: string) => {
    // Only allow deleting custom companions
    if (id.startsWith('preset-')) {
      alert('預設夥伴無法刪除');
      return;
    }
    if (confirm('確定要刪除這位夥伴嗎？')) {
      saveCustomCompanions(customCompanions.filter(c => c.id !== id));
    }
  };

  const handleStartEdit = () => {
    if (selectedCompanion && !selectedCompanion?.id?.startsWith('preset-')) {
      setIsEditing(true);
    }
  };

  const handleCancelEdit = () => {
    if (selectedCompanion) {
      setEditForm({
        name: selectedCompanion.name,
        style: selectedCompanion.style,
        catchphrase_1: selectedCompanion.catchphrase_1 || '',
        catchphrase_2: selectedCompanion.catchphrase_2 || ''
      });
    }
    setIsEditing(false);
  };

  const handleSaveEdit = () => {
    if (!selectedCompanion || !editForm.name.trim() || !editForm.style.trim()) {
      alert('請填寫名稱和風格');
      return;
    }

    const updatedCompanions = customCompanions.map(c => 
      c.id === selectedCompanion.id 
        ? { ...c, name: editForm.name, style: editForm.style, catchphrase_1: editForm.catchphrase_1 || undefined, catchphrase_2: editForm.catchphrase_2 || undefined }
        : c
    );
    
    saveCustomCompanions(updatedCompanions);
    setSelectedCompanion({ ...selectedCompanion, name: editForm.name, style: editForm.style, catchphrase_1: editForm.catchphrase_1 || undefined, catchphrase_2: editForm.catchphrase_2 || undefined });
    setIsEditing(false);
  };

  const handleGenerateCompanion = async () => {
    if (!createPrompt.trim()) return;

    setIsGenerating(true);
    try {
      const response = await fetch(`${import.meta.env.VITE_API_URL}/api/ai/generate`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ prompt: createPrompt }),
      });

      if (response.ok) {
        const generatedCompanion = await response.json();
        const newCompanion: Companion = {
          id: `custom-${Date.now()}`,
          name: generatedCompanion.name,
          avatar: generatedCompanion.avatar,
          style: generatedCompanion.style,
          catchphrase_1: generatedCompanion.catchphrase_1,
          catchphrase_2: generatedCompanion.catchphrase_2,
          voice: 'default'
        };
        saveCustomCompanions([...customCompanions, newCompanion]);
        setIsCreateModalOpen(false);
        setCreatePrompt('');
      } else {
        alert('生成失敗，請稍後再試');
      }
    } catch (error) {
      console.error('Failed to generate companion:', error);
      alert('生成失敗，請檢查網路連線');
    } finally {
      setIsGenerating(false);
    }
  };

  return (
    <div className="w-full h-screen max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12 border-t border-white/10 flex flex-col pt-24">
      <div className="flex items-center justify-between mb-8 shrink-0">
        <div>
          <h2 className="text-3xl font-bold text-white">我的智慧影伴</h2>
          <p className="text-gray-400 mt-1">管理您的專屬 AI 夥伴，自定義他們的個性與外觀</p>
        </div>
        <button 
          onClick={handleCreateNew}
          className="px-4 py-2 bg-purple-600 hover:bg-purple-500 text-white rounded-lg transition-colors flex items-center gap-2 shadow-lg shadow-purple-900/20"
        >
          <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className="w-5 h-5">
            <path fillRule="evenodd" d="M12 3.75a.75.75 0 0 1 .75.75v6.75h6.75a.75.75 0 0 1 0 1.5h-6.75v6.75a.75.75 0 0 1-1.5 0v-6.75H4.5a.75.75 0 0 1 0-1.5h6.75V4.5a.75.75 0 0 1 .75-.75Z" clipRule="evenodd" />
          </svg>
          創建新夥伴
        </button>
      </div>

      <div className="flex-1 overflow-y-auto custom-scrollbar pr-2">
        {isLoading ? (
          <div className="text-center py-12 bg-white/5 rounded-2xl border border-white/5">
            <span className="loading loading-spinner loading-lg text-purple-500"></span>
            <p className="text-gray-500 mt-4">正在載入智慧影伴...</p>
          </div>
        ) : companions.length === 0 ? (
          <div className="text-center py-12 bg-white/5 rounded-2xl border border-white/5 border-dashed">
            <p className="text-gray-500">目前還沒有任何夥伴，點擊上方按鈕創建一個吧！</p>
          </div>
        ) : (
          <div className="space-y-8 pb-8">
            {/* Preset Companions Section */}
            {presetCompanions.length > 0 && (
              <div>
                <h3 className="text-lg font-bold text-white mb-4 flex items-center gap-2">
                  <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className="w-5 h-5 text-purple-400">
                    <path fillRule="evenodd" d="M10.788 3.21c.448-1.077 1.976-1.077 2.424 0l2.082 5.006 5.404.434c1.164.093 1.636 1.545.749 2.305l-4.117 3.527 1.257 5.273c.271 1.136-.964 2.033-1.96 1.425L12 18.354 7.373 21.18c-.996.608-2.231-.29-1.96-1.425l1.257-5.273-4.117-3.527c-.887-.76-.415-2.212.749-2.305l5.404-.434 2.082-5.005Z" clipRule="evenodd" />
                  </svg>
                  預設智慧影伴
                  <span className="text-xs font-normal text-gray-500">({presetCompanions.length})</span>
                </h3>
                <div className="grid grid-cols-3 md:grid-cols-5 lg:grid-cols-6 xl:grid-cols-8 gap-4">
                  {presetCompanions.map((companion) => (
                    <button
                      key={companion.id}
                      onClick={() => handleViewDetails(companion)}
                      className="flex flex-col items-center gap-2 p-3 bg-[#1a1a1a] rounded-xl border border-white/5 hover:border-purple-500/50 transition-all group hover:scale-105 cursor-pointer"
                    >
                      <div className="relative w-16 h-16 rounded-full bg-gray-800 overflow-hidden border-2 border-white/10 group-hover:border-purple-500/50 transition-colors">
                        <img src={optimizeAvatarUrl(companion.avatar, avatarSizes.thumbnail)} alt={companion.name} loading="lazy" className="w-full h-full object-cover" />
                      </div>
                      <span className="text-xs font-medium text-white truncate w-full text-center">{companion.name}</span>
                    </button>
                  ))}
                </div>
              </div>
            )}

            {/* Custom Companions Section */}
            {customCompanions.length > 0 && (
              <div>
                <h3 className="text-lg font-bold text-white mb-4 flex items-center gap-2">
                  <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className="w-5 h-5 text-blue-400">
                    <path d="M21.731 2.269a2.625 2.625 0 0 0-3.712 0l-1.157 1.157 3.712 3.712 1.157-1.157a2.625 2.625 0 0 0 0-3.712ZM19.513 8.199l-3.712-3.712-8.4 8.4a5.25 5.25 0 0 0-1.32 2.214l-.8 2.685a.75.75 0 0 0 .933.933l2.685-.8a5.25 5.25 0 0 0 2.214-1.32l8.4-8.4Z" />
                    <path d="M5.25 5.25a3 3 0 0 0-3 3v10.5a3 3 0 0 0 3 3h10.5a3 3 0 0 0 3-3V13.5a.75.75 0 0 0-1.5 0v5.25a1.5 1.5 0 0 1-1.5 1.5H5.25a1.5 1.5 0 0 1-1.5-1.5V8.25a1.5 1.5 0 0 1 1.5-1.5h5.25a.75.75 0 0 0 0-1.5H5.25Z" />
                  </svg>
                  我的自訂影伴
                  <span className="text-xs font-normal text-gray-500">({customCompanions.length})</span>
                </h3>
                <div className="grid grid-cols-3 md:grid-cols-5 lg:grid-cols-6 xl:grid-cols-8 gap-4">
                  {customCompanions.map((companion) => (
                    <div key={companion.id} className="relative group">
                      <button
                        onClick={() => handleViewDetails(companion)}
                        className="w-full flex flex-col items-center gap-2 p-3 bg-[#1a1a1a] rounded-xl border border-white/5 hover:border-blue-500/50 transition-all group-hover:scale-105 cursor-pointer"
                      >
                        <div className="relative w-16 h-16 rounded-full bg-gray-800 overflow-hidden border-2 border-white/10 group-hover:border-blue-500/50 transition-colors">
                          <img src={optimizeAvatarUrl(companion.avatar, avatarSizes.thumbnail)} alt={companion.name} loading="lazy" className="w-full h-full object-cover" />
                        </div>
                        <span className="text-xs font-medium text-white truncate w-full text-center">{companion.name}</span>
                      </button>
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          handleDelete(companion.id);
                        }}
                        className="absolute -top-2 -right-2 w-6 h-6 bg-red-500 hover:bg-red-600 rounded-full flex items-center justify-center opacity-0 group-hover:opacity-100 transition-all shadow-lg"
                        title="刪除"
                      >
                        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="w-4 h-4 text-white">
                          <path d="M6.28 5.22a.75.75 0 0 0-1.06 1.06L8.94 10l-3.72 3.72a.75.75 0 1 0 1.06 1.06L10 11.06l3.72 3.72a.75.75 0 1 0 1.06-1.06L11.06 10l3.72-3.72a.75.75 0 0 0-1.06-1.06L10 8.94 6.28 5.22Z" />
                        </svg>
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Create Modal */}
      {isCreateModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-fade-in">
          <div className="bg-[#1a1a1a] rounded-2xl w-full max-w-md overflow-hidden border border-white/10 shadow-2xl">
            <div className="p-6 border-b border-white/5">
              <h3 className="text-xl font-bold text-white">創建新夥伴</h3>
              <p className="text-sm text-gray-400 mt-1">描述你想要的夥伴，AI 會為你生成</p>
            </div>
            
            <div className="p-6 space-y-4">
              <div className="space-y-2">
                <label className="text-xs font-bold text-gray-500 uppercase">描述你的夥伴</label>
                <textarea
                  value={createPrompt}
                  onChange={(e) => setCreatePrompt(e.target.value)}
                  placeholder="例如：一個活潑開朗的高中生，喜歡看動作電影..."
                  rows={4}
                  className="w-full bg-black/20 border border-white/10 rounded-lg px-4 py-3 text-white placeholder-gray-600 focus:outline-none focus:border-purple-500 resize-none"
                  disabled={isGenerating}
                />
              </div>

              <div className="bg-purple-500/10 border border-purple-500/20 rounded-lg p-3">
                <p className="text-xs text-purple-300">
                  💡 提示：描述得越詳細，生成的角色會越符合你的期待！
                </p>
              </div>
            </div>

            <div className="p-6 pt-0 flex gap-3">
              <button 
                onClick={() => setIsCreateModalOpen(false)}
                className="flex-1 px-4 py-2 rounded-lg font-medium text-gray-400 hover:bg-white/5 hover:text-white transition-colors"
                disabled={isGenerating}
              >
                取消
              </button>
              <button 
                onClick={handleGenerateCompanion}
                disabled={!createPrompt.trim() || isGenerating}
                className="flex-1 px-4 py-2 rounded-lg font-bold text-white bg-purple-600 hover:bg-purple-500 disabled:opacity-50 disabled:cursor-not-allowed transition-colors flex items-center justify-center gap-2"
              >
                {isGenerating ? (
                  <>
                    <span className="loading loading-spinner loading-sm"></span>
                    生成中...
                  </>
                ) : (
                  '生成夥伴'
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Detail Modal */}
      {isDetailModalOpen && selectedCompanion && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-fade-in">
          <div className="bg-[#1a1a1a] rounded-2xl w-full max-w-md overflow-hidden border border-white/10 shadow-2xl">
            <div className="p-6 border-b border-white/5 bg-gradient-to-r from-purple-900/20 to-blue-900/20">
              <div className="flex items-center gap-4">
                <div className="relative w-20 h-20 rounded-full bg-gray-800 overflow-hidden border-2 border-white/10">
                  <img src={optimizeAvatarUrl(selectedCompanion.avatar, avatarSizes.small)} alt={selectedCompanion.name} loading="lazy" className="w-full h-full object-cover" />
                </div>
                <div className="flex-1">
                  <h3 className="text-2xl font-bold text-white">{selectedCompanion.name}</h3>
                  {selectedCompanion?.id?.startsWith('preset-') ? (
                    <span className="inline-block px-2 py-1 bg-purple-500/20 text-purple-300 text-xs font-bold rounded-full border border-purple-500/30 mt-1">
                      預設影伴
                    </span>
                  ) : (
                    <span className="inline-block px-2 py-1 bg-blue-500/20 text-blue-300 text-xs font-bold rounded-full border border-blue-500/30 mt-1">
                      自訂影伴
                    </span>
                  )}
                </div>
              </div>
            </div>
            
            <div className="p-6 space-y-4">
              <div className="space-y-2">
                <h4 className="text-xs font-bold text-gray-500 uppercase flex items-center gap-2">
                  <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="w-4 h-4">
                    <path d="M10 8a3 3 0 1 0 0-6 3 3 0 0 0 0 6ZM3.465 14.493a1.23 1.23 0 0 0 .41 1.412A9.957 9.957 0 0 0 10 18c2.31 0 4.438-.784 6.131-2.1.43-.333.604-.903.408-1.41a7.002 7.002 0 0 0-13.074.003Z" />
                  </svg>
                  名稱
                </h4>
                {isEditing ? (
                  <input
                    type="text"
                    value={editForm.name}
                    onChange={(e) => setEditForm({ ...editForm, name: e.target.value })}
                    className="w-full bg-black/20 border border-white/10 rounded-lg px-4 py-2 text-white placeholder-gray-600 focus:outline-none focus:border-blue-500"
                    placeholder="輸入名稱"
                  />
                ) : (
                  <p className="text-sm text-gray-300 bg-white/5 p-3 rounded-lg border border-white/5">
                    {selectedCompanion.name}
                  </p>
                )}
              </div>

              <div className="space-y-2">
                <h4 className="text-xs font-bold text-gray-500 uppercase flex items-center gap-2">
                  <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="w-4 h-4">
                    <path d="M10 9a3 3 0 1 0 0-6 3 3 0 0 0 0 6ZM6 8a2 2 0 1 1-4 0 2 2 0 0 1 4 0ZM1.49 15.326a.78.78 0 0 1-.358-.442 3 3 0 0 1 4.308-3.516 6.484 6.484 0 0 0-1.905 3.959c-.023.222-.014.442.025.654a4.97 4.97 0 0 1-2.07-.655ZM16.44 15.98a4.97 4.97 0 0 0 2.07-.654.78.78 0 0 0 .357-.442 3 3 0 0 0-4.308-3.517 6.484 6.484 0 0 1 1.907 3.96 2.32 2.32 0 0 1-.026.654ZM18 8a2 2 0 1 1-4 0 2 2 0 0 1 4 0ZM5.304 16.19a.844.844 0 0 1-.277-.71 5 5 0 0 1 9.947 0 .843.843 0 0 1-.277.71A6.975 6.975 0 0 1 10 18a6.974 6.974 0 0 1-4.696-1.81Z" />
                  </svg>
                  風格特質
                </h4>
                {isEditing ? (
                  <textarea
                    value={editForm.style}
                    onChange={(e) => setEditForm({ ...editForm, style: e.target.value })}
                    rows={3}
                    className="w-full bg-black/20 border border-white/10 rounded-lg px-4 py-3 text-white placeholder-gray-600 focus:outline-none focus:border-blue-500 resize-none"
                    placeholder="描述風格特質"
                  />
                ) : (
                  <p className="text-sm text-gray-300 bg-white/5 p-3 rounded-lg border border-white/5">
                    {selectedCompanion.style}
                  </p>
                )}
              </div>

              <div className="space-y-2">
                <h4 className="text-xs font-bold text-gray-500 uppercase flex items-center gap-2">
                  <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="w-4 h-4">
                    <path fillRule="evenodd" d="M10 18a8 8 0 1 0 0-16 8 8 0 0 0 0 16Zm.75-13a.75.75 0 0 0-1.5 0v5c0 .414.336.75.75.75h4a.75.75 0 0 0 0-1.5h-3.25V5Z" clipRule="evenodd" />
                  </svg>
                  口頭禪 1{isEditing && !selectedCompanion?.id?.startsWith('preset-') ? ' (可選)' : ''}
                </h4>
                {isEditing ? (
                  <textarea
                    value={editForm.catchphrase_1}
                    onChange={(e) => setEditForm({ ...editForm, catchphrase_1: e.target.value })}
                    rows={2}
                    className="w-full bg-black/20 border border-white/10 rounded-lg px-4 py-3 text-white placeholder-gray-600 focus:outline-none focus:border-blue-500 resize-none"
                    placeholder="第一句經典語錄"
                  />
                ) : (
                  selectedCompanion.catchphrase_1 && (
                    <p className="text-sm text-gray-300 bg-white/5 p-3 rounded-lg border border-white/5">
                      {selectedCompanion.catchphrase_1}
                    </p>
                  )
                )}
              </div>
              
              <div className="space-y-2">
                <h4 className="text-xs font-bold text-gray-500 uppercase flex items-center gap-2">
                  <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="w-4 h-4">
                    <path fillRule="evenodd" d="M10 18a8 8 0 1 0 0-16 8 8 0 0 0 0 16Zm.75-13a.75.75 0 0 0-1.5 0v5c0 .414.336.75.75.75h4a.75.75 0 0 0 0-1.5h-3.25V5Z" clipRule="evenodd" />
                  </svg>
                  口頭禪 2{isEditing && !selectedCompanion?.id?.startsWith('preset-') ? ' (可選)' : ''}
                </h4>
                {isEditing ? (
                  <textarea
                    value={editForm.catchphrase_2}
                    onChange={(e) => setEditForm({ ...editForm, catchphrase_2: e.target.value })}
                    rows={2}
                    className="w-full bg-black/20 border border-white/10 rounded-lg px-4 py-3 text-white placeholder-gray-600 focus:outline-none focus:border-blue-500 resize-none"
                    placeholder="第二句經典語錄"
                  />
                ) : (
                  selectedCompanion.catchphrase_2 && (
                    <p className="text-sm text-gray-300 bg-white/5 p-3 rounded-lg border border-white/5">
                      {selectedCompanion.catchphrase_2}
                    </p>
                  )
                )}
              </div>
            </div>

            <div className="p-6 pt-0">
              {isEditing ? (
                <div className="flex gap-3">
                  <button 
                    onClick={handleCancelEdit}
                    className="flex-1 px-4 py-2 rounded-lg font-medium text-gray-400 bg-white/5 hover:bg-white/10 hover:text-white transition-colors"
                  >
                    取消
                  </button>
                  <button 
                    onClick={handleSaveEdit}
                    className="flex-1 px-4 py-2 rounded-lg font-bold text-white bg-blue-600 hover:bg-blue-500 transition-colors"
                  >
                    儲存變更
                  </button>
                </div>
              ) : (
                <div className="flex gap-3">
                  <button 
                    onClick={() => setIsDetailModalOpen(false)}
                    className="flex-1 px-4 py-2 rounded-lg font-medium text-white bg-white/10 hover:bg-white/20 transition-colors"
                  >
                    關閉
                  </button>
                  {!selectedCompanion?.id?.startsWith('preset-') && (
                    <button 
                      onClick={handleStartEdit}
                      className="flex-1 px-4 py-2 rounded-lg font-medium text-white bg-blue-600 hover:bg-blue-500 transition-colors flex items-center justify-center gap-2"
                    >
                      <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="w-4 h-4">
                        <path d="m5.433 13.917 1.262-3.155A4 4 0 0 1 7.58 9.42l6.92-6.918a2.121 2.121 0 0 1 3 3l-6.92 6.918c-.383.383-.84.685-1.343.886l-3.154 1.262a.5.5 0 0 1-.65-.65Z" />
                        <path d="M3.5 5.75c0-.69.56-1.25 1.25-1.25H10A.75.75 0 0 0 10 3H4.75A2.75 2.75 0 0 0 2 5.75v9.5A2.75 2.75 0 0 0 4.75 18h9.5A2.75 2.75 0 0 0 17 15.25V10a.75.75 0 0 0-1.5 0v5.25c0 .69-.56 1.25-1.25 1.25h-9.5c-.69 0-1.25-.56-1.25-1.25v-9.5Z" />
                      </svg>
                      編輯
                    </button>
                  )}
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default AICompanionManager;