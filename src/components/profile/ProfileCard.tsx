import { Clipboard, Check, Loader2, AlertCircle, BookOpen, Download, Calendar, ChevronLeft, ChevronRight, X, ChevronUp, ChevronDown } from 'lucide-react';
import { useUserProfile } from '../../lib/UserContext.tsx';
import { useState, useRef, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import PlanIcon from '../../ui/PlanIcon';
import { fontSize } from '../../lib/utils';
import { useTheme } from '../../lib/ThemeContext.tsx';
import { supabase } from '../../services/supabase';

const MAX_ROT = 28;

function lerp(a: number, b: number, t: number) { return a + (b - a) * t; }
function clamp(v: number, lo: number, hi: number) { return Math.max(lo, Math.min(hi, v)); }

const EXAMS_PER_PAGE = 5;

const getDailyImportLimit = (plan: string) => {
  const p = plan.toLowerCase();
  if (p.includes('lite')) return 5;
  if (p.includes('rise')) return 10;
  if (p.includes('peak')) return 15;
  return 3;
};

export default function ProfileCard({ onClose, userId }: { onClose: () => void; userId?: string }) {
  const { userProfile: loggedInProfile } = useUserProfile();
  const { theme, fontSizeLevel } = useTheme();
  const scale = {
    small: 0.85,
    medium: 1.0,
    large: 1.35,
    larger: 1.6
  }[fontSizeLevel] || 1.0;
  const [copied, setCopied] = useState(false);
  const navigate = useNavigate();

  const cardRef = useRef<HTMLDivElement>(null);
  const faceRef = useRef<HTMLDivElement>(null);

  const cur = useRef({ rx: 0, ry: 0 });
  const tgt = useRef({ rx: 0, ry: 0 });
  const drag = useRef({ rx: 0, ry: 0 });
  const vel = useRef({ x: 0, y: 0 });
  const last = useRef({ x: 0, y: 0 });
  const dragging = useRef(false);
  const rafId = useRef(0);


  const [viewProfile, setViewProfile] = useState<any | null>(null);
  const [loadingProfile, setLoadingProfile] = useState(false);


  const [exams, setExams] = useState<any[]>([]);
  const [examsLoading, setExamsLoading] = useState(false);
  const [page, setPage] = useState(0);
  const [totalCount, setTotalCount] = useState(0);
  const [showProfileCard, setShowProfileCard] = useState(true);

  const parsePlanSubjectsAndTopicsGrouped = (rawPlan: any) => {
    try {
      if (!rawPlan) return [];
      const parsed = typeof rawPlan === 'string' ? JSON.parse(rawPlan) : rawPlan;
      const subjectsList = Array.isArray(parsed) ? parsed : (parsed?.subjects || []);

      const grouped: { subject: string; topics: string[] }[] = [];

      subjectsList.forEach((s: any) => {
        const sName = typeof s === 'string' ? s : (s.name || s.subject || '');
        if (!sName) return;

        const topics: string[] = [];
        if (s && typeof s === 'object') {
          if (Array.isArray(s.segments)) {
            s.segments.forEach((seg: any) => {
              if (seg && Array.isArray(seg.topics)) {
                seg.topics.forEach((t: any) => {
                  const tLabel = typeof t === 'string' ? t : (t.name || t.topic || '');
                  if (tLabel && !topics.includes(tLabel)) topics.push(tLabel);
                });
              }
            });
          }
          if (Array.isArray(s.topics)) {
            s.topics.forEach((t: any) => {
              const tLabel = typeof t === 'string' ? t : (t.name || t.topic || '');
              if (tLabel && !topics.includes(tLabel)) topics.push(tLabel);
            });
          }
        }

        grouped.push({ subject: sName, topics });
      });

      return grouped;
    } catch {
      return [];
    }
  };


  const [importTargetExam, setImportTargetExam] = useState<any | null>(null);
  const [showCreateOthersCategoryModal, setShowCreateOthersCategoryModal] = useState(false);
  const [showConfirmImportModal, setShowConfirmImportModal] = useState(false);
  const [importing, setImporting] = useState(false);
  const [importError, setImportError] = useState('');
  const [importSuccess, setImportSuccess] = useState('');


  useEffect(() => {
    if (!userId) {
      setViewProfile(null);
      return;
    }
    const fetchProfile = async () => {
      setLoadingProfile(true);
      try {
        const { data, error } = await supabase
          .from('profiles')
          .select('*')
          .eq('id', userId)
          .maybeSingle();

        if (error) throw error;
        if (data) {
          setViewProfile({
            ...data,
            $id: data.id,
            isBan: data.is_ban,
            isPremium: data.is_premium,
            premiumEnds: data.premium_ends,
            PremiumType: data.premium_type,
            lastClaimed: data.last_claimed,
          });
        }
      } catch (err) {
        console.error('Error fetching profile:', err);
      } finally {
        setLoadingProfile(false);
      }
    };
    fetchProfile();
  }, [userId]);


  const fetchUserExams = useCallback(async () => {
    const targetUserId = userId || loggedInProfile?.id;
    if (!targetUserId) return;
    setExamsLoading(true);
    try {
      const start = page * EXAMS_PER_PAGE;
      const end = start + EXAMS_PER_PAGE - 1;

      const { data, error, count } = await supabase
        .from('exams')
        .select('id, examName, difficulty, created_at, totalTime, totalMarks, ExamPlan', { count: 'exact' })
        .eq('createdBy', targetUserId)
        .eq('isPublic', true)
        .order('created_at', { ascending: false })
        .range(start, end);

      if (error) throw error;
      setExams(data || []);
      setTotalCount(count || 0);
    } catch (err) {
      console.error('Error fetching exams:', err);
    } finally {
      setExamsLoading(false);
    }
  }, [userId, loggedInProfile?.id, page]);

  useEffect(() => {
    fetchUserExams();
  }, [fetchUserExams]);


  const userProfile = userId ? viewProfile : loggedInProfile;


  const applyTransform = (rx: number, ry: number) => {
    const card = cardRef.current;
    const face = faceRef.current;
    if (!card || !face) return;

    card.style.transform = `rotateX(${rx}deg) rotateY(${ry}deg)`;

    const mag = Math.sqrt(rx * rx + ry * ry);
    const sx = -ry * 0.55;
    const sy = rx * 0.55 + 16;
    const blur = 24 + mag * 0.8;
    const alpha = Math.min(0.55, 0.22 + mag * 0.006);
    card.style.boxShadow = `${sx}px ${sy}px ${blur}px rgba(0,0,0,${alpha.toFixed(3)}), 0 4px 16px rgba(0,0,0,0.3)`;

    const gx = clamp(50 - ry * 1.1, 10, 90);
    const gy = clamp(30 + rx * 1.1, 5, 85);
    face.style.setProperty('--gx', `${gx}%`);
    face.style.setProperty('--gy', `${gy}%`);
  };

  useEffect(() => {
    const tick = () => {
      cur.current.rx = lerp(cur.current.rx, tgt.current.rx, dragging.current ? 0.22 : 0.09);
      cur.current.ry = lerp(cur.current.ry, tgt.current.ry, dragging.current ? 0.22 : 0.09);
      applyTransform(cur.current.rx, cur.current.ry);
      rafId.current = requestAnimationFrame(tick);
    };
    rafId.current = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(rafId.current);
  }, []);

  useEffect(() => {
    const card = cardRef.current;
    if (!card) return;

    const onMouseLeave = () => { if (!dragging.current) { tgt.current.rx = 0; tgt.current.ry = 0; } };

    const onMouseDown = (e: MouseEvent) => {
      dragging.current = true;
      last.current = { x: e.clientX, y: e.clientY };
      drag.current = { ...cur.current };
      vel.current = { x: 0, y: 0 };
      card.style.cursor = 'grabbing';
      e.preventDefault();
    };
    const onMouseMoveDrag = (e: MouseEvent) => {
      if (!dragging.current) return;
      const dx = e.clientX - last.current.x;
      const dy = e.clientY - last.current.y;
      last.current = { x: e.clientX, y: e.clientY };
      vel.current = { x: dx, y: dy };
      drag.current.ry = clamp(drag.current.ry + dx * 0.55, -MAX_ROT, MAX_ROT);
      drag.current.rx = clamp(drag.current.rx - dy * 0.55, -MAX_ROT * 0.7, MAX_ROT * 0.7);
      tgt.current.rx = drag.current.rx;
      tgt.current.ry = drag.current.ry;
    };
    const onMouseUp = () => {
      if (!dragging.current) return;
      dragging.current = false;
      card.style.cursor = 'grab';
      let mx = vel.current.x * 0.4, my = vel.current.y * 0.4;
      const decay = () => {
        if (Math.abs(mx) < 0.1 && Math.abs(my) < 0.1) { tgt.current.rx = 0; tgt.current.ry = 0; return; }
        mx *= 0.88; my *= 0.88;
        drag.current.ry = clamp(drag.current.ry + mx * 0.45, -MAX_ROT, MAX_ROT);
        drag.current.rx = clamp(drag.current.rx - my * 0.45, -MAX_ROT * 0.7, MAX_ROT * 0.7);
        tgt.current.rx = drag.current.rx;
        tgt.current.ry = drag.current.ry;
        requestAnimationFrame(decay);
      };
      decay();
    };

    const onTouchStart = (e: TouchEvent) => {
      const t = e.touches[0];
      dragging.current = true;
      last.current = { x: t.clientX, y: t.clientY };
      drag.current = { ...cur.current };
      vel.current = { x: 0, y: 0 };
      e.preventDefault();
    };
    const onTouchMove = (e: TouchEvent) => {
      if (!dragging.current) return;
      const t = e.touches[0];
      const dx = t.clientX - last.current.x;
      const dy = t.clientY - last.current.y;
      last.current = { x: t.clientX, y: t.clientY };
      vel.current = { x: dx, y: dy };
      drag.current.ry = clamp(drag.current.ry + dx * 0.6, -MAX_ROT, MAX_ROT);
      drag.current.rx = clamp(drag.current.rx - dy * 0.6, -MAX_ROT * 0.7, MAX_ROT * 0.7);
      tgt.current.rx = drag.current.rx;
      tgt.current.ry = drag.current.ry;
      e.preventDefault();
    };
    const onTouchEnd = () => {
      dragging.current = false;
      let mx = vel.current.x * 0.35, my = vel.current.y * 0.35;
      const decay = () => {
        if (Math.abs(mx) < 0.1 && Math.abs(my) < 0.1) { tgt.current.rx = 0; tgt.current.ry = 0; return; }
        mx *= 0.86; my *= 0.86;
        drag.current.ry = clamp(drag.current.ry + mx * 0.45, -MAX_ROT, MAX_ROT);
        drag.current.rx = clamp(drag.current.rx - my * 0.45, -MAX_ROT * 0.7, MAX_ROT * 0.7);
        tgt.current.rx = drag.current.rx;
        tgt.current.ry = drag.current.ry;
        requestAnimationFrame(decay);
      };
      decay();
    };

    card.addEventListener('mouseleave', onMouseLeave);
    card.addEventListener('mousedown', onMouseDown);
    card.addEventListener('touchstart', onTouchStart, { passive: false });
    card.addEventListener('touchmove', onTouchMove, { passive: false });
    card.addEventListener('touchend', onTouchEnd);
    window.addEventListener('mousemove', onMouseMoveDrag);
    window.addEventListener('mouseup', onMouseUp);

    return () => {
      card.removeEventListener('mouseleave', onMouseLeave);
      card.removeEventListener('mousedown', onMouseDown);
      card.removeEventListener('touchstart', onTouchStart);
      card.removeEventListener('touchmove', onTouchMove);
      card.removeEventListener('touchend', onTouchEnd);
      window.removeEventListener('mousemove', onMouseMoveDrag);
      window.removeEventListener('mouseup', onMouseUp);
    };
  }, []);

  if (!userProfile) {
    return (
      <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-[250] flex items-center justify-center p-4">
        <Loader2 className="w-8 h-8 text-blue-500 animate-spin" />
      </div>
    );
  }

  const copyId = () => {
    navigator.clipboard.writeText(userProfile.username || '');
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const firstLetter = userProfile.name ? userProfile.name[0].toUpperCase() : 'U';
  const maskEmail = (email: string) => {
    const [local, domain] = (email || '').split('@');
    return domain ? `${local[0]}***@${domain}` : email;
  };

  const getShortPlanName = (planName: string) => {
    if (!planName) return '';
    if (planName.toLowerCase().includes('lite')) return 'Lite';
    if (planName.toLowerCase().includes('rise')) return 'Rise';
    if (planName.toLowerCase().includes('peak')) return 'Peak';
    return planName;
  };

  const totalPages = Math.ceil(totalCount / EXAMS_PER_PAGE);


  const checkOthersCategory = async (): Promise<string | null> => {
    if (!loggedInProfile?.id) return null;
    const { data } = await supabase
      .from('examtypes')
      .select('id')
      .eq('userId', loggedInProfile.id)
      .eq('name', 'others')
      .maybeSingle();
    return data?.id || null;
  };

  const handleImportExamClick = async (exam: any) => {
    setImportTargetExam(exam);
    setImportError('');
    setImportSuccess('');

    if (exam.createdBy === loggedInProfile?.id) {
      setImportError('You cannot import your own exams.');
      setShowConfirmImportModal(true);
      return;
    }

    try {
      const othersId = await checkOthersCategory();
      if (!othersId) {
        setShowCreateOthersCategoryModal(true);
      } else {
        setShowConfirmImportModal(true);
      }
    } catch (err: any) {
      setImportError(err.message || 'Failed to check categories.');
    }
  };

  const handleCreateOthersCategory = async () => {
    if (!loggedInProfile?.id) return;
    setImporting(true);
    setImportError('');
    try {

      const { data: catData, error: catError } = await supabase
        .from('examtypes')
        .insert({
          userId: loggedInProfile.id,
          name: 'others',
          subjects: ['any'],
          academicLevel: 'any'
        })
        .select('id')
        .single();

      if (catError) throw catError;

      localStorage.removeItem('wachsen_exam_categories');


      const { data: existingImport } = await supabase
        .from('exam_imports')
        .select('user_id')
        .eq('user_id', loggedInProfile.id)
        .maybeSingle();

      if (!existingImport) {
        const { error: impError } = await supabase
          .from('exam_imports')
          .insert({
            user_id: loggedInProfile.id,
            exam_imported: 0,
            last_imported: new Date().toISOString()
          });
        if (impError) throw impError;
      }

      setShowCreateOthersCategoryModal(false);
      setShowConfirmImportModal(true);
    } catch (err: any) {
      setImportError(err.message || 'Failed to create others category.');
    } finally {
      setImporting(false);
    }
  };

  const handleConfirmImport = async () => {
    if (!loggedInProfile?.id || !importTargetExam) return;
    setImporting(true);
    setImportError('');
    try {
      const othersCategoryId = await checkOthersCategory();
      if (!othersCategoryId) {
        throw new Error('Please create the "others" category first.');
      }

      const plan = loggedInProfile.PremiumType || 'free';
      const limit = getDailyImportLimit(plan);


      let { data: importData, error: importError } = await supabase
        .from('exam_imports')
        .select('*')
        .eq('user_id', loggedInProfile.id)
        .maybeSingle();

      if (!importData) {
        const { data: insertedData, error: insErr } = await supabase
          .from('exam_imports')
          .insert({
            user_id: loggedInProfile.id,
            exam_imported: 0,
            last_imported: new Date().toISOString()
          })
          .select('*')
          .single();
        if (insErr) throw insErr;
        importData = insertedData;
      }

      const lastDate = new Date(importData.last_imported);
      const today = new Date();
      const isSameDay = lastDate.getFullYear() === today.getFullYear() &&
        lastDate.getMonth() === today.getMonth() &&
        lastDate.getDate() === today.getDate();

      if (isSameDay && importData.exam_imported >= limit) {
        throw new Error(`Already imported ${limit} exams today. Try tomorrow.`);
      }


      const { data: examData, error: examErr } = await supabase
        .from('exams')
        .select('examName, totalQuestions, difficulty, totalTime, subjects, generatedExam, correct_marks, negative_marks, ExamPlan')
        .eq('id', importTargetExam.id)
        .single();

      if (examErr || !examData) throw examErr || new Error('Exam details not found');


      const { error: insExamErr } = await supabase
        .from('exams')
        .insert({
          createdBy: loggedInProfile.id,
          accessIds: [loggedInProfile.id],
          categoryId: othersCategoryId,
          examName: examData.examName,
          totalQuestions: examData.totalQuestions,
          difficulty: examData.difficulty,
          totalTime: examData.totalTime || 60,
          subjects: examData.subjects || '[]',
          generatedExam: examData.generatedExam || '[]',
          correct_marks: examData.correct_marks ?? 4,
          negative_marks: examData.negative_marks ?? 0,
          totalMarks: examData.totalQuestions * (examData.correct_marks ?? 4),
          ExamPlan: examData.ExamPlan || '{}',
          status: 'active',
          examType: 'practice',
          accessType: 'anytime',
          startDateTime: null,
          endDateTime: null,
        });

      if (insExamErr) throw insExamErr;


      const newCount = isSameDay ? (importData.exam_imported + 1) : 1;
      const { error: updErr } = await supabase
        .from('exam_imports')
        .update({
          exam_imported: newCount,
          last_imported: new Date().toISOString()
        })
        .eq('user_id', loggedInProfile.id);

      if (updErr) throw updErr;

      setImportSuccess('Exam imported successfully!');
      setTimeout(() => {
        setShowConfirmImportModal(false);
        setImportTargetExam(null);
        setImportSuccess('');
        setImporting(false);
      }, 1500);

    } catch (err: any) {
      setImportError(err.message || 'Failed to import exam.');
      setImporting(false);
    }
  };


  if (!userId) {
    return (
      <div
        className="fixed inset-0 bg-black/60 backdrop-blur-sm z-[250] flex flex-col"
        onClick={e => { if (e.target === e.currentTarget) onClose(); }}
      >
        <div className="flex justify-between items-center px-6 pt-6 pb-2 flex-shrink-0">
          <h1 className="font-medium tracking-tight text-white" style={{ fontSize: fontSize.xl }}>Wachsen</h1>
          <div className="flex items-center gap-2">
            <button
              onClick={copyId}
              className="p-2 hover:bg-white/10 rounded-lg transition-colors flex items-center gap-2 text-zinc-400 hover:text-white"
              title="Copy ID"
            >
              {copied ? <Check className="w-5 h-5 text-green-400" /> : <Clipboard className="w-5 h-5" />}
            </button>
          </div>
        </div>

        <div className="flex-1 flex flex-col items-center justify-center px-6">
          <div style={{ perspective: `${700 * scale}px`, perspectiveOrigin: '50% 50%' }}>
            <div
              ref={cardRef}
              style={{
                width: `${380 * scale}px`,
                height: `${240 * scale}px`,
                borderRadius: `${16 * scale}px`,
                position: 'relative',
                transformStyle: 'preserve-3d',
                willChange: 'transform',
                cursor: 'grab',
                boxShadow: '0 16px 48px rgba(0,0,0,0.45), 0 4px 16px rgba(0,0,0,0.3)',
              }}
            >
              <div
                ref={faceRef}
                style={{
                  position: 'absolute', inset: 0,
                  borderRadius: `${16 * scale}px`,
                  background: theme === 'dark' ? '#1a1a2e' : '#ffffff',
                  border: theme === 'dark' ? '0.5px solid rgba(255,255,255,0.1)' : '0.5px solid rgba(0,0,0,0.1)',
                  overflow: 'hidden',
                  padding: `${20 * scale}px ${20 * scale}px ${16 * scale}px`,
                  display: 'flex', flexDirection: 'row', gap: `${16 * scale}px`,
                  fontFamily: "'DM Sans', system-ui, sans-serif",
                } as React.CSSProperties}
              >
                <div
                  style={{
                    position: 'absolute',
                    top: `${12 * scale}px`,
                    left: `${12 * scale}px`,
                    fontSize: `${10 * scale}px`,
                    fontWeight: 700,
                    letterSpacing: '0.15em',
                    color: theme === 'dark' ? 'rgba(255,255,255,0.5)' : 'rgba(0,0,0,0.5)',
                    textTransform: 'uppercase',
                    zIndex: 10,
                  }}
                >
                  Wachsen
                </div>

                <div
                  style={{
                    position: 'absolute', inset: 0, borderRadius: `${16 * scale}px`,
                    background: 'radial-gradient(ellipse at var(--gx,50%) var(--gy,30%), rgba(0,0,0,0.06) 0%, transparent 75%)',
                    pointerEvents: 'none', zIndex: 20,
                  } as React.CSSProperties}
                />

                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: `${8 * scale}px`, flexShrink: 0, justifyContent: 'center' }}>
                  <div style={{
                    width: `${72 * scale}px`, height: `${72 * scale}px`, borderRadius: '50%',
                    background: 'linear-gradient(135deg, #3b82f6 0%, #1d4ed8 100%)',
                    display: 'flex', alignItems: 'center', justify500: 'center',
                    fontSize: `${26 * scale}px`, fontWeight: 500, color: '#fff', overflow: 'hidden',
                    boxShadow: '0 2px 10px rgba(0,0,0,0.1)', flexShrink: 0,
                  } as any}>
                    {userProfile.profile_picture?.trim()
                      ? <img src={userProfile.profile_picture} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover', borderRadius: '50%' }} onError={e => { (e.target as HTMLImageElement).style.display = 'none'; }} />
                      : firstLetter}
                  </div>
                  {userProfile.PremiumType && (
                    <div style={{ display: 'flex', alignItems: 'center', gap: `${4 * scale}px` }}>
                      <div style={{
                        width: `${60 * scale}px`, height: `${24 * scale}px`, borderRadius: `${6 * scale}px`,
                        background: theme === 'dark' ? '#0f0f23' : '#1e293b',
                        display: 'flex', alignItems: 'center', justifyContent: 'center', gap: `${4 * scale}px`,
                      }}>
                        <PlanIcon planName={userProfile.PremiumType} variant="profileCard" />
                        <span style={{
                          fontSize: `${9 * scale}px`, fontWeight: 600, letterSpacing: '0.05em',
                          color: '#ffffff', textTransform: 'uppercase',
                        }}>
                          {getShortPlanName(userProfile.PremiumType)}
                        </span>
                      </div>
                    </div>
                  )}
                </div>

                <div style={{ width: '0.5px', background: theme === 'dark' ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.1)', alignSelf: 'stretch', flexShrink: 0 }} />

                <div style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', justifyContent: 'space-between' }}>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: `${5 * scale}px`, marginTop: `${30 * scale}px`, flex: 1 }}>
                    {([
                      { l: 'Name', v: userProfile.name?.toUpperCase() },
                      { l: 'USER ID', v: `@${userProfile.username || ''}` },
                      { l: 'Email', v: maskEmail(userProfile.email || '') },
                      userProfile.DOB && { l: 'DOB', v: userProfile.DOB },
                      userProfile.gender && { l: 'Gender', v: userProfile.gender },
                      userProfile.country && { l: 'Nation', v: userProfile.country },
                    ] as any[]).filter(Boolean).map((f: any) => (
                      <div key={f.l} style={{ display: 'flex', alignItems: 'baseline', gap: `${10 * scale}px` }}>
                        <span style={{ fontSize: `${10 * scale}px`, textTransform: 'uppercase', letterSpacing: '0.09em', color: theme === 'dark' ? 'rgba(255,255,255,0.5)' : 'rgba(0,0,0,0.5)', flexShrink: 0, width: `${65 * scale}px`, fontWeight: 500 }}>{f.l}</span>
                        <span style={{
                          fontSize: f.l === 'Name' ? `${12 * scale}px` : `${11 * scale}px`,
                          fontWeight: f.l === 'Name' ? 700 : 400,
                          color: theme === 'dark' ? '#ffffff' : '#000000',
                          fontFamily: f.l === 'Name' ? "'DM Sans', system-ui, sans-serif" : "'DM Mono',monospace",
                          whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', flex: 1
                        }}>{f.v}</span>
                      </div>
                    ))}
                  </div>

                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', paddingTop: `${8 * scale}px`, borderTop: theme === 'dark' ? '0.5px solid rgba(255,255,255,0.1)' : '0.5px solid rgba(0,0,0,0.1)' }}>
                    <span style={{ fontSize: `${9 * scale}px`, fontWeight: 500, color: theme === 'dark' ? 'rgba(255,255,255,0.5)' : 'rgba(0,0,0,0.5)', letterSpacing: '0.05em' }}>
                      Member since {new Date(userProfile.created_at || userProfile.id).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })}
                    </span>
                    <div style={{ display: 'flex', gap: `${3 * scale}px` }}>
                      {[0.32, 0.18, 0.09].map((o, i) => <div key={i} style={{ width: `${5 * scale}px`, height: `${5 * scale}px`, borderRadius: '50%', background: theme === 'dark' ? `rgba(255,255,255,${o})` : `rgba(0,0,0,${o})` }} />)}
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>

          <button
            onClick={onClose}
            className="mt-8 px-6 py-2.5 bg-white/10 hover:bg-white/15 transition-colors rounded-xl text-white font-medium cursor-pointer"
            style={{ fontSize: fontSize.sm }}
          >
            Close
          </button>
        </div>
      </div>
    );
  }


  return (
    <>
      <div
        className="fixed inset-0 bg-black/60 backdrop-blur-sm z-[250] flex items-center justify-center p-4"
        onClick={e => { if (e.target === e.currentTarget) onClose(); }}
      >
        <div className="bg-white dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800/80 rounded-3xl w-full max-w-[420px] sm:max-w-[620px] md:max-w-[720px] lg:max-w-[800px] h-[640px] max-h-[90vh] flex flex-col shadow-2xl relative overflow-hidden animate-fade-in">

          <div className="flex justify-between items-center px-5 py-4 border-b border-black/10 dark:border-white/10 flex-shrink-0">
            <h1 className="font-semibold text-zinc-900 dark:text-white" style={{ fontSize: fontSize.base }}>
              Public profile
            </h1>
            <div className="flex items-center gap-2">
              <button
                onClick={copyId}
                className="p-1.5 hover:bg-zinc-100 dark:hover:bg-zinc-900 rounded-lg transition-colors text-zinc-500 hover:text-zinc-850 dark:text-zinc-400 dark:hover:text-white"
                title="Copy ID"
              >
                {copied ? <Check className="w-4 h-4 text-green-500" /> : <Clipboard className="w-4 h-4" />}
              </button>
              <button
                onClick={onClose}
                className="p-1.5 hover:bg-zinc-100 dark:hover:bg-zinc-900 rounded-full transition-colors text-zinc-500 hover:text-zinc-850 dark:text-zinc-400 dark:hover:text-white cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
          </div>

          <div className="flex-1 flex flex-col items-center p-5 overflow-hidden min-h-0 space-y-4">

            {showProfileCard && (
              <div style={{ perspective: `${700 * scale}px`, perspectiveOrigin: '50% 50%' }} className="flex-shrink-0">
                <div
                  ref={cardRef}
                  style={{
                    width: `${350 * scale}px`,
                    height: `${220 * scale}px`,
                    borderRadius: `${16 * scale}px`,
                    position: 'relative',
                    transformStyle: 'preserve-3d',
                    willChange: 'transform',
                    cursor: 'grab',
                    boxShadow: '0 12px 36px rgba(0,0,0,0.35), 0 4px 12px rgba(0,0,0,0.2)',
                  }}
                >
                  <div
                    ref={faceRef}
                    style={{
                      position: 'absolute', inset: 0,
                      borderRadius: `${16 * scale}px`,
                      background: theme === 'dark' ? '#1a1a2e' : '#ffffff',
                      border: theme === 'dark' ? '0.5px solid rgba(255,255,255,0.1)' : '0.5px solid rgba(0,0,0,0.1)',
                      overflow: 'hidden',
                      padding: `${16 * scale}px ${16 * scale}px ${12 * scale}px`,
                      display: 'flex', flexDirection: 'row', gap: `${14 * scale}px`,
                      fontFamily: "'DM Sans', system-ui, sans-serif",
                    } as React.CSSProperties}
                  >
                    <div
                      style={{
                        position: 'absolute',
                        top: `${10 * scale}px`,
                        left: `${10 * scale}px`,
                        fontSize: `${9 * scale}px`,
                        fontWeight: 750,
                        letterSpacing: '0.15em',
                        color: theme === 'dark' ? 'rgba(255,255,255,0.5)' : 'rgba(0,0,0,0.5)',
                        textTransform: 'uppercase',
                        zIndex: 10,
                      }}
                    >
                      Wachsen
                    </div>

                    <div
                      style={{
                        position: 'absolute', inset: 0, borderRadius: `${16 * scale}px`,
                        background: 'radial-gradient(ellipse at var(--gx,50%) var(--gy,30%), rgba(0,0,0,0.06) 0%, transparent 75%)',
                        pointerEvents: 'none', zIndex: 20,
                      } as React.CSSProperties}
                    />

                    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: `${6 * scale}px`, flexShrink: 0, justify500: 'center' } as any}>
                      <div style={{
                        width: `${64 * scale}px`, height: `${64 * scale}px`, borderRadius: '50%',
                        background: 'linear-gradient(135deg, #3b82f6 0%, #1d4ed8 100%)',
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                        fontSize: `${24 * scale}px`, fontWeight: 500, color: '#fff', overflow: 'hidden',
                        boxShadow: '0 2px 8px rgba(0,0,0,0.1)', flexShrink: 0,
                      }}>
                        {userProfile.profile_picture?.trim()
                          ? <img src={userProfile.profile_picture} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover', borderRadius: '50%' }} />
                          : firstLetter}
                      </div>
                      {userProfile.PremiumType && (
                        <div style={{ display: 'flex', alignItems: 'center', gap: `${4 * scale}px` }}>
                          <div style={{
                            width: `${54 * scale}px`, height: `${22 * scale}px`, borderRadius: `${5 * scale}px`,
                            background: theme === 'dark' ? '#0f0f23' : '#1e293b',
                            display: 'flex', alignItems: 'center', justifyContent: 'center', gap: `${3 * scale}px`,
                          }}>
                            <PlanIcon planName={userProfile.PremiumType} variant="profileCard" />
                            <span style={{
                              fontSize: `${8 * scale}px`, fontWeight: 600, letterSpacing: '0.05em',
                              color: '#ffffff', textTransform: 'uppercase',
                            }}>
                              {getShortPlanName(userProfile.PremiumType)}
                            </span>
                          </div>
                        </div>
                      )}
                    </div>

                    <div style={{ width: '0.5px', background: theme === 'dark' ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.1)', alignSelf: 'stretch', flexShrink: 0 }} />

                    <div style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', justifyContent: 'space-between' }}>
                      <div style={{ display: 'flex', flexDirection: 'column', gap: `${4 * scale}px`, marginTop: `${24 * scale}px`, flex: 1 }}>
                        {([
                          { l: 'Name', v: userProfile.name?.toUpperCase() },
                          { l: 'USER ID', v: `@${userProfile.username || ''}` },
                          { l: 'Email', v: maskEmail(userProfile.email || '') },
                          userProfile.DOB && { l: 'DOB', v: userProfile.DOB },
                          userProfile.gender && { l: 'Gender', v: userProfile.gender },
                          userProfile.country && { l: 'Nation', v: userProfile.country },
                        ] as any[]).filter(Boolean).map((f: any) => (
                          <div key={f.l} style={{ display: 'flex', alignItems: 'baseline', gap: `${8 * scale}px` }}>
                            <span style={{ fontSize: `${9 * scale}px`, textTransform: 'uppercase', letterSpacing: '0.09em', color: theme === 'dark' ? 'rgba(255,255,255,0.5)' : 'rgba(0,0,0,0.5)', flexShrink: 0, width: `${55 * scale}px`, fontWeight: 500 }}>{f.l}</span>
                            <span style={{
                              fontSize: f.l === 'Name' ? `${11 * scale}px` : `${10 * scale}px`,
                              fontWeight: f.l === 'Name' ? 700 : 400,
                              color: theme === 'dark' ? '#ffffff' : '#000000',
                              fontFamily: f.l === 'Name' ? "'DM Sans', system-ui, sans-serif" : "'DM Mono',monospace",
                              whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', flex: 1
                            }}>{f.v}</span>
                          </div>
                        ))}
                      </div>

                      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', paddingTop: `${6 * scale}px`, borderTop: theme === 'dark' ? '0.5px solid rgba(255,255,255,0.1)' : '0.5px solid rgba(0,0,0,0.1)' }}>
                        <span style={{ fontSize: `${8 * scale}px`, fontWeight: 500, color: theme === 'dark' ? 'rgba(255,255,255,0.5)' : 'rgba(0,0,0,0.5)', letterSpacing: '0.05em' }}>
                          Member since {new Date(userProfile.created_at || userProfile.id).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })}
                        </span>
                        <div style={{ display: 'flex', gap: `${3 * scale}px` }}>
                          {[0.32, 0.18, 0.09].map((o, i) => <div key={i} style={{ width: `${4 * scale}px`, height: `${4 * scale}px`, borderRadius: '50%', background: theme === 'dark' ? `rgba(255,255,255,${o})` : `rgba(0,0,0,${o})` }} />)}
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            )}

            <div className="flex-1 w-full max-w-[360px] sm:max-w-[560px] md:max-w-[660px] lg:max-w-[740px] bg-zinc-50 dark:bg-zinc-900/40 border border-zinc-200 dark:border-zinc-800 rounded-3xl p-4 flex flex-col min-h-0 overflow-hidden">
              <div className="flex items-center justify-between px-1 mb-2.5 flex-shrink-0">
                <div className="flex items-center gap-1.5">
                  <h4 className="font-semibold text-zinc-500" style={{ fontSize: fontSize.xs }}>Public Exams</h4>
                  <button
                    onClick={() => setShowProfileCard(!showProfileCard)}
                    className="p-1 hover:bg-zinc-200 dark:hover:bg-zinc-800 rounded-lg transition-colors text-zinc-550 dark:text-zinc-450 cursor-pointer flex items-center justify-center"
                    title={showProfileCard ? "Collapse Card" : "Expand Card"}
                  >
                    {showProfileCard ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
                  </button>
                </div>
                <span className="text-zinc-500 font-medium" style={{ fontSize: fontSize.xs }}>Total: {totalCount}</span>
              </div>

              <div className="flex-grow overflow-y-auto space-y-2 pr-1 min-h-0">
                {examsLoading ? (
                  <div className="flex flex-col items-center justify-center py-8">
                    <Loader2 className="w-5 h-5 text-blue-500 animate-spin" />
                    <p className="mt-1 text-[9px] text-zinc-500">Loading Exams...</p>
                  </div>
                ) : exams.length > 0 ? (
                  exams.map((exam) => {
                    const groupedPlan = parsePlanSubjectsAndTopicsGrouped(exam.ExamPlan);
                    return (
                      <div
                        key={exam.id}
                        className="p-3 bg-white dark:bg-zinc-950 border border-black/10 dark:border-white/10 rounded-2xl flex flex-col space-y-2.5 w-full hover:border-black/20 dark:hover:border-white/25 transition-all shadow-xs"
                      >
                        <div className="flex justify-between items-start gap-4 w-full">
                          <div className="flex-1 min-w-0">
                            <div className="flex flex-wrap items-center gap-1.5">
                              <h5 className="font-semibold text-zinc-900 dark:text-white truncate max-w-[130px] sm:max-w-[200px] md:max-w-[260px] lg:max-w-[420px]" title={exam.examName} style={{ fontSize: fontSize.sm }}>
                                {exam.examName || 'Untitled Exam'}
                              </h5>
                              <span className={`px-1.5 py-0.5 rounded font-bold uppercase ${exam.difficulty?.toLowerCase() === 'easy' ? 'bg-green-500/10 text-green-600 dark:text-green-400' :
                                exam.difficulty?.toLowerCase() === 'hard' ? 'bg-red-500/10 text-red-600 dark:text-red-400' :
                                  'bg-amber-500/10 text-amber-600 dark:text-amber-400'
                                }`} style={{ fontSize: fontSize.xs }}>
                                {exam.difficulty || 'Medium'}
                              </span>
                              {exam.totalTime && (
                                <span className="font-bold text-zinc-500 dark:text-zinc-400" style={{ fontSize: fontSize.xs }}>
                                  {exam.totalTime} Mins
                                </span>
                              )}
                              {exam.totalMarks && (
                                <span className="font-bold text-zinc-500 dark:text-zinc-400" style={{ fontSize: fontSize.xs }}>
                                  {exam.totalMarks} Marks
                                </span>
                              )}
                            </div>
                          </div>

                          {loggedInProfile?.id !== userId && (
                            <button
                              onClick={() => handleImportExamClick(exam)}
                              className="p-1.5 bg-blue-600 hover:bg-blue-700 text-white rounded-lg cursor-pointer transition-all flex items-center justify-center shadow-xs flex-shrink-0"
                              title="Import to your exams"
                            >
                              <Download className="w-3 h-3 text-white" />
                            </button>
                          )}
                        </div>

                        {groupedPlan.length > 0 && (
                          <div className="w-full bg-zinc-50 dark:bg-zinc-900/60 border border-black/5 dark:border-white/8 rounded-2xl p-2.5 space-y-1.5">
                            {groupedPlan.map((g, idx) => (
                              <div key={idx} className="leading-relaxed text-zinc-650 dark:text-zinc-400" style={{ fontSize: fontSize.xs }}>
                                <strong className="text-zinc-800 dark:text-zinc-200 uppercase">{g.subject}:</strong>{' '}
                                {g.topics.length > 0 ? g.topics.join(', ') : 'All Topics'}
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    );
                  })
                ) : (
                  <div className="text-center py-8 border border-dashed border-black/15 dark:border-white/20 rounded-2xl">
                    <BookOpen className="w-6 h-6 text-zinc-400 mx-auto mb-1.5" />
                    <p className="text-zinc-500 font-medium" style={{ fontSize: fontSize.xs }}>No public exams found.</p>
                  </div>
                )}
              </div>

              {totalPages > 1 && (
                <div className="flex items-center justify-between pt-2.5 border-t border-black/10 dark:border-white/10 mt-2.5 flex-shrink-0">
                  <button
                    onClick={() => setPage(p => Math.max(0, p - 1))}
                    disabled={page === 0}
                    className="px-2 py-1 bg-zinc-100 dark:bg-zinc-800 hover:bg-zinc-200 dark:hover:bg-zinc-700 disabled:opacity-40 disabled:cursor-not-allowed rounded-lg font-semibold text-zinc-750 dark:text-zinc-300 transition-all flex items-center gap-1 cursor-pointer"
                    style={{ fontSize: fontSize.xs }}
                  >
                    <ChevronLeft className="w-3 h-3" />
                    Prev
                  </button>
                  <span className="text-zinc-500 dark:text-zinc-400 font-medium" style={{ fontSize: fontSize.xs }}>
                    Page {page + 1} of {totalPages}
                  </span>
                  <button
                    onClick={() => setPage(p => Math.min(totalPages - 1, p + 1))}
                    disabled={page >= totalPages - 1}
                    className="px-2 py-1 bg-zinc-100 dark:bg-zinc-800 hover:bg-zinc-200 dark:hover:bg-zinc-700 disabled:opacity-40 disabled:cursor-not-allowed rounded-lg font-semibold text-zinc-750 dark:text-zinc-300 transition-all flex items-center gap-1 cursor-pointer"
                    style={{ fontSize: fontSize.xs }}
                  >
                    Next
                    <ChevronRight className="w-3 h-3" />
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      {showCreateOthersCategoryModal && (
        <div className="fixed inset-0 z-[260] flex items-center justify-center bg-black/75 backdrop-blur-xs p-4">
          <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800/80 rounded-3xl p-5 max-w-xs w-full shadow-2xl flex flex-col items-center text-center">
            <AlertCircle className="w-10 h-10 text-blue-500 mb-3" />
            <h3 className="text-sm font-semibold text-zinc-900 dark:text-white mb-2">Create Category 'others'?</h3>
            <p className="text-xs text-zinc-500 dark:text-zinc-400 mb-4 leading-relaxed font-medium">
              You need to create the 'others' exam type category first to import public exams. Create it now?
            </p>

            {importError && (
              <div className="p-2 mb-4 bg-red-50 dark:bg-red-950/20 border border-red-200 dark:border-red-900 rounded-xl text-red-600 dark:text-red-400 text-[10px] font-medium flex gap-1.5 text-left w-full">
                <AlertCircle className="w-3.5 h-3.5 shrink-0 text-red-500" />
                <span>{importError}</span>
              </div>
            )}

            <div className="flex gap-2.5 w-full">
              <button
                onClick={() => {
                  setShowCreateOthersCategoryModal(false);
                  setImportTargetExam(null);
                }}
                disabled={importing}
                className="flex-1 py-2 border border-zinc-200 dark:border-zinc-800 text-zinc-600 dark:text-zinc-300 hover:bg-zinc-900 rounded-xl text-xs font-semibold cursor-pointer transition-all"
              >
                Cancel
              </button>
              <button
                onClick={handleCreateOthersCategory}
                disabled={importing}
                className="flex-1 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-semibold cursor-pointer transition-all flex items-center justify-center gap-1.5"
              >
                {importing ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : 'Create'}
              </button>
            </div>
          </div>
        </div>
      )}

      {showConfirmImportModal && (
        <div className="fixed inset-0 z-[260] flex items-center justify-center bg-black/75 backdrop-blur-xs p-4">
          <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800/80 rounded-3xl p-5 max-w-xs w-full shadow-2xl flex flex-col items-center text-center">
            <Check className="w-10 h-10 text-green-500 mb-3" />
            <h3 className="text-sm font-semibold text-zinc-900 dark:text-white mb-2">Import Exam?</h3>
            <p className="text-xs text-zinc-500 dark:text-zinc-400 mb-4 leading-relaxed font-medium">
              Would you like to add <strong>{importTargetExam?.examName}</strong> to your 'others' exams?
            </p>

            {importError && (
              <div className="p-2 mb-4 bg-red-50 dark:bg-red-950/20 border border-red-200 dark:border-red-900 rounded-xl text-red-600 dark:text-red-400 text-[10px] font-medium flex gap-1.5 text-left w-full">
                <AlertCircle className="w-3.5 h-3.5 shrink-0 text-red-500" />
                <span>{importError}</span>
              </div>
            )}

            {importSuccess && (
              <div className="p-2 mb-4 bg-green-50 dark:bg-green-950/20 border border-green-200 dark:border-green-900 rounded-xl text-green-600 dark:text-green-400 text-[10px] font-medium flex gap-1.5 text-left w-full">
                <Check className="w-3.5 h-3.5 shrink-0 text-green-500" />
                <span>{importSuccess}</span>
              </div>
            )}

            <div className="flex gap-2.5 w-full">
              <button
                onClick={() => {
                  setShowConfirmImportModal(false);
                  setImportTargetExam(null);
                }}
                disabled={importing}
                className="flex-1 py-2 border border-zinc-200 dark:border-zinc-800 text-zinc-600 dark:text-zinc-300 hover:bg-zinc-900 rounded-xl text-xs font-semibold cursor-pointer transition-all"
              >
                Cancel
              </button>
              <button
                onClick={handleConfirmImport}
                disabled={importing || !!importSuccess || importTargetExam?.createdBy === loggedInProfile?.id}
                className="flex-1 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-semibold cursor-pointer transition-all flex items-center justify-center gap-1.5"
              >
                {importing ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : 'Add'}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
