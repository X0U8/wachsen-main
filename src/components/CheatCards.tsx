import React, { useState, useEffect } from 'react';
import { X, AlertCircle, ChevronRight, RotateCcw } from 'lucide-react';
import MathText from '../ui/MathText';
import { supabase } from '../services/supabase';
import { LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer } from 'recharts';

interface CheatCardData {
  question: string;
  answer: string;
}

interface CheatCardsProps {
  onClose: () => void;
  cards: CheatCardData[];
  topics?: string;
  subjectName?: string;
  difficulty?: string;
  userId?: string;
  categoryId?: string;
  academicLevel?: string;
  isAlreadySaved?: boolean;
}

export default function CheatCards({
  onClose,
  cards = [],
  topics,
  subjectName,
  difficulty,
  userId,
  categoryId,
  academicLevel,
  isAlreadySaved
}: CheatCardsProps) {
  const [currentIndex, setCurrentIndex] = useState(0);
  const [isFlipped, setIsFlipped] = useState(false);
  const [isFinished, setIsFinished] = useState(false);
  const [cardTimes, setCardTimes] = useState<Record<number, number>>({});
  const [startTime, setStartTime] = useState<number>(Date.now());
  const [isTransitioning, setIsTransitioning] = useState(false);

  useEffect(() => {
    setStartTime(Date.now());
  }, [currentIndex, isFinished]);

  const [savingDeck, setSavingDeck] = useState(false);
  const [saveStatus, setSaveStatus] = useState<'idle' | 'saving' | 'saved' | 'error'>('idle');
  const [showNameInputModal, setShowNameInputModal] = useState(false);
  const [customName, setCustomName] = useState('');

  const handleSaveDeck = async (name: string) => {
    const finalName = name.trim();
    if (!finalName) return;
    if (!userId || cards.length === 0 || savingDeck) return;

    setSavingDeck(true);
    setSaveStatus('saving');
    try {
      const { error } = await supabase.from('saved_cheat_cards').insert({
        user_id: userId,
        category_id: categoryId || null,
        academic_level: academicLevel || null,
        subject_name: subjectName || null,
        difficulty: difficulty || null,
        name: finalName,
        topics: topics || finalName,
        cards
      });

      if (error) throw error;
      setSaveStatus('saved');
      setShowNameInputModal(false);
    } catch (err) {
      console.error('Error saving cheat card deck:', err);
      setSaveStatus('error');
    } finally {
      setSavingDeck(false);
    }
  };

  if (cards.length === 0) {
    return (
      <div className="fixed inset-0 z-[300] flex items-center justify-center bg-black/60 dark:bg-black/80 backdrop-blur-md p-4 animate-in fade-in duration-200">
        <div className="bg-white dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 rounded-3xl p-8 w-full max-w-md text-center space-y-4 shadow-2xl">
          <AlertCircle className="w-12 h-12 text-zinc-400 dark:text-zinc-500 mx-auto" />
          <h3 className="font-semibold text-zinc-850 dark:text-white text-sm">No cheat cards generated</h3>
          <p className="text-zinc-500 dark:text-zinc-400 text-xs">Try generating a cheat card deck from the exam details page.</p>
          <button
            onClick={onClose}
            className="px-6 py-2.5 bg-blue-600 hover:bg-blue-700 text-white rounded-xl font-semibold transition-all cursor-pointer text-xs"
          >
            Close
          </button>
        </div>
      </div>
    );
  }

  const currentCard = cards[currentIndex];
  const progressPercent = ((currentIndex + 1) / cards.length) * 100;
  const hasNext = currentIndex < cards.length - 1;

  const handleNext = () => {
    const duration = Math.max(1, Math.round((Date.now() - startTime) / 1000));
    setCardTimes(prev => ({ ...prev, [currentIndex]: (prev[currentIndex] || 0) + duration }));
    if (hasNext) {
      setIsTransitioning(true);
      setIsFlipped(false);
      setCurrentIndex(prev => prev + 1);
      setTimeout(() => {
        setIsTransitioning(false);
      }, 50);
    } else {
      setIsFinished(true);
    }
  };

  const handleReset = () => {
    setIsFlipped(false);
    setCurrentIndex(0);
    setIsFinished(false);
    setCardTimes({});
  };

  const chartData = cards.map((_, idx) => ({
    name: `C${idx + 1}`,
    seconds: cardTimes[idx] || 0
  }));

  return (
    <div className="fixed inset-0 z-[300] flex items-center justify-center bg-black/60 dark:bg-black/80 backdrop-blur-md p-4 animate-in fade-in duration-200">
      <div className="bg-white dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 rounded-3xl p-5 sm:p-6 w-full max-w-lg h-[620px] flex flex-col shadow-2xl relative overflow-hidden text-zinc-900 dark:text-white">
        <div className="flex items-center justify-between flex-shrink-0">
          <div>
            <h3 className="font-semibold text-zinc-850 dark:text-white tracking-wider text-sm">Recall Cards</h3>
            <p className="text-zinc-500 dark:text-zinc-400 text-xs">Click card to flip</p>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 hover:bg-zinc-100 dark:hover:bg-zinc-800 rounded-lg transition-all cursor-pointer text-zinc-400 hover:text-zinc-700 dark:hover:text-white"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {!isFinished ? (
          <>
            <div className="space-y-1.5 flex-shrink-0 mt-4">
              <div className="flex items-center justify-between text-zinc-500 font-semibold tracking-wider text-xs">
                <span>Card {currentIndex + 1} of {cards.length}</span>
                <button
                  onClick={handleReset}
                  className="flex items-center gap-1 text-zinc-400 hover:text-zinc-700 dark:hover:text-zinc-200 transition-colors"
                >
                  <RotateCcw className="w-3 h-3" />
                  <span>Reset</span>
                </button>
              </div>
              <div className="w-full bg-zinc-100 dark:bg-zinc-800 h-1.5 rounded-full overflow-hidden">
                <div
                  className="bg-blue-600 h-full rounded-full transition-all duration-300 ease-out"
                  style={{ width: `${progressPercent}%` }}
                />
              </div>
            </div>

            <div className="flex-grow flex flex-col items-center justify-center min-h-0 my-4">
              <div
                className="relative w-full max-w-sm aspect-[4/3] cursor-pointer"
                style={{ perspective: '1000px' }}
                onClick={() => setIsFlipped(f => !f)}
              >
                <div
                  className={`absolute inset-0 ${isTransitioning ? 'transition-none' : 'transition-transform duration-500'}`}
                  style={{
                    transformStyle: 'preserve-3d',
                    transform: isFlipped ? 'rotateY(180deg)' : 'rotateY(0deg)'
                  }}
                >
                  {/* Front */}
                  <div
                    className="absolute inset-0 backface-hidden bg-gradient-to-br from-blue-500/5 to-purple-500/5 dark:from-blue-500/10 dark:to-purple-500/10 border border-blue-500/20 dark:border-blue-500/30 rounded-3xl p-6 flex flex-col items-center justify-center text-center shadow-sm"
                    style={{ backfaceVisibility: 'hidden' }}
                  >
                    <span className="text-[10px] uppercase tracking-widest text-blue-500/80 font-semibold mb-3">Question</span>
                    <div className="text-zinc-800 dark:text-zinc-100 leading-relaxed font-medium text-sm overflow-y-auto max-h-full pr-1">
                      <MathText text={currentCard.question} />
                    </div>
                  </div>

                  {/* Back */}
                  <div
                    className="absolute inset-0 backface-hidden bg-zinc-50 dark:bg-zinc-900/40 border border-zinc-200 dark:border-zinc-800 rounded-3xl p-6 flex flex-col items-center justify-center text-center shadow-sm"
                    style={{
                      backfaceVisibility: 'hidden',
                      transform: 'rotateY(180deg)'
                    }}
                  >
                    <span className="text-[10px] uppercase tracking-widest text-zinc-400 font-semibold mb-3">Answer</span>
                    <div className="text-zinc-800 dark:text-zinc-100 leading-relaxed font-medium text-sm overflow-y-auto max-h-full pr-1">
                      <MathText text={currentCard.answer} />
                    </div>
                  </div>
                </div>
              </div>
            </div>

            <div className="flex items-center justify-end gap-3 flex-shrink-0">
              <button
                onClick={handleNext}
                className="flex items-center gap-1 px-4 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-700 text-xs font-semibold text-white transition-colors cursor-pointer"
              >
                {currentIndex === cards.length - 1 ? 'Finish Practice' : 'Next'}
                <ChevronRight className="w-4 h-4" />
              </button>
            </div>
          </>
        ) : (
          /* Summary Screen */
          <div className="flex-grow flex flex-col justify-between bg-zinc-50 dark:bg-zinc-900/40 border border-zinc-200 dark:border-zinc-800 rounded-2xl p-4 my-3 overflow-y-auto">
            <div className="text-center space-y-3 flex-grow flex flex-col justify-center">
              <div>
                <h4 className="font-semibold text-zinc-400 dark:text-zinc-500 uppercase tracking-wider text-[10px]">Practice Completed</h4>
                <div className="text-3xl font-extrabold text-blue-600 dark:text-blue-400 mt-2">
                  All {cards.length} Cards Done
                </div>
              </div>



              {/* Time spent chart */}
              <div className="space-y-1.5 pt-2">
                <p className="text-[9px] font-semibold text-zinc-400 uppercase tracking-wider text-left pl-2">Time Spent per Card (seconds)</p>
                <div className="h-[140px] w-full bg-white dark:bg-zinc-950/20 border border-zinc-200/80 dark:border-zinc-800/80 rounded-2xl p-2">
                  <ResponsiveContainer width="100%" height="100%">
                    <LineChart data={chartData} margin={{ top: 10, right: 10, left: -25, bottom: 0 }}>
                      <XAxis dataKey="name" stroke="#94a3b8" fontSize={8} tickLine={false} axisLine={false} />
                      <YAxis stroke="#94a3b8" fontSize={8} tickLine={false} axisLine={false} />
                      <Tooltip
                        contentStyle={{
                          backgroundColor: '#18181b',
                          borderColor: '#27272a',
                          borderRadius: '8px',
                          color: '#fff',
                          fontSize: '10px'
                        }}
                      />
                      <Line type="monotone" dataKey="seconds" stroke="#3b82f6" strokeWidth={2} dot={{ r: 2 }} activeDot={{ r: 4 }} />
                    </LineChart>
                  </ResponsiveContainer>
                </div>
              </div>
            </div>
            <div className="space-y-2 mt-4 flex-shrink-0">
              {userId && !isAlreadySaved && (
                <button
                  disabled={savingDeck || saveStatus === 'saved'}
                  onClick={() => {
                    const defaultName = topics || 'Recall Cards';
                    setCustomName(defaultName.length > 50 ? `${defaultName.slice(0, 50)}...` : defaultName);
                    setShowNameInputModal(true);
                  }}
                  className={`w-full py-2.5 rounded-xl font-semibold transition-all cursor-pointer text-xs ${saveStatus === 'saved'
                      ? 'bg-green-600 hover:bg-green-700 text-white cursor-default font-semibold'
                      : saveStatus === 'error'
                        ? 'bg-red-650 hover:bg-red-700 text-white'
                        : 'bg-blue-500/10 text-blue-600 hover:bg-blue-500/20 dark:bg-blue-500/25 dark:text-blue-400 dark:hover:bg-blue-500/35'
                    }`}
                >
                  {saveStatus === 'saving'
                    ? 'Saving...'
                    : saveStatus === 'saved'
                      ? 'Saved!'
                      : saveStatus === 'error'
                        ? 'Retry Save'
                        : 'Save Recall Cards'}
                </button>
              )}
              <div className="flex gap-2">
                <button
                  onClick={handleReset}
                  className="flex-1 py-2.5 border border-zinc-200 dark:border-zinc-800 text-zinc-700 dark:text-zinc-300 hover:bg-zinc-100 dark:hover:bg-zinc-900 rounded-xl font-semibold transition-all cursor-pointer text-xs"
                >
                  Restart Practice
                </button>
                <button
                  onClick={onClose}
                  className="flex-1 py-2.5 bg-blue-600 hover:bg-blue-700 rounded-xl font-semibold text-white transition-all cursor-pointer text-xs"
                >
                  Close Summary
                </button>
              </div>
            </div>
          </div>
        )}
      </div>

      {showNameInputModal && (
        <div className="fixed inset-0 z-[400] flex items-center justify-center bg-black/70 dark:bg-black/90 backdrop-blur-md p-4 animate-in fade-in duration-200">
          <div className="bg-white dark:bg-zinc-950 border border-zinc-250 dark:border-zinc-800 rounded-3xl p-5 w-full max-w-sm shadow-2xl relative text-zinc-900 dark:text-white flex flex-col gap-4 text-left">
            <div>
              <h3 className="font-semibold text-zinc-850 dark:text-white text-sm">Save Recall Card Deck</h3>
              <p className="text-zinc-500 dark:text-zinc-400 text-[10px] mt-0.5">Name this deck so you can review it later</p>
            </div>

            <div className="space-y-1">
              <input
                type="text"
                maxLength={50}
                placeholder="Deck name"
                value={customName}
                onChange={(e) => setCustomName(e.target.value)}
                className="w-full px-3 py-2 bg-zinc-50 dark:bg-zinc-950/40 border border-zinc-200 dark:border-zinc-800 focus:border-blue-500 rounded-xl focus:outline-none focus:ring-1 focus:ring-blue-500 text-zinc-800 dark:text-white text-xs leading-relaxed"
              />
              <div className="flex justify-end text-[9px] text-zinc-400 font-medium">
                {customName.length} / 50
              </div>
            </div>

            <div className="flex gap-2 justify-end pt-1">
              <button
                disabled={savingDeck}
                onClick={() => setShowNameInputModal(false)}
                className="px-3.5 py-2 bg-zinc-100 hover:bg-zinc-200 dark:bg-zinc-900 dark:hover:bg-zinc-800 text-zinc-700 dark:text-zinc-300 font-semibold rounded-xl text-xs transition-all cursor-pointer"
              >
                Cancel
              </button>
              <button
                disabled={savingDeck || !customName.trim()}
                onClick={() => handleSaveDeck(customName)}
                className="px-4 py-2 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white font-semibold rounded-xl text-xs transition-all flex items-center gap-1.5 justify-center cursor-pointer shadow-md"
              >
                {savingDeck ? 'Saving...' : 'Save Deck'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
