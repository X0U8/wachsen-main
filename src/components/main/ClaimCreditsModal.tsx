import { useState } from 'react';
import { X, Gift, Loader2 } from 'lucide-react';
import { supabase } from '../../services/supabase';
import { fontSize } from '../../lib/utils';

interface ClaimCreditsModalProps {
  show: boolean;
  onClose: () => void;
  userProfile: any;
  refreshCredits: () => Promise<void>;
}

const planCredits: Record<string, number> = { 'Glix Peak': 300, 'Glix Rise': 150, 'Glix Lite': 75 };

const getDailyCredits = (plan: string) => planCredits[plan] || 20;

const getTimePassed = () => {
  const now = new Date();
  const start = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const elapsed = now.getTime() - start.getTime();
  const h = Math.floor(elapsed / 3600000);
  const m = Math.floor((elapsed % 3600000) / 60000);
  return `${h}h ${m}m passed`;
};

const getTimeLeft = () => {
  const now = new Date();
  const next = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1, 0, 1, 0);
  const remaining = next.getTime() - now.getTime();
  if (remaining <= 0) return 'Available now';
  const h = Math.floor(remaining / 3600000);
  const m = Math.floor((remaining % 3600000) / 60000);
  return `${h}h ${m}m left`;
};

const getProgress = () => {
  const now = new Date();
  const start = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const next = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1, 0, 1, 0);
  const total = next.getTime() - start.getTime();
  const elapsed = now.getTime() - start.getTime();
  return Math.min(100, (elapsed / total) * 100);
};

const todayStr = new Date().toDateString();

export default function ClaimCreditsModal({ show, onClose, userProfile, refreshCredits }: ClaimCreditsModalProps) {
  const [claiming, setClaiming] = useState(false);
  const [msg, setMsg] = useState<{ type: string; text: string } | null>(null);
  const [claimed, setClaimed] = useState(() => localStorage.getItem('last_claimed_date') === todayStr);

  const handleClaim = async () => {
    if (claimed) return;
    setClaiming(true);
    setMsg(null);
    try {
      const { data } = await supabase.auth.getSession();
      const token = data.session?.access_token || '';
      const r = await fetch('/api/claim-credits', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId: userProfile?.$id, authToken: token })
      });
      const d = await r.json();
      if (d.success) {
        setMsg({ type: 'success', text: `Credits set to ${d.creditsAdded}` });
        localStorage.setItem('last_claimed_date', new Date().toDateString());
        await refreshCredits();
        setClaimed(true);
      } else {
        setMsg({ type: 'error', text: d.error || 'Failed to claim' });
      }
    } catch {
      setMsg({ type: 'error', text: 'Error claiming credits' });
    } finally {
      setClaiming(false);
    }
  };

  if (!show) return null;

  const dailyCredits = getDailyCredits(userProfile?.PremiumType || '');

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/60 backdrop-blur-sm p-6"
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}>
      <div className="bg-white dark:bg-gray-900 border border-zinc-200 dark:border-gray-800 rounded-2xl p-5 w-full max-w-xs space-y-4 shadow-2xl relative">
        <button onClick={onClose} className="absolute top-3 right-3 p-1 hover:bg-zinc-100 dark:hover:bg-gray-800 rounded-full transition-colors">
          <X className="w-4 h-4 text-zinc-400" />
        </button>
        <div className="flex items-center gap-2.5">
          <div className="w-9 h-9 rounded-full bg-zinc-200 dark:bg-gray-800 overflow-hidden flex items-center justify-center text-zinc-500 dark:text-gray-400 font-semibold shrink-0" style={{ fontSize: fontSize.sm }}>
            {userProfile?.profile_picture
              ? <img src={userProfile.profile_picture} alt="" className="w-full h-full object-cover" />
              : (userProfile?.name?.charAt(0)?.toUpperCase() || '?')}
          </div>
          <div className="min-w-0">
            <p className="font-semibold text-zinc-900 dark:text-white truncate" style={{ fontSize: fontSize.sm }}>{userProfile?.name || 'User'}</p>
            {userProfile?.PremiumType && userProfile.PremiumType !== 'Free' ? (
              <span className="text-zinc-400 dark:text-gray-500" style={{ fontSize: fontSize.xs }}>{userProfile.PremiumType}</span>
            ) : (
              <span className="text-zinc-400 dark:text-gray-500" style={{ fontSize: fontSize.xs }}>Free Plan</span>
            )}
          </div>
        </div>

        <div className="h-px bg-zinc-200 dark:bg-gray-800" />

        <div className="space-y-1.5">
          <div className="flex items-center justify-between">
            <span className="text-zinc-400 dark:text-gray-500" style={{ fontSize: fontSize.xs }}>{getTimeLeft()} for next claim</span>
          </div>
          <div className="w-full bg-zinc-200 dark:bg-gray-800 rounded-full h-1.5 overflow-hidden">
            <div className="h-full bg-[#007AFF] rounded-full transition-all duration-1000"
              style={{ width: `${getProgress()}%` }} />
          </div>
        </div>

        <div className="bg-zinc-50 dark:bg-gray-950 rounded-xl p-3 text-center">
          <p className="text-zinc-400 dark:text-gray-500" style={{ fontSize: fontSize.xs }}>Available</p>
          <p className="font-bold text-[#007AFF]" style={{ fontSize: fontSize['2xl'] || '1.5rem' }}>{dailyCredits}</p>
          <p className="text-zinc-400 dark:text-gray-500" style={{ fontSize: fontSize.xs }}>credits</p>
        </div>

        {msg && (
          <div className={`text-center p-2 rounded-lg font-medium ${msg.type === 'success' ? 'bg-green-500/10 text-green-500' : 'bg-red-500/10 text-red-400'}`} style={{ fontSize: fontSize.xs }}>
            {msg.text}
          </div>
        )}

        <button onClick={handleClaim} disabled={claimed || claiming}
          className={`w-full py-2.5 rounded-xl font-semibold transition-all flex items-center justify-center gap-2 ${claimed ? 'bg-zinc-100 dark:bg-gray-800 text-zinc-400 dark:text-gray-500 cursor-not-allowed' : 'bg-[#007AFF] hover:bg-[#0062CC] text-white'}`}
          style={{ fontSize: fontSize.sm }}>
          {claiming ? <><Loader2 className="w-4 h-4 animate-spin" /> Claiming...</>
            : claimed ? 'Claimed'
              : <>Claim</>}
        </button>
      </div>
    </div>
  );
}
