import { Clipboard, Check, Loader2, AlertCircle, BookOpen, Download, ChevronLeft, ChevronRight, X, ChevronUp, ChevronDown } from 'lucide-react';
import { useUserProfile } from '../../lib/UserContext.tsx';
import { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { fontSize } from '../../lib/utils';
import { useTheme } from '../../lib/ThemeContext.tsx';
import { supabase } from '../../services/supabase';
import ProfileCard from './ProfileCard';

const EXAMS_PER_PAGE = 5;

const getDailyImportLimit = (plan: string) => {
  const p = plan.toLowerCase();
  if (p.includes('lite')) return 5;
  if (p.includes('rise')) return 10;
  if (p.includes('peak')) return 15;
  return 3;
};

export default function PublicProfileModal({ onClose, userId }: { onClose: () => void; userId?: string }) {
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

  const totalPages = Math.ceil(totalCount / EXAMS_PER_PAGE);

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
          <ProfileCard userProfile={userProfile} variant="preview" />
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
      setImportError("You cannot import your own exam.");
      setShowConfirmImportModal(true);
      return;
    }

    try {
      const { data: countData, error: countErr } = await supabase
        .from('import_logs')
        .select('created_at')
        .eq('userId', loggedInProfile?.id);

      if (countErr) throw countErr;

      const todayStr = new Date().toDateString();
      const todayImports = (countData || []).filter(log => new Date(log.created_at).toDateString() === todayStr).length;

      const limit = getDailyImportLimit(loggedInProfile?.PremiumType || '');
      if (todayImports >= limit) {
        setImportError(`Daily import limit reached (${limit}/${limit} exams).`);
        setShowConfirmImportModal(true);
        return;
      }

      const { data: checkLink, error: linkErr } = await supabase
        .from('exams')
        .select('id')
        .eq('createdBy', loggedInProfile?.id)
        .eq('importedFrom', exam.id)
        .maybeSingle();

      if (linkErr) throw linkErr;
      if (checkLink) {
        setImportError("You have already imported this exam.");
        setShowConfirmImportModal(true);
        return;
      }

      const othersId = await checkOthersCategory();
      if (!othersId) {
        setShowCreateOthersCategoryModal(true);
      } else {
        setShowConfirmImportModal(true);
      }
    } catch (err: any) {
      console.error(err);
      setImportError(err.message || 'Error checking import status.');
      setShowConfirmImportModal(true);
    }
  };

  const handleCreateOthersCategory = async () => {
    if (!loggedInProfile?.id) return;
    setImporting(true);
    setImportError('');
    try {
      const { error } = await supabase
        .from('examtypes')
        .insert({
          userId: loggedInProfile.id,
          name: 'others',
          sub: []
        });

      if (error) throw error;
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
    setImportSuccess('');
    try {
      const othersId = await checkOthersCategory();
      if (!othersId) throw new Error("Category 'others' not found.");

      const { data: sourceQuestions, error: qErr } = await supabase
        .from('questions')
        .select('*')
        .eq('examId', importTargetExam.id);

      if (qErr) throw qErr;
      if (!sourceQuestions || sourceQuestions.length === 0) {
        throw new Error("No questions found in this exam to import.");
      }

      const { data: newExam, error: examErr } = await supabase
        .from('exams')
        .insert({
          createdBy: loggedInProfile.id,
          examName: importTargetExam.examName,
          difficulty: importTargetExam.difficulty,
          examTypeId: othersId,
          totalTime: importTargetExam.totalTime,
          totalMarks: importTargetExam.totalMarks,
          isPublic: false,
          importedFrom: importTargetExam.id,
          ExamPlan: importTargetExam.ExamPlan
        })
        .select('id')
        .single();

      if (examErr) throw examErr;

      const questionsToInsert = sourceQuestions.map(q => ({
        examId: newExam.id,
        questionText: q.questionText,
        options: q.options,
        correctOption: q.correctOption,
        solutionText: q.solutionText,
        marks: q.marks,
        negativeMarks: q.negativeMarks,
        subject: q.subject,
        topic: q.topic
      }));

      const { error: batchErr } = await supabase
        .from('questions')
        .insert(questionsToInsert);

      if (batchErr) throw batchErr;

      await supabase
        .from('import_logs')
        .insert({
          userId: loggedInProfile.id,
          examId: importTargetExam.id
        });

      setImportSuccess('Exam successfully imported!');
      setTimeout(() => {
        setShowConfirmImportModal(false);
        setImportTargetExam(null);
        setImportSuccess('');
      }, 1500);
    } catch (err: any) {
      setImportError(err.message || 'Failed to import exam.');
      setImporting(false);
    }
  };

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
              <div className="flex-shrink-0">
                <ProfileCard userProfile={userProfile} variant="public" />
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
                        className="bg-white dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800/80 rounded-2xl p-3 flex flex-col gap-2 hover:border-zinc-350 dark:hover:border-zinc-700 transition-colors"
                      >
                        <div className="flex justify-between items-start">
                          <div>
                            <h5 className="font-bold text-zinc-800 dark:text-zinc-200" style={{ fontSize: fontSize.sm }}>
                              {exam.examName}
                            </h5>
                            <div className="flex items-center gap-2 mt-0.5 text-zinc-400" style={{ fontSize: fontSize.xs }}>
                              <span className="capitalize px-1.5 py-0.5 rounded bg-zinc-100 dark:bg-zinc-900 font-semibold">{exam.difficulty}</span>
                              <span>•</span>
                              <span>{exam.totalMarks} Marks</span>
                              <span>•</span>
                              <span>{exam.totalTime} Mins</span>
                            </div>
                          </div>

                          {loggedInProfile?.id && (
                            <button
                              onClick={() => handleImportExamClick(exam)}
                              disabled={exam.createdBy === loggedInProfile.id}
                              className="p-1.5 bg-blue-600 hover:bg-blue-700 disabled:opacity-40 disabled:hover:bg-blue-600 rounded-lg transition-colors flex items-center justify-center cursor-pointer"
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
