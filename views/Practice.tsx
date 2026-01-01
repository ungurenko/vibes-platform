import React, { useState, useEffect, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Flame, Trophy, Clock, ChevronRight } from 'lucide-react';
import { PracticeActivity, PracticeProgress, PracticeStreak, QuizQuestion, Flashcard, FindErrorQuestion } from '../types';
import { PRACTICE_ACTIVITIES_DATA, QUIZ_WEB_BASICS_DATA, QUIZ_VIBE_TOOLS_DATA, FLASHCARDS_TERMS_DATA, FIND_ERROR_DATA } from '../data';
import ActivityCard from '../components/practice/ActivityCard';
import QuizActivity from '../components/practice/QuizActivity';
import FlashcardActivity from '../components/practice/FlashcardActivity';
import FindErrorActivity from '../components/practice/FindErrorActivity';
import { useSound } from '../SoundContext';

interface PracticeProps {
  currentUserId?: string;
}

const Practice: React.FC<PracticeProps> = ({ currentUserId }) => {
  const { playSound } = useSound();
  const [activities] = useState<PracticeActivity[]>(PRACTICE_ACTIVITIES_DATA);
  const [progress, setProgress] = useState<Record<string, PracticeProgress>>({});
  const [streak, setStreak] = useState<PracticeStreak | null>(null);
  const [selectedActivity, setSelectedActivity] = useState<PracticeActivity | null>(null);

  // Get questions/cards for selected activity
  const getActivityContent = (activity: PracticeActivity) => {
    switch (activity.id) {
      case 'quiz-web-basics':
        return QUIZ_WEB_BASICS_DATA;
      case 'quiz-vibe-tools':
        return QUIZ_VIBE_TOOLS_DATA;
      case 'flashcards-terms':
        return FLASHCARDS_TERMS_DATA;
      case 'find-error':
        return FIND_ERROR_DATA;
      default:
        return [];
    }
  };

  // Calculate stats
  const stats = useMemo(() => {
    const completed = Object.values(progress).filter(p => p.status === 'completed').length;
    const total = activities.length;
    return { completed, total };
  }, [progress, activities]);

  const handleActivitySelect = (activity: PracticeActivity) => {
    playSound('click');
    setSelectedActivity(activity);
  };

  const handleActivityComplete = (activityId: string, score: number) => {
    playSound('success');
    setProgress(prev => ({
      ...prev,
      [activityId]: {
        user_id: currentUserId || '',
        activity_id: activityId,
        status: 'completed',
        score,
        completed_at: new Date().toISOString()
      }
    }));

    // Update streak
    setStreak(prev => ({
      user_id: currentUserId || '',
      current_streak: (prev?.current_streak || 0) + 1,
      last_practice_date: new Date().toISOString().split('T')[0],
      longest_streak: Math.max((prev?.longest_streak || 0), (prev?.current_streak || 0) + 1)
    }));

    setSelectedActivity(null);
  };

  const handleActivityClose = () => {
    setSelectedActivity(null);
  };

  return (
    <div className="px-6 md:px-8 pb-8">
      {/* Header */}
      <div className="mb-8">
        <h1 className="text-2xl md:text-3xl font-bold text-zinc-900 dark:text-white mb-2">
          Практика
        </h1>
        <p className="text-zinc-500 dark:text-zinc-400 text-base">
          Закрепи знания через интерактивные задания. Ошибаться можно — это часть обучения.
        </p>
      </div>

      {/* Stats Bar */}
      <div className="flex flex-wrap gap-4 mb-8">
        <div className="flex items-center gap-3 px-4 py-3 bg-white dark:bg-white/5 rounded-2xl border border-zinc-200 dark:border-white/10">
          <div className="w-10 h-10 rounded-xl bg-violet-100 dark:bg-violet-500/20 flex items-center justify-center">
            <Trophy className="w-5 h-5 text-violet-600 dark:text-violet-400" />
          </div>
          <div>
            <p className="text-xs text-zinc-500 dark:text-zinc-400">Твой прогресс</p>
            <p className="text-lg font-bold text-zinc-900 dark:text-white">
              {stats.completed} <span className="text-zinc-400 font-normal">из</span> {stats.total}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-3 px-4 py-3 bg-white dark:bg-white/5 rounded-2xl border border-zinc-200 dark:border-white/10">
          <div className="w-10 h-10 rounded-xl bg-orange-100 dark:bg-orange-500/20 flex items-center justify-center">
            <Flame className="w-5 h-5 text-orange-500" />
          </div>
          <div>
            <p className="text-xs text-zinc-500 dark:text-zinc-400">Серия</p>
            <p className="text-lg font-bold text-zinc-900 dark:text-white">
              {streak?.current_streak || 0} <span className="text-zinc-400 font-normal">дней</span>
            </p>
          </div>
        </div>
      </div>

      {/* Activities Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
        {activities.map((activity) => (
          <ActivityCard
            key={activity.id}
            activity={activity}
            progress={progress[activity.id]}
            onClick={() => handleActivitySelect(activity)}
          />
        ))}
      </div>

      {/* Activity Modal */}
      <AnimatePresence>
        {selectedActivity && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 dark:bg-black/80 backdrop-blur-sm"
            onClick={handleActivityClose}
          >
            <motion.div
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              transition={{ type: "spring", stiffness: 300, damping: 30 }}
              className="w-full max-w-2xl max-h-[90vh] overflow-hidden"
              onClick={(e) => e.stopPropagation()}
            >
              {selectedActivity.type === 'quiz' && (
                <QuizActivity
                  activity={selectedActivity}
                  questions={getActivityContent(selectedActivity) as QuizQuestion[]}
                  onComplete={(score) => handleActivityComplete(selectedActivity.id, score)}
                  onClose={handleActivityClose}
                />
              )}
              {selectedActivity.type === 'flashcard' && (
                <FlashcardActivity
                  activity={selectedActivity}
                  flashcards={getActivityContent(selectedActivity) as Flashcard[]}
                  onComplete={(score) => handleActivityComplete(selectedActivity.id, score)}
                  onClose={handleActivityClose}
                />
              )}
              {selectedActivity.type === 'find-error' && (
                <FindErrorActivity
                  activity={selectedActivity}
                  questions={getActivityContent(selectedActivity) as FindErrorQuestion[]}
                  onComplete={(score) => handleActivityComplete(selectedActivity.id, score)}
                  onClose={handleActivityClose}
                />
              )}
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};

export default Practice;
