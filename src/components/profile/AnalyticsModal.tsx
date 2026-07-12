import { X } from 'lucide-react';
import { fontSize } from '../../lib/utils';
import { useUserProfile } from '../../lib/UserContext';
import ProfileAnalyticsView from './ProfileAnalyticsView';

export default function AnalyticsModal({
  onClose,
  targetUserId
}: {
  onClose: () => void;
  targetUserId?: string;
}) {
  const { userProfile: loggedInUser } = useUserProfile();
  const displayUserId = targetUserId || loggedInUser?.id;
  const isOwner = !targetUserId || targetUserId === loggedInUser?.id;

  if (!displayUserId) return null;

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-[250] flex items-center justify-center p-4">
      <div className="bg-white dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800/80 rounded-3xl w-full max-w-[420px] sm:max-w-[620px] md:max-w-[720px] lg:max-w-[800px] h-[640px] max-h-[90vh] flex flex-col shadow-2xl relative overflow-hidden animate-fade-in">
        
        <div className="flex justify-between items-center px-5 py-4 border-b border-black/10 dark:border-white/10 flex-shrink-0">
          <h1 className="font-semibold text-zinc-900 dark:text-white" style={{ fontSize: fontSize.base }}>
            Personal Analytics
          </h1>
          <button
            onClick={onClose}
            className="p-1.5 hover:bg-zinc-100 dark:hover:bg-zinc-900 rounded-full transition-colors text-zinc-500 hover:text-zinc-850 dark:text-zinc-400 dark:hover:text-white cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-5 min-h-0">
          <ProfileAnalyticsView userId={displayUserId} isOwner={isOwner} />
        </div>

      </div>
    </div>
  );
}
