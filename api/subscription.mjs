import { createClient } from '@supabase/supabase-js';
import crypto from 'crypto';

const supabaseUrl = process.env.VITE_SUPABASE_URL;
const supabaseAnonKey = process.env.VITE_SUPABASE_ANON_KEY;
const RAZORPAY_KEY_ID = process.env.RAZORPAY_KEY_ID;
const RAZORPAY_KEY_SECRET = process.env.RAZORPAY_KEY_SECRET;

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






    if (action === 'create-order') {
      if (!RAZORPAY_KEY_ID || !RAZORPAY_KEY_SECRET) {
        return res.status(500).json({ error: 'Razorpay credentials not configured.' });
      }

      const amountInPaise = Math.round(amount * 100);

      const response = await fetch('https://api.razorpay.com/v1/orders', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: 'Basic ' + Buffer.from(`${RAZORPAY_KEY_ID}:${RAZORPAY_KEY_SECRET}`).toString('base64'),
        },
        body: JSON.stringify({
          amount: amountInPaise,
          currency: currency || 'INR',
          receipt: `rcpt_${userId.slice(-8)}_${Date.now().toString().slice(-8)}`,
          notes: { plan, period, userId },
        }),
      });

      const orderData = await response.json();

      if (!response.ok || !orderData.id) {
        console.error('Razorpay order creation failed:', orderData);
        return res.status(500).json({ error: 'Failed to create payment order.', details: orderData.error?.description });
      }

      return res.status(200).json({ success: true, order_id: orderData.id });
    }




    if (action === 'process') {
      if (!razorpay_payment_id || !razorpay_order_id || !razorpay_signature) {
        return res.status(400).json({ error: 'Missing payment verification data.' });
      }

      if (!RAZORPAY_KEY_SECRET) {
        return res.status(500).json({ error: 'Razorpay secret not configured.' });
      }


      const expectedSignature = crypto
        .createHmac('sha256', RAZORPAY_KEY_SECRET)
        .update(`${razorpay_order_id}|${razorpay_payment_id}`)
        .digest('hex');

      if (expectedSignature !== razorpay_signature) {
        console.error('Razorpay signature mismatch!', { expectedSignature, razorpay_signature });
        return res.status(400).json({ error: 'Payment verification failed. Invalid signature.' });
      }


      return activateSubscription(res, authed, { userId, plan, creditsPerDay, period, amount, currency, razorpay_payment_id, razorpay_order_id, razorpay_signature });
    }




    if (action === 'update') {
      return activateSubscription(res, authed, { userId, plan, creditsPerDay, period: period || 'month', amount: 0, currency: 'USD', razorpay_payment_id: null, razorpay_order_id: null, razorpay_signature: null });
    }

    return res.status(400).json({ error: 'Invalid action.' });

  } catch (error) {
    console.error('Subscription handler error:', error);
    return res.status(500).json({ error: 'Internal server error', details: error.message });
  }
}




async function activateSubscription(res, authed, { userId, plan, creditsPerDay, period, amount, currency, razorpay_payment_id, razorpay_order_id, razorpay_signature }) {
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
    return res.status(500).json({ error: 'Failed to log transaction.', details: txError.message });
  }


  const { error: profileError } = await authed
    .from('profiles')
    .update({
      is_premium: isPremium,
      premium_ends: premiumEnds,
      premium_type: plan,
      credits: creditsPerDay || 20
    })
    .eq('id', userId);

  if (profileError) {
    console.error('Profile update failed:', profileError);
    return res.status(500).json({ error: 'Failed to update profile.', details: profileError.message });
  }

  return res.status(200).json({ success: true });
}
