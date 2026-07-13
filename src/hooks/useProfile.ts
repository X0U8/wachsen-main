import { useEffect, useState, useCallback } from 'react';
import { supabase } from '../services/supabase';

export interface Profile {
  id: string;
  email: string;
  name: string;
  username: string;
  frequency: number;
  source: string;
  DOB: string | null;
  gender: string;
  country: string;
  is_ban: boolean;
  is_premium: boolean;
  premium_ends: string | null;
  credits: number | null;
  profile_picture: string | null;
  last_claimed: string | null;
  premium_type: string | null;
}

export function useProfile(userId: string | undefined) {
  const [profile, setProfile] = useState<Profile | null>(null);
  const [loading, setLoading] = useState(true);

  const fetchProfile = useCallback(async () => {
    if (!userId) return;
    try {
      const { data, error } = await supabase
        .from('profiles')
        .select('id, email, name, username, frequency, source, DOB, gender, country, is_ban, is_premium, premium_ends, credits, profile_picture, last_claimed, premium_type')
        .eq('id', userId)
        .maybeSingle();

      if (!error && data) {
        setProfile(data as Profile);
      }
    } catch {
    } finally {
      setLoading(false);
    }
  }, [userId]);

  useEffect(() => {
    if (!userId) {
      setProfile(null);
      setLoading(false);
      return;
    }

    fetchProfile();

    const channel = supabase
      .channel(`profile-${userId}`)
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'profiles',
          filter: `id=eq.${userId}`,
        },
        (payload) => {
          setProfile(payload.new as Profile);
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [userId, fetchProfile]);

  return { profile, loading, refetch: fetchProfile };
}
