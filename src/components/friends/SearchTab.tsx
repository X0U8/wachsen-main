import React from 'react';
import { Search as SearchIcon, Loader2, UserPlus, Check } from 'lucide-react';

interface ProfileData {
  id: string;
  name: string;
  username: string;
  profile_picture?: string;
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
  requestError: string;
  renderProfilePic: (profile: any, className: string) => React.ReactNode;
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
  requestError,
  renderProfilePic,
}) => {
  return (
    <div className="space-y-4">
      {/* Search Input Bar */}
      <div className="flex items-center gap-2">
        <div className="relative flex-1">
          <SearchIcon className="absolute left-3.5 top-3 w-4 h-4 text-zinc-400" />
          <input
            type="text"
            placeholder="Search by username..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') onSearch();
            }}
            className="w-full pl-10 pr-4 py-2.5 bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-2xl text-xs text-zinc-800 dark:text-zinc-100 focus:outline-none focus:border-blue-500 placeholder-zinc-400 font-medium transition-all shadow-xs"
          />
        </div>
        <button
          onClick={onSearch}
          disabled={searchLoading}
          className="px-4 py-2.5 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white rounded-2xl text-xs font-bold transition-all cursor-pointer shadow-sm flex items-center justify-center min-w-[70px]"
        >
          {searchLoading ? (
            <Loader2 className="w-4 h-4 animate-spin text-white" />
          ) : (
            'Search'
          )}
        </button>
      </div>

      {requestError && (
        <div className="p-3 bg-red-50 dark:bg-red-950/20 border border-red-200 dark:border-red-900 rounded-2xl text-red-600 dark:text-red-400 text-xs font-medium">
          {requestError}
        </div>
      )}

      {hasSearched && (
        <div className="pt-2">
          {searchResult ? (
            <div className="flex items-center justify-between p-3.5 bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800/80 rounded-2xl shadow-xs animate-fade-in">
              <div className="flex items-center gap-3">
                {renderProfilePic(searchResult, 'w-11 h-11')}
                <div>
                  <h4 className="text-xs font-bold text-zinc-800 dark:text-white">
                    {searchResult.name}
                  </h4>
                  <p className="text-[10px] text-zinc-500 dark:text-zinc-400">@{searchResult.username}</p>
                </div>
              </div>

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
