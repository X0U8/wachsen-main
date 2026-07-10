import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../services/supabase';
import { useUserProfile } from '../lib/UserContext';
import { Search, Users, UserPlus, Loader2, ChevronLeft, AlertCircle } from 'lucide-react';
import Footer from './Footer';
import PlanIcon from '../ui/PlanIcon';

interface ProfileData {
  id: string;
  name: string;
  username: string;
  profile_picture?: string;
  is_premium?: boolean;
  premium_type?: string;
}

export default function Friends() {
  const navigate = useNavigate();
  const { userProfile } = useUserProfile();
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResult, setSearchResult] = useState<ProfileData | null>(null);
  const [searchLoading, setSearchLoading] = useState(false);
  const [hasSearched, setHasSearched] = useState(false);
  const [activeTab, setActiveTab] = useState<'friends' | 'search'>('friends');

  // Search user by username
  const handleSearch = async () => {
    if (!searchQuery.trim()) return;

    setSearchLoading(true);
    setSearchResult(null);
    setHasSearched(true);

    try {
      // Query profiles table in Supabase by username (case-insensitive/exact match based on DB setup)
      const { data, error } = await supabase
        .from('profiles')
        .select('id, name, username, profile_picture')
        .eq('username', searchQuery.trim().toLowerCase())
        .maybeSingle();

      if (error) throw error;

      if (data) {
        setSearchResult(data as ProfileData);
      } else {
        setSearchResult(null);
      }
    } catch (error) {
      console.error('Error searching user:', error);
      setSearchResult(null);
    } finally {
      setSearchLoading(false);
    }
  };

  // Render profile picture
  const renderProfilePic = (user: ProfileData, size = 'w-12 h-12') => {
    if (user.profile_picture && user.profile_picture.trim() !== '') {
      return (
        <img
          src={user.profile_picture}
          alt={user.name}
          className={`${size} rounded-full object-cover border border-zinc-200 dark:border-zinc-800`}
          onError={(e) => {
            (e.target as HTMLImageElement).style.display = 'none';
            (e.target as HTMLImageElement).nextElementSibling?.classList.remove('hidden');
          }}
        />
      );
    }

    const firstLetter = user.name ? user.name.charAt(0).toUpperCase() : '?';
    return (
      <div className={`${size} rounded-full bg-zinc-100 dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 flex items-center justify-center text-zinc-700 dark:text-zinc-300 font-semibold`}>
        {firstLetter}
      </div>
    );
  };

  return (
    <div className="flex flex-col min-h-screen bg-zinc-50 dark:bg-black text-zinc-900 dark:text-white font-sans antialiased select-none pb-24">
      {/* Header */}
      <header className="sticky top-0 z-[100] backdrop-blur-md bg-white/70 dark:bg-black/70 border-b border-zinc-150 dark:border-zinc-900/60 px-4 py-4 flex items-center justify-between">
        <button
          onClick={() => navigate(-1)}
          className="p-1.5 hover:bg-zinc-100 dark:hover:bg-zinc-900 rounded-xl transition-all text-zinc-500 dark:text-zinc-400 hover:text-zinc-800 dark:hover:text-white cursor-pointer"
        >
          <ChevronLeft className="w-5 h-5" />
        </button>
        <h2 className="text-sm font-semibold tracking-wider uppercase text-zinc-800 dark:text-white">Friends</h2>
        <div className="w-8" />
      </header>

      {/* Main content */}
      <main className="flex-grow max-w-md w-full mx-auto p-4 sm:p-5 space-y-6">
        {/* Tabs */}
        <div className="flex bg-zinc-150 dark:bg-zinc-900/50 p-1 rounded-xl border border-zinc-200 dark:border-zinc-800">
          <button
            onClick={() => setActiveTab('friends')}
            className={`flex-1 py-2 rounded-lg font-medium text-xs transition-all cursor-pointer ${
              activeTab === 'friends'
                ? 'bg-white dark:bg-zinc-800 text-zinc-900 dark:text-white shadow-sm'
                : 'text-zinc-550 hover:text-zinc-700 dark:hover:text-zinc-300'
            }`}
          >
            Friends
          </button>
          <button
            onClick={() => setActiveTab('search')}
            className={`flex-1 py-2 rounded-lg font-medium text-xs transition-all cursor-pointer ${
              activeTab === 'search'
                ? 'bg-white dark:bg-zinc-800 text-zinc-900 dark:text-white shadow-sm'
                : 'text-zinc-550 hover:text-zinc-700 dark:hover:text-zinc-300'
            }`}
          >
            Search & Requests
          </button>
        </div>

        {activeTab === 'search' && (
          <div className="space-y-6">
            {/* Search section */}
            <div className="space-y-3">
              <h3 className="text-xs font-semibold text-zinc-400 dark:text-zinc-550 uppercase tracking-wider pl-1">Search Users</h3>
              <div className="flex gap-2">
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
                  placeholder="Search username..."
                  className="flex-1 bg-white dark:bg-zinc-900/30 border border-zinc-200 dark:border-zinc-850/80 rounded-xl px-4 py-2.5 text-zinc-800 dark:text-white text-xs placeholder-zinc-400 dark:placeholder-zinc-650 focus:outline-none focus:border-blue-500 transition-colors"
                />
                <button
                  onClick={handleSearch}
                  disabled={searchLoading || !searchQuery.trim()}
                  className="px-4 bg-zinc-900 dark:bg-zinc-100 hover:bg-zinc-800 dark:hover:bg-zinc-200 disabled:opacity-40 disabled:hover:bg-zinc-900 text-white dark:text-black rounded-xl transition-all cursor-pointer flex items-center justify-center"
                >
                  {searchLoading ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : (
                    <Search className="w-4 h-4" />
                  )}
                </button>
              </div>
            </div>

            {/* Search Result */}
            {searchLoading ? (
              <div className="flex justify-center py-6">
                <Loader2 className="w-6 h-6 text-blue-500 animate-spin" />
              </div>
            ) : searchResult ? (
              <div className="bg-white dark:bg-zinc-900/20 border border-zinc-200 dark:border-zinc-850/80 rounded-2xl p-4 flex items-center gap-4 shadow-sm animate-in fade-in slide-in-from-bottom-2 duration-200">
                {renderProfilePic(searchResult, 'w-12 h-12')}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <h3 className="text-sm font-medium text-zinc-800 dark:text-white truncate">{searchResult.name || 'Unknown User'}</h3>
                    {searchResult.is_premium && (
                      <PlanIcon planName={searchResult.premium_type || 'Premium'} />
                    )}
                  </div>
                  <p className="text-[10px] text-zinc-550 truncate">@{searchResult.username}</p>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  <button
                    onClick={() => console.log('Send friend request to:', searchResult.id)}
                    className="py-1.5 px-3 bg-[#007AFF] hover:bg-[#0062CC] text-white rounded-lg text-[10px] font-semibold transition-all cursor-pointer"
                  >
                    Send Request
                  </button>
                  <button
                    onClick={() => console.log('Show details of:', searchResult.id)}
                    className="py-1.5 px-3 bg-zinc-100 dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-850 rounded-lg text-[10px] font-semibold text-zinc-700 dark:text-zinc-350 transition-all cursor-pointer"
                  >
                    Details
                  </button>
                </div>
              </div>
            ) : hasSearched && searchQuery && !searchLoading ? (
              <div className="text-center py-8 bg-white dark:bg-zinc-900/10 border border-zinc-200 dark:border-zinc-850/40 rounded-2xl p-4 text-zinc-500 dark:text-zinc-450 text-xs flex flex-col items-center justify-center gap-2">
                <AlertCircle className="w-6 h-6 text-zinc-400" />
                <span>No user found with username "@{searchQuery.trim().toLowerCase()}"</span>
              </div>
            ) : null}

            {/* Friend Requests placeholder */}
            <div className="space-y-3">
              <h3 className="text-xs font-semibold text-zinc-400 dark:text-zinc-550 uppercase tracking-wider pl-1">Friend Requests</h3>
              <div className="bg-white dark:bg-zinc-900/10 border border-zinc-250/60 dark:border-zinc-900/40 rounded-3xl p-8 text-center space-y-3 shadow-2xs">
                <UserPlus className="w-8 h-8 text-zinc-400 dark:text-zinc-650 mx-auto" />
                <div className="text-xs font-semibold text-zinc-800 dark:text-white">No pending requests</div>
                <p className="text-[10px] text-zinc-500 dark:text-zinc-450 leading-relaxed max-w-xs mx-auto">
                  When other students send you a friend request, they will appear here.
                </p>
              </div>
            </div>
          </div>
        )}

        {activeTab === 'friends' && (
          /* Friends List placeholder */
          <div className="space-y-3">
            <h3 className="text-xs font-semibold text-zinc-400 dark:text-zinc-550 uppercase tracking-wider pl-1">Your Friends</h3>
            <div className="bg-white dark:bg-zinc-900/10 border border-zinc-250/60 dark:border-zinc-900/40 rounded-3xl p-8 text-center space-y-3 shadow-2xs">
              <Users className="w-8 h-8 text-zinc-400 dark:text-zinc-650 mx-auto" />
              <div className="text-xs font-semibold text-zinc-800 dark:text-white">No friends added yet</div>
              <p className="text-[10px] text-zinc-500 dark:text-zinc-450 leading-relaxed max-w-xs mx-auto">
                Go to the "Search & Requests" tab to find and add other students.
              </p>
            </div>
          </div>
        )}
      </main>

      <Footer />
    </div>
  );
}
