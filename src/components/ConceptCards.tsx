import React, { useState, useEffect } from 'react';
import { X, Check, AlertCircle } from 'lucide-react';
import MathText from '../ui/MathText';
import { fontSize } from '../lib/utils';
import { supabase } from '../services/supabase';
import { LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer } from 'recharts';

interface ConceptCardData {
  question: string;
  options: string[];
  correctAnswers: number[];
  explanation: string;
}

interface ConceptCardsProps {
  onClose: () => void;
  cards: ConceptCardData[];
  topics?: string;
  deckName?: string;
  subjectName?: string;
  difficulty?: string;
  userId?: string;
  categoryId?: string;
  academicLevel?: string;
  isAlreadySaved?: boolean;
}

export default function ConceptCards({ onClose, cards = [], topics, deckName, subjectName, difficulty, userId, categoryId, academicLevel, isAlreadySaved }: ConceptCardsProps) {
  const [currentIndex, setCurrentIndex] = useState(0);
  const [selectedOptions, setSelectedOptions] = useState<number[]>([]);
  const [isFlipped, setIsFlipped] = useState(false);
  const [results, setResults] = useState<Record<number, boolean>>({});
  const [isFinished, setIsFinished] = useState(false);
  const [questionTimes, setQuestionTimes] = useState<Record<number, number>>({});
  const [startTime, setStartTime] = useState<number>(Date.now());

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
      const { error } = await supabase
        .from('saved_concept_cards')
        .insert({
          user_id: userId,
          category_id: categoryId || null,
          academic_level: academicLevel || null,
          subject_name: subjectName || null,
          difficulty: difficulty || null,
          name: finalName,
          topics: topics || null,
          questions: cards,
        });

      if (error) throw error;
      setSaveStatus('saved');
    } catch (err) {
      console.error('Error saving concept deck:', err);
      setSaveStatus('error');
    } finally {
      setSavingDeck(false);
    }
  };

  const handleNext = () => {
    if (currentIndex < cards.length - 1) {
      setSelectedOptions([]);
      setIsFlipped(false);
      setCurrentIndex(currentIndex + 1);
    } else {
      setIsFinished(true);
    }
  };

  const handleOptionSelect = (optionIdx: number) => {
    if (isFlipped) return;
    setSelectedOptions((prev) => {
      const isSelected = prev.includes(optionIdx);
      if (isSelected) {
        return prev.filter((i) => i !== optionIdx);
      } else {
        return [...prev, optionIdx];
      }
    });
  };

  const handleFlip = () => {
    if (selectedOptions.length === 0) return;
    setIsFlipped(true);
    const correctAnswers = cards[currentIndex].correctAnswers || [];
    const isCorrect =
      selectedOptions.length === correctAnswers.length &&
      selectedOptions.every((idx) => correctAnswers.includes(idx));
    setResults((prev) => ({ ...prev, [currentIndex]: isCorrect }));
    const endTime = Date.now();
    const elapsedSeconds = Math.round((endTime - startTime) / 1000);
    setQuestionTimes((prev) => ({ ...prev, [currentIndex]: elapsedSeconds }));
  };

  const handleReset = () => {
    setCurrentIndex(0);
    setSelectedOptions([]);
    setIsFlipped(false);
    setResults({});
    setIsFinished(false);
    setQuestionTimes({});
    setStartTime(Date.now());
    setSaveStatus('idle');
  };

  const correctCount = Object.values(results).filter(Boolean).length;

  const chartData = cards.map((_, idx) => ({
    name: `Q${idx + 1}`,
    seconds: questionTimes[idx] || 0,
  }));

  if (cards.length === 0) return null;

  return (
    <div className="fixed inset-0 z-[300] flex items-center justify-center bg-black/60 dark:bg-black/80 backdrop-blur-md p-4 animate-in fade-in duration-200">
      <div className="bg-white dark:bg-zinc-950 border border-zinc-250 dark:border-zinc-800 rounded-3xl p-5 sm:p-6 w-full max-w-lg h-[620px] flex flex-col shadow-2xl relative text-zinc-900 dark:text-white justify-between overflow-hidden">
        <div className="flex items-center justify-between pb-2 border-b border-zinc-150 dark:border-zinc-900 flex-shrink-0">
          <h3 className="font-semibold text-zinc-850 dark:text-white tracking-wider text-xs">Concept Cards</h3>
          <button
            onClick={onClose}
            className="p-1 hover:bg-zinc-100 dark:hover:bg-zinc-850 rounded-lg transition-all cursor-pointer text-zinc-400 hover:text-zinc-700 dark:hover:text-white"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {!isFinished ? (
          <>
            <div className="flex-grow flex flex-col justify-between my-2 overflow-y-auto no-scrollbar">
              <div className="space-y-4">
                <div className="text-zinc-450 dark:text-zinc-500 font-semibold tracking-wider text-[10px] uppercase">
                  Card {currentIndex + 1} of {cards.length}
                </div>
                <h4 className="font-medium text-zinc-850 dark:text-zinc-150 leading-relaxed text-sm sm:text-base px-2">
                  <MathText text={cards[currentIndex].question} />
                </h4>

                <div className="space-y-2 pt-2 px-1">
                  {cards[currentIndex].options.map((option, idx) => {
                    const isSelected = selectedOptions.includes(idx);
                    const isCorrect = cards[currentIndex].correctAnswers.includes(idx);
                    let optionStyle = 'bg-zinc-50 hover:bg-zinc-100 dark:bg-zinc-900/30 border-zinc-200 dark:border-zinc-850 text-zinc-800 dark:text-zinc-300';
                    if (isSelected) {
                      optionStyle = 'bg-blue-600/10 border-blue-600 text-zinc-900 dark:text-white';
                    }
                    if (isFlipped) {
                      if (isCorrect) {
                        optionStyle = 'bg-green-600/15 border-green-600 text-green-700 dark:text-green-400 font-semibold';
                      } else if (isSelected && !isCorrect) {
                        optionStyle = 'bg-red-600/15 border-red-650 text-red-600 dark:text-red-400';
                      } else {
                        optionStyle = 'opacity-50 bg-zinc-50 dark:bg-zinc-900/30 border-zinc-200 dark:border-zinc-850 text-zinc-800 dark:text-zinc-300';
                      }
                    }

                    return (
                      <button
                        key={idx}
                        disabled={isFlipped}
                        onClick={() => handleOptionSelect(idx)}
                        className={`w-full p-3 border rounded-2xl text-left text-xs transition-all flex items-center gap-2.5 cursor-pointer ${optionStyle}`}
                      >
                        <div
                          className={`w-5 h-5 rounded-full border flex items-center justify-center shrink-0 ${
                            isSelected ? 'bg-blue-600 border-blue-600 text-white' : 'border-zinc-350 dark:border-zinc-800'
                          } text-[10px]`}
                        >
                          {String.fromCharCode(65 + idx)}
                        </div>
                        <span className="leading-relaxed">
                          <MathText text={option} />
                        </span>
                      </button>
                    );
                  })}
                </div>
              </div>
            </div>



            <div className="flex gap-2 justify-end pt-2 flex-shrink-0 border-t border-zinc-150 dark:border-zinc-900">
              {!isFlipped ? (
                <button
                  disabled={selectedOptions.length === 0}
                  onClick={handleFlip}
                  className="flex items-center gap-1 px-4 py-2 rounded-xl bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-xs font-semibold text-white transition-all cursor-pointer"
                >
                  Check Answer
                </button>
              ) : (
                <button
                  onClick={handleNext}
                  className="flex items-center gap-1 px-4 py-2 rounded-xl bg-blue-600 hover:bg-blue-700 text-xs font-semibold text-white transition-all cursor-pointer"
                >
                  {currentIndex === cards.length - 1 ? 'Finish' : 'Next'}
                </button>
              )}
            </div>
          </>
        ) : (
          <div className="flex-grow flex flex-col justify-between bg-zinc-50 dark:bg-zinc-900/40 border border-zinc-200 dark:border-zinc-800 rounded-2xl p-4 my-3 overflow-y-auto">
            <div className="text-center space-y-3 flex-grow flex flex-col justify-center">
              <div>
                <h4 className="font-semibold text-zinc-450 dark:text-zinc-500 uppercase tracking-wider text-[10px]">Practice Completed</h4>
                <div className="text-3xl font-extrabold text-blue-600 dark:text-blue-400 mt-2">
                  {correctCount} / {cards.length} Correct
                </div>
              </div>

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

            <div className="space-y-2 mt-4">
              {userId && topics && !isAlreadySaved && (
                <button
                  disabled={savingDeck || saveStatus === 'saved'}
                  onClick={() => {
                    const defaultName = deckName || topics || 'Concept Cards';
                    setCustomName(defaultName.length > 50 ? `${defaultName.substring(0, 50)}...` : defaultName);
                    setShowNameInputModal(true);
                  }}
                  className={`w-full py-2.5 rounded-xl font-semibold transition-all cursor-pointer text-xs ${
                    saveStatus === 'saved'
                      ? 'bg-green-600 hover:bg-green-700 text-white cursor-default font-semibold'
                      : saveStatus === 'error'
                      ? 'bg-red-650 hover:bg-red-700 text-white'
                      : 'bg-blue-500/10 text-blue-600 hover:bg-blue-500/20 dark:bg-blue-500/25 dark:text-blue-400 dark:hover:bg-blue-500/35'
                  }`}
                >
                  {saveStatus === 'saving'
                    ? 'Saving...'
                    : saveStatus === 'saved'
                    ? 'Saved Successfully!'
                    : saveStatus === 'error'
                    ? 'Failed to Save. Retry?'
                    : 'Save Concept Cards'}
                </button>
              )}
              <button
                onClick={onClose}
                className="w-full py-2.5 bg-blue-600 hover:bg-blue-700 rounded-xl font-semibold text-white transition-all cursor-pointer text-xs">
                Close Summary
              </button>
            </div>
          </div>
        )}
      </div>

      {showNameInputModal && (
        <div className="fixed inset-0 z-[400] flex items-center justify-center bg-black/70 dark:bg-black/90 backdrop-blur-md p-4 animate-in fade-in duration-200">
          <div className="bg-white dark:bg-zinc-950 border border-zinc-250 dark:border-zinc-800 rounded-3xl p-5 w-full max-w-sm shadow-2xl relative text-zinc-900 dark:text-white flex flex-col gap-4 text-left">
            <div>
              <h3 className="font-semibold text-zinc-850 dark:text-white text-sm">Save Concept Card Deck</h3>
              <p className="text-zinc-500 dark:text-zinc-400 text-[10px] mt-0.5">Enter a name to save this flashcard deck for future practice</p>
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
