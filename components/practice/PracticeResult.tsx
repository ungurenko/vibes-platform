import React from 'react';
import { motion } from 'framer-motion';
import { Trophy, Star, RotateCcw, X, Sparkles, Target } from 'lucide-react';
import { PracticeActivity } from '../../types';
import { useSound } from '../../SoundContext';

interface PracticeResultProps {
  activity: PracticeActivity;
  score: number;
  correctAnswers: number;
  totalQuestions: number;
  onComplete: () => void;
  onRetry: () => void;
  onClose: () => void;
}

const PracticeResult: React.FC<PracticeResultProps> = ({
  activity,
  score,
  correctAnswers,
  totalQuestions,
  onComplete,
  onRetry,
  onClose
}) => {
  const { playSound } = useSound();

  const getResultMessage = () => {
    if (score >= 90) return { emoji: '🎉', text: 'Великолепно!', subtext: 'Ты настоящий эксперт!' };
    if (score >= 70) return { emoji: '💪', text: 'Отлично!', subtext: 'Ещё чуть-чуть и будет идеально' };
    if (score >= 50) return { emoji: '👍', text: 'Хорошо!', subtext: 'Продолжай практиковаться' };
    return { emoji: '📚', text: 'Попробуй ещё раз', subtext: 'Практика делает мастера' };
  };

  const result = getResultMessage();

  const getScoreColor = () => {
    if (score >= 90) return 'text-emerald-500';
    if (score >= 70) return 'text-blue-500';
    if (score >= 50) return 'text-amber-500';
    return 'text-red-500';
  };

  const getScoreGradient = () => {
    if (score >= 90) return 'from-emerald-500 to-teal-500';
    if (score >= 70) return 'from-blue-500 to-indigo-500';
    if (score >= 50) return 'from-amber-500 to-orange-500';
    return 'from-red-500 to-pink-500';
  };

  return (
    <div className="bg-white dark:bg-zinc-900 rounded-3xl shadow-2xl overflow-hidden">
      {/* Header */}
      <div className="px-6 py-4 border-b border-zinc-100 dark:border-white/10 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <span className="text-2xl">{activity.icon}</span>
          <div>
            <h2 className="font-bold text-zinc-900 dark:text-white">{activity.title}</h2>
            <p className="text-xs text-zinc-500 dark:text-zinc-400">Результат</p>
          </div>
        </div>
        <button
          onClick={onClose}
          className="p-2 rounded-xl hover:bg-zinc-100 dark:hover:bg-white/10 transition-colors text-zinc-500"
        >
          <X className="w-5 h-5" />
        </button>
      </div>

      {/* Content */}
      <div className="p-8 text-center">
        {/* Emoji */}
        <motion.div
          initial={{ scale: 0 }}
          animate={{ scale: 1 }}
          transition={{ type: "spring", stiffness: 200, damping: 10, delay: 0.1 }}
          className="text-6xl mb-4"
        >
          {result.emoji}
        </motion.div>

        {/* Message */}
        <motion.h3
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2 }}
          className="text-2xl font-bold text-zinc-900 dark:text-white mb-1"
        >
          {result.text}
        </motion.h3>
        <motion.p
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.3 }}
          className="text-zinc-500 dark:text-zinc-400 mb-8"
        >
          {result.subtext}
        </motion.p>

        {/* Score Circle */}
        <motion.div
          initial={{ scale: 0, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          transition={{ type: "spring", stiffness: 200, damping: 15, delay: 0.4 }}
          className="relative w-40 h-40 mx-auto mb-8"
        >
          {/* Background circle */}
          <svg className="w-full h-full transform -rotate-90">
            <circle
              cx="80"
              cy="80"
              r="70"
              fill="none"
              stroke="currentColor"
              strokeWidth="12"
              className="text-zinc-100 dark:text-white/10"
            />
            <motion.circle
              cx="80"
              cy="80"
              r="70"
              fill="none"
              stroke="url(#scoreGradient)"
              strokeWidth="12"
              strokeLinecap="round"
              strokeDasharray={2 * Math.PI * 70}
              initial={{ strokeDashoffset: 2 * Math.PI * 70 }}
              animate={{ strokeDashoffset: 2 * Math.PI * 70 * (1 - score / 100) }}
              transition={{ duration: 1, delay: 0.5, ease: "easeOut" }}
            />
            <defs>
              <linearGradient id="scoreGradient" x1="0%" y1="0%" x2="100%" y2="100%">
                <stop offset="0%" className={`${getScoreGradient().split(' ')[0].replace('from-', 'stop-')}`} style={{ stopColor: score >= 90 ? '#10b981' : score >= 70 ? '#3b82f6' : score >= 50 ? '#f59e0b' : '#ef4444' }} />
                <stop offset="100%" className={`${getScoreGradient().split(' ')[1].replace('to-', 'stop-')}`} style={{ stopColor: score >= 90 ? '#14b8a6' : score >= 70 ? '#6366f1' : score >= 50 ? '#f97316' : '#ec4899' }} />
              </linearGradient>
            </defs>
          </svg>

          {/* Score text */}
          <div className="absolute inset-0 flex flex-col items-center justify-center">
            <motion.span
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 0.8 }}
              className={`text-4xl font-bold ${getScoreColor()}`}
            >
              {score}%
            </motion.span>
            <span className="text-sm text-zinc-400 dark:text-zinc-500">результат</span>
          </div>
        </motion.div>

        {/* Stats */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.6 }}
          className="flex justify-center gap-8 mb-8"
        >
          <div className="text-center">
            <div className="flex items-center justify-center gap-1 text-emerald-500 mb-1">
              <Target className="w-4 h-4" />
              <span className="text-xl font-bold">{correctAnswers}</span>
            </div>
            <p className="text-xs text-zinc-500 dark:text-zinc-400">Правильно</p>
          </div>
          <div className="text-center">
            <div className="flex items-center justify-center gap-1 text-zinc-400 mb-1">
              <Star className="w-4 h-4" />
              <span className="text-xl font-bold">{totalQuestions}</span>
            </div>
            <p className="text-xs text-zinc-500 dark:text-zinc-400">Всего</p>
          </div>
        </motion.div>

        {/* Actions */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.7 }}
          className="flex gap-3 justify-center"
        >
          <button
            onClick={() => {
              playSound('click');
              onRetry();
            }}
            className="flex items-center gap-2 px-5 py-3 bg-zinc-100 dark:bg-white/10 text-zinc-700 dark:text-zinc-200 font-medium rounded-xl hover:bg-zinc-200 dark:hover:bg-white/20 transition-colors"
          >
            <RotateCcw className="w-4 h-4" />
            Ещё раз
          </button>
          <button
            onClick={() => {
              playSound('success');
              onComplete();
            }}
            className="flex items-center gap-2 px-5 py-3 bg-violet-600 hover:bg-violet-700 text-white font-medium rounded-xl transition-colors"
          >
            <Sparkles className="w-4 h-4" />
            Готово
          </button>
        </motion.div>
      </div>
    </div>
  );
};

export default PracticeResult;
