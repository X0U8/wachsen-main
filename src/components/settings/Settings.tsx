import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTheme } from '../../lib/ThemeContext.tsx';
import { useUserProfile } from '../../lib/UserContext';
import { fontSize } from '../../lib/utils';
import { ArrowLeft, Sun, Moon, Type, Gift, Key, Check, Eye, EyeOff, Trash2, AlertTriangle, Plus } from 'lucide-react';
import BuyCreditsModal from '../../ui/BuyCreditsModal';

const FONT_OPTIONS = [
  { value: 'small' as const, label: 'Small' },
  { value: 'medium' as const, label: 'Medium' },
  { value: 'large' as const, label: 'Large' },
  { value: 'larger' as const, label: 'Larger' },
];

const DEFAULT_MODELS = ['anthropic/claude-sonnet-5', 'google/gemini-3.5-flash'];

export default function Settings() {
  const navigate = useNavigate();
  const { theme, toggleTheme, fontSizeLevel, setFontSizeLevel } = useTheme();
  const { userProfile, refreshCredits, refreshProfile } = useUserProfile();
  const [showBuy, setShowBuy] = useState(false);
  const [meshKey, setMeshKey] = useState('');
  const [mistralKey, setMistralKey] = useState('');
  const [showKey, setShowKey] = useState(false);
  const [keySaved, setKeySaved] = useState(false);
  const [showRemoveConfirm, setShowRemoveConfirm] = useState(false);
  const [provider, setProvider] = useState<'mesh' | 'mistral'>('mesh');
  const [models, setModels] = useState<string[]>(DEFAULT_MODELS);
  const [activeModel, setActiveModel] = useState(DEFAULT_MODELS[0]);
  const [showAddModel, setShowAddModel] = useState(false);
  const [newModel, setNewModel] = useState('');
  const [useOwnKey, setUseOwnKey] = useState(false);

  useEffect(() => {
    const savedKey = localStorage.getItem('mesh_api_key');
    if (savedKey) setMeshKey(savedKey);
    const savedMistralKey = localStorage.getItem('mistral_api_key');
    if (savedMistralKey) setMistralKey(savedMistralKey);
    const savedProv = localStorage.getItem('provider');
    if (savedProv === 'mesh' || savedProv === 'mistral') setProvider(savedProv);
    const savedModels = localStorage.getItem('mesh_models');
    if (savedModels) {
      try { const m = JSON.parse(savedModels); if (Array.isArray(m) && m.length > 0) setModels(m); } catch {}
    }
    const savedActive = localStorage.getItem('mesh_active_model');
    if (savedActive) setActiveModel(savedActive);
    const savedOwnKey = localStorage.getItem('use_own_key');
    if (savedOwnKey === 'true') setUseOwnKey(true);
  }, []);

  const saveKey = () => {
    const key = provider === 'mesh' ? meshKey.trim() : mistralKey.trim();
    if (key) {
      localStorage.setItem(provider === 'mesh' ? 'mesh_api_key' : 'mistral_api_key', key);
      setKeySaved(true);
      setTimeout(() => setKeySaved(false), 2000);
    }
  };

  const confirmRemoveKey = () => {
    if (provider === 'mesh') {
      setMeshKey('');
      localStorage.removeItem('mesh_api_key');
    } else {
      setMistralKey('');
      localStorage.removeItem('mistral_api_key');
    }
    setShowRemoveConfirm(false);
  };

  const setAndSaveProvider = (p: 'mesh' | 'mistral') => {
    setProvider(p);
    localStorage.setItem('provider', p);
  };

  const setAndSaveActiveModel = (m: string) => {
    setActiveModel(m);
    localStorage.setItem('mesh_active_model', m);
  };

  const addModel = () => {
    const trimmed = newModel.trim();
    if (!trimmed || models.length >= 10 || models.includes(trimmed)) return;
    const updated = [...models, trimmed];
    setModels(updated);
    localStorage.setItem('mesh_models', JSON.stringify(updated));
    setNewModel('');
    setShowAddModel(false);
  };

  const removeModel = (model: string) => {
    if (models.length <= 1) return;
    const updated = models.filter(m => m !== model);
    setModels(updated);
    localStorage.setItem('mesh_models', JSON.stringify(updated));
    if (activeModel === model) {
      setAndSaveActiveModel(updated[0]);
    }
  };

  const toggleUseOwnKey = () => {
    const val = !useOwnKey;
    setUseOwnKey(val);
    localStorage.setItem('use_own_key', val ? 'true' : 'false');
  };

  return (
    <>
      <div className="flex flex-col min-h-screen bg-zinc-50 dark:bg-black text-zinc-900 dark:text-gray-100 font-sans antialiased">
        <header className="sticky top-0 z-40 w-full px-4 sm:px-6 py-3 sm:py-4 bg-white/80 dark:bg-black/80 backdrop-blur-md border-b border-zinc-200 dark:border-gray-900/80 flex items-center gap-3 transition-colors duration-300">
          <button onClick={() => navigate(-1)} className="p-1.5 rounded-lg hover:bg-zinc-100 dark:hover:bg-zinc-900 text-zinc-600 dark:text-zinc-400 transition-colors cursor-pointer">
            <ArrowLeft className="w-5 h-5" />
          </button>
          <h1 className="font-semibold text-zinc-800 dark:text-gray-100" style={{ fontSize: fontSize.lg }}>Settings</h1>
        </header>

        <main className="flex-1 max-w-2xl w-full mx-auto p-4 sm:p-6 space-y-6">
          {/* Subscription */}
          <div className="bg-white dark:bg-zinc-900/50 border border-zinc-200 dark:border-gray-800 rounded-2xl p-4 sm:p-5 space-y-4 transition-colors">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <Gift className="w-5 h-5 text-[#007AFF]" />
                <div>
                  <p className="font-medium text-zinc-800 dark:text-gray-100" style={{ fontSize: fontSize.sm }}>Subscription</p>
                  <p className="text-zinc-500 dark:text-gray-400" style={{ fontSize: fontSize.xs }}>
                    {userProfile?.PremiumType || 'Free'} — {userProfile?.credits || 0} credits
                  </p>
                </div>
              </div>
              <button onClick={() => setShowBuy(true)}
                className="px-3 py-1.5 bg-[#007AFF] hover:bg-[#0062CC] text-white rounded-lg font-medium transition-colors"
                style={{ fontSize: fontSize.xs }}>Upgrade</button>
            </div>
          </div>

          {/* Provider & BYOK */}
          <div className="bg-white dark:bg-zinc-900/50 border border-zinc-200 dark:border-gray-800 rounded-2xl p-4 sm:p-5 space-y-4 transition-colors">
            <div className="flex items-center gap-3">
              <Key className="w-5 h-5 text-zinc-500 dark:text-zinc-400" />
              <div>
                <p className="font-medium text-zinc-800 dark:text-gray-100" style={{ fontSize: fontSize.sm }}>API Provider</p>
              </div>
            </div>

            {/* Provider toggle */}
            <div className="flex bg-zinc-100 dark:bg-gray-900 rounded-xl p-1 border border-zinc-200 dark:border-gray-800">
              <button onClick={() => setAndSaveProvider('mesh')}
                className={`flex-1 py-2 rounded-lg font-medium transition-all ${provider === 'mesh' ? 'bg-white dark:bg-gray-800 text-zinc-900 dark:text-white shadow-sm' : 'text-zinc-500 dark:text-gray-500 hover:text-zinc-700 dark:hover:text-gray-300'}`}
                style={{ fontSize: fontSize.xs }}>Mesh API <span className="text-[#007AFF]">Recommended</span></button>
              <button onClick={() => setAndSaveProvider('mistral')}
                className={`flex-1 py-2 rounded-lg font-medium transition-all ${provider === 'mistral' ? 'bg-white dark:bg-gray-800 text-zinc-900 dark:text-white shadow-sm' : 'text-zinc-500 dark:text-gray-500 hover:text-zinc-700 dark:hover:text-gray-300'}`}
                style={{ fontSize: fontSize.xs }}>Mistral</button>
            </div>

            {/* API Key input */}
            <div className="space-y-2">
              <label className="text-zinc-500 dark:text-gray-500 font-medium" style={{ fontSize: fontSize.xs }}>API Key</label>
              <div className="flex gap-2">
                <div className="relative flex-1">
                  <input type={showKey ? 'text' : 'password'} value={provider === 'mesh' ? meshKey : mistralKey} onChange={(e) => provider === 'mesh' ? setMeshKey(e.target.value) : setMistralKey(e.target.value)}
                    placeholder={provider === 'mesh' ? 'rsk_...' : 'mistral_...'}
                    className="w-full bg-zinc-100 dark:bg-gray-950 border border-zinc-300 dark:border-gray-700 rounded-xl px-3 py-2 pr-10 text-zinc-900 dark:text-white font-mono text-xs focus:outline-none focus:ring-1 focus:ring-[#007AFF]"
                    style={{ fontSize: fontSize.xs }} />
                  <button onClick={() => setShowKey(!showKey)} className="absolute right-2 top-1/2 -translate-y-1/2 p-1 hover:bg-zinc-200 dark:hover:bg-gray-800 rounded transition-colors">
                    {showKey ? <EyeOff className="w-3.5 h-3.5 text-zinc-400" /> : <Eye className="w-3.5 h-3.5 text-zinc-400" />}
                  </button>
                </div>
                <button onClick={saveKey} disabled={!(provider === 'mesh' ? meshKey.trim() : mistralKey.trim())}
                  className="px-3 py-2 bg-[#007AFF] hover:bg-[#0062CC] disabled:opacity-40 text-white rounded-xl font-medium transition-colors flex items-center gap-1.5"
                  style={{ fontSize: fontSize.xs }}>
                  {keySaved ? <><Check className="w-3.5 h-3.5" /> Saved</> : 'Save'}
                </button>
              </div>
              {(provider === 'mesh' ? meshKey : mistralKey) && (
                <button onClick={() => setShowRemoveConfirm(true)} className="text-red-400 hover:text-red-500 text-xs font-medium transition-colors">Remove key</button>
              )}
            </div>

            {/* Models (only for Mesh) */}
            {provider === 'mesh' && (
              <div className="space-y-2">
                <label className="text-zinc-500 dark:text-gray-500 font-medium" style={{ fontSize: fontSize.xs }}>Models ({models.length}/10)</label>
                <div className="space-y-1.5">
                  {models.map(m => (
                    <div key={m} className={`flex items-center justify-between px-3 py-2 rounded-lg border transition-all cursor-pointer ${activeModel === m ? 'bg-[#007AFF]/10 border-[#007AFF]/30' : 'bg-zinc-50 dark:bg-gray-950 border-zinc-200 dark:border-gray-800 hover:border-zinc-300 dark:hover:border-gray-700'}`}
                      onClick={() => setAndSaveActiveModel(m)}>
                      <div className="flex items-center gap-2 min-w-0">
                        {activeModel === m && <Check className="w-3.5 h-3.5 text-[#007AFF] shrink-0" />}
                        <span className={`truncate ${activeModel === m ? 'text-[#007AFF] font-medium' : 'text-zinc-600 dark:text-gray-400'}`} style={{ fontSize: fontSize.xs }}>{m}</span>
                      </div>
                      {models.length > 1 && (
                        <button onClick={(e) => { e.stopPropagation(); removeModel(m); }} className="p-1 hover:bg-red-500/10 rounded transition-colors">
                          <Trash2 className="w-3 h-3 text-red-400" />
                        </button>
                      )}
                    </div>
                  ))}
                </div>
                {models.length < 10 && (
                  showAddModel ? (
                    <div className="flex gap-2">
                      <input value={newModel} onChange={(e) => setNewModel(e.target.value)}
                        placeholder="e.g. anthropic/claude-sonnet-5"
                        className="flex-1 bg-zinc-100 dark:bg-gray-950 border border-zinc-300 dark:border-gray-700 rounded-lg px-3 py-1.5 text-zinc-900 dark:text-white font-mono text-xs focus:outline-none focus:ring-1 focus:ring-[#007AFF]"
                        style={{ fontSize: fontSize.xs }} />
                      <button onClick={addModel} disabled={!newModel.trim() || models.includes(newModel.trim())}
                        className="px-3 py-1.5 bg-[#007AFF] text-white rounded-lg text-xs font-medium disabled:opacity-40">Add</button>
                      <button onClick={() => { setShowAddModel(false); setNewModel(''); }} className="px-3 py-1.5 bg-zinc-100 dark:bg-gray-800 text-zinc-600 dark:text-gray-400 rounded-lg text-xs font-medium">Cancel</button>
                    </div>
                  ) : (
                    <button onClick={() => setShowAddModel(true)} className="flex items-center gap-1.5 text-[#007AFF] text-xs font-medium hover:underline">
                      <Plus className="w-3 h-3" /> Add model
                    </button>
                  )
                )}
              </div>
            )}

            {/* Use own key toggle */}
            <div className="flex items-center justify-between pt-1">
              <div>
                <p className="text-zinc-700 dark:text-gray-300 font-medium" style={{ fontSize: fontSize.xs }}>Use my own key for generation</p>
                <p className="text-zinc-400 dark:text-gray-500" style={{ fontSize: fontSize.xs }}>Bypass credit deduction</p>
              </div>
              <button onClick={toggleUseOwnKey}
                className={`relative w-10 h-5 rounded-full transition-colors ${useOwnKey ? 'bg-[#007AFF]' : 'bg-zinc-300 dark:bg-gray-700'}`}>
                <span className={`absolute top-0.5 left-0.5 w-4 h-4 bg-white rounded-full shadow-sm transition-transform ${useOwnKey ? 'translate-x-5' : 'translate-x-0'}`} />
              </button>
            </div>
          </div>

          {/* Theme */}
          <div className="bg-white dark:bg-zinc-900/50 border border-zinc-200 dark:border-gray-800 rounded-2xl p-4 sm:p-5 space-y-4 transition-colors">
            <div className="flex items-center justify-between">
              {theme === 'dark' ? <Moon className="w-5 h-5 text-blue-400" /> : <Sun className="w-5 h-5 text-amber-500" />}
              <div>
                <p className="font-medium text-zinc-800 dark:text-gray-100" style={{ fontSize: fontSize.sm }}>Theme</p>
                <p className="text-zinc-500 dark:text-gray-400" style={{ fontSize: fontSize.xs }}>{theme === 'dark' ? 'Dark mode' : 'Light mode'}</p>
              </div>
            </div>
            <div className="flex justify-end">
              <button onClick={toggleTheme}
                className={`relative w-12 h-6 rounded-full transition-colors cursor-pointer ${theme === 'dark' ? 'bg-blue-600' : 'bg-zinc-300 dark:bg-gray-700'}`}>
                <span className={`absolute top-0.5 left-0.5 w-5 h-5 bg-white rounded-full shadow-sm transition-transform duration-200 ${theme === 'dark' ? 'translate-x-6' : 'translate-x-0'}`} />
              </button>
            </div>
          </div>

          {/* Font Size */}
          <div className="bg-white dark:bg-zinc-900/50 border border-zinc-200 dark:border-gray-800 rounded-2xl p-4 sm:p-5 space-y-4 transition-colors">
            <div className="flex items-center gap-3">
              <Type className="w-5 h-5 text-zinc-500 dark:text-zinc-400" />
              <div>
                <p className="font-medium text-zinc-800 dark:text-gray-100" style={{ fontSize: fontSize.sm }}>Font Size</p>
                <p className="text-zinc-500 dark:text-gray-400" style={{ fontSize: fontSize.xs }}>Adjust text size across the app</p>
              </div>
            </div>
            <div className="flex gap-2">
              {FONT_OPTIONS.map(opt => (
                <button key={opt.value} onClick={() => setFontSizeLevel(opt.value)}
                  className={`flex-1 py-2.5 px-3 rounded-xl font-medium transition-all duration-200 cursor-pointer ${fontSizeLevel === opt.value ? 'bg-blue-600 text-white shadow-sm' : 'bg-zinc-100 dark:bg-gray-800 text-zinc-600 dark:text-gray-300 hover:bg-zinc-200 dark:hover:bg-gray-700'}`}
                  style={{ fontSize: fontSize.sm }}>
                  {opt.label}
                </button>
              ))}
            </div>
          </div>
        </main>
      </div>

      {/* Remove key confirmation */}
      {showRemoveConfirm && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/60 backdrop-blur-sm p-6"
          onClick={(e) => { if (e.target === e.currentTarget) setShowRemoveConfirm(false); }}>
          <div className="bg-white dark:bg-gray-900 border border-zinc-200 dark:border-gray-800 rounded-2xl p-5 w-full max-w-xs space-y-4 shadow-2xl">
            <div className="text-center space-y-2">
              <AlertTriangle className="w-8 h-8 text-red-500 mx-auto" />
              <h3 className="font-semibold text-zinc-900 dark:text-white" style={{ fontSize: fontSize.base }}>Remove API Key?</h3>
              <p className="text-zinc-500 dark:text-gray-400" style={{ fontSize: fontSize.xs }}>Generation will use server credits instead.</p>
            </div>
            <div className="flex gap-3">
              <button onClick={() => setShowRemoveConfirm(false)}
                className="flex-1 py-2 bg-zinc-100 dark:bg-gray-800 text-zinc-700 dark:text-gray-300 rounded-xl font-medium transition-colors"
                style={{ fontSize: fontSize.sm }}>Cancel</button>
              <button onClick={confirmRemoveKey}
                className="flex-1 py-2 bg-red-500 hover:bg-red-600 text-white rounded-xl font-medium transition-colors"
                style={{ fontSize: fontSize.sm }}>Remove</button>
            </div>
          </div>
        </div>
      )}

      {showBuy && (
        <BuyCreditsModal
          onClose={() => setShowBuy(false)}
          userId={userProfile?.$id}
          onPaymentSuccess={async () => { await refreshCredits(); }}
          currentPlan={userProfile?.PremiumType}
          isPremium={userProfile?.isPremium}
          premiumEnds={userProfile?.premiumEnds}
          refreshProfile={refreshProfile}
        />
      )}
    </>
  );
}
