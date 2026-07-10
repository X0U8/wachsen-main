import React from 'react';
import { Loader2, Swords } from 'lucide-react';

interface ProfileData {
  id: string;
  name: string;
  username: string;
  profile_picture?: string;
}

interface FriendRequest {
  id: string;
  created_at: string;
  sender: {
    id: string;
    name: string;
    username: string;
    profile_picture?: string;
  };
}

interface FriendsTabProps {
  loadingFriends: boolean;
  friendsList: ProfileData[];
  onOpenChallenge: (friend: ProfileData) => void;
  incomingRequests: FriendRequest[];
  loadingRequests: boolean;
  onAcceptRequest: (reqId: string) => void;
  onDeclineRequest: (reqId: string) => void;
  renderProfilePic: (profile: any, className: string) => React.ReactNode;
}

export const FriendsTab: React.FC<FriendsTabProps> = ({
  loadingFriends,
  friendsList,
  onOpenChallenge,
  incomingRequests,
  loadingRequests,
  onAcceptRequest,
  onDeclineRequest,
  renderProfilePic,
}) => {
  return (
    <div className="space-y-4">
      {/* Friend Requests Section */}
      {incomingRequests.length > 0 && (
        <div className="bg-blue-50/50 dark:bg-blue-950/15 border border-blue-100 dark:border-blue-900/50 rounded-2xl p-4 space-y-3 animate-fade-in">
          <h3 className="text-xs font-bold text-blue-700 dark:text-blue-400 flex items-center gap-1.5">
            Incoming Friend Requests
          </h3>
          <div className="space-y-2.5">
            {incomingRequests.map((req) => (
              <div
                key={req.id}
                className="flex items-center justify-between bg-white dark:bg-zinc-900 p-2.5 rounded-xl border border-zinc-200 dark:border-zinc-800"
              >
                <div className="flex items-center gap-2">
                  {renderProfilePic({
                    id: req.sender.id,
                    name: req.sender.name,
                    username: req.sender.username,
                    profile_picture: req.sender.profile_picture,
                  }, 'w-8 h-8')}
                  <div>
                    <h4 className="text-xs font-semibold text-zinc-800 dark:text-white">
                      {req.sender.name}
                    </h4>
                    <p className="text-[9px] text-zinc-550 dark:text-zinc-400">@{req.sender.username}</p>
                  </div>
                </div>
                <div className="flex items-center gap-1.5">
                  <button
                    onClick={() => onAcceptRequest(req.id)}
                    className="px-3 py-1 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-[10px] font-semibold cursor-pointer transition-all"
                  >
                    Accept
                  </button>
                  <button
                    onClick={() => onDeclineRequest(req.id)}
                    className="px-3 py-1 bg-zinc-100 dark:bg-zinc-800 hover:bg-zinc-200 dark:hover:bg-zinc-700 rounded-lg text-[10px] font-semibold text-zinc-700 dark:text-zinc-350 cursor-pointer transition-all"
                  >
                    Decline
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Friends List Section */}
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
                className="flex items-center justify-between p-3 bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800/80 rounded-2xl shadow-xs"
              >
                <div className="flex items-center gap-3">
                  {renderProfilePic(friend, 'w-10 h-10')}
                  <div>
                    <h4 className="text-xs font-bold text-zinc-800 dark:text-white">
                      {friend.name}
                    </h4>
                    <p className="text-[10px] text-zinc-500 dark:text-zinc-400">
                      @{friend.username}
                    </p>
                  </div>
                </div>
                <button
                  onClick={() => onOpenChallenge(friend)}
                  className="px-3.5 py-1.5 bg-blue-50 hover:bg-blue-100 dark:bg-blue-950/40 dark:hover:bg-blue-900/40 text-blue-600 dark:text-blue-400 rounded-xl text-[10px] font-bold transition-all cursor-pointer flex items-center gap-1 border border-blue-200/30"
                >
                  <Swords className="w-3.5 h-3.5" />
                  Challenge
                </button>
              </div>
            ))}
          </div>
        ) : (
          <div className="text-center py-12 bg-zinc-50 dark:bg-zinc-900/20 border border-dashed border-zinc-200 dark:border-zinc-800 rounded-2xl">
            <div className="w-10 h-10 bg-zinc-100 dark:bg-zinc-800 rounded-full flex items-center justify-center mx-auto mb-2.5">
              <Swords className="w-5 h-5 text-zinc-400" />
            </div>
            <p className="text-xs text-zinc-500 dark:text-zinc-400 font-medium">
              No friends added yet.
            </p>
          </div>
        )}
      </div>
    </div>
  );
};
