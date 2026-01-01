import React, { useState, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, RotateCcw, Check, Brain, ChevronLeft, ChevronRight } from 'lucide-react';
import { PracticeActivity, Flashcard } from '../../types';
import { useSound } from '../../SoundContext';
import PracticeResult from './PracticeResult';

interface FlashcardActivityProps {
  activity: PracticeActivity;
  flashcards: Flashcard[];
  onComplete: (score: number) => void;
  onClose: () => void;
}

const FlashcardActivity: React.FC<FlashcardActivityProps> = ({ activity, flashcards, onComplete, onClose }) => {
  const { playSound } = useSound();
  const [currentIndex, setCurrentIndex] = useState(0);
  const [isFlipped, setIsFlipped] = useState(false);
  const [cardStatus, setCardStatus] = useState<Record<string, 'learning' | 'known'>>({});
  const [isComplete, setIsComplete] = useState(false);

  // Cards that are still being learned (prioritize these)
  const cardsToReview = useMemo(() => {
    const learningCards = flashcards.filter(card => cardStatus[card.id] === 'learning');
    const unknownCards = flashcards.filter(card => !cardStatus[card.id]);
    const knownCards = flashcards.filter(card => cardStatus[card.id] === 'known');
    return [...learningCards, ...unknownCards, ...knownCards];
  }, [flashcards, cardStatus]);

  const currentCard = cardsToReview[currentIndex] || flashcards[0];
  const progress = ((currentIndex + 1) / flashcards.length) * 100;

  const stats = useMemo(() => {
    const known = Object.values(cardStatus).filter(s => s === 'known').length;
    const learning = Object.values(cardStatus).filter(s => s === 'learning').length;
    const total = flashcards.length;
    return { known, learning, remaining: total - known - learning, total };
  }, [cardStatus, flashcards]);

  const handleFlip = () => {
    playSound('click');
    setIsFlipped(!isFlipped);
  };

  const handleMarkKnown = () => {
    playSound('success');
    setCardStatus(prev => ({ ...prev, [currentCard.id]: 'known' }));
    moveToNext();
  };

  const handleMarkLearning = () => {
    playSound('click');
    setCardStatus(prev => ({ ...prev, [currentCard.id]: 'learning' }));
    moveToNext();
  };

  const moveToNext = () => {
    setIsFlipped(false);

    // Check if all cards are marked as known
    const newKnownCount = Object.values(cardStatus).filter(s => s === 'known').length + 1;
    if (newKnownCount >= flashcards.length) {
      setTimeout(() => setIsComplete(true), 300);
      return;
    }

    if (currentIndex < cardsToReview.length - 1) {
      setTimeout(() => setCurrentIndex(prev => prev + 1), 300);
    } else {
      // Restart from beginning with remaining cards
      setTimeout(() => setCurrentIndex(0), 300);
    }
  };

  const handlePrevious = () => {
    playSound('click');
    setIsFlipped(false);
    if (currentIndex > 0) {
      setCurrentIndex(prev => prev - 1);
    }
  };

  const handleSkip = () => {
    playSound('click');
    setIsFlipped(false);
    if (currentIndex < cardsToReview.length - 1) {
      setCurrentIndex(prev => prev + 1);
    } else {
      setCurrentIndex(0);
    }
  };

  if (isComplete) {
    const score = Math.round((stats.known / stats.total) * 100);
    return (
      <PracticeResult
        activity={activity}
        score={score}
        correctAnswers={stats.known}
        totalQuestions={stats.total}
        onComplete={() => onComplete(score)}
        onRetry={() => {
          setCurrentIndex(0);
          setIsFlipped(false);
          setCardStatus({});
          setIsComplete(false);
        }}
        onClose={onClose}
      />
    );
  }

  return (
    <div className="bg-white dark:bg-zinc-900 rounded-3xl shadow-2xl overflow-hidden">
      {/* Header */}
      <div className="px-6 py-4 border-b border-zinc-100 dark:border-white/10 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <span className="text-2xl">{activity.icon}</span>
          <div>
            <h2 className="font-bold text-zinc-900 dark:text-white">{activity.title}</h2>
            <p className="text-xs text-zinc-500 dark:text-zinc-400">
              Карточка {currentIndex + 1} из {cardsToReview.length}
            </p>
          </div>
        </div>
        <button
          onClick={onClose}
          className="p-2 rounded-xl hover:bg-zinc-100 dark:hover:bg-white/10 transition-colors text-zinc-500"
        >
          <X className="w-5 h-5" />
        </button>
      </div>

      {/* Stats */}
      <div className="px-6 py-3 bg-zinc-50 dark:bg-white/5 flex gap-4 text-sm">
        <span className="flex items-center gap-1.5">
          <span className="w-2 h-2 rounded-full bg-emerald-500"></span>
          <span className="text-zinc-600 dark:text-zinc-400">Знаю: {stats.known}</span>
        </span>
        <span className="flex items-center gap-1.5">
          <span className="w-2 h-2 rounded-full bg-amber-500"></span>
          <span className="text-zinc-600 dark:text-zinc-400">Учу: {stats.learning}</span>
        </span>
        <span className="flex items-center gap-1.5">
          <span className="w-2 h-2 rounded-full bg-zinc-300 dark:bg-zinc-600"></span>
          <span className="text-zinc-600 dark:text-zinc-400">Осталось: {stats.remaining}</span>
        </span>
      </div>

      {/* Progress bar */}
      <div className="h-1 bg-zinc-100 dark:bg-white/10">
        <motion.div
          className="h-full bg-violet-500"
          animate={{ width: `${(stats.known / stats.total) * 100}%` }}
          transition={{ duration: 0.3 }}
        />
      </div>

      {/* Card */}
      <div className="p-6">
        <div
          className="relative h-64 cursor-pointer perspective-1000"
          onClick={handleFlip}
        >
          <AnimatePresence mode="wait">
            <motion.div
              key={`${currentCard.id}-${isFlipped}`}
              initial={{ rotateY: isFlipped ? -90 : 90, opacity: 0 }}
              animate={{ rotateY: 0, opacity: 1 }}
              exit={{ rotateY: isFlipped ? 90 : -90, opacity: 0 }}
              transition={{ duration: 0.3 }}
              className={`absolute inset-0 rounded-2xl p-6 flex flex-col items-center justify-center text-center border-2 ${
                isFlipped
                  ? 'bg-violet-50 dark:bg-violet-500/10 border-violet-200 dark:border-violet-500/30'
                  : 'bg-white dark:bg-white/5 border-zinc-200 dark:border-white/10'
              }`}
            >
              {!isFlipped ? (
                <>
                  <p className="text-xs text-zinc-400 dark:text-zinc-500 mb-2 uppercase tracking-wider">Термин</p>
                  <h3 className="text-2xl font-bold text-zinc-900 dark:text-white">{currentCard.term}</h3>
                  <p className="mt-4 text-sm text-zinc-400 dark:text-zinc-500">Нажми, чтобы перевернуть</p>
                </>
              ) : (
                <>
                  <p className="text-xs text-violet-500 dark:text-violet-400 mb-2 uppercase tracking-wider">Определение</p>
                  <p className="text-lg text-zinc-700 dark:text-zinc-200 leading-relaxed">{currentCard.definition}</p>
                </>
              )}
            </motion.div>
          </AnimatePresence>
        </div>
      </div>

      {/* Actions */}
      <div className="px-6 py-4 border-t border-zinc-100 dark:border-white/10">
        {isFlipped ? (
          <div className="flex gap-3">
            <motion.button
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              onClick={handleMarkLearning}
              className="flex-1 flex items-center justify-center gap-2 px-4 py-3 bg-amber-100 dark:bg-amber-500/20 text-amber-700 dark:text-amber-300 font-medium rounded-xl hover:bg-amber-200 dark:hover:bg-amber-500/30 transition-colors"
            >
              <Brain className="w-4 h-4" />
              Ещё учу
            </motion.button>
            <motion.button
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.1 }}
              onClick={handleMarkKnown}
              className="flex-1 flex items-center justify-center gap-2 px-4 py-3 bg-emerald-100 dark:bg-emerald-500/20 text-emerald-700 dark:text-emerald-300 font-medium rounded-xl hover:bg-emerald-200 dark:hover:bg-emerald-500/30 transition-colors"
            >
              <Check className="w-4 h-4" />
              Знаю!
            </motion.button>
          </div>
        ) : (
          <div className="flex justify-between">
            <button
              onClick={handlePrevious}
              disabled={currentIndex === 0}
              className="flex items-center gap-2 px-4 py-2 text-zinc-500 dark:text-zinc-400 hover:text-zinc-700 dark:hover:text-zinc-200 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
            >
              <ChevronLeft className="w-4 h-4" />
              Назад
            </button>
            <button
              onClick={handleSkip}
              className="flex items-center gap-2 px-4 py-2 text-zinc-500 dark:text-zinc-400 hover:text-zinc-700 dark:hover:text-zinc-200 transition-colors"
            >
              Пропустить
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>
        )}
      </div>
    </div>
  );
};

export default FlashcardActivity;
