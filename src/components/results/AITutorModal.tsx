import React, { useEffect, useState, useRef } from 'react';
import { supabase } from '../../services/supabase';
import MathText from '../../ui/MathText';
import { fontSize } from '../../lib/utils';
import {
  Sparkle, X, Send, Loader2, Lightbulb, XCircle, HelpCircle, BookOpen, ListOrdered
} from 'lucide-react';

interface AITutorModalProps {
  isOpen: boolean;
  onClose: () => void;
  question: any;
  userAnswer: string;
  userId: string | null;
  userProfile: any;
  refreshCredits: () => void;
  showNotification: (type: 'success' | 'error' | 'info', message: string) => void;
  originalIndex: number;
  status: 'correct' | 'wrong' | 'skipped';
}

export default function AITutorModal({
  isOpen,
  onClose,
  question,
  userAnswer,
  userId,
  userProfile,
  refreshCredits,
  showNotification,
  originalIndex,
  status
}: AITutorModalProps) {
  const [chatHistory, setChatHistory] = useState<Array<{ role: 'user' | 'assistant', content: string }>>([]);
  const [chatInput, setChatInput] = useState('');
  const [isSendingChat, setIsSendingChat] = useState(false);
  const [lastSentTime, setLastSentTime] = useState(0);

  const chatEndRef = useRef<HTMLDivElement>(null);
  const initializedQuestionId = useRef<string | null>(null);


  useEffect(() => {
    if (!isOpen || !question) return;
    if (chatHistory.length > 0) return;
    if (initializedQuestionId.current === question.id) return;
    initializedQuestionId.current = question.id;

    let intro = `Hi! I am your AI tutor. I noticed you got Question ${originalIndex} `;
    if (status === 'correct') {
      intro += `correct! Excellent job.\n\nWould you like to review the core concepts or discuss any specific step of this question?`;
    } else if (status === 'wrong') {
      intro += `incorrect.\n\nYour answer was "${userAnswer || '(No answer provided)'}", but the correct answer is "${question.correct_answer}".\n\nLet's work together to understand why. Ask me anything about the theory or execution!`;
    } else {
      intro += `skipped.\n\nThe correct answer is "${question.correct_answer}".\n\nLet's go over how to solve this so you are ready next time!`;
    }

    setChatHistory([
      { role: 'assistant', content: intro }
    ]);
    setChatInput('');
    setIsSendingChat(false);
  }, [isOpen, question?.id]);


  useEffect(() => {
    if (chatEndRef.current) {
      chatEndRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  }, [chatHistory]);

  const sendTutorMessage = async (customMessage?: string) => {
    const messageText = customMessage || chatInput.trim();
    if (!messageText.trim() || isSendingChat || !question) return;


    const now = Date.now();
    if (now - lastSentTime < 3000) {
      showNotification('info', 'Please wait 3 seconds between messages.');
      return;
    }
    setLastSentTime(now);

    if (!customMessage) {
      setChatInput('');
    }

    const useOwnKey = localStorage.getItem('use_own_key') === 'true';
    if (!useOwnKey && (userProfile?.credits || 0) < 1) {
      showNotification('error', 'Insufficient credits. You need at least 1 credit to ask the tutor.');
      return;
    }

    setIsSendingChat(true);

    const userMessage = { role: 'user' as const, content: messageText };
    const updatedHistory = [...chatHistory, userMessage];
    setChatHistory(updatedHistory);

    try {
      const { data: { session } } = await supabase.auth.getSession();
      const authToken = session?.access_token || '';

      const useOwnKey = localStorage.getItem('use_own_key') === 'true';
      const userApiKey = localStorage.getItem(localStorage.getItem('provider') === 'mistral' ? 'mistral_api_key' : 'mesh_api_key') || '';
      const activeProvider = localStorage.getItem('provider') || 'mesh';
      const activeModel = localStorage.getItem('mesh_active_model') || '';

      const response = await fetch('/api/ask-question', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          question: question.text,
          correctAnswer: question.correct_answer,
          userAnswer: userAnswer,
          options: question.options,
          history: updatedHistory.slice(1),
          userId: userId,
          authToken,
          apiKey: useOwnKey ? userApiKey : undefined,
          useOwnKey,
          provider: activeProvider,
          model: activeModel,
          stream: true
        })
      });

      if (!response.ok) {
        const errorText = await response.text();
        let errorData: any = {};
        try { errorData = JSON.parse(errorText); } catch (_) {}
        throw new Error(errorData.error || 'Failed to ask tutor');
      }

      let currentHistory = [...updatedHistory, { role: 'assistant' as const, content: '' }];
      setChatHistory(currentHistory);

      const reader = response.body?.getReader();
      if (!reader) throw new Error('Failed to initialize stream reader.');

      const decoder = new TextDecoder();
      let buffer = '';
      let accumulatedText = '';

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split('\n');
        buffer = lines.pop() || '';

        for (const line of lines) {
          const cleanLine = line.trim();
          if (!cleanLine || cleanLine === 'data: [DONE]') continue;

          if (cleanLine.startsWith('data: ')) {
            try {
              const jsonStr = cleanLine.substring(6);
              const parsed = JSON.parse(jsonStr);
              const token = parsed.choices?.[0]?.delta?.content || '';
              if (token) {
                accumulatedText += token;
                currentHistory = currentHistory.map((msg, index) =>
                  index === currentHistory.length - 1 ? { ...msg, content: accumulatedText } : msg
                );
                setChatHistory(currentHistory);
              }
            } catch (err) {
              console.warn('Error parsing SSE stream line:', cleanLine, err);
            }
          }
        }
      }

      if (buffer && buffer.startsWith('data: ')) {
        try {
          const cleanLine = buffer.trim();
          if (cleanLine && cleanLine !== 'data: [DONE]') {
            const jsonStr = cleanLine.substring(6);
            const parsed = JSON.parse(jsonStr);
            const token = parsed.choices?.[0]?.delta?.content || '';
            if (token) {
              accumulatedText += token;
              currentHistory = currentHistory.map((msg, index) =>
                index === currentHistory.length - 1 ? { ...msg, content: accumulatedText } : msg
              );
              setChatHistory(currentHistory);
            }
          }
        } catch (_) {}
      }

      if (!useOwnKey) {
        refreshCredits();
      }
    } catch (err: any) {
      console.error(err);
      showNotification('error', err.message || 'Failed to communicate with tutor');
      setChatHistory(prev => prev.filter((_, i) => i < updatedHistory.length));
      if (!customMessage) {
        setChatInput(messageText);
      }
    } finally {
      setIsSendingChat(false);
    }
  };

  if (!isOpen || !question) return null;

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
      <div className="bg-white dark:bg-gray-900 border border-zinc-200 dark:border-gray-800 rounded-3xl w-full max-w-lg h-[500px] max-h-[85vh] flex flex-col shadow-2xl overflow-hidden animate-in fade-in zoom-in duration-200">
        <div className="p-4 border-b border-zinc-200/50 dark:border-gray-800 flex items-center justify-between bg-zinc-50/50 dark:bg-gray-900/50 backdrop-blur-md">
          <div className="flex items-center gap-2">
            <Sparkle className="w-5 h-5 text-blue-500 fill-blue-500 " />
            <div>
              <div className="font-semibold text-zinc-900 dark:text-white text-sm">AI Tutor</div>
              <div className="text-zinc-550 dark:text-gray-400 text-xs">
                {localStorage.getItem('use_own_key') === 'true' ? 'Using own API key' : `Cost: 1 credit per message (You have ${userProfile?.credits || 0} credits)`}
              </div>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 hover:bg-zinc-200 dark:hover:bg-gray-800 rounded-xl transition-colors cursor-pointer"
          >
            <X className="w-4 h-4 text-zinc-500 dark:text-gray-400" />
          </button>
        </div>

        <div className="flex-grow p-4 overflow-y-auto space-y-4">
          {chatHistory.map((msg, i) => (
            <div key={i} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
              <div
                className={`max-w-[85%] rounded-2xl p-3.5 leading-relaxed select-text whitespace-pre-wrap ${msg.role === 'user'
                  ? 'bg-blue-600 text-white rounded-tr-none'
                  : 'bg-zinc-100 dark:bg-gray-800/80 text-zinc-900 dark:text-gray-200 rounded-tl-none border border-zinc-200/20 dark:border-gray-700/30'
                  } text-xs`}>
                <MathText text={msg.content} />
              </div>
            </div>
          ))}

          {chatHistory.length === 1 && !isSendingChat && (
            <div className="flex flex-wrap gap-2 pt-2 px-1">
              {[
                { label: 'Explain Question', icon: <Lightbulb className="w-3 h-3 sm:w-3.5 sm:h-3.5" />, text: 'Can you explain this question step-by-step?' },
                { label: 'What did I do wrong?', icon: <XCircle className="w-3 h-3 sm:w-3.5 sm:h-3.5" />, text: 'Here was my answer. Can you tell me what I did wrong and how to solve this?' },
                { label: 'Step-by-step Answer', icon: <ListOrdered className="w-3 h-3 sm:w-3.5 sm:h-3.5" />, text: 'Can you write a detailed step-by-step solution for this question?' },
                { label: 'Give me a hint', icon: <HelpCircle className="w-3 h-3 sm:w-3.5 sm:h-3.5" />, text: 'Do not give me the full answer yet. Just give me a small hint to point me in the right direction.' },
                { label: 'Key Concept', icon: <BookOpen className="w-3 h-3 sm:w-3.5 sm:h-3.5" />, text: 'What is the main concept or formula behind this question?' }
              ].map((pill, pIdx) => (
                <button
                  key={pIdx}
                  type="button"
                  onClick={() => sendTutorMessage(pill.text)}
                  className="px-3 py-1.5 bg-blue-500/5 hover:bg-blue-500/10 active:bg-blue-500/15 border border-blue-500/20 text-blue-600 dark:text-blue-400 rounded-xl text-[10px] font-medium transition-all cursor-pointer flex items-center gap-1.5"
                >
                  {pill.icon}
                  {pill.label}
                </button>
              ))}
            </div>
          )}

          {isSendingChat && (
            <div className="flex justify-start">
              <div className="bg-zinc-100 dark:bg-gray-800/80 border border-zinc-200/20 dark:border-gray-700/30 rounded-2xl rounded-tl-none p-3.5 flex items-center gap-2">
                <Loader2 className="w-3.5 h-3.5 text-blue-500 animate-spin" />
                <span className="text-zinc-500 dark:text-gray-450 font-medium text-xs">Tutor is thinking...</span>
              </div>
            </div>
          )}
          <div ref={chatEndRef} />
        </div>

        <div className="p-3 border-t border-zinc-200/50 dark:border-gray-800 bg-zinc-50/50 dark:bg-gray-900/50">
          <form
            onSubmit={(e) => { e.preventDefault(); sendTutorMessage(); }}
            className="flex items-center gap-2"
          >
            <div className="flex items-center gap-2 flex-grow bg-white dark:bg-gray-950 border border-zinc-200 dark:border-gray-800 rounded-xl px-4 focus-within:ring-1 focus-within:ring-blue-600 transition-all">
              <input
                type="text"
                placeholder="Ask a follow-up question..."
                value={chatInput}
                onChange={(e) => setChatInput(e.target.value)}
                disabled={isSendingChat}
                maxLength={250}
                className="flex-grow bg-transparent border-none py-2.5 text-zinc-900 dark:text-white placeholder:text-zinc-400 dark:placeholder:text-gray-500 focus:outline-none disabled:opacity-50 text-xs" />
              {chatInput.length > 200 && (
                <span className="text-zinc-400 dark:text-gray-500 select-none text-xs">
                  {250 - chatInput.length}
                </span>
              )}
            </div>
            <button
              type="submit"
              disabled={!chatInput.trim() || isSendingChat}
              className="p-2.5 bg-blue-600 hover:bg-blue-700 disabled:bg-zinc-250 dark:disabled:bg-gray-800 text-white disabled:text-zinc-500 dark:disabled:text-gray-655 rounded-xl transition-all shadow-md hover:shadow-lg disabled:cursor-not-allowed cursor-pointer flex items-center justify-center"
            >
              <Send className="w-3.5 h-3.5" />
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}
