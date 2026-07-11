import { useState } from 'react';
import Stepper from '../../ui/Stepper';
import { supabase } from '../../services/supabase';
import { Session } from '@supabase/supabase-js';
import InfoComponent, { InfoType } from '../../ui/InfoComponent';
import { fontSize } from '../../lib/utils';
import StepName from './StepName';
import StepUsername from './StepUsername';
import StepFrequency from './StepFrequency';
import StepDOB from './StepDOB';
import StepGender from './StepGender';
import StepCountry from './StepCountry';
import StepSource from './StepSource';

const inputCls =
  "w-full bg-zinc-50/60 dark:bg-zinc-950/60 border border-zinc-200 dark:border-zinc-800 focus:border-blue-500/40 rounded-xl px-4 py-3 text-black dark:text-white placeholder-zinc-400 dark:placeholder-zinc-600 focus:outline-none transition-colors font-sans";

const selectCls =
  "w-full bg-zinc-50/60 dark:bg-zinc-950/60 border border-zinc-200 dark:border-zinc-800 focus:border-blue-500/40 rounded-xl px-4 py-3 text-black dark:text-white focus:outline-none transition-colors font-sans";

export default function Onboarding({
  session,
  onComplete,
}: {
  session: Session;
  onComplete: () => void;
}) {
  const [data, setData] = useState({
    name: '',
    username: '',
    frequency: '',
    source: '',
    dobDay: '',
    dobMonth: '',
    dobYear: '',
    gender: '',
    country: ''
  });

  const [activeStep, setActiveStep] = useState(1);
  const [usernameVerified, setUsernameVerified] = useState(false);
  const [isVerifyingUsername, setIsVerifyingUsername] = useState(false);
  const [usernameMessage, setUsernameMessage] = useState<string | null>(null);
  const [alert, setAlert] = useState<{ message: string; type: InfoType } | null>(null);

  const updateData = (field: string, value: string) => {
    setData(prev => ({ ...prev, [field]: value }));
  };

  const isStepValid = (step: number) => {
    switch (step) {
      case 1: return data.name.trim().length >= 3 && data.name.trim().length <= 10;
      case 2: return data.username.trim().length >= 4 && data.username.trim().length <= 8;
      case 3: return !!data.frequency.trim() && !isNaN(Number(data.frequency)) && Number(data.frequency) > 0;
      case 4: return !!(data.dobDay && data.dobMonth && data.dobYear);
      case 5: return !!data.gender;
      case 6: return !!data.country;
      case 7: return !!data.source;
      default: return true;
    }
  };

  const verifyUsername = async () => {
    const rawUsername = data.username.trim();
    if (rawUsername.length < 4 || rawUsername.length > 8) {
      setUsernameMessage('Username must be between 4 and 8 characters.');
      return false;
    }

    setIsVerifyingUsername(true);
    setUsernameMessage(null);
    try {
      const { data: existing, error } = await supabase
        .from('profiles')
        .select('id')
        .ilike('username', rawUsername)
        .maybeSingle();

      if (error && error.code !== 'PGRST116') throw error;

      if (existing) {
        setUsernameVerified(false);
        setUsernameMessage('This username is already taken.');
        return false;
      } else {
        setUsernameVerified(true);
        setUsernameMessage('Username is available!');
        return true;
      }
    } catch (err: any) {
      setUsernameMessage('Error checking username: ' + err.message);
      return false;
    } finally {
      setIsVerifyingUsername(false);
    }
  };

  const handleNextInterceptor = async (step: number) => {
    if (step === 2 && !usernameVerified) {
      return await verifyUsername();
    }
    return true;
  };

  const handleUsernameChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const cleanVal = e.target.value.toLowerCase().replace(/[^a-z0-9_.]/g, '');
    updateData('username', cleanVal);
    setUsernameVerified(false);
    setUsernameMessage(null);
  };

  const handleFrequencyChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const cleanVal = e.target.value.replace(/\D/g, '').replace(/^0+/, '');
    if (cleanVal === '') {
      updateData('frequency', '');
      return;
    }
    const num = parseInt(cleanVal, 10);
    if (num >= 1 && num <= 99) {
      updateData('frequency', num.toString());
    } else if (num > 99) {
      updateData('frequency', '99');
    }
  };

  const handleSave = async () => {
    try {
      let existingProfile: any = null;
      try {
        const { data: profile } = await supabase
          .from('profiles')
          .select('*')
          .eq('id', session.user.id)
          .maybeSingle();
        existingProfile = profile;
      } catch { }

      const DOB = data.dobDay && data.dobMonth && data.dobYear
        ? `${data.dobYear}-${data.dobMonth.padStart(2, '0')}-${data.dobDay.padStart(2, '0')}`
        : null;

      const { error } = await supabase
        .from('profiles')
        .upsert({
          id: session.user.id,
          email: session.user.email,
          name: data.name,
          username: data.username,
          frequency: data.frequency ? parseInt(data.frequency, 10) : null,
          source: data.source,
          DOB,
          gender: data.gender,
          country: data.country,
          is_ban: existingProfile?.is_ban ?? false,
          is_premium: existingProfile?.is_premium ?? false,
          premium_ends: existingProfile?.premium_ends ?? null,
          credits: existingProfile?.credits ?? null,
          profile_picture: existingProfile?.profile_picture ?? null,
          last_claimed: existingProfile?.last_claimed ?? null,
          premium_type: existingProfile?.premium_type ?? null,
        }, { onConflict: 'id' });

      if (error) throw error;
      onComplete();
    } catch (err: any) {
      setAlert({ message: err.message || 'Failed to save onboarding data.', type: 'error' });
    }
  };

  return (
    <div className="min-h-screen bg-white dark:bg-black flex flex-col items-center justify-center p-6 text-black dark:text-white selection:bg-blue-500/30 font-sans">
      <div className="w-full max-w-lg mb-6">
        <h1 className="font-light text-black dark:text-white tracking-tight" style={{ fontSize: fontSize['3xl'] }}>Welcome to Wachsen!</h1>
        <p className="text-zinc-500 dark:text-zinc-400 mt-1" style={{ fontSize: fontSize.sm }}>Let's set up your profile.</p>
      </div>

      <div className="w-full max-w-lg bg-zinc-50/60 dark:bg-zinc-950/60 border border-black/15 dark:border-white/15 rounded-3xl p-6 backdrop-blur-xl">
        <Stepper
          onFinalStepCompleted={handleSave}
          onStepChange={(step) => setActiveStep(step)}
          onNext={handleNextInterceptor}
          nextButtonProps={{ disabled: !isStepValid(activeStep) || isVerifyingUsername }}
          nextButtonText={activeStep === 2 && !usernameVerified ? (isVerifyingUsername ? 'Verifying...' : 'Verify') : 'Continue'}
          contentClassName="min-h-[100px]"
        >
          <StepName value={data.name} onChange={v => updateData('name', v)} inputCls={inputCls} />
          <StepUsername value={data.username} onChange={handleUsernameChange} message={usernameMessage} verified={usernameVerified} inputCls={inputCls} />
          <StepFrequency value={data.frequency} onChange={handleFrequencyChange} inputCls={inputCls} />
          <StepDOB day={data.dobDay} month={data.dobMonth} year={data.dobYear} onChange={(f, v) => updateData(f, v)} selectCls={selectCls} />
          <StepGender value={data.gender} onChange={v => updateData('gender', v)} selectCls={selectCls} />
          <StepCountry value={data.country} onChange={v => updateData('country', v)} selectCls={selectCls} />
          <StepSource value={data.source} onChange={v => updateData('source', v)} selectCls={selectCls} />
        </Stepper>
      </div>

      {alert && (
        <InfoComponent message={alert.message} type={alert.type} onClose={() => setAlert(null)} />
      )}
    </div>
  );
}
