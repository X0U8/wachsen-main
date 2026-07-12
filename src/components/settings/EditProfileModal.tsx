import { useState, useEffect, useRef } from 'react';
import { useUserProfile } from '../../lib/UserContext';
import { fontSize } from '../../lib/utils';
import { User, AlertCircle, X, Upload, Loader2 } from 'lucide-react';
import { supabase } from '../../services/supabase';
import { COUNTRIES } from '../../data/countries';
import { DAYS, MONTHS, YEARS } from '../../data/dates';
import { localStorageCache } from '../../lib/localStorage';

interface EditProfileModalProps {
  show: boolean;
  onClose: () => void;
}

const inputCls =
  'w-full bg-zinc-100 dark:bg-gray-950 border border-zinc-300 dark:border-gray-800 rounded-xl px-3 py-2 text-zinc-900 dark:text-white placeholder-zinc-400 dark:placeholder-zinc-600 focus:outline-none focus:ring-1 focus:ring-[#007AFF] transition-colors font-sans';

const selectCls =
  'w-full bg-zinc-100 dark:bg-gray-950 border border-zinc-300 dark:border-gray-700 rounded-xl px-3 py-2 text-zinc-900 dark:text-white focus:outline-none focus:ring-1 focus:ring-[#007AFF] cursor-pointer transition-colors font-sans';

const MAX_SIZE_MB = 1;

async function compressImage(file: File, maxSizeMB = MAX_SIZE_MB): Promise<Blob> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.readAsDataURL(file);
    reader.onload = (e) => {
      const img = new Image();
      img.src = e.target?.result as string;
      img.onload = () => {
        const canvas = document.createElement('canvas');
        const maxDim = 512;
        let { width, height } = img;
        if (width > height) {
          if (width > maxDim) { height = Math.round((height * maxDim) / width); width = maxDim; }
        } else {
          if (height > maxDim) { width = Math.round((width * maxDim) / height); height = maxDim; }
        }
        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext('2d')!;
        ctx.drawImage(img, 0, 0, width, height);

        let quality = 0.85;
        const tryCompress = () => {
          canvas.toBlob((blob) => {
            if (!blob) return reject(new Error('Compression failed'));
            if (blob.size <= maxSizeMB * 1024 * 1024 || quality <= 0.3) {
              resolve(blob);
            } else {
              quality -= 0.1;
              tryCompress();
            }
          }, 'image/jpeg', quality);
        };
        tryCompress();
      };
      img.onerror = reject;
    };
    reader.onerror = reject;
  });
}

export default function EditProfileModal({ show, onClose }: EditProfileModalProps) {
  const { userProfile, refreshProfile } = useUserProfile();

  const [editName, setEditName] = useState('');
  const [editPicUrl, setEditPicUrl] = useState('');
  const [editGender, setEditGender] = useState('');
  const [editCountry, setEditCountry] = useState('');
  const [dobDay, setDobDay] = useState('');
  const [dobMonth, setDobMonth] = useState('');
  const [dobYear, setDobYear] = useState('');

  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState('');
  const fileInputRef = useRef<HTMLInputElement>(null);

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
        setDobDay(''); setDobMonth(''); setDobYear('');
      }
      setError('');
    }
  }, [userProfile, show]);

  if (!show || !userProfile) return null;

  const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!file.type.startsWith('image/')) {
      setError('Please select an image file.');
      return;
    }
    if (file.size > 5 * 1024 * 1024) {
      setError('Image must be under 5 MB before compression.');
      return;
    }

    setUploading(true);
    setError('');
    try {
      const compressedBlob = await compressImage(file);
      const filePath = `avatars/${userProfile.id}_${Date.now()}.jpg`;

      const { error: uploadError } = await supabase.storage
        .from('scan-refs')
        .upload(filePath, compressedBlob, {
          cacheControl: '3600',
          upsert: false,
          contentType: 'image/jpeg'
        });

      if (uploadError) throw new Error(uploadError.message);

      const { data } = supabase.storage.from('scan-refs').getPublicUrl(filePath);
      setEditPicUrl(data.publicUrl);
    } catch (err: any) {
      setError(err?.message || 'Failed to upload image');
    } finally {
      setUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  const handleSave = async () => {
    const trimmedName = editName.trim();
    if (trimmedName.length < 3) { setError('Name must be at least 3 characters.'); return; }
    if (trimmedName.length > 8) { setError('Name must be at most 8 characters.'); return; }

    setSaving(true);
    setError('');

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
        const cachedProfile = localStorageCache.get<any>(localStorageCache.keys.USER_PROFILE) || {};
        localStorageCache.set(localStorageCache.keys.USER_PROFILE, {
          ...cachedProfile, ...updatePayload,
          $id: userProfile.id,
          name: trimmedName,
          profile_picture: editPicUrl.trim() || null,
        });
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
      <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-gray-800 rounded-3xl p-5 sm:p-6 w-full max-w-md space-y-4 shadow-2xl">

        <div className="flex items-center justify-between border-b border-zinc-100 dark:border-gray-800 pb-3">
          <div className="flex items-center gap-3">

            <h3 className="font-semibold text-zinc-900 dark:text-white" style={{ fontSize: fontSize.base }}>Edit profile</h3>
          </div>
          <button onClick={onClose} className="p-1 hover:bg-zinc-100 dark:hover:bg-gray-800 rounded-lg text-zinc-400 hover:text-zinc-600 transition-colors cursor-pointer">
            <X className="w-4 h-4" />
          </button>
        </div>

        {error && (
          <div className="p-2.5 bg-red-50 dark:bg-red-950/20 border border-red-200 dark:border-red-900 rounded-xl text-red-500 dark:text-red-400 flex gap-2 items-start" style={{ fontSize: fontSize.xs }}>
            <AlertCircle className="w-3.5 h-3.5 shrink-0 mt-0.5" />
            <span>{error}</span>
          </div>
        )}

        <div className="space-y-3.5 max-h-[60vh] overflow-y-auto pr-1">

          <div className="flex items-center gap-4 bg-zinc-50 dark:bg-gray-950 p-3 rounded-2xl border border-zinc-200/80 dark:border-gray-800">
            <div className="w-14 h-14 rounded-full bg-gradient-to-br from-blue-500 to-indigo-600 flex items-center justify-center text-white font-semibold overflow-hidden shadow-sm shrink-0" style={{ fontSize: fontSize.lg }}>
              {editPicUrl.trim() ? (
                <img src={editPicUrl} alt="Preview" className="w-full h-full object-cover" onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }} />
              ) : (
                editName ? editName[0].toUpperCase() : 'U'
              )}
            </div>
            <div className="flex-1 space-y-1.5">
              <p className="text-zinc-500 dark:text-gray-400 font-medium" style={{ fontSize: fontSize.xs }}>Profile photo</p>
              <input ref={fileInputRef} type="file" accept="image/*" className="hidden" onChange={handleImageUpload} />
              <button
                onClick={() => fileInputRef.current?.click()}
                disabled={uploading}
                className="flex items-center gap-1.5 px-3 py-1.5 bg-white dark:bg-gray-800 border border-zinc-300 dark:border-gray-700 rounded-lg hover:bg-zinc-50 dark:hover:bg-gray-700 transition-colors disabled:opacity-50 cursor-pointer"
                style={{ fontSize: fontSize.xs }}
              >
                {uploading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Upload className="w-3.5 h-3.5" />}
                {uploading ? 'Uploading...' : 'Upload image'}
              </button>
              <p className="text-zinc-400 dark:text-gray-600" style={{ fontSize: fontSize.xs }}>Max 1 MB · auto-compressed</p>
            </div>
          </div>

          <div className="space-y-1">
            <div className="flex justify-between items-center">
              <label className="text-zinc-500 dark:text-gray-400 font-medium" style={{ fontSize: fontSize.xs }}>Name</label>
              <span className="text-zinc-400 dark:text-gray-500 font-mono" style={{ fontSize: fontSize.xs }}>{editName.trim().length}/8</span>
            </div>
            <input type="text" maxLength={8} value={editName} onChange={(e) => setEditName(e.target.value)}
              placeholder="Enter your name" className={inputCls} style={{ fontSize: fontSize.xs }} />
          </div>

          <div className="space-y-1">
            <label className="text-zinc-500 dark:text-gray-400 font-medium" style={{ fontSize: fontSize.xs }}>Gender</label>
            <select value={editGender} onChange={(e) => setEditGender(e.target.value)} className={selectCls} style={{ fontSize: fontSize.xs }}>
              <option value="">Select gender</option>
              <option value="Male">Male</option>
              <option value="Female">Female</option>
              <option value="Other">Other</option>
              <option value="Prefer not to say">Prefer not to say</option>
            </select>
          </div>

          <div className="space-y-1">
            <label className="text-zinc-500 dark:text-gray-400 font-medium" style={{ fontSize: fontSize.xs }}>Country</label>
            <select value={editCountry} onChange={(e) => setEditCountry(e.target.value)} className={selectCls} style={{ fontSize: fontSize.xs }}>
              <option value="">Select country</option>
              {COUNTRIES.map(c => <option key={c} value={c}>{c}</option>)}
            </select>
          </div>

          <div className="space-y-1">
            <label className="text-zinc-500 dark:text-gray-400 font-medium" style={{ fontSize: fontSize.xs }}>Date of birth</label>
            <div className="flex gap-2">
              <select className={selectCls} style={{ fontSize: fontSize.xs }} value={dobDay} onChange={e => setDobDay(e.target.value)}>
                <option value="">Day</option>
                {DAYS.map(d => <option key={d} value={d}>{d}</option>)}
              </select>
              <select className={selectCls} style={{ fontSize: fontSize.xs }}
                value={dobMonth ? MONTHS[parseInt(dobMonth, 10) - 1] || '' : ''}
                onChange={e => { const idx = MONTHS.indexOf(e.target.value) + 1; setDobMonth(idx ? idx.toString() : ''); }}>
                <option value="">Month</option>
                {MONTHS.map(m => <option key={m} value={m}>{m}</option>)}
              </select>
              <select className={selectCls} style={{ fontSize: fontSize.xs }} value={dobYear} onChange={e => setDobYear(e.target.value)}>
                <option value="">Year</option>
                {YEARS.map(y => <option key={y} value={y}>{y}</option>)}
              </select>
            </div>
          </div>
        </div>

        <div className="flex gap-3 pt-1">
          <button onClick={onClose}
            className="flex-1 py-2.5 bg-zinc-100 dark:bg-gray-800 text-zinc-700 dark:text-gray-300 rounded-xl font-medium transition-colors hover:bg-zinc-200 dark:hover:bg-gray-700 cursor-pointer"
            style={{ fontSize: fontSize.sm }}>Cancel</button>
          <button onClick={handleSave} disabled={saving || uploading || !editName.trim()}
            className="flex-1 py-2.5 bg-[#007AFF] hover:bg-[#0062CC] disabled:opacity-40 text-white rounded-xl font-medium transition-colors cursor-pointer flex items-center justify-center gap-1.5"
            style={{ fontSize: fontSize.sm }}>
            {saving ? <><Loader2 className="w-3.5 h-3.5 animate-spin" />Saving...</> : 'Save changes'}
          </button>
        </div>
      </div>
    </div>
  );
}
