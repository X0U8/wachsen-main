import React from 'react';
import { Search as SearchIcon, Loader2, UserPlus, Check } from 'lucide-react';
import { fontSize } from '../../lib/utils';

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

interface SearchTabProps {
  searchQuery: string;
  setSearchQuery: (query: string) => void;
  onSearch: () => void;
  searchLoading: boolean;
  hasSearched: boolean;
  searchResult: ProfileData | null;
  sentRequests: string[];
  sendingRequest: boolean;
  onRequestFriend: (friendId: string) => void;
  onOpenDetails: (friend: ProfileData) => void;
  requestError: string;
  renderProfilePic: (profile: any, className: string) => React.ReactNode;
  incomingRequests: FriendRequest[];
  loadingRequests: boolean;
  onAcceptRequest: (reqId: string) => void;
  onDeclineRequest: (reqId: string) => void;
}

export const SearchTab: React.FC<SearchTabProps> = ({
  searchQuery,
  setSearchQuery,
  onSearch,
  searchLoading,
  hasSearched,
  searchResult,
  sentRequests,
  sendingRequest,
  onRequestFriend,
  onOpenDetails,
  requestError,
  renderProfilePic,
  incomingRequests,
  loadingRequests,
  onAcceptRequest,
  onDeclineRequest,
}) => {
  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2">
        <div className="relative flex-1">
          <SearchIcon className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-400 pointer-events-none" />
          <input
            type="text"
            placeholder="Search by username..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') onSearch();
            }}
            className="w-full pl-10 pr-4 py-2.5 bg-white dark:bg-zinc-900 border border-black/15 dark:border-white/20 rounded-2xl text-zinc-800 dark:text-zinc-100 focus:border-blue-500 dark:focus:border-white/50 focus:outline-none placeholder-zinc-400 font-medium transition-all shadow-xs text-xs"
          />
        </div>

        <button
          onClick={onSearch}
          disabled={searchLoading}
          className="px-4 py-2.5 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white rounded-2xl font-bold transition-all cursor-pointer shadow-sm flex items-center justify-center min-w-[70px] text-xs">
          {searchLoading ? (
            <Loader2 className="w-4 h-4 animate-spin text-white" />
          ) : (
            'Search'
          )}
        </button>
      </div>
      
      {/* Incoming Friend Requests section — scrollable, no container inside container */}
      <div className="space-y-3 pt-2">
        <h3 className="text-xs font-bold text-zinc-850 dark:text-zinc-100 px-1">
          Incoming Requests
        </h3>
        {loadingRequests ? (
          <div className="flex justify-center py-6">
            <Loader2 className="w-5 h-5 text-blue-500 animate-spin" />
          </div>
        ) : incomingRequests.length > 0 ? (
          <div className="max-h-60 overflow-y-auto space-y-2 pr-1">
            {incomingRequests.map((req) => (
              <div
                key={req.id}
                className="flex items-center justify-between p-3 bg-white dark:bg-zinc-900 border border-black/15 dark:border-white/20 rounded-2xl shadow-xs"
              >
                <div className="flex items-center gap-3">
                  {renderProfilePic({
                    id: req.sender.id,
                    name: req.sender.name,
                    username: req.sender.username,
                    profile_picture: req.sender.profile_picture,
                  }, 'w-10 h-10')}
                  <div>
                    <h4 className="text-xs font-bold text-zinc-800 dark:text-white">
                      {req.sender.name}
                    </h4>
                    <p className="text-[10px] text-zinc-500 dark:text-zinc-400">@{req.sender.username}</p>
                  </div>
                </div>
                <div className="flex items-center gap-1.5">
                  <button
                    onClick={() => onAcceptRequest(req.id)}
                    className="px-3.5 py-1.5 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-[10px] font-bold cursor-pointer transition-all shadow-xs"
                  >
                    Accept
                  </button>
                  <button
                    onClick={() => onDeclineRequest(req.id)}
                    className="px-3.5 py-1.5 bg-zinc-50 dark:bg-zinc-800/60 hover:bg-zinc-100 dark:hover:bg-zinc-700 rounded-xl text-[10px] font-bold text-zinc-700 dark:text-zinc-350 cursor-pointer transition-all border border-zinc-200 dark:border-zinc-850"
                  >
                    Decline
                  </button>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="text-center py-6 bg-zinc-50 dark:bg-zinc-900/20 border border-dashed border-black/10 dark:border-white/10 rounded-2xl">
            <p className="text-[10px] text-zinc-405 dark:text-zinc-500 font-medium">No incoming requests</p>
          </div>
        )}
      </div>

      {requestError && (
        <div className="p-3 bg-red-50 dark:bg-red-950/20 border border-red-200 dark:border-red-900 rounded-2xl text-red-600 dark:text-red-400 text-xs font-medium">
          {requestError}
        </div>
      )}
      {hasSearched && (
        <div className="pt-2">
          {searchResult ? (
            <div className="flex items-center justify-between p-3.5 bg-white dark:bg-zinc-900 border border-black/15 dark:border-white/20 rounded-2xl shadow-xs animate-fade-in">
              <div className="flex items-center gap-3">
                {renderProfilePic(searchResult, 'w-11 h-11')}
                <div>
                  <h4 className="text-xs font-bold text-zinc-800 dark:text-white">
                    {searchResult.name}
                  </h4>
                  <p className="text-[10px] text-zinc-500 dark:text-zinc-400">@{searchResult.username}</p>
                </div>
              </div>

              <div className="flex items-center gap-1.5">
                <button
                  onClick={() => onOpenDetails(searchResult)}
                  className="px-3 py-1.5 bg-zinc-50 dark:bg-zinc-800/60 hover:bg-zinc-100 dark:hover:bg-zinc-700 text-zinc-700 dark:text-zinc-300 rounded-xl text-[10px] font-bold transition-all cursor-pointer border border-zinc-200 dark:border-zinc-850"
                >
                  Details
                </button>
                {sentRequests.includes(searchResult.id) ? (
                  <span className="px-3 py-1.5 bg-zinc-50 dark:bg-zinc-900 border border-zinc-200/30 rounded-xl text-[10px] font-bold text-zinc-400 flex items-center gap-1">
                    <Check className="w-3.5 h-3.5 text-zinc-400" />
                    Sent
                  </span>
                ) : (
                  <button
                    onClick={() => onRequestFriend(searchResult.id)}
                    disabled={sendingRequest}
                    className="px-3.5 py-1.5 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white rounded-xl text-[10px] font-bold transition-all cursor-pointer flex items-center gap-1 shadow-sm"
                  >
                    {sendingRequest ? (
                      <Loader2 className="w-3.5 h-3.5 animate-spin text-white" />
                    ) : (
                      <>
                        <UserPlus className="w-3.5 h-3.5" />
                        Add Friend
                      </>
                    )}
                  </button>
                )}
              </div>
            </div>
          ) : (
            <div className="text-center py-10 bg-zinc-50 dark:bg-zinc-900/20 border border-dashed border-zinc-200 dark:border-zinc-800 rounded-2xl">
              <p className="text-xs text-zinc-500 dark:text-zinc-400 font-medium">
                No user found matching that username.
              </p>
            </div>
          )}
        </div>
      )}
    </div>
  );
};
