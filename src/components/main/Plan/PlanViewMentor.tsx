import { useState, useEffect, useRef } from 'react';
import { supabase } from '../../../services/supabase';
import { useUserProfile } from '../../../lib/UserContext.tsx';
import { idbGet, idbSet } from '../../../lib/idb';
import { Send, Sparkles, Loader2, RefreshCw, HelpCircle, Info, Database, X } from 'lucide-react';
import { fontSize } from '../../../lib/utils';

interface PlanViewMentorProps {
  planId: string;
  createdAt: string;
}

interface Message {
  id: string;
  sender: 'user' | 'ai';
  text: string;
  timestamp: number;
}

interface ExamType {
  id: string;
  name: string;
}

export default function PlanViewMentor({ planId, createdAt }: PlanViewMentorProps) {
  const { userProfile, refreshCredits } = useUserProfile();

  const [categories, setCategories] = useState<ExamType[]>([]);
  const [selectedCatId, setSelectedCatId] = useState<string | null>(null);
  const [selectedCatName, setSelectedCatName] = useState<string>('');
  const [loadingCategories, setLoadingCategories] = useState<boolean>(true);
  const [showSelectModal, setShowSelectModal] = useState<boolean>(false);


  const [messages, setMessages] = useState<Message[]>([]);
  const [visibleCount, setVisibleCount] = useState<number>(20);
  const [inputValue, setInputValue] = useState<string>('');
  const [sending, setSending] = useState<boolean>(false);
  const [chatLoaded, setChatLoaded] = useState<boolean>(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const chatContainerRef = useRef<HTMLDivElement>(null);

  const createdDate = new Date(createdAt);
  const currentDate = new Date();
  const createdMidnight = new Date(createdDate.getFullYear(), createdDate.getMonth(), createdDate.getDate()).getTime();
  const currentMidnight = new Date(currentDate.getFullYear(), currentDate.getMonth(), currentDate.getDate()).getTime();
  const diffDays = Math.max(0, Math.floor((currentMidnight - createdMidnight) / (1000 * 60 * 60 * 24)));
  const currentActiveMonth = Math.floor(diffDays / 30) + 1;


  useEffect(() => {
    const fetchCategories = async () => {
      try {
        const { data, error } = await supabase
          .from('examtypes')
          .select('id, name, subjects, academicLevel')
          .eq('userId', userProfile?.id)
          .order('created_at', { ascending: true });

        if (error) throw error;
        if (data) {
          const filtered = data.filter(cat => {
            const nameLower = cat.name.toLowerCase();
            const hasAnyAcademic = cat.academicLevel?.toLowerCase() === 'any';
            const hasAnySubject = Array.isArray(cat.subjects)
              ? cat.subjects.some((s: string) => s.toLowerCase() === 'any')
              : typeof cat.subjects === 'string' && (cat.subjects as string).toLowerCase() === 'any';


            if (nameLower === 'challenges' || nameLower === 'others') {
              if (hasAnyAcademic || hasAnySubject) return false;
            }


            if (hasAnyAcademic || hasAnySubject) return false;

            return true;
          });

          setCategories(filtered.map(f => ({ id: f.id, name: f.name })));


          const savedCatId = localStorage.getItem(`mentor_linked_category_${planId}`);
          if (savedCatId) {
            const found = filtered.find(c => c.id === savedCatId);
            if (found) {
              setSelectedCatId(found.id);
              setSelectedCatName(found.name);
            }
          }
        }
      } catch (err) {
        console.error('Failed to load categories:', err);
      } finally {
        setLoadingCategories(false);
      }
    };
    if (userProfile?.id) {
      fetchCategories();
    }
  }, [userProfile?.id, planId]);


  useEffect(() => {
    const loadChat = async () => {
      const savedChats = await idbGet(`mentor_chat_${planId}`);
      setMessages(savedChats || []);
      setChatLoaded(true);
    };
    loadChat();
  }, [planId]);


  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, visibleCount]);

  const handleLinkCategory = (id: string, name: string) => {
    setSelectedCatId(id);
    setSelectedCatName(name);
    localStorage.setItem(`mentor_linked_category_${planId}`, id);
  };

  const handleUnlinkCategory = () => {
    setSelectedCatId(null);
    setSelectedCatName('');
    localStorage.removeItem(`mentor_linked_category_${planId}`);
  };

  const handleSendMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!inputValue.trim() || sending || !selectedCatId) return;

    const userMessageText = inputValue.trim();
    setInputValue('');
    setSending(true);
    setErrorMsg(null);

    const useOwnKey = localStorage.getItem('use_own_key') === 'true';


    if (useOwnKey) {
      setErrorMsg("Mentor AI can only be queried using our default credit system. Please disable 'Use Own Key' in Settings.");
      setSending(false);
      return;
    }

    const messageCost = 1;
    const userCredits = userProfile?.credits || 0;

    if (userCredits < messageCost) {
      setErrorMsg(`Insufficient credits. Asking Mentor costs ${messageCost} credit. You have ${userCredits}.`);
      setSending(false);
      return;
    }


    const userMsgObj: Message = {
      id: Math.random().toString(36).substring(2),
      sender: 'user',
      text: userMessageText,
      timestamp: Date.now()
    };
    const updatedMessages = [...messages, userMsgObj];
    setMessages(updatedMessages);
    await idbSet(`mentor_chat_${planId}`, updatedMessages);

    try {
      const session = await supabase.auth.getSession();
      const authToken = session.data?.session?.access_token || '';


      const { data: activeTasksRecord } = await supabase
        .from('study_plan_details')
        .select('details_json')
        .eq('plan_id', planId)
        .eq('month_number', currentActiveMonth)
        .maybeSingle();

      const activeTasks = activeTasksRecord?.details_json || [];


      const { data: categoryExams } = await supabase
        .from('exams')
        .select('id, examName, ExamPlan')
        .eq('categoryId', selectedCatId)
        .eq('status', 'completed')
        .order('created_at', { ascending: false })
        .limit(5);

      let examsPerformance: any[] = [];
      if (categoryExams && categoryExams.length > 0) {
        const examIds = categoryExams.map(e => e.id);
        const { data: examResults } = await supabase
          .from('results')
          .select('examId, totalMarks, marksObtained')
          .eq('userId', userProfile?.id)
          .in('examId', examIds);

        examsPerformance = categoryExams.map(exam => {
          const matchingResult = examResults?.find(r => r.examId === exam.id);
          return {
            name: exam.examName,
            plan: exam.ExamPlan,
            marksObtained: matchingResult?.marksObtained || 0,
            totalMarks: matchingResult?.totalMarks || 0
          };
        });
      }


      const response = await fetch('/api/mentor-chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          message: userMessageText,
          chatHistory: updatedMessages.slice(-10),
          activeTasks,
          examsPerformance,
          currentTime: new Date().toLocaleString(undefined, { dateStyle: 'medium', timeStyle: 'short' }),
          userId: userProfile?.id,
          authToken
        })
      });

      const data = await response.json();
      if (!response.ok || !data.success) {
        throw new Error(data.error || 'Failed to fetch response from Mentor.');
      }


      const aiMsgObj: Message = {
        id: Math.random().toString(36).substring(2),
        sender: 'ai',
        text: data.response,
        timestamp: Date.now()
      };
      const finalizedMessages = [...updatedMessages, aiMsgObj];
      setMessages(finalizedMessages);
      await idbSet(`mentor_chat_${planId}`, finalizedMessages);
      refreshCredits();

    } catch (err: any) {
      console.error(err);
      setErrorMsg(err.message || 'Mentor AI is currently offline. Please try again.');
    } finally {
      setSending(false);
    }
  };


  const visibleMessages = messages.slice(-visibleCount);
  const showLoadOlder = messages.length > visibleCount;

  const handleLoadOlder = () => {
    setVisibleCount(prev => prev + 20);
  };

  return (
    <>
      {!selectedCatId ? (
        <div className="border border-zinc-200 dark:border-gray-850 rounded-3xl p-10 text-center flex flex-col items-center gap-6 bg-white/20 dark:bg-gray-900/20 backdrop-blur-[2px] animate-fadeIn">
          <div className="space-y-1.5 max-w-sm">
            <h4 className="font-bold text-zinc-800 dark:text-gray-250 text-sm">Link Exam Type to Mentor AI</h4>
            <p className="text-zinc-500 dark:text-gray-400 text-xs leading-relaxed">
              Select a preparation category to provide Mentor AI with mock exam scores and progress context automatically.
            </p>
          </div>

          <button
            onClick={() => setShowSelectModal(true)}
            className="px-5 py-2.5 bg-blue-600 hover:bg-blue-700 text-white font-bold rounded-xl transition-all cursor-pointer shadow-md hover:shadow-lg flex items-center gap-2 text-xs">
            Select Exam Type
          </button>
        </div>
      ) : (
        <div className="border border-black/15 dark:border-white/20 bg-white dark:bg-zinc-900/40 rounded-3xl overflow-hidden flex flex-col h-[600px] shadow-sm animate-fadeIn relative">

          <div className="px-4 py-3 bg-zinc-50/50 dark:bg-zinc-950/40 border-b border-black/15 dark:border-white/20 flex items-center justify-between gap-4 shrink-0">
            <div className="flex items-center gap-2">
              <h4 className="font-semibold text-zinc-700 dark:text-gray-300 text-xs">
                Mentor AI <span className="text-zinc-400 dark:text-zinc-550 font-normal">({selectedCatName})</span>
              </h4>
            </div>
          </div>

          <div
            ref={chatContainerRef}
            className="flex-1 overflow-y-auto p-4 space-y-4 min-h-0 bg-zinc-50/20 dark:bg-gray-950/10"
          >
            {showLoadOlder && (
              <button
                onClick={handleLoadOlder}
                className="w-full py-2 text-blue-500 hover:underline font-bold transition-all text-center flex items-center justify-center gap-1.5 cursor-pointer text-xs">
                <RefreshCw className="w-3 h-3 animate-spin-reverse" />
                Load older messages...
              </button>
            )}

            {visibleMessages.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-16 text-center gap-3">
                <p className="text-zinc-500 dark:text-zinc-400 font-medium text-xs">
                  start prep related conversation
                </p>
              </div>
            ) : (
              visibleMessages.map((msg) => (
                <div
                  key={msg.id}
                  className={`flex ${msg.sender === 'user' ? 'justify-end' : 'justify-start'} animate-fadeIn`}
                >
                  <div
                    className={`max-w-[80%] rounded-2xl px-4 py-2.5 font-medium leading-relaxed ${msg.sender === 'user'
                      ? 'bg-blue-600 text-white rounded-br-none shadow-sm'
                      : 'bg-zinc-200/60 dark:bg-zinc-800 text-zinc-800 dark:text-gray-200 rounded-bl-none border border-black/15 dark:border-white/20 shadow-xs'
                      } text-xs`}>
                    {msg.text}
                  </div>
                </div>
              ))
            )}

            {sending && (
              <div className="flex justify-start">
                <div
                  className="bg-zinc-150 dark:bg-zinc-800 text-zinc-400 rounded-2xl rounded-bl-none px-4 py-3 flex items-center gap-2 border border-black/5 dark:border-white/8 text-xs">
                  <Loader2 className="w-3.5 h-3.5 animate-spin text-zinc-400" />
                  <span>thinking</span>
                </div>
              </div>
            )}

            {errorMsg && (
              <div
                className="p-3 bg-red-500/10 border border-red-500/20 text-red-500 rounded-2xl font-semibold leading-relaxed text-xs">
                {errorMsg}
              </div>
            )}

            <div ref={messagesEndRef} />
          </div>

          <form
            onSubmit={handleSendMessage}
            className="p-3 bg-white dark:bg-zinc-950 border-t border-black/15 dark:border-white/20 flex items-center gap-2 shrink-0"
          >
            <input
              type="text"
              value={inputValue}
              onChange={(e) => setInputValue(e.target.value)}
              placeholder="Ask Mentor about study plan or performance..."
              disabled={sending}
              className="flex-1 px-4 py-3 bg-zinc-50 dark:bg-zinc-900 border border-black/15 dark:border-white/20 rounded-2xl text-zinc-800 dark:text-white placeholder-zinc-400 focus:outline-none focus:border-blue-500 transition-colors disabled:opacity-40 text-xs" />
            <button
              type="submit"
              disabled={sending || !inputValue.trim()}
              className="p-3 bg-blue-600 hover:bg-blue-700 disabled:bg-zinc-200 dark:disabled:bg-zinc-900 text-white disabled:text-zinc-400 rounded-2xl transition-all cursor-pointer shrink-0 disabled:cursor-not-allowed"
            >
              <Send className="w-4 h-4" />
            </button>
          </form>
        </div>
      )}
      {showSelectModal && (
        <div className="fixed inset-0 z-[300] flex items-center justify-center bg-black/60 dark:bg-black/80 backdrop-blur-md p-4 animate-in fade-in duration-200">
          <div className="bg-white dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 rounded-3xl p-6 w-full max-w-sm flex flex-col justify-between shadow-2xl relative overflow-hidden text-zinc-900 dark:text-white text-left animate-in zoom-in-95 duration-200">
            <div className="flex items-center justify-between pb-3 border-b border-zinc-100 dark:border-zinc-900">
              <h3
                className="font-bold text-zinc-800 dark:text-white tracking-wider text-sm">Select Exam Type</h3>
              <button
                onClick={() => setShowSelectModal(false)}
                className="p-1 hover:bg-zinc-100 dark:hover:bg-zinc-800 rounded-lg transition-all text-zinc-400 dark:text-zinc-500 hover:text-zinc-700 dark:hover:text-white cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="my-4 max-h-60 overflow-y-auto space-y-2 pr-1 scrollbar-thin">
              {loadingCategories ? (
                <div className="flex items-center justify-center py-6">
                  <Loader2 className="w-5 h-5 animate-spin text-blue-500" />
                </div>
              ) : categories.length === 0 ? (
                <div className="text-center py-6 text-zinc-400 text-xs font-semibold">
                  No Exam Categories found. Create one in the Exams tab first!
                </div>
              ) : (
                categories.map((cat) => (
                  <button
                    key={cat.id}
                    onClick={() => {
                      handleLinkCategory(cat.id, cat.name);
                      setShowSelectModal(false);
                    }}
                    className="w-full py-3 px-4 bg-zinc-50 hover:bg-zinc-100 dark:bg-zinc-900/50 dark:hover:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 hover:border-blue-500 text-zinc-700 dark:text-gray-300 font-bold rounded-2xl transition-all cursor-pointer text-xs uppercase tracking-wide text-center shrink-0 text-xs">
                    {cat.name}
                  </button>
                ))
              )}
            </div>

            <div className="border-t border-zinc-100 dark:border-zinc-900 pt-3">
              <button
                onClick={() => setShowSelectModal(false)}
                className="w-full py-2 bg-zinc-100 hover:bg-zinc-200 dark:bg-zinc-900 dark:hover:bg-zinc-800 border border-zinc-250 dark:border-zinc-800 rounded-xl font-semibold text-zinc-700 dark:text-white transition-all cursor-pointer text-xs">
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
