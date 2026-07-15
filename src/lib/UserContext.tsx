import { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { supabase } from '../services/supabase';
import { localStorageCache } from './localStorage';

export interface UserProfile {
  id: string;
  email?: string;
  name?: string;
  username?: string;
  frequency?: number;
  source?: string;
  is_ban?: boolean;
  is_premium?: boolean;
  premium_ends?: string;
  DOB?: string;
  gender?: string;
  country?: string;
  credits?: number;
  profile_picture?: string;
  last_claimed?: string;
  premium_type?: string;
  [key: string]: any;
}

interface UserContextValue {
  userProfile: UserProfile | null;
  profileLoading: boolean;
  userPresence: { active_days: number[]; last_opened: string } | null;
  refreshProfile: (force?: boolean) => Promise<void>;
  refreshCredits: () => Promise<void>;
  logout: () => Promise<void>;
}

const UserContext = createContext<UserContextValue>({
  userProfile: null,
  profileLoading: true,
  userPresence: null,
  refreshProfile: async () => {},
  refreshCredits: async () => {},
  logout: async () => {},
});

export function UserProvider({ children }: { children: React.ReactNode }) {
  const [userProfile, setUserProfile] = useState<UserProfile | null>(null);
  const [profileLoading, setProfileLoading] = useState(true);
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);
  const [userPresence, setUserPresence] = useState<{ active_days: number[]; last_opened: string } | null>(null);

  const fetchProfile = useCallback(async (userId: string) => {
    try {
      const { data, error } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', userId)
        .maybeSingle();

      if (!error && data) {
        const mapped: UserProfile = {
          ...data,
          $id: data.id,
          isBan: data.is_ban,
          isPremium: data.is_premium,
          premiumEnds: data.premium_ends,
          PremiumType: data.premium_type,
          lastClaimed: data.last_claimed,
        };
        setUserProfile(mapped);

        try {
          const todayStr = new Date().toLocaleDateString('en-CA');
          const { data: presenceData, error: presenceErr } = await supabase
            .from('user_presence')
            .select('active_days, last_opened')
            .eq('user_id', userId)
            .maybeSingle();

          if (!presenceErr) {
            if (!presenceData) {
              const newPresence = {
                user_id: userId,
                last_opened: todayStr,
                active_days: [1]
              };
              await supabase.from('user_presence').insert(newPresence);
              setUserPresence({ active_days: [1], last_opened: todayStr });
            } else {
              let activeDays = presenceData.active_days || [];
              if (presenceData.last_opened !== todayStr) {
                const lastDate = new Date(presenceData.last_opened);
                const currDate = new Date(todayStr);
                const diffTime = currDate.getTime() - lastDate.getTime();
                const diffDays = Math.floor(diffTime / (1000 * 60 * 60 * 24));

                if (diffDays > 0) {
                  const missingDaysCount = diffDays - 1;
                  const padding = Array.from({ length: missingDaysCount }, () => 0);
                  activeDays = [...activeDays, ...padding, 1];

                  await supabase
                    .from('user_presence')
                    .update({
                      last_opened: todayStr,
                      active_days: activeDays
                    })
                    .eq('user_id', userId);
                }
              }
              setUserPresence({ active_days: activeDays, last_opened: todayStr });
            }
          }
        } catch (err) {
          console.error('Error in presence check-in:', err);
        }

      } else {
        setUserProfile(null);
        setUserPresence(null);
      }
    } catch {
      setUserProfile(null);
      setUserPresence(null);
    } finally {
      setProfileLoading(false);
    }
  }, []);

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (session) {
        setCurrentUserId(session.user.id);
      } else {
        setCurrentUserId(null);
        setUserProfile(null);
        setUserPresence(null);
        setProfileLoading(false);
        localStorage.removeItem('wachsen_react_query_cache');
      }
    });

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      if (session) {
        setCurrentUserId(session.user.id);
      } else {
        setCurrentUserId(null);
        setUserProfile(null);
        setUserPresence(null);
        setProfileLoading(false);
        localStorage.removeItem('wachsen_react_query_cache');
      }
    });

    return () => {
      subscription.unsubscribe();
    };
  }, []);

  useEffect(() => {
    if (!currentUserId) return;

    fetchProfile(currentUserId);

    const channel = supabase
      .channel(`profile-context-${currentUserId}`)
      .on(
        'postgres_changes',
        { event: 'UPDATE', schema: 'public', table: 'profiles', filter: `id=eq.${currentUserId}` },
        (payload) => {
          const data = payload.new;
          setUserProfile(prev => {
            const base = prev ? { ...prev } : {} as UserProfile;
            return {
              ...base,
              ...data as Partial<UserProfile>,
              $id: data.id,
              isBan: data.is_ban,
              isPremium: data.is_premium,
              premiumEnds: data.premium_ends,
              PremiumType: data.premium_type,
              lastClaimed: data.last_claimed,
            };
          });
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [currentUserId, fetchProfile]);

  const refreshProfile = async () => {
    const session = (await supabase.auth.getSession()).data.session;
    if (session) {
      await fetchProfile(session.user.id);
    }
  };

  const refreshCredits = refreshProfile;

  useEffect(() => {
    if (userProfile) {
      localStorageCache.set(localStorageCache.keys.USER_PROFILE, userProfile);
      localStorageCache.set(localStorageCache.keys.CREDITS, userProfile.credits || 0);
    } else {
      localStorageCache.remove(localStorageCache.keys.USER_PROFILE);
      localStorageCache.remove(localStorageCache.keys.CREDITS);
    }
  }, [userProfile]);

  const logout = async () => {
    await supabase.auth.signOut();
    setUserPresence(null);
  };

  return (
    <UserContext.Provider value={{ userProfile, profileLoading, userPresence, refreshProfile, refreshCredits, logout }}>
      {children}
    </UserContext.Provider>
  );
}

export function useUserProfile() {
  return useContext(UserContext);
}
