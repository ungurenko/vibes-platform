import React from 'react';
import { motion } from 'framer-motion';
import { Clock, CheckCircle2, ChevronRight } from 'lucide-react';
import { PracticeActivity, PracticeProgress } from '../../types';

interface ActivityCardProps {
  activity: PracticeActivity;
  progress?: PracticeProgress;
  onClick: () => void;
}

const ActivityCard: React.FC<ActivityCardProps> = ({ activity, progress, onClick }) => {
  const isCompleted = progress?.status === 'completed';
  const score = progress?.score;

  const getDifficultyColor = (difficulty: string) => {
    switch (difficulty) {
      case 'Легко':
        return 'text-emerald-600 dark:text-emerald-400 bg-emerald-100 dark:bg-emerald-500/20';
      case 'Средне':
        return 'text-amber-600 dark:text-amber-400 bg-amber-100 dark:bg-amber-500/20';
      case 'Сложно':
        return 'text-red-600 dark:text-red-400 bg-red-100 dark:bg-red-500/20';
      default:
        return 'text-zinc-600 dark:text-zinc-400 bg-zinc-100 dark:bg-zinc-500/20';
    }
  };

  const getTypeLabel = (type: string) => {
    switch (type) {
      case 'quiz':
        return 'Квиз';
      case 'flashcard':
        return 'Карточки';
      case 'find-error':
        return 'Найди ошибку';
      default:
        return type;
    }
  };

  return (
    <motion.button
      onClick={onClick}
      whileHover={{ scale: 1.02, y: -2 }}
      whileTap={{ scale: 0.98 }}
      className={`relative w-full text-left p-5 rounded-2xl border transition-all duration-300 group ${
        isCompleted
          ? 'bg-emerald-50 dark:bg-emerald-500/10 border-emerald-200 dark:border-emerald-500/30'
          : 'bg-white dark:bg-white/5 border-zinc-200 dark:border-white/10 hover:border-violet-300 dark:hover:border-violet-500/50'
      }`}
    >
      {/* Completed Badge */}
      {isCompleted && (
        <div className="absolute top-3 right-3">
          <div className="flex items-center gap-1.5 px-2 py-1 bg-emerald-500 text-white rounded-full text-xs font-medium">
            <CheckCircle2 className="w-3 h-3" />
            {score}%
          </div>
        </div>
      )}

      {/* Icon */}
      <div className="text-4xl mb-3">{activity.icon}</div>

      {/* Title */}
      <h3 className="text-lg font-bold text-zinc-900 dark:text-white mb-1 pr-16">
        {activity.title}
      </h3>

      {/* Description */}
      <p className="text-sm text-zinc-500 dark:text-zinc-400 mb-4 line-clamp-2">
        {activity.description}
      </p>

      {/* Meta */}
      <div className="flex flex-wrap items-center gap-2">
        <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${getDifficultyColor(activity.difficulty)}`}>
          {activity.difficulty}
        </span>
        <span className="px-2 py-0.5 rounded-full text-xs font-medium text-zinc-600 dark:text-zinc-400 bg-zinc-100 dark:bg-zinc-500/20">
          {getTypeLabel(activity.type)}
        </span>
        <span className="flex items-center gap-1 text-xs text-zinc-400 dark:text-zinc-500">
          <Clock className="w-3 h-3" />
          {activity.estimatedTime}
        </span>
      </div>

      {/* Items count */}
      <div className="mt-3 pt-3 border-t border-zinc-100 dark:border-white/5 flex items-center justify-between">
        <span className="text-xs text-zinc-400 dark:text-zinc-500">
          {activity.totalItems} {activity.type === 'flashcard' ? 'карточек' : 'вопросов'}
        </span>
        <ChevronRight className={`w-4 h-4 transition-transform group-hover:translate-x-1 ${
          isCompleted ? 'text-emerald-500' : 'text-zinc-400 dark:text-zinc-500'
        }`} />
      </div>
    </motion.button>
  );
};

export default ActivityCard;
