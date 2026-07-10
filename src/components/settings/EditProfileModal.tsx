import { useState, useEffect } from 'react';
import { useUserProfile } from '../../lib/UserContext';
import { useTheme } from '../../lib/ThemeContext';
import { fontSize } from '../../lib/utils';
import { User, AlertCircle, X } from 'lucide-react';
import { supabase } from '../../services/supabase';
import { COUNTRIES } from '../../data/countries';
import { DAYS, MONTHS, YEARS } from '../../data/dates';
import { localStorageCache } from '../../lib/localStorage';

interface EditProfileModalProps {
  show: boolean;
  onClose: () => void;
}

const inputCls =
  "w-full bg-zinc-100 dark:bg-gray-950 border border-zinc-300 dark:border-gray-800 rounded-xl px-3 py-2 text-zinc-900 dark:text-white placeholder-zinc-400 dark:placeholder-zinc-600 focus:outline-none focus:ring-1 focus:ring-[#007AFF] transition-colors font-sans";

const selectCls =
  "w-full bg-zinc-100 dark:bg-gray-950 border border-zinc-300 dark:border-gray-700 rounded-xl px-3 py-2 text-zinc-900 dark:text-white focus:outline-none focus:ring-1 focus:ring-[#007AFF] cursor-pointer transition-colors font-sans";

export default function EditProfileModal({ show, onClose }: EditProfileModalProps) {
  const { userProfile, refreshProfile } = useUserProfile();
  const { theme } = useTheme();

  const [editName, setEditName] = useState('');
  const [editPicUrl, setEditPicUrl] = useState('');
  const [editGender, setEditGender] = useState('');
  const [editCountry, setEditCountry] = useState('');
  const [dobDay, setDobDay] = useState('');
  const [dobMonth, setDobMonth] = useState('');
  const [dobYear, setDobYear] = useState('');

  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (userProfile && show) {
      setEditName(userProfile.name || '');
      setEditPicUrl(userProfile.profile_picture || '');
      setEditGender(userProfile.gender || '');
      setEditCountry(userProfile.country || '');
      
      const dobStr = userProfile.DOB || '';
      if (dobStr && dobStr.includes('-')) {
        const [y, m, d] = dobStr.split('-');
        setDobYear(parseInt(y, 10).toString());
        setDobMonth(parseInt(m, 10).toString());
        setDobDay(parseInt(d, 10).toString());
      } else {
        setDobDay('');
        setDobMonth('');
        setDobYear('');
      }
      setError('');
    }
  }, [userProfile, show]);

  if (!show || !userProfile) return null;

  const handleSave = async () => {
    const trimmedName = editName.trim();
    if (trimmedName.length < 3) {
      setError('Name must be at least 3 characters.');
      return;
    }
    if (trimmedName.length > 8) {
      setError('Name must be at most 8 characters.');
      return;
    }

    setSaving(true);
    setError('');

    // Format DOB like onboarding: YYYY-MM-DD
    const formattedDOB = dobDay && dobMonth && dobYear
      ? `${dobYear}-${dobMonth.padStart(2, '0')}-${dobDay.padStart(2, '0')}`
      : null;

    try {
      const updatePayload = {
        name: trimmedName,
        profile_picture: editPicUrl.trim() || null,
        gender: editGender || null,
        country: editCountry || null,
        DOB: formattedDOB
      };

      const { error: dbError } = await supabase
        .from('profiles')
        .update(updatePayload)
        .eq('id', userProfile.id);

      if (dbError) {
        setError(dbError.message);
      } else {
        // Explicitly sync localStorage cached profile
        const cachedProfile = localStorageCache.get<any>(localStorageCache.keys.USER_PROFILE) || {};
        const updatedProfile = {
          ...cachedProfile,
          ...updatePayload,
          is_ban: cachedProfile.is_ban,
          is_premium: cachedProfile.is_premium,
          premium_ends: cachedProfile.premium_ends,
          credits: cachedProfile.credits,
          premium_type: cachedProfile.premium_type,
          last_claimed: cachedProfile.last_claimed,
          name: trimmedName,
          profile_picture: editPicUrl.trim() || null,
          gender: editGender || null,
          country: editCountry || null,
          DOB: formattedDOB,
          $id: userProfile.id,
          isBan: cachedProfile.isBan,
          isPremium: cachedProfile.isPremium,
          premiumEnds: cachedProfile.premiumEnds,
          PremiumType: cachedProfile.PremiumType,
          lastClaimed: cachedProfile.lastClaimed,
        };
        localStorageCache.set(localStorageCache.keys.USER_PROFILE, updatedProfile);

        await refreshProfile();
        onClose();
      }
    } catch (err: any) {
      setError(err?.message || 'Failed to update profile');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 sm:p-6"
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}>
      <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-gray-800 rounded-3xl p-5 sm:p-6 w-full max-w-md space-y-4 shadow-2xl transition-all duration-300">
        
        {/* Header */}
        <div className="flex items-center justify-between border-b border-zinc-150 dark:border-gray-800 pb-3">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-purple-500/10 rounded-xl">
              <User className="w-5 h-5 text-purple-500" />
            </div>
            <div>
              <h3 className="font-semibold text-zinc-900 dark:text-white" style={{ fontSize: fontSize.base }}>Edit Profile</h3>
              <p className="text-zinc-500 dark:text-gray-400" style={{ fontSize: fontSize.xs }}>Update your account details</p>
            </div>
          </div>
          <button onClick={onClose} className="p-1 hover:bg-zinc-100 dark:hover:bg-gray-850 rounded-lg text-zinc-400 hover:text-zinc-600 transition-colors">
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Error Info */}
        {error && (
          <div className="p-3 bg-red-50 dark:bg-red-950/20 border border-red-200 dark:border-red-900 rounded-xl text-red-650 dark:text-red-400 text-xs font-medium flex gap-2">
            <AlertCircle className="w-4 h-4 shrink-0 text-red-500" />
            <span>{error}</span>
          </div>
        )}

        {/* Scrollable Fields */}
        <div className="space-y-4 max-h-[60vh] overflow-y-auto pr-1">
          {/* Avatar Preview & URL */}
          <div className="flex items-center gap-4 bg-zinc-50 dark:bg-gray-950 p-3 rounded-2xl border border-zinc-200/80 dark:border-gray-800">
            <div className="w-14 h-14 rounded-full bg-linear-to-br from-blue-500 to-indigo-600 flex items-center justify-center text-white text-xl font-semibold overflow-hidden shadow-sm shrink-0">
              {editPicUrl.trim() ? (
                <img src={editPicUrl} alt="Preview" className="w-full h-full object-cover" onError={(e) => { (e.target as HTMLImageElement).src = ''; }} />
              ) : (
                editName ? editName[0].toUpperCase() : 'U'
              )}
            </div>
            <div className="flex-1 space-y-1">
              <label className="text-zinc-500 dark:text-gray-400 font-medium block" style={{ fontSize: fontSize.xs }}>Avatar URL</label>
              <input
                type="text"
                value={editPicUrl}
                onChange={(e) => setEditPicUrl(e.target.value)}
                placeholder="https://example.com/avatar.jpg"
                className="w-full bg-white dark:bg-zinc-900 border border-zinc-300 dark:border-gray-700 rounded-xl px-3 py-1.5 text-zinc-900 dark:text-white focus:outline-none focus:ring-1 focus:ring-[#007AFF]"
                style={{ fontSize: fontSize.xs }}
              />
            </div>
          </div>

          {/* Full Name */}
          <div className="space-y-1">
            <div className="flex justify-between items-center">
              <label className="text-zinc-500 dark:text-gray-400 font-medium block" style={{ fontSize: fontSize.xs }}>Full Name</label>
              <span className="text-[10px] text-zinc-400 dark:text-gray-500 font-mono">{editName.trim().length}/8</span>
            </div>
            <input
              type="text"
              maxLength={8}
              value={editName}
              onChange={(e) => setEditName(e.target.value)}
              placeholder="Enter your name"
              className={inputCls}
              style={{ fontSize: fontSize.xs }}
            />
          </div>

          {/* Gender */}
          <div className="space-y-1">
            <label className="text-zinc-500 dark:text-gray-400 font-medium block" style={{ fontSize: fontSize.xs }}>Gender</label>
            <select
              value={editGender}
              onChange={(e) => setEditGender(e.target.value)}
              className={selectCls}
              style={{ fontSize: fontSize.xs }}
            >
              <option value="">Select Gender</option>
              <option value="Male" className="bg-white dark:bg-zinc-950 text-black dark:text-white">Male</option>
              <option value="Female" className="bg-white dark:bg-zinc-950 text-black dark:text-white">Female</option>
              <option value="Other" className="bg-white dark:bg-zinc-950 text-black dark:text-white">Other</option>
              <option value="Prefer not to say" className="bg-white dark:bg-zinc-950 text-black dark:text-white">Prefer not to say</option>
            </select>
          </div>

          {/* Country */}
          <div className="space-y-1">
            <label className="text-zinc-500 dark:text-gray-400 font-medium block" style={{ fontSize: fontSize.xs }}>Country</label>
            <select
              value={editCountry}
              onChange={(e) => setEditCountry(e.target.value)}
              className={selectCls}
              style={{ fontSize: fontSize.xs }}
            >
              <option value="">Select Country</option>
              {COUNTRIES.map(c => (
                <option key={c} value={c} className="bg-white dark:bg-zinc-950 text-black dark:text-white">{c}</option>
              ))}
            </select>
          </div>

          {/* Date of Birth dropdowns */}
          <div className="space-y-1">
            <label className="text-zinc-500 dark:text-gray-400 font-medium block" style={{ fontSize: fontSize.xs }}>Date of Birth</label>
            <div className="flex gap-2">
              <select
                className={selectCls}
                style={{ fontSize: fontSize.xs }}
                value={dobDay}
                onChange={e => setDobDay(e.target.value)}
              >
                <option value="" className="bg-white dark:bg-zinc-950">Day</option>
                {DAYS.map(d => (
                  <option key={d} value={d} className="bg-white dark:bg-zinc-950 text-black dark:text-white">{d}</option>
                ))}
              </select>
              <select
                className={selectCls}
                style={{ fontSize: fontSize.xs }}
                value={dobMonth ? MONTHS[parseInt(dobMonth, 10) - 1] || '' : ''}
                onChange={e => {
                  const mName = e.target.value;
                  const idx = MONTHS.indexOf(mName) + 1;
                  setDobMonth(idx ? idx.toString() : '');
                }}
              >
                <option value="" className="bg-white dark:bg-zinc-950">Month</option>
                {MONTHS.map((m) => (
                  <option key={m} value={m} className="bg-white dark:bg-zinc-950 text-black dark:text-white">{m}</option>
                ))}
              </select>
              <select
                className={selectCls}
                style={{ fontSize: fontSize.xs }}
                value={dobYear}
                onChange={e => setDobYear(e.target.value)}
              >
                <option value="" className="bg-white dark:bg-zinc-950">Year</option>
                {YEARS.map(y => (
                  <option key={y} value={y} className="bg-white dark:bg-zinc-950 text-black dark:text-white">{y}</option>
                ))}
              </select>
            </div>
          </div>
        </div>

        {/* Actions */}
        <div className="flex gap-3 pt-2">
          <button onClick={onClose}
            className="flex-1 py-2.5 bg-zinc-100 dark:bg-gray-800 text-zinc-700 dark:text-gray-300 rounded-xl font-medium transition-colors hover:bg-zinc-200 dark:hover:bg-gray-700 cursor-pointer"
            style={{ fontSize: fontSize.sm }}>Cancel</button>
          <button onClick={handleSave} disabled={saving || !editName.trim()}
            className="flex-1 py-2.5 bg-[#007AFF] hover:bg-[#0062CC] disabled:opacity-40 text-white rounded-xl font-medium transition-colors cursor-pointer flex items-center justify-center gap-1.5"
            style={{ fontSize: fontSize.sm }}>
            {saving ? 'Saving...' : 'Save Changes'}
          </button>
        </div>
      </div>
    </div>
  );
}
