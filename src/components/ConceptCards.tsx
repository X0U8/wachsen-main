import React, { useState } from 'react';
import { X, Check, AlertCircle } from 'lucide-react';
import MathText from '../ui/MathText';
import { fontSize } from '../lib/utils';
import { supabase } from '../services/supabase';

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
  userId?: string;
}

export default function ConceptCards({ onClose, cards = [], topics, userId }: ConceptCardsProps) {
  const [currentIndex, setCurrentIndex] = useState(0);
  const [selectedOptions, setSelectedOptions] = useState<number[]>([]);
  const [isFlipped, setIsFlipped] = useState(false);
  const [results, setResults] = useState<Record<number, boolean>>({});
  const [isFinished, setIsFinished] = useState(false);

  const [savingDeck, setSavingDeck] = useState(false);
  const [saveStatus, setSaveStatus] = useState<'idle' | 'saving' | 'saved' | 'error'>('idle');

  const handleSaveDeck = async () => {
    if (!userId || !topics || cards.length === 0 || savingDeck) return;
    setSavingDeck(true);
    setSaveStatus('saving');
    try {
      const deckName = topics.length > 40 ? `${topics.substring(0, 40)}...` : topics;
      const { error } = await supabase
        .from('saved_concept_cards')
        .insert({
          user_id: userId,
          name: deckName,
          topics: topics,
          questions: cards
        });

      if (error) throw error;
      setSaveStatus('saved');
    } catch (err) {
      console.error('Error saving concept card deck:', err);
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
          <h3 className="font-semibold text-zinc-850 dark:text-white text-sm">No concept cards generated</h3>
          <p className="text-zinc-500 dark:text-zinc-400 text-xs">Try generating concept cards from the revision logs dashboard.</p>
          <button
            onClick={onClose}
            className="px-6 py-2.5 bg-blue-600 hover:bg-blue-700 text-white rounded-xl font-semibold transition-all cursor-pointer text-xs">
            Close Dashboard
          </button>
        </div>
      </div>
    );
  }

  const currentCard = cards[currentIndex];
  const progressPercent = ((currentIndex + 1) / cards.length) * 100;

  const handleToggleOption = (idx: number) => {
    if (isFlipped) return;
    setSelectedOptions(prev =>
      prev.includes(idx) ? prev.filter(i => i !== idx) : [...prev, idx]
    );
  };

  const handleCheckAnswer = () => {
    const correctAnswers = currentCard.correctAnswers || [];

    const isCorrect =
      selectedOptions.length === correctAnswers.length &&
      selectedOptions.every(val => correctAnswers.includes(val));

    setResults(prev => ({ ...prev, [currentIndex]: isCorrect }));
    setIsFlipped(true);
  };

  const handleNext = () => {
    if (currentIndex < cards.length - 1) {
      setIsFlipped(false);
      setSelectedOptions([]);
      setCurrentIndex(prev => prev + 1);
    } else {
      setIsFinished(true);
    }
  };

  const correctCount = Object.values(results).filter(Boolean).length;
  const percentage = Math.round((correctCount / cards.length) * 100);

  return (
    <div className="fixed inset-0 z-[300] flex items-center justify-center bg-black/60 dark:bg-black/80 backdrop-blur-md p-4 animate-in fade-in duration-200">
      <div className="bg-white dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 rounded-3xl p-6 w-full max-w-lg h-[600px] flex flex-col justify-between shadow-2xl relative overflow-hidden text-zinc-900 dark:text-white">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div>
              <h3
                className="font-semibold text-zinc-805 dark:text-white tracking-wider text-sm">Concept Cards</h3>
              <p className="text-zinc-500 dark:text-zinc-400 text-xs">Multiple select practice</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 hover:bg-zinc-100 dark:hover:bg-zinc-800 rounded-lg transition-all cursor-pointer text-zinc-400 hover:text-zinc-700 dark:hover:text-white"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {!isFinished ? (
          <div className="flex-grow flex flex-col justify-between overflow-hidden mt-4 space-y-4">
            <div className="space-y-1.5 flex-shrink-0">
              <div
                className="flex items-center justify-between text-zinc-500 font-semibold tracking-wider text-xs">
                <span>Card {currentIndex + 1} of {cards.length}</span>
                <span>{correctCount} correct</span>
              </div>
              <div className="w-full bg-zinc-100 dark:bg-zinc-800 h-1.5 rounded-full overflow-hidden">
                <div
                  className="bg-blue-600 h-full rounded-full transition-all duration-300 ease-out"
                  style={{ width: `${progressPercent}%` }}
                />
              </div>
            </div>

            <div className="flex-grow overflow-y-auto pr-1 space-y-4">
              <div className="bg-zinc-50 dark:bg-zinc-900/20 border border-zinc-200 dark:border-zinc-800/80 rounded-2xl p-5 space-y-3">
                <div
                  className="text-zinc-800 dark:text-zinc-200 leading-relaxed font-normal h-32 overflow-y-auto pr-1 text-sm">
                  <MathText text={currentCard.question} />
                </div>
              </div>

              <div className="space-y-2">
                {currentCard.options && currentCard.options.map((option, optIdx) => {
                  const isSelected = selectedOptions.includes(optIdx);
                  const isCorrectAnswer = (currentCard.correctAnswers || []).includes(optIdx);

                  let buttonClass = 'bg-white dark:bg-zinc-900/30 border-zinc-200 dark:border-zinc-800 hover:bg-zinc-50 dark:hover:bg-zinc-800/30 text-zinc-700 dark:text-zinc-300';

                  if (isFlipped) {
                    if (isCorrectAnswer) {
                      buttonClass = 'bg-green-500/10 border-green-500/40 text-green-600 dark:text-green-400 font-medium';
                    } else if (isSelected && !isCorrectAnswer) {
                      buttonClass = 'bg-red-500/10 border-red-500/40 text-red-600 dark:text-red-400 font-medium';
                    } else {
                      buttonClass = 'bg-zinc-50 dark:bg-zinc-900/10 border-zinc-200/60 dark:border-zinc-800/40 opacity-40 text-zinc-400 dark:text-zinc-500';
                    }
                  } else if (isSelected) {
                    buttonClass = 'bg-blue-500/10 border-blue-500/40 text-blue-600 dark:text-blue-400 font-semibold';
                  }

                  return (
                    <button
                      key={optIdx}
                      disabled={isFlipped}
                      onClick={() => handleToggleOption(optIdx)}
                      className={`w-full p-3 rounded-xl border text-left transition-all cursor-pointer ${buttonClass} text-xs`}>
                      <div className="flex items-center gap-2">
                        <span
                          className="w-5 h-5 rounded-full bg-zinc-100 dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 flex items-center justify-center text-zinc-500 dark:text-zinc-400 text-xs">
                          {String.fromCharCode(65 + optIdx)}
                        </span>
                        <span><MathText text={option} /></span>
                      </div>
                    </button>
                  );
                })}
              </div>

              {isFlipped && (
                <div className="mt-3 p-4 bg-zinc-50 dark:bg-zinc-900/30 border border-zinc-200 dark:border-zinc-800 rounded-xl space-y-2 animate-in fade-in duration-200">
                  <div
                    className="font-semibold text-zinc-500 dark:text-zinc-400 uppercase tracking-wider text-xs">Explanation</div>
                  <div className="text-zinc-700 dark:text-zinc-300 leading-relaxed text-xs">
                    <MathText text={currentCard.explanation} />
                  </div>
                </div>
              )}
            </div>

            <div className="pt-2 flex-shrink-0">
              {!isFlipped ? (
                <button
                  disabled={selectedOptions.length === 0}
                  onClick={handleCheckAnswer}
                  className="w-full py-2.5 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed rounded-xl font-semibold text-white transition-all cursor-pointer text-xs">
                  Check Answers
                </button>
              ) : (
                <button
                  onClick={handleNext}
                  className="w-full py-2.5 bg-blue-600 hover:bg-blue-700 rounded-xl font-semibold text-white transition-all cursor-pointer text-xs">
                  {currentIndex === cards.length - 1 ? 'See Results Summary' : 'Next Question'}
                </button>
              )}
            </div>
          </div>
        ) : (
          /* Results Summary Screen */
          (<div className="flex-grow flex flex-col justify-center bg-zinc-50 dark:bg-zinc-900/40 border border-zinc-200 dark:border-zinc-800 rounded-2xl p-5 space-y-4 my-4 overflow-y-auto">
            <h4
              className="font-semibold text-zinc-800 dark:text-white uppercase tracking-wider text-xs">Training Summary</h4>
            <div className="text-zinc-650 dark:text-gray-300 text-xs">
              <div className="font-bold text-zinc-800 dark:text-white mb-1 text-base">
                {correctCount} / {cards.length} correct ({percentage}%)
              </div>
              <div className="text-zinc-500 dark:text-zinc-400 mb-4 text-xs">
                {percentage >= 80
                  ? 'Excellent job! You have fully mastered these concepts.'
                  : percentage >= 50
                    ? 'Good effort! A bit more practice will make it perfect.'
                    : 'Keep revising. Practice makes permanent!'}
              </div>
              {userId && topics && (
                <button
                  disabled={savingDeck || saveStatus === 'saved'}
                  onClick={handleSaveDeck}
                  className={`w-full py-2.5 rounded-xl font-semibold transition-all cursor-pointer text-xs mb-2 ${
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
          </div>)
        )}
      </div>
    </div>
  );
}
