import React, { useState } from 'react';
import { Sparkles, ArrowLeft, ArrowRight, RotateCw, X, Check } from 'lucide-react';
import MathText from '../ui/MathText';

interface ConceptCardData {
  front: string;
  back: string;
}

interface ConceptCardsProps {
  onClose: () => void;
  cards: ConceptCardData[];
}

export default function ConceptCards({ onClose, cards = [] }: ConceptCardsProps) {
  const [currentIndex, setCurrentIndex] = useState(0);
  const [isFlipped, setIsFlipped] = useState(false);
  const [knownCards, setKnownCards] = useState<Record<number, 'known' | 'learning'>>({});

  if (cards.length === 0) {
    return (
      <div className="fixed inset-0 z-[300] flex items-center justify-center bg-black/80 backdrop-blur-md p-4 animate-in fade-in duration-200">
        <div className="bg-gray-900 border border-gray-800 rounded-3xl p-8 w-full max-w-md text-center space-y-4 shadow-2xl">
          <Sparkles className="w-12 h-12 text-blue-500 mx-auto animate-pulse" />
          <h3 className="text-base font-bold text-white">No concept cards generated</h3>
          <p className="text-gray-400 text-xs">Try generating concept cards from the revision logs dashboard.</p>
          <button
            onClick={onClose}
            className="px-6 py-2.5 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-semibold transition-all cursor-pointer"
          >
            Close Dashboard
          </button>
        </div>
      </div>
    );
  }

  const currentCard = cards[currentIndex];
  const progressPercent = ((currentIndex + 1) / cards.length) * 100;

  const handleNext = () => {
    if (currentIndex < cards.length - 1) {
      setIsFlipped(false);
      setTimeout(() => {
        setCurrentIndex(prev => prev + 1);
      }, 150);
    }
  };

  const handlePrev = () => {
    if (currentIndex > 0) {
      setIsFlipped(false);
      setTimeout(() => {
        setCurrentIndex(prev => prev - 1);
      }, 150);
    }
  };

  const toggleFlip = () => {
    setIsFlipped(!isFlipped);
  };

  const markCardStatus = (status: 'known' | 'learning') => {
    setKnownCards(prev => ({ ...prev, [currentIndex]: status }));
    // Automatically go next after small delay
    if (currentIndex < cards.length - 1) {
      setTimeout(() => {
        handleNext();
      }, 350);
    }
  };

  const knownCount = Object.values(knownCards).filter(v => v === 'known').length;

  return (
    <div className="fixed inset-0 z-[300] flex items-center justify-center bg-black/85 backdrop-blur-md p-4 animate-in fade-in duration-200">
      <div className="bg-zinc-950 border border-zinc-800 rounded-3xl p-6 w-full max-w-lg space-y-6 shadow-2xl relative overflow-hidden">
        {/* Top Header */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-blue-500/10 flex items-center justify-center text-blue-400">
              <Sparkles className="w-4 h-4" />
            </div>
            <div>
              <h3 className="text-xs font-bold text-white uppercase tracking-wider">Revision Flashcards</h3>
              <p className="text-[10px] text-zinc-550">Active concept training</p>
            </div>
          </div>
          <button 
            onClick={onClose} 
            className="p-1.5 hover:bg-zinc-850 rounded-lg transition-all cursor-pointer text-zinc-400 hover:text-white"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Progress Bar */}
        <div className="space-y-1.5">
          <div className="flex items-center justify-between text-[10px] text-zinc-500 font-semibold">
            <span>CARD {currentIndex + 1} OF {cards.length}</span>
            <span>{knownCount} GOT IT</span>
          </div>
          <div className="w-full bg-zinc-850 h-1.5 rounded-full overflow-hidden">
            <div 
              className="bg-blue-600 h-full rounded-full transition-all duration-300 ease-out"
              style={{ width: `${progressPercent}%` }}
            />
          </div>
        </div>

        {/* 3D Flashcard Container */}
        <div className="h-64 [perspective:1000px] w-full cursor-pointer relative" onClick={toggleFlip}>
          <div 
            className={`w-full h-full relative transition-all duration-500 [transform-style:preserve-3d] ${
              isFlipped ? '[transform:rotateY(180deg)]' : ''
            }`}
          >
            {/* Front Card Side */}
            <div className="absolute inset-0 w-full h-full p-6 bg-gradient-to-br from-zinc-900 to-zinc-900/60 border border-zinc-800 rounded-2xl flex flex-col justify-between items-center text-center [backface-visibility:hidden]">
              <span className="text-[9px] font-bold text-blue-400 uppercase tracking-widest bg-blue-500/10 px-2 py-0.5 rounded-full">
                Front — Question / Concept
              </span>
              <div className="flex-grow flex items-center justify-center overflow-y-auto w-full my-4 text-xs text-white leading-relaxed max-h-40 px-2">
                <MathText text={currentCard.front} />
              </div>
              <div className="text-[9px] text-zinc-500 flex items-center gap-1">
                <RotateCw className="w-2.5 h-2.5" /> Click card to flip and view explanation
              </div>
            </div>

            {/* Back Card Side */}
            <div className="absolute inset-0 w-full h-full p-6 bg-zinc-900 border border-blue-900/40 rounded-2xl flex flex-col justify-between items-center text-center [backface-visibility:hidden] [transform:rotateY(180deg)]">
              <span className="text-[9px] font-bold text-green-450 uppercase tracking-widest bg-green-500/10 px-2 py-0.5 rounded-full">
                Back — Answer / Explanation
              </span>
              <div className="flex-grow flex items-center justify-center overflow-y-auto w-full my-4 text-xs text-zinc-200 leading-relaxed max-h-40 px-2">
                <MathText text={currentCard.back} />
              </div>
              <div className="text-[9px] text-zinc-500 flex items-center gap-1">
                <RotateCw className="w-2.5 h-2.5" /> Click card to flip back
              </div>
            </div>
          </div>
        </div>

        {/* Card Training Action Buttons */}
        <div className="flex flex-col gap-3">
          {isFlipped && (
            <div className="flex gap-2 animate-in slide-in-from-bottom-2 duration-200">
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  markCardStatus('learning');
                }}
                className={`flex-1 py-2.5 border rounded-xl text-xs font-semibold transition-all cursor-pointer flex items-center justify-center gap-1.5 ${
                  knownCards[currentIndex] === 'learning'
                    ? 'bg-amber-500/20 border-amber-500/50 text-amber-400'
                    : 'border-zinc-800 text-zinc-400 hover:text-white hover:bg-zinc-900'
                }`}
              >
                Need Practice
              </button>
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  markCardStatus('known');
                }}
                className={`flex-1 py-2.5 border rounded-xl text-xs font-semibold transition-all cursor-pointer flex items-center justify-center gap-1.5 ${
                  knownCards[currentIndex] === 'known'
                    ? 'bg-green-500/20 border-green-500/50 text-green-400'
                    : 'border-zinc-800 text-zinc-400 hover:text-white hover:bg-zinc-900'
                }`}
              >
                <Check className="w-3.5 h-3.5" />
                Got It!
              </button>
            </div>
          )}

          {/* Navigation controls */}
          <div className="flex items-center justify-between pt-2">
            <button
              onClick={(e) => {
                e.stopPropagation();
                handlePrev();
              }}
              disabled={currentIndex === 0}
              className="flex items-center gap-1.5 text-xs text-zinc-400 hover:text-white transition-all disabled:opacity-30 disabled:pointer-events-none cursor-pointer"
            >
              <ArrowLeft className="w-3.5 h-3.5" />
              Previous
            </button>

            {currentIndex === cards.length - 1 ? (
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  onClose();
                }}
                className="px-5 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-semibold shadow-md transition-all cursor-pointer"
              >
                Finish Review
              </button>
            ) : (
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  handleNext();
                }}
                className="flex items-center gap-1.5 text-xs text-zinc-400 hover:text-white transition-all cursor-pointer"
              >
                Next
                <ArrowRight className="w-3.5 h-3.5" />
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
