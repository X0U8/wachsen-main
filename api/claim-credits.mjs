import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.VITE_SUPABASE_URL;
const supabaseAnonKey = process.env.VITE_SUPABASE_ANON_KEY;

const CREDITS_MAP = {
  'Free': 20,
  'Glix Lite': 75,
  'Glix Rise': 150,
  'Glix Peak': 300,
};

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  try {
    const { userId, authToken, check } = req.body;
    if (!userId || !authToken) return res.status(400).json({ error: 'Missing userId or authToken' });

    const authed = createClient(supabaseUrl, supabaseAnonKey, {
      global: { headers: { Authorization: `Bearer ${authToken}` } }
    });

    const { data: profile, error } = await authed.from('profiles').select('id, credits, premium_type, last_claimed, is_premium').eq('id', userId).single();
    if (error || !profile) return res.status(400).json({ error: 'User not found' });

    const plan = profile.premium_type || 'Free';
    const dailyCredits = CREDITS_MAP[plan] || 20;

    const now = new Date();
    const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const lastClaimed = profile.last_claimed ? new Date(profile.last_claimed) : null;

    if (lastClaimed && lastClaimed >= todayStart) {
      const msUntilMidnight = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1).getTime() - now.getTime();
      return res.json({ canClaim: false, cooldownRemaining: Math.ceil(msUntilMidnight / 1000), error: 'Already claimed today' });
    }

    if (check) return res.json({ canClaim: true, dailyCredits });

    const newCreditsTotal = (profile.credits || 0) + dailyCredits;

    const { error: updateError } = await authed.from('profiles').update({
      credits: newCreditsTotal,
      last_claimed: now.toISOString(),
    }).eq('id', userId);

    if (updateError) return res.status(500).json({ error: 'Failed to update credits' });

    return res.json({ success: true, creditsAdded: dailyCredits, newTotal: newCreditsTotal, lastClaimed: now.toISOString() });
  } catch (error) {
    console.error('Claim credits error:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
}
