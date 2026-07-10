import React, { useState, useEffect } from 'react';
import { Sparkles, RotateCcw, Check, X } from 'lucide-react';

interface ConceptCard {
  question: string;
  options: string[];
  correctIndex: number;
}

interface ConceptCardsProps {
  onClose: () => void;
  examQuestions?: any[];
  subtopics?: string[];
  cardCount?: number;
}

export default function ConceptCards({ onClose, examQuestions = [], subtopics = [], cardCount = 5 }: ConceptCardsProps) {
  const [cards, setCards] = useState<ConceptCard[]>([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [isAnimating, setIsAnimating] = useState(false);
  const [showAnswer, setShowAnswer] = useState(false);
  const [selectedOption, setSelectedOption] = useState<number | null>(null);
  const [isCorrect, setIsCorrect] = useState<boolean | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    generateConceptCards();
  }, []);

  const generateConceptCards = async () => {
    try {
      setLoading(true);
      // Generate concept cards via serverless function
      const response = await fetch('/api/generate-exam-log', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'generate-concept-cards',
          count: cardCount,
          examQuestions,
          subtopics
        })
      });

      if (!response.ok) {
        throw new Error('Failed to generate concept cards');
      }

      const data = await response.json();
      setCards(data.cards || []);
      setLoading(false);
    } catch (err) {
      console.error('Error generating concept cards:', err);
      setError('Failed to generate concept cards');
      setLoading(false);
    }
  };

  const handleOptionClick = (index: number) => {
    if (showAnswer || isAnimating) return;
    setSelectedOption(index);
    setIsCorrect(index === cards[currentIndex].correctIndex);
    setShowAnswer(true);
  };

  const handleNext = () => {
    if (isAnimating) return;
    setIsAnimating(true);
    setShowAnswer(false);
    setSelectedOption(null);
    setIsCorrect(null);

    setTimeout(() => {
      setCurrentIndex((prev) => prev + 1);
      setIsAnimating(false);
    }, 300);
  };

  const handleRefresh = () => {
    setCurrentIndex(0);
    setShowAnswer(false);
    setSelectedOption(null);
    setIsCorrect(null);
    generateConceptCards();
  };

  if (loading) {
    return (
      <div className="fixed inset-0 z-[300] flex items-center justify-center bg-black/80 backdrop-blur-md p-4">
        <div className="bg-gray-900 border border-gray-800 rounded-3xl p-8 w-full max-w-md text-center">
          <Sparkles className="w-12 h-12 text-blue-500 mx-auto mb-4 animate-pulse" />
          <p className="text-white text-xs">Generating concept cards...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="fixed inset-0 z-[300] flex items-center justify-center bg-black/80 backdrop-blur-md p-4">
        <div className="bg-gray-900 border border-gray-800 rounded-3xl p-8 w-full max-w-md text-center">
          <p className="text-red-400 mb-4">{error}</p>
          <button
            onClick={onClose}
            className="px-4 py-2 bg-blue-500 rounded-xl text-white"
          >
            Close
          </button>
        </div>
      </div>
    );
  }

  if (currentIndex >= cards.length) {
    return (
      <div className="fixed inset-0 z-[300] flex items-center justify-center bg-black/80 backdrop-blur-md p-4">
        <div className="bg-gray-900 border border-gray-800 rounded-3xl p-8 w-full max-w-md text-center space-y-6">
          <Sparkles className="w-16 h-16 text-green-500 mx-auto" />
          <div>
            <h3 className="text-base font-bold text-white mb-2">All Done!</h3>
            <p className="text-gray-400 text-xs">You've reviewed all concept cards.</p>
          </div>
          <div className="flex gap-3">
            <button
              onClick={handleRefresh}
              className="flex-1 py-3 bg-gray-800 rounded-xl text-white flex items-center justify-center gap-2"
            >
              <RotateCcw className="w-4 h-4" />
              Generate More
            </button>
            <button
              onClick={onClose}
              className="flex-1 py-3 bg-blue-500 rounded-xl text-white"
            >
              Close
            </button>
          </div>
        </div>
      </div>
    );
  }

  const currentCard = cards[currentIndex];

  return (
    <div className="fixed inset-0 z-[300] flex items-center justify-center bg-black/80 backdrop-blur-md p-4">
      <div className="bg-gray-900 border border-gray-800 rounded-3xl p-6 w-full max-w-md space-y-6">
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-semibold text-white flex items-center gap-2">
            <Sparkles className="w-5 h-5 text-blue-400" />
            Concept Card {currentIndex + 1} / {cards.length}
          </h3>
          <button onClick={onClose} className="p-2 hover:bg-gray-800 rounded-full transition-all">
            <X className="w-5 h-5 text-gray-400" />
          </button>
        </div>

        <div className="bg-gray-800/50 rounded-2xl p-6 space-y-4">
          <p className="text-white text-xs leading-relaxed">{currentCard.question}</p>
        </div>

        <div className="space-y-3">
          {currentCard.options.map((option, index) => {
            let optionClass = 'bg-gray-800/30 border-gray-700/50 text-white hover:border-gray-600';
            if (showAnswer) {
              if (index === currentCard.correctIndex) {
                optionClass = 'bg-green-500/20 border-green-500/50 text-green-400';
              } else if (selectedOption === index) {
                optionClass = 'bg-red-500/20 border-red-500/50 text-red-400';
              }
            } else if (selectedOption === index) {
              optionClass = 'bg-blue-500/20 border-blue-500/50 text-blue-400';
            }

            return (
              <button
                key={index}
                onClick={() => handleOptionClick(index)}
                disabled={showAnswer}
                className={`w-full p-3 rounded-xl border text-left text-xs transition-all ${optionClass}`}
              >
                <div className="flex items-center gap-3">
                  <span className="w-5 h-5 rounded-full bg-gray-700 flex items-center justify-center text-[10px]">
                    {String.fromCharCode(65 + index)}
                  </span>
                  <span>{option}</span>
                  {showAnswer && index === currentCard.correctIndex && (
                    <Check className="w-4 h-4 ml-auto" />
                  )}
                  {showAnswer && selectedOption === index && index !== currentCard.correctIndex && (
                    <X className="w-4 h-4 ml-auto" />
                  )}
                </div>
              </button>
            );
          })}
        </div>

        {showAnswer && (
          <div className="space-y-3">
            <div className={`p-4 rounded-xl text-center ${isCorrect ? 'bg-green-500/20 border border-green-500/30' : 'bg-red-500/20 border border-red-500/30'}`}>
              <p className={`font-semibold text-xs ${isCorrect ? 'text-green-400' : 'text-red-400'}`}>
                {isCorrect ? 'Correct!' : 'Incorrect'}
              </p>
            </div>
            <button
              onClick={handleNext}
              className="w-full py-3 bg-blue-500 rounded-xl text-white font-medium"
            >
              {currentIndex === cards.length - 1 ? 'Finish' : 'Next Card'}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
