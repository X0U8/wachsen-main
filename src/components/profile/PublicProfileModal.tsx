import { Clipboard, Check, Loader2, AlertCircle, BookOpen, Download, ChevronLeft, ChevronRight, X, ChevronUp, ChevronDown } from 'lucide-react';
import MathText from '../../ui/MathText';
import { useUserProfile } from '../../lib/UserContext.tsx';
import { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { fontSize } from '../../lib/utils';
import { useTheme } from '../../lib/ThemeContext.tsx';
import { supabase } from '../../services/supabase';
import { useQueryClient } from '@tanstack/react-query';
import localStorageCache from '../../lib/localStorage';
import ProfileCard from './ProfileCard';
import ProfileAnalyticsView from './ProfileAnalyticsView';

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
  const queryClient = useQueryClient();
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
  const [activeTab, setActiveTab] = useState<'profile' | 'questions' | 'analytics'>('profile');
  const [expandedExamIds, setExpandedExamIds] = useState<string[]>([]);

  const toggleExamExpanded = (id: string) => {
    setExpandedExamIds(prev =>
      prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]
    );
  };

  const targetUserId = userId || loggedInProfile?.id;
  const isOwner = targetUserId === loggedInProfile?.id;

  const parsePlanSubjectsAndTopicsGrouped = (rawPlan: any) => {
    try {
      if (!rawPlan) return [];
      const parsed = typeof rawPlan === 'string' ? JSON.parse(rawPlan) : rawPlan;
      const subjectsList = Array.isArray(parsed) ? parsed : (parsed?.subjects || []);

      const grouped: { subject: string; topics: string[] }[] = [];

      subjectsList.forEach((sub: any) => {
        const subName = sub.subjectName || sub.name || '';
        if (!subName) return;
        let topics = sub.topics || [];
        if (Array.isArray(sub.segments)) {
          topics = sub.segments.flatMap((seg: any) => seg.topics || []);
        }
        const topicNames = topics.map((t: any) => typeof t === 'string' ? t : (t?.name || t?.topicName || t?.topic || '')).filter(Boolean);
        grouped.push({
          subject: subName,
          topics: topicNames
        });
      });
      return grouped;
    } catch (e) {
      console.error(e);
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
          .select('id, email, name, username, frequency, source, DOB, gender, country, is_ban, is_premium, premium_ends, credits, profile_picture, last_claimed, premium_type')
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
      if (count !== null) setTotalCount(count);
    } catch (err) {
      console.error('Error fetching public exams:', err);
    } finally {
      setExamsLoading(false);
    }
  }, [targetUserId, page]);

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
          <h1 className="font-medium tracking-tight text-white text-xl">Wachsen</h1>
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
            className="mt-8 px-6 py-2.5 bg-white/10 hover:bg-white/15 transition-colors rounded-xl text-white font-medium cursor-pointer text-sm">
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
      const today = new Date();
      today.setHours(0, 0, 0, 0);

      const { count: todayCount, error: countErr } = await supabase
        .from('import_logs')
        .select('*', { count: 'exact', head: true })
        .eq('userId', loggedInProfile?.id)
        .gte('created_at', today.toISOString());

      if (countErr) throw countErr;

      const todayImports = todayCount ?? 0;

      const limit = getDailyImportLimit(loggedInProfile?.PremiumType || '');
      if (todayImports >= limit) {
        setImportError(`Daily import limit reached (${limit}/${limit} exams).`);
        setShowConfirmImportModal(true);
        return;
      }

      const { data: checkLink, error: linkErr } = await supabase
        .from('import_logs')
        .select('id')
        .eq('userId', loggedInProfile?.id)
        .eq('examId', exam.id)
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
      const { data, error } = await supabase
        .from('examtypes')
        .insert({
          userId: loggedInProfile.id,
          name: 'others',
          subjects: ['any'],
          academicLevel: 'any'
        })
        .select('id')
        .single();

      if (error) throw error;

      // Update localStorage cache so ExamPage shows 'others' immediately
      const cached = localStorageCache.get<any[]>(localStorageCache.keys.EXAM_CATEGORIES) || [];
      const newCategory = { id: data.id, name: 'others', subjects: ['any'], academicLevel: 'any' };
      localStorageCache.set(localStorageCache.keys.EXAM_CATEGORIES, [...cached, newCategory]);

      // Invalidate the TanStack Query so ExamPage re-renders
      queryClient.invalidateQueries({ queryKey: ['examCategories', loggedInProfile.id] });

      setShowCreateOthersCategoryModal(false);
      setShowConfirmImportModal(true);
    } catch (err: any) {
      setImportError(err.message || 'Failed to create others ExamType.');
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
      if (!othersId) throw new Error("ExamType 'others' not found.");

      // Fetch all source exam data — questions live inside generatedExam JSON
      const { data: sourceExam, error: srcErr } = await supabase
        .from('exams')
        .select('examName, examType, difficulty, totalTime, totalQuestions, totalMarks, subjects, generatedExam, correct_marks, negative_marks, language, ExamPlan')
        .eq('id', importTargetExam.id)
        .single();

      if (srcErr || !sourceExam) throw srcErr || new Error('Could not fetch source exam.');
      if (!sourceExam.generatedExam) throw new Error('This exam has no questions to import.');

      const { error: examErr } = await supabase
        .from('exams')
        .insert({
          // User-specific overrides
          createdBy: loggedInProfile.id,
          accessIds: [loggedInProfile.id],
          accessType: 'anytime',
          startDateTime: null,
          endDateTime: null,
          categoryId: othersId,
          status: 'Pending',
          isPublic: false,
          likes: 0,
          likedBy: [],
          // Everything else copied exactly from source
          examName: sourceExam.examName,
          examType: sourceExam.examType,
          difficulty: sourceExam.difficulty,
          totalTime: sourceExam.totalTime,
          totalQuestions: sourceExam.totalQuestions,
          totalMarks: sourceExam.totalMarks,
          subjects: sourceExam.subjects,
          generatedExam: sourceExam.generatedExam,
          correct_marks: sourceExam.correct_marks,
          negative_marks: sourceExam.negative_marks,
          language: sourceExam.language,
          ExamPlan: sourceExam.ExamPlan,
        });

      if (examErr) throw examErr;

      await supabase
        .from('import_logs')
        .insert({ userId: loggedInProfile.id, examId: importTargetExam.id });

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

  const getDifficultyColor = (diff: string) => {
    const d = String(diff || '').toLowerCase();
    if (d === 'easy') return 'bg-green-500/10 text-green-600 dark:bg-green-500/20 dark:text-green-400';
    if (d === 'hard') return 'bg-red-500/10 text-red-600 dark:bg-red-500/20 dark:text-red-400';
    return 'bg-blue-500/10 text-blue-600 dark:bg-blue-500/20 dark:text-blue-400';
  };

  return (
    <>
      <div
        className="fixed inset-0 bg-black/60 backdrop-blur-sm z-[250] flex items-center justify-center p-4"
        onClick={e => { if (e.target === e.currentTarget) onClose(); }}
      >
        <div className="bg-white dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800/80 rounded-3xl w-full max-w-[420px] sm:max-w-[620px] md:max-w-[720px] lg:max-w-[800px] h-[640px] max-h-[90vh] flex flex-col shadow-2xl relative overflow-hidden animate-fade-in">

          <div className="flex justify-between items-center px-5 py-4 border-b border-black/10 dark:border-white/10 flex-shrink-0">
            <h1 className="font-semibold text-zinc-900 dark:text-white text-base">
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

            <div className="flex bg-zinc-100 dark:bg-zinc-900 p-1 rounded-2xl border border-zinc-200 dark:border-zinc-800 w-full max-w-[360px] mx-auto flex-shrink-0">
              <button
                onClick={() => setActiveTab('profile')}
                className={`flex-1 py-1.5 text-xs font-semibold rounded-xl transition-all cursor-pointer text-center ${activeTab === 'profile'
                    ? 'bg-white dark:bg-zinc-950 text-zinc-900 dark:text-white shadow-xs'
                    : 'text-zinc-500 hover:text-zinc-700 dark:hover:text-zinc-300'
                  }`}
              >
                Profile
              </button>
              <button
                onClick={() => setActiveTab('questions')}
                className={`flex-1 py-1.5 text-xs font-semibold rounded-xl transition-all cursor-pointer text-center ${activeTab === 'questions'
                    ? 'bg-white dark:bg-zinc-950 text-zinc-900 dark:text-white shadow-xs'
                    : 'text-zinc-500 hover:text-zinc-700 dark:hover:text-zinc-300'
                  }`}
              >
                Exams
              </button>
              <button
                onClick={() => setActiveTab('analytics')}
                className={`flex-1 py-1.5 text-xs font-semibold rounded-xl transition-all cursor-pointer text-center ${activeTab === 'analytics'
                    ? 'bg-white dark:bg-zinc-950 text-zinc-900 dark:text-white shadow-xs'
                    : 'text-zinc-500 hover:text-zinc-700 dark:hover:text-zinc-300'
                  }`}
              >
                Analytics
              </button>
            </div>

            <div className="flex-1 w-full max-w-[360px] sm:max-w-[560px] md:max-w-[660px] lg:max-w-[740px] flex flex-col min-h-0 overflow-hidden">

              {activeTab === 'profile' && (
                <div className="flex-grow flex flex-col items-center justify-center p-4">
                  <ProfileCard userProfile={userProfile} variant="public" />
                </div>
              )}

              {activeTab === 'questions' && (
                <div className="flex-grow flex flex-col min-h-0 space-y-4">
                  <div className="flex items-center justify-between px-1 flex-shrink-0">
                    <h4 className="font-semibold text-zinc-500 text-xs">Public Exams</h4>
                    <span className="text-zinc-500 font-medium text-xs">Total: {totalCount}</span>
                  </div>

                  <div className="flex-1 overflow-y-auto space-y-3 pb-4 pr-1">
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
                            className="bg-white dark:bg-zinc-900/40 border border-zinc-200 dark:border-zinc-800 rounded-2xl p-4 flex flex-col gap-2 shadow-xs hover:shadow-md transition-shadow"
                          >
                            <div className="flex justify-between items-start">
                              <div>
                                <h5 className="font-bold text-zinc-850 dark:text-zinc-205 text-sm">
                                  {exam.examName}
                                </h5>
                                <div
                                  className="flex items-center gap-2 mt-1 text-zinc-550 dark:text-zinc-400 font-medium text-xs">
                                  <span className={`capitalize px-2 py-0.5 rounded-lg font-semibold ${getDifficultyColor(exam.difficulty)}`}>
                                    {exam.difficulty}
                                  </span>
                                  <span className="text-zinc-350 dark:text-zinc-600">•</span>
                                  <span>{exam.totalMarks} Marks</span>
                                  <span className="text-zinc-350 dark:text-zinc-600">•</span>
                                  <span>{exam.totalTime} Mins</span>
                                </div>
                              </div>

                              {loggedInProfile?.id && (
                                <button
                                  onClick={() => handleImportExamClick(exam)}
                                  disabled={exam.createdBy === loggedInProfile.id}
                                  className="p-2 bg-blue-600 hover:bg-blue-700 disabled:opacity-40 disabled:hover:bg-blue-600 rounded-xl transition-colors flex items-center justify-center cursor-pointer"
                                  title="Import to your exams"
                                >
                                  <Download className="w-3.5 h-3.5 text-white" />
                                </button>
                              )}
                            </div>
                            {groupedPlan.length > 0 && (() => {
                              const isExpanded = expandedExamIds.includes(exam.id);
                              return (
                                <div className="w-full pt-1.5 flex items-start gap-3">
                                  <div className={`flex-1 text-zinc-500 dark:text-zinc-400 text-xs overflow-hidden ${isExpanded ? 'space-y-1' : 'line-clamp-1 truncate'}`}>
                                    {groupedPlan.map((g, idx) => (
                                      <div key={idx} className={isExpanded ? "leading-relaxed animate-fade-in" : "inline mr-3"}>
                                        <strong className="text-zinc-700 dark:text-zinc-300 uppercase">
                                          {isExpanded ? <MathText text={g.subject} /> : g.subject}:
                                        </strong>{' '}
                                        <span>
                                          {isExpanded ? (
                                            <MathText text={g.topics.length > 0 ? g.topics.join(', ') : 'All Topics'} />
                                          ) : (
                                            g.topics.length > 0 ? g.topics.join(', ') : 'All Topics'
                                          )}
                                        </span>
                                        {!isExpanded && idx < groupedPlan.length - 1 && <span className="text-zinc-400"> | </span>}
                                      </div>
                                    ))}
                                  </div>
                                  <button
                                    onClick={() => toggleExamExpanded(exam.id)}
                                    className="p-1 hover:bg-zinc-100 dark:hover:bg-zinc-900 rounded-lg text-zinc-450 dark:text-zinc-550 transition-colors flex items-center justify-center cursor-pointer shrink-0"
                                    title={isExpanded ? "Show Less" : "Show More"}
                                  >
                                    {isExpanded ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
                                  </button>
                                </div>
                              );
                            })()}
                          </div>
                        );
                      })
                    ) : (
                      <div className="text-center py-8 border border-dashed border-black/15 dark:border-white/20 rounded-2xl">
                        <BookOpen className="w-6 h-6 text-zinc-400 mx-auto mb-1.5" />
                        <p className="text-zinc-500 font-medium text-xs">No public exams found.</p>
                      </div>
                    )}
                  </div>

                  {totalPages > 1 && (
                    <div className="flex items-center justify-between pt-2.5 border-t border-black/10 dark:border-white/10 mt-auto flex-shrink-0">
                      <button
                        onClick={() => setPage(p => Math.max(0, p - 1))}
                        disabled={page === 0}
                        className="px-2.5 py-1.5 bg-zinc-100 dark:bg-zinc-900 hover:bg-zinc-200 dark:hover:bg-zinc-800 disabled:opacity-40 disabled:cursor-not-allowed rounded-xl font-semibold text-zinc-750 dark:text-zinc-300 transition-all flex items-center gap-1 cursor-pointer text-xs">
                        <ChevronLeft className="w-3.5 h-3.5" />
                        Prev
                      </button>
                      <span className="text-zinc-500 font-semibold text-xs">
                        Page {page + 1} of {totalPages}
                      </span>
                      <button
                        onClick={() => setPage(p => Math.min(totalPages - 1, p + 1))}
                        disabled={page === totalPages - 1}
                        className="px-2.5 py-1.5 bg-zinc-100 dark:bg-zinc-900 hover:bg-zinc-200 dark:hover:bg-zinc-800 disabled:opacity-40 disabled:cursor-not-allowed rounded-xl font-semibold text-zinc-750 dark:text-zinc-300 transition-all flex items-center gap-1 cursor-pointer text-xs">
                        Next
                        <ChevronRight className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  )}
                </div>
              )}

              {activeTab === 'analytics' && (
                <div className="flex-1 overflow-y-auto min-h-0 pr-1">
                  <ProfileAnalyticsView userId={targetUserId} isOwner={isOwner} />
                </div>
              )}

            </div>

          </div>

        </div>
      </div>
      {showConfirmImportModal && importTargetExam && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-xs z-[260] flex items-center justify-center p-4">
          <div className="bg-white dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800/80 rounded-3xl p-5 w-full max-w-[340px] shadow-2xl relative overflow-hidden text-center space-y-4">
            <h4 className="font-bold text-zinc-900 dark:text-white text-base">Import Exam</h4>
            <p className="text-zinc-500 font-medium text-xs leading-relaxed">
              Do you want to import <strong>{importTargetExam.examName}</strong> to your own categories?
            </p>
            {importError && (
              <div className="flex items-center gap-1.5 text-red-500 justify-center font-semibold text-[10px]">
                <AlertCircle className="w-3.5 h-3.5" />
                <span>{importError}</span>
              </div>
            )}
            {importSuccess && (
              <div className="text-green-500 justify-center font-bold text-xs">
                {importSuccess}
              </div>
            )}
            <div className="flex gap-2.5 pt-1">
              <button
                onClick={() => { setShowConfirmImportModal(false); setImportTargetExam(null); }}
                disabled={importing || !!importSuccess}
                className="flex-1 py-2 border border-zinc-200 dark:border-zinc-800 text-zinc-655 dark:text-zinc-300 font-semibold rounded-xl text-xs cursor-pointer hover:bg-zinc-50 dark:hover:bg-zinc-900 transition-all"
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
      {showCreateOthersCategoryModal && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-xs z-[260] flex items-center justify-center p-4">
          <div className="bg-white dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800/80 rounded-3xl p-5 w-full max-w-[340px] shadow-2xl relative overflow-hidden text-center space-y-4">
            <h4 className="font-bold text-zinc-900 dark:text-white text-base">Create ExamType</h4>
            <p className="text-zinc-500 font-medium text-xs leading-relaxed">
              We need to initialize a default ExamType named <strong>others</strong> on your account to import this exam.
            </p>
            {importError && (
              <div className="flex items-center gap-1.5 text-red-500 justify-center font-semibold text-[10px]">
                <AlertCircle className="w-3.5 h-3.5" />
                <span>{importError}</span>
              </div>
            )}
            <div className="flex gap-2.5 pt-1">
              <button
                onClick={() => setShowCreateOthersCategoryModal(false)}
                disabled={importing}
                className="flex-1 py-2 border border-zinc-200 dark:border-zinc-800 text-zinc-655 dark:text-zinc-300 font-semibold rounded-xl text-xs cursor-pointer hover:bg-zinc-50 dark:hover:bg-zinc-900 transition-all"
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
    </>
  );
}
