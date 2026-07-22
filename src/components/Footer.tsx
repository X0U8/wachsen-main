import { useRef, useEffect, useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { useUserProfile } from '../lib/UserContext.tsx';
import { useTheme } from '../lib/ThemeContext.tsx';
import { useCachedImage } from '../hooks/useCachedImage';
import { FilePenLineIcon } from '../icons/FilePenLineIcon';
import { FileCheckIcon } from '../icons/FileCheckIcon';
import { UsersIcon } from '../icons/UsersIcon';
import { TelescopeIcon } from '../icons/TelescopeIcon';
import { fontSize } from '../lib/utils';
import PublicProfileModal from './profile/PublicProfileModal';

export default function Footer() {
  const location = useLocation();
  const { userProfile } = useUserProfile();
  const { fontSizeLevel } = useTheme();
  const cachedProfilePicture = useCachedImage(userProfile?.profile_picture);
  const [showProfile, setShowProfile] = useState(false);

  const examRef = useRef<any>(null);
  const resultsRef = useRef<any>(null);
  const groupsRef = useRef<any>(null);
  const revisionRef = useRef<any>(null);

  const getIconSize = () => {
    if (fontSizeLevel === 'small') return 18;
    if (fontSizeLevel === 'larger') return 24;
    if (fontSizeLevel === 'large') return 22;
    return 20;
  };
  const iconSize = getIconSize();

  const getProfileSizeClass = () => {
    if (fontSizeLevel === 'small') return 'w-6 h-6 sm:w-7 sm:h-7';
    if (fontSizeLevel === 'large') return 'w-10 h-10 sm:w-11 sm:h-11';
    if (fontSizeLevel === 'larger') return 'w-12 h-12 sm:w-13 sm:h-13';
    return 'w-8 h-8 sm:w-9 sm:h-9';
  };
  const profileSizeClass = getProfileSizeClass();

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
        className={`flex items-center justify-center transition-all duration-200 [&_svg]:fill-current/15
          ${isActive(to)
            ? 'text-blue-600 dark:text-blue-400 scale-110 drop-shadow-[0_2px_8px_rgba(37,99,235,0.2)] [&_svg]:fill-blue-600/15 dark:[&_svg]:fill-blue-400/15'
            : 'text-zinc-450 dark:text-gray-550 hover:text-zinc-700 dark:hover:text-gray-100 [&_svg]:fill-zinc-450/15 dark:[&_svg]:fill-gray-550/10'
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
          <NavLink to="/exam" icon={<FilePenLineIcon ref={examRef} size={iconSize} />} />
          <NavLink to="/results" icon={<FileCheckIcon ref={resultsRef} size={iconSize} />} />

          <button
            onClick={() => setShowProfile(true)}
            className="flex-1 flex items-center justify-center h-full group cursor-pointer"
          >
            {userProfile ? (
              <div className={`rounded-full overflow-hidden transition-all duration-300 shadow-sm group-hover:scale-105 ${profileSizeClass}
                ${isProfileActive
                  ? 'ring-2 ring-blue-500 dark:ring-blue-400 ring-offset-2 ring-offset-zinc-50 dark:ring-offset-black'
                  : 'ring-1 ring-zinc-200 dark:ring-gray-800'
                }`}
              >
                {cachedProfilePicture && cachedProfilePicture.trim() !== '' ? (
                  <img
                    src={cachedProfilePicture}
                    alt={userProfile.name || 'Profile'}
                    className="w-full h-full object-cover"
                    onError={(e) => {
                      (e.target as HTMLImageElement).style.display = 'none';
                      (e.target as HTMLImageElement).nextElementSibling?.classList.remove('hidden');
                    }}
                  />
                ) : null}
                <div
                  className="w-full h-full bg-linear-to-br from-blue-500 to-indigo-600 flex items-center justify-center text-white font-medium tracking-wider text-xs">
                  {userProfile.name ? userProfile.name[0].toUpperCase() : 'U'}
                </div>
              </div>
            ) : (
              <div className={`rounded-full bg-zinc-200 dark:bg-gray-800 transition-all duration-300 group-hover:scale-105 ${profileSizeClass}
                ${isProfileActive ? 'ring-2 ring-blue-500 dark:ring-blue-400 ring-offset-2 ring-offset-zinc-50 dark:ring-offset-black' : ''}`}
              />
            )}
          </button>

          <NavLink to="/friends" icon={<UsersIcon ref={groupsRef} size={iconSize} />} />
          <NavLink to="/revision" icon={<TelescopeIcon ref={revisionRef} size={iconSize} />} />
        </div>
      </footer>
      {showProfile && <PublicProfileModal onClose={() => setShowProfile(false)} />}
    </>
  );
}
