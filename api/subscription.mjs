import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.VITE_SUPABASE_URL;
const supabaseAnonKey = process.env.VITE_SUPABASE_ANON_KEY;

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  try {
    const {
      action,
      userId,
      authToken,
      plan,
      creditsPerDay,
      period,
      amount,
      currency,
      razorpay_payment_id,
      razorpay_order_id,
      razorpay_signature
    } = req.body;

    if (!userId || !authToken) {
      return res.status(400).json({ error: 'Missing userId or authToken' });
    }

    const authed = createClient(supabaseUrl, supabaseAnonKey, {
      global: { headers: { Authorization: `Bearer ${authToken}` } }
    });

    const isFree = plan.toLowerCase() === 'free';
    const isPremium = !isFree;
    const now = new Date();
    
    let premiumEnds = null;
    if (isPremium) {
      if (period === 'year' || period === 'yearly') {
        premiumEnds = new Date(now.getFullYear() + 1, now.getMonth(), now.getDate()).toISOString();
      } else {
        premiumEnds = new Date(now.getFullYear(), now.getMonth() + 1, now.getDate()).toISOString();
      }
    }

    // Insert transaction log
    const { error: txError } = await authed
      .from('transactions')
      .insert({
        user_id: userId,
        plan_name: plan,
        amount: amount || 0,
        currency: currency || 'USD',
        payment_id: razorpay_payment_id || null,
        order_id: razorpay_order_id || null,
        signature: razorpay_signature || null,
        period: period || 'month',
        status: 'success'
      });

    if (txError) {
      console.error('Transaction logging failed:', txError);
      throw txError;
    }

    // Update profiles table
    const { error: profileError } = await authed
      .from('profiles')
      .update({
        is_premium: isPremium,
        premium_ends: premiumEnds,
        premium_type: plan,
        credits: creditsPerDay || 20
      })
      .eq('id', userId);

    if (profileError) throw profileError;

    return res.status(200).json({ success: true });
  } catch (error) {
    console.error('Subscription handler error:', error);
    return res.status(500).json({ error: 'Internal server error', details: error.message });
  }
}
