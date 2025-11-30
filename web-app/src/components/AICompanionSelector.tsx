import { useState, useEffect } from 'react';
import type { AICompanion } from '../types';

interface Props {
  onSelect: (companions: AICompanion[]) => void;
}

const ITEMS_PER_PAGE = 50;

const AICompanionSelector = ({ onSelect }: Props) => {
  const [presets, setPresets] = useState<AICompanion[]>([]);
  const [customCompanions, setCustomCompanions] = useState<AICompanion[]>([]);
  const [selectedCompanions, setSelectedCompanions] = useState<AICompanion[]>([]);
  const [currentPage, setCurrentPage] = useState(1);
  const [selectedCategory, setSelectedCategory] = useState<string>('全部');
  
  // Custom Generation State
  const [showCustomModal, setShowCustomModal] = useState(false);
  const [customPrompt, setCustomPrompt] = useState('');
  const [generatedCompanion, setGeneratedCompanion] = useState<AICompanion | null>(null);
  const [loading, setLoading] = useState(false);

  // Detail View State
  const [viewingCompanion, setViewingCompanion] = useState<AICompanion | null>(null);

  useEffect(() => {
    fetchPresets();
  }, []);

  const fetchPresets = async () => {
    try {
      const res = await fetch(`${import.meta.env.VITE_API_URL}/api/ai/presets`);
      if (res.ok) {
        const data = await res.json();
        setPresets(data);
      }
    } catch (err) {
      console.error(err);
    }
  };

  const toggleSelection = (companion: AICompanion) => {
    const isSelected = selectedCompanions.some(c => c.name === companion.name);
    let newSelection: AICompanion[];
    
    if (isSelected) {
      newSelection = selectedCompanions.filter(c => c.name !== companion.name);
    } else {
      // No limit on selection here, room limit is handled in parent
      newSelection = [...selectedCompanions, companion];
    }
    
    setSelectedCompanions(newSelection);
    onSelect(newSelection);
  };

  const generateCompanion = async () => {
    if (!customPrompt.trim()) return;
    setLoading(true);
    try {
      const res = await fetch(`${import.meta.env.VITE_API_URL}/api/ai/generate`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ prompt: customPrompt })
      });
      if (res.ok) {
        const data = await res.json();
        setGeneratedCompanion(data);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const handleAddGenerated = () => {
    if (generatedCompanion) {
      // Add to custom list
      const newCompanion = { ...generatedCompanion, category: '自訂' };
      setCustomCompanions(prev => [newCompanion, ...prev]);
      
      // Auto select
      toggleSelection(newCompanion);
      
      // Reset modal
      setShowCustomModal(false);
      setGeneratedCompanion(null);
      setCustomPrompt('');
      
      // Switch to '自訂' or '全部' category to see the new item
      if (selectedCategory !== '全部' && selectedCategory !== '自訂') {
        setSelectedCategory('自訂');
      }
    }
  };

  // Combine presets and custom companions
  const allCompanions = [...customCompanions, ...presets];
  
  // Filter by category
  const categories = ['全部', '自訂', ...Array.from(new Set(presets.map(p => p.category || '其他')))];
  const filteredCompanions = selectedCategory === '全部' 
    ? allCompanions 
    : allCompanions.filter(c => (c.category || '其他') === selectedCategory);

  // Pagination
  const totalPages = Math.ceil((filteredCompanions.length + 1) / ITEMS_PER_PAGE); // +1 for the "Create New" button
  const startIndex = (currentPage - 1) * ITEMS_PER_PAGE;
  
  // We need to handle the "Create New" button as the first item in the grid
  // So we adjust the slicing logic
  const displayItems = filteredCompanions.slice(
    Math.max(0, startIndex - 1), // Adjust for the button taking up slot 0
    startIndex + ITEMS_PER_PAGE - 1
  );

  return (
    <div className="space-y-4">
      {/* Header & Filter */}
      <div className="flex flex-col gap-4">
      <div className="flex justify-between items-center px-2">
        <h3 className="text-gray-400 text-sm">
          已選擇 {selectedCompanions.length} 位智慧影伴
        </h3>
      </div>        {/* Categories */}
        <div className="flex gap-2 overflow-x-auto pb-2 scrollbar-hide">
          {categories.map(cat => (
            <button
              key={cat}
              onClick={() => {
                setSelectedCategory(cat);
                setCurrentPage(1);
              }}
              className={`px-3 py-1.5 rounded-full text-xs font-medium whitespace-nowrap transition-colors ${
                selectedCategory === cat
                  ? 'bg-purple-500 text-white'
                  : 'bg-white/5 text-gray-400 hover:bg-white/10'
              }`}
            >
              {cat}
            </button>
          ))}
        </div>
      </div>

      {/* Grid */}
      <div className="grid grid-cols-5 sm:grid-cols-8 md:grid-cols-10 lg:grid-cols-12 gap-2">
        {/* Create New Card - Only show on first page */}
        {currentPage === 1 && (
          <div 
            onClick={() => setShowCustomModal(true)}
            className="aspect-square rounded-xl border-2 border-dashed border-white/20 bg-white/5 hover:bg-white/10 hover:border-purple-500/50 cursor-pointer transition-all flex flex-col items-center justify-center gap-2 group"
          >
            <div className="w-10 h-10 rounded-full bg-purple-500/20 flex items-center justify-center group-hover:scale-110 transition-transform">
              <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className="w-5 h-5 text-purple-400">
                <path fillRule="evenodd" d="M12 3.75a.75.75 0 0 1 .75.75v6.75h6.75a.75.75 0 0 1 0 1.5h-6.75v6.75a.75.75 0 0 1-1.5 0v-6.75H4.5a.75.75 0 0 1 0-1.5h6.75V4.5a.75.75 0 0 1 .75-.75Z" clipRule="evenodd" />
              </svg>
            </div>
            <span className="text-xs font-medium text-gray-400 group-hover:text-white">自訂生成</span>
          </div>
        )}

        {displayItems.map((companion) => {
          const isSelected = selectedCompanions.some(c => c.name === companion.name);
          return (
            <div 
              key={companion.name}
              className="flex flex-col gap-1 group cursor-pointer"
              onClick={() => setViewingCompanion(companion)}
            >
              <div className={`relative aspect-square rounded-xl overflow-hidden border-2 transition-all ${
                isSelected 
                  ? 'border-purple-500 shadow-[0_0_15px_rgba(168,85,247,0.3)]' 
                  : 'border-transparent hover:border-white/20'
              }`}>
                <img 
                  src={companion.avatar} 
                  alt={companion.name}
                  className="w-full h-full object-cover bg-white/5"
                />
                
                {/* Selection Indicator */}
                {isSelected && (
                  <div className="absolute top-1 right-1 w-5 h-5 bg-purple-500 rounded-full flex items-center justify-center shadow-lg">
                    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="w-3 h-3 text-white">
                      <path fillRule="evenodd" d="M16.704 4.153a.75.75 0 0 1 .143 1.052l-8 10.5a.75.75 0 0 1-1.127.075l-4.5-4.5a.75.75 0 0 1 1.06-1.06l3.894 3.893 7.48-9.817a.75.75 0 0 1 1.05-.143Z" clipRule="evenodd" />
                    </svg>
                  </div>
                )}
              </div>
              <span className="text-[10px] text-center text-gray-400 group-hover:text-white truncate px-1">
                {companion.name}
              </span>
            </div>
          );
        })}
      </div>

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex justify-center gap-2 mt-4">
          <button
            onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
            disabled={currentPage === 1}
            className="p-1.5 rounded-lg bg-white/5 hover:bg-white/10 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
          >
            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="w-4 h-4 text-gray-300">
              <path fillRule="evenodd" d="M11.78 5.22a.75.75 0 0 1 0 1.06L8.06 10l3.72 3.72a.75.75 0 1 1-1.06 1.06l-4.25-4.25a.75.75 0 0 1 0-1.06l4.25-4.25a.75.75 0 0 1 1.06 0Z" clipRule="evenodd" />
            </svg>
          </button>
          <span className="text-sm text-gray-400 flex items-center px-2">
            {currentPage} / {totalPages}
          </span>
          <button
            onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
            disabled={currentPage === totalPages}
            className="p-1.5 rounded-lg bg-white/5 hover:bg-white/10 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
          >
            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="w-4 h-4 text-gray-300">
              <path fillRule="evenodd" d="M8.22 5.22a.75.75 0 0 1 1.06 0l4.25 4.25a.75.75 0 0 1 0 1.06l-4.25 4.25a.75.75 0 0 1-1.06-1.06L11.94 10 8.22 6.28a.75.75 0 0 1 0-1.06Z" clipRule="evenodd" />
            </svg>
          </button>
        </div>
      )}

      {/* Custom Generation Modal */}
      {showCustomModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm">
          <div className="bg-[#1a1b26] rounded-2xl p-6 w-full max-w-md border border-white/10 shadow-2xl">
            <h3 className="text-lg font-bold text-white mb-4">自訂智慧影伴</h3>
            
            {!generatedCompanion ? (
              <div className="space-y-4">
                <div>
                  <label className="block text-sm text-gray-400 mb-2">描述你想創造的角色</label>
                  <textarea
                    value={customPrompt}
                    onChange={(e) => setCustomPrompt(e.target.value)}
                    placeholder="例如：一個喜歡講冷笑話的古代劍客..."
                    className="w-full h-32 bg-black/20 border border-white/10 rounded-xl p-3 text-white placeholder-gray-500 focus:outline-none focus:border-purple-500/50 resize-none"
                  />
                </div>
                <div className="flex gap-3">
                  <button
                    onClick={() => setShowCustomModal(false)}
                    className="flex-1 py-2.5 rounded-xl bg-white/5 text-gray-300 hover:bg-white/10 transition-colors"
                  >
                    取消
                  </button>
                  <button
                    onClick={generateCompanion}
                    disabled={loading || !customPrompt.trim()}
                    className="flex-1 py-2.5 rounded-xl bg-purple-600 text-white hover:bg-purple-500 disabled:opacity-50 disabled:cursor-not-allowed transition-colors flex items-center justify-center gap-2"
                  >
                    {loading ? (
                      <>
                        <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                        生成中...
                      </>
                    ) : (
                      '開始生成'
                    )}
                  </button>
                </div>
              </div>
            ) : (
              <div className="space-y-6">
                <div className="flex flex-col items-center gap-4">
                  <div className="w-24 h-24 rounded-full overflow-hidden border-4 border-purple-500/30">
                    <img src={generatedCompanion.avatar} alt={generatedCompanion.name} className="w-full h-full object-cover bg-white/5" />
                  </div>
                  <div className="text-center">
                    <h4 className="text-xl font-bold text-white">{generatedCompanion.name}</h4>
                    <p className="text-sm text-gray-400 mt-1">{generatedCompanion.personality}</p>
                  </div>
                  <div className="bg-white/5 rounded-xl p-3 text-sm text-gray-300 w-full">
                    {generatedCompanion.background}
                  </div>
                </div>
                <div className="flex gap-3">
                  <button
                    onClick={() => setGeneratedCompanion(null)}
                    className="flex-1 py-2.5 rounded-xl bg-white/5 text-gray-300 hover:bg-white/10 transition-colors"
                  >
                    重新生成
                  </button>
                  <button
                    onClick={handleAddGenerated}
                    className="flex-1 py-2.5 rounded-xl bg-purple-600 text-white hover:bg-purple-500 transition-colors"
                  >
                    確認加入
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Detail View Modal */}
      {viewingCompanion && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm" onClick={() => setViewingCompanion(null)}>
          <div className="bg-[#1a1b26] rounded-2xl p-6 w-full max-w-sm border border-white/10 shadow-2xl" onClick={e => e.stopPropagation()}>
            <div className="flex flex-col items-center gap-4">
              <div className="w-24 h-24 rounded-full overflow-hidden border-4 border-purple-500/30">
                <img src={viewingCompanion.avatar} alt={viewingCompanion.name} className="w-full h-full object-cover bg-white/5" />
              </div>
              <div className="text-center">
                <h4 className="text-xl font-bold text-white">{viewingCompanion.name}</h4>
                <span className="inline-block mt-2 px-2 py-0.5 rounded-full bg-white/10 text-xs text-gray-400">
                  {viewingCompanion.category || '其他'}
                </span>
              </div>
              
              <div className="w-full space-y-3">
                <div>
                  <label className="text-xs text-gray-500 uppercase font-bold tracking-wider">個性</label>
                  <p className="text-sm text-gray-300 mt-1">{viewingCompanion.personality}</p>
                </div>
                <div>
                  <label className="text-xs text-gray-500 uppercase font-bold tracking-wider">背景</label>
                  <p className="text-sm text-gray-300 mt-1">{viewingCompanion.background}</p>
                </div>
              </div>

              <div className="flex gap-3 w-full mt-2">
                <button
                  onClick={() => setViewingCompanion(null)}
                  className="flex-1 py-2.5 rounded-xl bg-white/5 text-gray-300 hover:bg-white/10 transition-colors"
                >
                  關閉
                </button>
                <button
                  onClick={() => {
                    if (viewingCompanion) {
                      toggleSelection(viewingCompanion);
                      setViewingCompanion(null);
                    }
                  }}
                  className={`flex-1 py-2.5 rounded-xl text-white transition-colors ${
                    selectedCompanions.some(c => c.name === viewingCompanion?.name)
                      ? 'bg-red-500/80 hover:bg-red-500'
                      : 'bg-purple-600 hover:bg-purple-500'
                  }`}
                >
                  {selectedCompanions.some(c => c.name === viewingCompanion?.name) ? '移除' : '加入'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default AICompanionSelector;
