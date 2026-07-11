import { useRef, useState } from 'react';
import { supabase } from '../../services/supabase';
import SpotlightCard from '../../ui/SpotlightCard';
import { Loader2 } from 'lucide-react';
import Aurora from '../../effects/Aurora';
import { useTheme } from '../../lib/ThemeContext.tsx';
import { fontSize } from '../../lib/utils';

const GoogleIcon = () => (
  <svg viewBox="0 0 24 24" className="w-5 h-5" fill="currentColor">
    <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4" />
    <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853" />
    <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.26.81-.58z" fill="#FBBC05" />
    <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.83c.87-2.6 3.3-4.52 6.16-4.52z" fill="#EA4335" />
  </svg>
);

const inputCls =
  'w-full bg-white dark:bg-zinc-950 border border-blue-200/30 dark:border-blue-900/20 rounded-xl px-4 py-3 text-black dark:text-white placeholder-zinc-400 dark:placeholder-zinc-600 focus:outline-none focus:border-blue-500 transition-colors font-sans';
const primaryBtnCls =
  'w-full bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-500 hover:to-purple-500 text-white dark:text-white font-medium py-3.5 rounded-xl transition-all disabled:opacity-50 hover:scale-[1.01] active:scale-[0.99] flex items-center justify-center cursor-pointer';

export default function Login() {
  const [googleLoading, setGoogleLoading] = useState(false);
  const [otpLoading, setOtpLoading] = useState(false);
  const [verifyLoading, setVerifyLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [infoMsg, setInfoMsg] = useState<string | null>(null);
  const [email, setEmail] = useState('');
  const [otpDigits, setOtpDigits] = useState<string[]>(Array(6).fill(''));
  const [otpSent, setOtpSent] = useState(false);
  const inputsRef = useRef<(HTMLInputElement | null)[]>([]);

  const busy = googleLoading || otpLoading || verifyLoading;

  const handleGoogleLogin = async () => {
    setGoogleLoading(true);
    setError(null);
    try {
      const { error } = await supabase.auth.signInWithOAuth({
        provider: 'google',
        options: { redirectTo: `${window.location.origin}/` },
      });
      if (error) setError(error.message);
    } catch (err: any) {
      setError(err.message || 'An unexpected error occurred during Google sign-in.');
    } finally {
      setGoogleLoading(false);
    }
  };

  const handleSendOtp = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email) {
      setError('Please enter a valid email address');
      return;
    }
    setOtpLoading(true);
    setError(null);
    setInfoMsg(null);
    try {
      const { error } = await supabase.auth.signInWithOtp({
        email,
        options: { shouldCreateUser: true, emailRedirectTo: `${window.location.origin}/` },
      });
      if (error) {
        setError(error.message);
      } else {
        setOtpSent(true);
        setInfoMsg('Verification code sent to your email');
      }
    } catch (err: any) {
      setError(err.message || 'Failed to send OTP.');
    } finally {
      setOtpLoading(false);
    }
  };

  const handleVerifyOtpDirect = async (code: string) => {
    setVerifyLoading(true);
    setError(null);
    try {
      const { error } = await supabase.auth.verifyOtp({ email, token: code, type: 'email' });
      if (error) setError(error.message);
    } catch (err: any) {
      setError(err.message || 'Failed to verify OTP.');
    } finally {
      setVerifyLoading(false);
    }
  };

  const handleVerifyOtp = async (e: React.FormEvent) => {
    e.preventDefault();
    const code = otpDigits.join('');
    if (code.length < 6) {
      setError('Please enter the complete 6-digit code');
      return;
    }
    await handleVerifyOtpDirect(code);
  };

  const setDigits = (digits: string[]) => {
    setOtpDigits(digits);
    if (digits.join('').length === 6) handleVerifyOtpDirect(digits.join(''));
  };

  const handleChange = (index: number, value: string) => {
    if (!/^\d*$/.test(value)) return;
    const next = [...otpDigits];
    next[index] = value.slice(-1);
    setDigits(next);
    if (value && index < 5) inputsRef.current[index + 1]?.focus();
  };

  const handleKeyDown = (index: number, e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key !== 'Backspace') return;
    const next = [...otpDigits];
    if (!otpDigits[index] && index > 0) {
      next[index - 1] = '';
      inputsRef.current[index - 1]?.focus();
    } else {
      next[index] = '';
    }
    setOtpDigits(next);
  };

  const handlePaste = (e: React.ClipboardEvent<HTMLInputElement>) => {
    e.preventDefault();
    const pasted = e.clipboardData.getData('text').trim();
    if (!/^\d{6}$/.test(pasted)) return;
    setDigits(pasted.split(''));
    inputsRef.current[5]?.focus();
  };

  return (
    <SpotlightCard
      spotlightColor="rgba(59, 130, 246, 0.15)"
      className="w-screen h-screen flex items-center justify-center p-4 bg-white dark:bg-black font-sans selection:bg-blue-500/30 overflow-hidden relative"
    >
      <div className="absolute inset-0 z-0 w-full h-full opacity-40">
        <Aurora colorStops={['#7cff67', '#B497CF', '#5227FF']} blend={0.5} amplitude={1.0} speed={1} />
      </div>
      <div className="absolute inset-0 bg-gradient-to-br from-blue-950/20 to-purple-950/20 blur-[120px] z-0" />

      <div className="w-full max-w-sm relative z-10 flex flex-col items-center">
        <div className="text-center mb-10">
          <h1 className="text-black dark:text-white tracking-normal font-normal leading-none" style={{ fontSize: fontSize['5xl'], fontFamily: '"Times New Roman", Times, serif' }}>Wachsen</h1>
          <p className="text-zinc-500 dark:text-zinc-400 mt-4 font-sans" style={{ fontSize: fontSize.xs }}>Plan . Execute . Revise all in one place</p>
        </div>

        {error && (
          <p className="mb-4 text-blue-800 dark:text-blue-200 p-3 bg-blue-100/60 dark:bg-blue-950/40 border border-blue-200/30 dark:border-blue-900/35 rounded-xl w-full text-center animate-fade-in" style={{ fontSize: fontSize.sm }}>
            {error}
          </p>
        )}
        {infoMsg && (
          <p className="mb-4 text-purple-800 dark:text-purple-200 p-3 bg-purple-100/60 dark:bg-purple-950/40 border border-purple-200/30 dark:border-purple-900/35 rounded-xl w-full text-center animate-fade-in" style={{ fontSize: fontSize.sm }}>
            {infoMsg}
          </p>
        )}

        <div className="w-full rounded-2xl p-6 bg-zinc-50/60 dark:bg-zinc-950/60 border border-black/10 dark:border-white/10 dark:shadow-[0_0_40px_rgba(255,255,255,0.09)] relative overflow-hidden backdrop-blur-md">
          {busy && (
            <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-blue-500 via-purple-500 to-blue-500 animate-loading-line" />
          )}

          {!otpSent ? (
            <div className="space-y-4">
              <form onSubmit={handleSendOtp} className="space-y-4">
                <input
                  type="email"
                  placeholder="Enter your email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  disabled={busy}
                  required
                  className={inputCls}
                  style={{ fontSize: fontSize.sm }}
                />
                <button type="submit" disabled={busy} className={primaryBtnCls} style={{ fontSize: fontSize.sm }}>
                  {otpLoading ? <Loader2 className="w-5 h-5 animate-spin" /> : 'Send OTP'}
                </button>
              </form>

              <div className="flex items-center justify-between gap-4 py-2">
                <div className="h-px bg-zinc-200/60 dark:bg-zinc-900/60 flex-1" />
                <span className="font-medium font-sans text-zinc-400 dark:text-zinc-600" style={{ fontSize: fontSize.xs }}>or</span>
                <div className="h-px bg-zinc-200/60 dark:bg-zinc-900/60 flex-1" />
              </div>

              <button
                onClick={handleGoogleLogin}
                disabled={busy}
                className="flex w-full items-center justify-center gap-3 rounded-xl bg-black/5 dark:bg-white/5 border border-black/10 dark:border-white/10 hover:bg-black/10 dark:hover:bg-white/10 px-4 py-4 text-black dark:text-white font-medium transition-all hover:scale-[1.02] active:scale-[0.98] disabled:opacity-50 cursor-pointer"
                style={{ fontSize: fontSize.sm }}
              >
                {googleLoading ? (
                  <Loader2 className="w-5 h-5 animate-spin" />
                ) : (
                  <>
                    <GoogleIcon />
                    Continue with Google
                  </>
                )}
              </button>
            </div>
          ) : (
            <form onSubmit={handleVerifyOtp} className="space-y-6">
              <div className="flex justify-between gap-2 max-w-[280px] mx-auto">
                {otpDigits.map((digit, idx) => (
                  <input
                    key={idx}
                    type="text"
                    inputMode="numeric"
                    maxLength={1}
                    value={digit}
                    ref={(el) => { inputsRef.current[idx] = el; }}
                    onChange={(e) => handleChange(idx, e.target.value)}
                    onKeyDown={(e) => handleKeyDown(idx, e)}
                    onPaste={idx === 0 ? handlePaste : undefined}
                    disabled={busy}
                    className="w-10 h-12 bg-white dark:bg-zinc-950 border border-blue-200/30 dark:border-blue-900/30 rounded-xl text-black dark:text-white text-center font-semibold focus:outline-none focus:border-blue-500 transition-colors"
                    style={{ fontSize: fontSize.lg }}
                  />
                ))}
              </div>
              <button type="submit" disabled={busy} className={primaryBtnCls} style={{ fontSize: fontSize.sm }}>
                {verifyLoading ? <Loader2 className="w-5 h-5 animate-spin" /> : 'Sign In'}
              </button>
              <button
                type="button"
                onClick={() => setOtpSent(false)}
                disabled={busy}
                className="w-full text-zinc-500 dark:text-zinc-500 hover:text-black dark:hover:text-white font-medium py-1 transition-colors cursor-pointer disabled:opacity-50"
                style={{ fontSize: fontSize.xs }}
              >
                Go Back
              </button>
            </form>
          )}
        </div>
      </div>
    </SpotlightCard>
  );
}
