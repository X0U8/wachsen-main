import React from 'react';
import { Loader2, Swords } from 'lucide-react';

interface ProfileData {
  id: string;
  name: string;
  username: string;
  profile_picture?: string;
}

interface FriendsTabProps {
  loadingFriends: boolean;
  friendsList: ProfileData[];
  onOpenChallenge: (friend: ProfileData) => void;
  onOpenDetails: (friend: ProfileData) => void;
  renderProfilePic: (profile: any, className: string) => React.ReactNode;
}

export const FriendsTab: React.FC<FriendsTabProps> = ({
  loadingFriends,
  friendsList,
  onOpenChallenge,
  onOpenDetails,
  renderProfilePic,
}) => {
  return (
    <div className="space-y-4">

      <div className="space-y-3">
        <h3 className="text-xs font-bold text-zinc-800 dark:text-zinc-200 px-1">
          My Friends ({friendsList.length})
        </h3>

        {loadingFriends ? (
          <div className="flex justify-center py-10">
            <Loader2 className="w-6 h-6 text-blue-500 animate-spin" />
          </div>
        ) : friendsList.length > 0 ? (
          <div className="grid gap-2.5">
            {friendsList.map((friend) => (
              <div
                key={friend.id}
                className="flex items-center justify-between p-3 bg-white dark:bg-zinc-900 border border-black/15 dark:border-white/20 rounded-2xl shadow-xs"
              >
                <div className="flex items-center gap-3">
                  {renderProfilePic(friend, 'w-10 h-10')}
                  <div>
                    <h4 className="text-xs font-bold text-zinc-800 dark:text-white">
                      {friend.name}
                    </h4>
                    <p className="text-xs text-zinc-500 dark:text-zinc-400">
                      @{friend.username}
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-1.5">
                  <button
                    onClick={() => onOpenDetails(friend)}
                    className="px-3.5 py-1.5 bg-zinc-50 dark:bg-zinc-800/60 hover:bg-zinc-100 dark:hover:bg-zinc-700 text-zinc-700 dark:text-zinc-300 rounded-xl text-xs font-bold transition-all cursor-pointer border border-zinc-200 dark:border-zinc-850"
                  >
                    Details
                  </button>
                  <button
                    onClick={() => onOpenChallenge(friend)}
                    className="px-2.5 sm:px-3.5 py-1.5 bg-blue-50 hover:bg-blue-100 dark:bg-blue-950/40 dark:hover:bg-blue-900/40 text-blue-600 dark:text-blue-400 rounded-xl text-xs font-bold transition-all cursor-pointer flex items-center gap-1 border border-blue-200/30"
                  >
                    <Swords className="w-3.5 h-3.5" fill="currentColor" />
                    <span className="hidden sm:inline">Challenge</span>
                  </button>


                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="text-center py-12 bg-zinc-50 dark:bg-zinc-900/20 border border-dashed border-black/15 dark:border-white/20 rounded-2xl">
            <p className="text-xs text-zinc-500 dark:text-zinc-400 font-medium">
              No friends yet.
            </p>
          </div>
        )}
      </div>
    </div>
  );
};
