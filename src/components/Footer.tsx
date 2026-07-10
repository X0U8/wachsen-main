import { useRef, useEffect, useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { useUserProfile } from '../lib/UserContext.tsx';
import { FilePenLineIcon } from '../icons/FilePenLineIcon';
import { HistoryIcon } from '../icons/HistoryIcon';
import { UsersIcon } from '../icons/UsersIcon';
import { TelescopeIcon } from '../icons/TelescopeIcon';
import { fontSize } from '../lib/utils';
import ProfileCard from './profile/ProfileCard';

export default function Footer() {
  const location = useLocation();
  const { userProfile } = useUserProfile();
  const [showProfile, setShowProfile] = useState(false);

  const examRef = useRef<any>(null);
  const resultsRef = useRef<any>(null);
  const groupsRef = useRef<any>(null);
  const revisionRef = useRef<any>(null);

  useEffect(() => {
    const interval = setInterval(() => {
      [examRef, resultsRef, groupsRef, revisionRef]
        .forEach(ref => ref.current?.startAnimation?.());
      setTimeout(() => {
        [examRef, resultsRef, groupsRef, revisionRef]
          .forEach(ref => ref.current?.stopAnimation?.());
      }, 1000);
    }, 5000);
    return () => clearInterval(interval);
  }, []);

  const isActive = (path: string) => location.pathname === path;
  const isProfileActive = isActive('/profile');

  const NavLink = ({ to, icon }: { to: string; icon: React.ReactNode }) => (
    <Link
      to={to}
      className="flex-1 flex flex-col items-center justify-center py-2 sm:py-3 h-full transition-all duration-200"
    >
      <div
        className={`flex items-center justify-center transition-all duration-200
          ${isActive(to)
            ? 'text-blue-600 dark:text-blue-400 scale-110 drop-shadow-[0_2px_8px_rgba(37,99,235,0.2)]'
            : 'text-zinc-450 dark:text-gray-500 hover:text-zinc-700 dark:hover:text-gray-100'
          }`}
      >
        {icon}
      </div>
    </Link>
  );

  return (
    <>
      <footer className="fixed bottom-0 left-0 w-full bg-white/80 dark:bg-black border-t border-zinc-200 dark:border-gray-900 shadow-[0_-8px_32px_rgba(0,0,0,0.06)] dark:shadow-[0_-8px_32px_rgba(0,0,0,0.5)] backdrop-blur-xl transition-colors duration-300 z-50">
        <div className="w-full max-w-5xl mx-auto flex items-center justify-between h-14 sm:h-16 px-2">
          <NavLink to="/exam" icon={<FilePenLineIcon ref={examRef} size={20} />} />
          <NavLink to="/results" icon={<HistoryIcon ref={resultsRef} size={20} />} />

          <button
            onClick={() => setShowProfile(true)}
            className="flex-1 flex items-center justify-center h-full group cursor-pointer"
          >
            {userProfile ? (
              <div className={`w-8 h-8 sm:w-9 sm:h-9 md:w-10 md:h-10 rounded-full overflow-hidden transition-all duration-300 shadow-sm group-hover:scale-105
                ${isProfileActive
                  ? 'ring-2 ring-blue-500 dark:ring-blue-400 ring-offset-2 ring-offset-zinc-50 dark:ring-offset-black'
                  : 'ring-1 ring-zinc-200 dark:ring-gray-800'
                }`}
              >
                {userProfile.profile_picture && userProfile.profile_picture.trim() !== '' ? (
                  <img
                    src={userProfile.profile_picture}
                    alt={userProfile.name || 'Profile'}
                    className="w-full h-full object-cover"
                    onError={(e) => {
                      (e.target as HTMLImageElement).style.display = 'none';
                      (e.target as HTMLImageElement).nextElementSibling?.classList.remove('hidden');
                    }}
                  />
                ) : null}
                <div className="w-full h-full bg-linear-to-br from-blue-500 to-indigo-600 flex items-center justify-center text-white font-medium tracking-wider" style={{ fontSize: fontSize.xs }}>
                  {userProfile.name ? userProfile.name[0].toUpperCase() : 'U'}
                </div>
              </div>
            ) : (
              <div className={`w-8 h-8 sm:w-9 sm:h-9 md:w-10 md:h-10 rounded-full bg-zinc-200 dark:bg-gray-800 transition-all duration-300 group-hover:scale-105
                ${isProfileActive ? 'ring-2 ring-blue-500 dark:ring-blue-400 ring-offset-2 ring-offset-zinc-50 dark:ring-offset-black' : ''}`}
              />
            )}
          </button>

          <NavLink to="/friends" icon={<UsersIcon ref={groupsRef} size={20} />} />
          <NavLink to="/revision" icon={<TelescopeIcon ref={revisionRef} size={20} />} />
        </div>
      </footer>

      {showProfile && <ProfileCard onClose={() => setShowProfile(false)} />}
    </>
  );
}
