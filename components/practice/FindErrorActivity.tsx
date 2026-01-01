import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, ChevronRight, CheckCircle2, XCircle, Lightbulb, Code } from 'lucide-react';
import { PracticeActivity, FindErrorQuestion, QuizOption } from '../../types';
import { useSound } from '../../SoundContext';
import PracticeResult from './PracticeResult';

interface FindErrorActivityProps {
  activity: PracticeActivity;
  questions: FindErrorQuestion[];
  onComplete: (score: number) => void;
  onClose: () => void;
}

const FindErrorActivity: React.FC<FindErrorActivityProps> = ({ activity, questions, onComplete, onClose }) => {
  const { playSound } = useSound();
  const [currentIndex, setCurrentIndex] = useState(0);
  const [selectedOption, setSelectedOption] = useState<string | null>(null);
  const [showExplanation, setShowExplanation] = useState(false);
  const [correctAnswers, setCorrectAnswers] = useState(0);
  const [isComplete, setIsComplete] = useState(false);

  const currentQuestion = questions[currentIndex];
  const progress = ((currentIndex + 1) / questions.length) * 100;

  const handleOptionSelect = (option: QuizOption) => {
    if (selectedOption) return;

    playSound('click');
    setSelectedOption(option.id);
    setShowExplanation(true);

    const isCorrect = option.isCorrect;
    if (isCorrect) {
      setCorrectAnswers(prev => prev + 1);
      playSound('success');
    }
  };

  const handleNext = () => {
    playSound('click');
    if (currentIndex < questions.length - 1) {
      setCurrentIndex(prev => prev + 1);
      setSelectedOption(null);
      setShowExplanation(false);
    } else {
      setIsComplete(true);
    }
  };

  const getOptionStyle = (option: QuizOption) => {
    if (!selectedOption) {
      return 'bg-white dark:bg-white/5 border-zinc-200 dark:border-white/10 hover:border-violet-300 dark:hover:border-violet-500/50';
    }
    if (option.id === selectedOption) {
      return option.isCorrect
        ? 'bg-emerald-50 dark:bg-emerald-500/20 border-emerald-500 dark:border-emerald-400'
        : 'bg-red-50 dark:bg-red-500/20 border-red-500 dark:border-red-400';
    }
    if (option.isCorrect) {
      return 'bg-emerald-50 dark:bg-emerald-500/20 border-emerald-500 dark:border-emerald-400';
    }
    return 'bg-white dark:bg-white/5 border-zinc-200 dark:border-white/10 opacity-50';
  };

  if (isComplete) {
    const finalScore = Math.round((correctAnswers / questions.length) * 100);
    return (
      <PracticeResult
        activity={activity}
        score={finalScore}
        correctAnswers={correctAnswers}
        totalQuestions={questions.length}
        onComplete={() => onComplete(finalScore)}
        onRetry={() => {
          setCurrentIndex(0);
          setSelectedOption(null);
          setShowExplanation(false);
          setCorrectAnswers(0);
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
              Задание {currentIndex + 1} из {questions.length}
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

      {/* Progress bar */}
      <div className="h-1 bg-zinc-100 dark:bg-white/10">
        <motion.div
          className="h-full bg-violet-500"
          initial={{ width: 0 }}
          animate={{ width: `${progress}%` }}
          transition={{ duration: 0.3 }}
        />
      </div>

      {/* Question */}
      <div className="p-6 max-h-[60vh] overflow-y-auto">
        <AnimatePresence mode="wait">
          <motion.div
            key={currentIndex}
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -20 }}
            transition={{ duration: 0.2 }}
          >
            {/* Scenario */}
            <div className="mb-4">
              <p className="text-zinc-700 dark:text-zinc-300 whitespace-pre-line">
                {currentQuestion.scenario}
              </p>
            </div>

            {/* Code block if exists */}
            {currentQuestion.code && (
              <div className="mb-6 rounded-xl bg-zinc-900 dark:bg-black/50 p-4 overflow-x-auto">
                <div className="flex items-center gap-2 mb-2 text-zinc-500 text-xs">
                  <Code className="w-3 h-3" />
                  Код
                </div>
                <pre className="text-sm font-mono text-emerald-400">
                  {currentQuestion.code}
                </pre>
              </div>
            )}

            <h3 className="text-lg font-bold text-zinc-900 dark:text-white mb-4">
              Что здесь не так?
            </h3>

            {/* Options */}
            <div className="space-y-3">
              {currentQuestion.options.map((option, index) => (
                <motion.button
                  key={option.id}
                  onClick={() => handleOptionSelect(option)}
                  disabled={!!selectedOption}
                  whileHover={!selectedOption ? { scale: 1.01 } : {}}
                  whileTap={!selectedOption ? { scale: 0.99 } : {}}
                  className={`w-full text-left p-4 rounded-xl border-2 transition-all duration-200 flex items-center gap-3 ${getOptionStyle(option)}`}
                >
                  <span className="w-8 h-8 rounded-lg bg-zinc-100 dark:bg-white/10 flex items-center justify-center text-sm font-bold text-zinc-600 dark:text-zinc-300 flex-shrink-0">
                    {String.fromCharCode(65 + index)}
                  </span>
                  <span className="flex-1 text-zinc-900 dark:text-white">{option.text}</span>
                  {selectedOption && option.isCorrect && (
                    <CheckCircle2 className="w-5 h-5 text-emerald-500 flex-shrink-0" />
                  )}
                  {selectedOption === option.id && !option.isCorrect && (
                    <XCircle className="w-5 h-5 text-red-500 flex-shrink-0" />
                  )}
                </motion.button>
              ))}
            </div>

            {/* Explanation */}
            <AnimatePresence>
              {showExplanation && (
                <motion.div
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -10 }}
                  className="mt-6 p-4 rounded-xl bg-amber-50 dark:bg-amber-500/10 border border-amber-200 dark:border-amber-500/30"
                >
                  <div className="flex gap-3">
                    <Lightbulb className="w-5 h-5 text-amber-500 flex-shrink-0 mt-0.5" />
                    <p className="text-sm text-amber-900 dark:text-amber-200">
                      {currentQuestion.explanation}
                    </p>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </motion.div>
        </AnimatePresence>
      </div>

      {/* Footer */}
      {showExplanation && (
        <div className="px-6 py-4 border-t border-zinc-100 dark:border-white/10 flex justify-end">
          <motion.button
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            onClick={handleNext}
            className="flex items-center gap-2 px-6 py-3 bg-violet-600 hover:bg-violet-700 text-white font-medium rounded-xl transition-colors"
          >
            {currentIndex < questions.length - 1 ? 'Далее' : 'Завершить'}
            <ChevronRight className="w-4 h-4" />
          </motion.button>
        </div>
      )}
    </div>
  );
};

export default FindErrorActivity;
