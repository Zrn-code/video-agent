import { useState, useEffect } from 'react';
import type { AICompanion } from '../types';

interface Props {
  onSelect: (companion: AICompanion | null) => void;
}

const AICompanionSelector = ({ onSelect }: Props) => {
  const [mode, setMode] = useState<'preset' | 'custom'>('preset');
  const [presets, setPresets] = useState<AICompanion[]>([]);
  const [customPrompt, setCustomPrompt] = useState('');
  const [generatedCompanion, setGeneratedCompanion] = useState<AICompanion | null>(null);
  const [selectedCompanion, setSelectedCompanion] = useState<AICompanion | null>(null);
  const [loading, setLoading] = useState(false);

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
        handleSelect(data);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const handleSelect = (companion: AICompanion) => {
    setSelectedCompanion(companion);
    onSelect(companion);
  };

  return (
    <div className="space-y-8">
      {/* Mode Toggle - Redesigned */}
      <div className="flex justify-center border-b border-white/5">
        <div className="flex gap-12">
            <button
                className={`pb-4 px-4 text-lg font-medium transition-all relative ${
                    mode === 'preset' ? 'text-white' : 'text-gray-500 hover:text-gray-300'
                }`}
                onClick={() => setMode('preset')}
            >
                預設角色
                {mode === 'preset' && (
                    <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-purple-500 shadow-[0_0_20px_rgba(168,85,247,1)] rounded-full animate-fade-in" />
                )}
            </button>
            <button
                className={`pb-4 px-4 text-lg font-medium transition-all relative ${
                    mode === 'custom' ? 'text-white' : 'text-gray-500 hover:text-gray-300'
                }`}
                onClick={() => setMode('custom')}
            >
                自訂生成
                {mode === 'custom' && (
                    <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-purple-500 shadow-[0_0_20px_rgba(168,85,247,1)] rounded-full animate-fade-in" />
                )}
            </button>
        </div>
      </div>

      {mode === 'preset' ? (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {presets.map((companion, idx) => (
            <div 
              key={idx}
              className={`relative p-6 rounded-2xl border cursor-pointer transition-all duration-300 group
                ${selectedCompanion?.name === companion.name 
                  ? 'border-purple-500 bg-purple-500/10 shadow-[0_0_30px_-10px_rgba(168,85,247,0.3)]' 
                  : 'border-white/5 bg-white/[0.02] hover:bg-white/5 hover:border-white/10'
                }`}
              onClick={() => handleSelect(companion)}
            >
              <div className="flex flex-col items-center text-center space-y-4">
                <div className="relative">
                  <div className={`absolute inset-0 rounded-full blur-xl opacity-50 transition-colors duration-500 ${selectedCompanion?.name === companion.name ? 'bg-purple-500' : 'bg-transparent group-hover:bg-white/20'}`}></div>
                  <img src={companion.avatar} alt={companion.name} className="relative w-24 h-24 rounded-full shadow-lg" />
                </div>
                <div>
                  <h4 className="text-lg font-bold text-white mb-1">{companion.name}</h4>
                  <p className="text-sm text-gray-400 line-clamp-3 leading-relaxed">{companion.personality}</p>
                </div>
              </div>
              {selectedCompanion?.name === companion.name && (
                <div className="absolute top-3 right-3 text-purple-500">
                  <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="w-6 h-6">
                    <path fillRule="evenodd" d="M10 18a8 8 0 1 0 0-16 8 8 0 0 0 0 16Zm3.857-9.809a.75.75 0 0 0-1.214-.882l-3.483 4.79-1.88-1.88a.75.75 0 1 0-1.06 1.061l2.5 2.5a.75.75 0 0 0 1.137-.089l4-5.5Z" clipRule="evenodd" />
                  </svg>
                </div>
              )}
            </div>
          ))}
        </div>
      ) : (
        <div className="max-w-2xl mx-auto space-y-8">
          <div className="space-y-4">
            <label className="block text-center text-gray-300 mb-2">描述您想要的 AI 影伴性格與特徵</label>
            <div className="relative">
              <textarea
                value={customPrompt}
                onChange={(e) => setCustomPrompt(e.target.value)}
                placeholder="例如：一位熱愛科幻電影的退休太空人，說話總是帶著專業術語，但偶爾會講冷笑話..."
                className="textarea textarea-lg w-full h-32 bg-black/40 border-white/10 focus:border-purple-500 text-white rounded-2xl resize-none leading-relaxed"
              />
              <div className="absolute bottom-3 right-3">
                <button
                  onClick={generateCompanion}
                  disabled={loading || !customPrompt.trim()}
                  className="btn btn-primary btn-sm rounded-lg shadow-lg shadow-purple-900/20"
                >
                  {loading ? (
                    <>
                      <span className="loading loading-spinner loading-xs"></span>
                      生成中...
                    </>
                  ) : (
                    <>
                      <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="w-4 h-4 mr-1">
                        <path fillRule="evenodd" d="M9.661 2.237a.531.531 0 0 1 .678 0 11.947 11.947 0 0 0 6.878 2.743c.345.044.673.266.673.637v10.87c0 .471-.335.897-.808.986a10.002 10.002 0 0 1-13.008-3.001.75.75 0 0 1 1.292-.752 8.502 8.502 0 0 0 11.216 2.586V6.562a10.452 10.452 0 0 1-6.25-2.325Z" clipRule="evenodd" />
                      </svg>
                      開始生成
                    </>
                  )}
                </button>
              </div>
            </div>
          </div>
          
          {generatedCompanion && (
            <div className="animate-fade-in">
              <h4 className="text-center text-gray-400 mb-4 text-sm">生成結果預覽</h4>
              <div 
                className="bg-gradient-to-b from-purple-900/20 to-transparent p-8 rounded-3xl border border-purple-500/30 flex flex-col md:flex-row items-center gap-8 cursor-pointer hover:border-purple-500/50 transition-colors"
                onClick={() => handleSelect(generatedCompanion)}
              >
                <div className="relative flex-shrink-0">
                  <div className="absolute inset-0 bg-purple-500 blur-2xl opacity-20 rounded-full"></div>
                  <img src={generatedCompanion.avatar} alt={generatedCompanion.name} className="relative w-32 h-32 rounded-full shadow-2xl border-4 border-white/5" />
                </div>
                <div className="flex-1 text-center md:text-left space-y-3">
                  <div className="flex items-center justify-center md:justify-start gap-3">
                    <h4 className="text-2xl font-bold text-white">{generatedCompanion.name}</h4>
                    <span className="badge badge-primary badge-outline">AI 影伴</span>
                  </div>
                  <p className="text-gray-300 leading-relaxed">{generatedCompanion.personality}</p>
                  <div className="bg-white/5 p-4 rounded-xl text-sm text-gray-400 italic">
                    "{generatedCompanion.background}"
                  </div>
                </div>
                <div className="flex-shrink-0">
                   <div className={`w-8 h-8 rounded-full border-2 flex items-center justify-center transition-colors ${selectedCompanion?.name === generatedCompanion.name ? 'border-purple-500 bg-purple-500 text-white' : 'border-gray-600 text-transparent'}`}>
                    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="w-5 h-5">
                      <path fillRule="evenodd" d="M16.704 4.153a.75.75 0 0 1 .143 1.052l-8 10.5a.75.75 0 0 1-1.127.075l-4.5-4.5a.75.75 0 0 1 1.06-1.06l3.894 3.893 7.48-9.817a.75.75 0 0 1 1.05-.143Z" clipRule="evenodd" />
                    </svg>
                   </div>
                </div>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default AICompanionSelector;
