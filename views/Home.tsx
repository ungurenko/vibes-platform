
import React, { useState, useEffect } from 'react';
import {
  Calendar,
  CheckCircle2,
  Palette,
  Terminal,
  Book,
  Bot,
  Sparkles,
  ListChecks,
  MapPin
} from 'lucide-react';
import { TabId, DashboardStage } from '../types';
import { DASHBOARD_STAGES } from '../data';
import { motion } from 'framer-motion';
import { fetchAllCalls, fetchUserTasks, toggleTaskComplete } from '../lib/supabase';

interface HomeProps {
  stages?: DashboardStage[];
  onNavigate: (tab: TabId) => void;
  userId?: string;
  userName?: string;
}

const Home: React.FC<HomeProps> = ({
  stages = DASHBOARD_STAGES,
  onNavigate,
  userId,
  userName = 'Студент'
}) => {
  const [activeStageId, setActiveStageId] = useState<number>(1);
  const [completedTasks, setCompletedTasks] = useState<string[]>([]);
  const [upcomingCall, setUpcomingCall] = useState<any>(null);
  const [isLoadingTasks, setIsLoadingTasks] = useState(true);

  const activeStage = stages.find(s => s.id === activeStageId) || stages[0] || { id: 1, title: 'Загрузка...', subtitle: 'Неделя 1', tasks: [] };
  const currentWeek = activeStage?.subtitle || `Неделя ${activeStageId}`;

  // Load user's completed tasks and upcoming call
  useEffect(() => {
    if (userId) {
      loadUserTasks();
    }
    loadUpcomingCall();
  }, [userId]);

  const loadUserTasks = async () => {
    if (!userId) return;

    try {
      setIsLoadingTasks(true);
      const tasks = await fetchUserTasks(userId);
      setCompletedTasks(tasks);
    } catch (error) {
      console.error('Error loading tasks:', error);
    } finally {
      setIsLoadingTasks(false);
    }
  };

  const loadUpcomingCall = async () => {
    try {
      const calls = await fetchAllCalls();
      const now = new Date();

      // Find the next scheduled or live call
      const upcoming = calls.find((call: any) => {
        const callDate = new Date(call.date + 'T' + call.time);
        return call.status === 'scheduled' || call.status === 'live';
      });

      setUpcomingCall(upcoming);
    } catch (error) {
      console.error('Error loading upcoming call:', error);
    }
  };

  const handleTaskToggle = async (taskId: string) => {
    if (!userId) {
      // If no userId, just toggle locally
      setCompletedTasks(prev =>
        prev.includes(taskId)
          ? prev.filter(id => id !== taskId)
          : [...prev, taskId]
      );
      return;
    }

    const isCurrentlyCompleted = completedTasks.includes(taskId);
    const newCompletedState = !isCurrentlyCompleted;

    // Optimistic update
    setCompletedTasks(prev =>
      newCompletedState
        ? [...prev, taskId]
        : prev.filter(id => id !== taskId)
    );

    try {
      await toggleTaskComplete(userId, taskId, newCompletedState);
    } catch (error) {
      console.error('Error toggling task:', error);
      // Revert on error
      setCompletedTasks(prev =>
        newCompletedState
          ? prev.filter(id => id !== taskId)
          : [...prev, taskId]
      );
    }
  };

  // Calculate Progress
  const tasks = activeStage?.tasks || [];
  const totalTasks = tasks.length;
  const completedCount = tasks.filter(t => completedTasks.includes(t.id)).length;

  // Check if it's close to call time (15 minutes before)
  const isCallSoon = upcomingCall ? (() => {
    const callDateTime = new Date(upcomingCall.date + 'T' + upcomingCall.time);
    const now = new Date();
    const diffMinutes = (callDateTime.getTime() - now.getTime()) / (1000 * 60);
    return diffMinutes <= 15 && diffMinutes >= 0;
  })() : false;

  // Format date for call display
  const formatCallDate = (dateString: string) => {
    const date = new Date(dateString);
    const days = ['Вс', 'Пн', 'Вт', 'Ср', 'Чт', 'Пт', 'Сб'];
    const months = ['янв', 'фев', 'мар', 'апр', 'май', 'июн', 'июл', 'авг', 'сен', 'окт', 'ноя', 'дек'];

    return `${days[date.getDay()]}, ${date.getDate()} ${months[date.getMonth()]}`;
  };

  // Animation Variants
  const containerVariants = {
    hidden: { opacity: 0 },
    show: {
      opacity: 1,
      transition: { staggerChildren: 0.1, delayChildren: 0.05 }
    }
  };

  const itemVariants = {
    hidden: { y: 20, opacity: 0 },
    show: {
      y: 0,
      opacity: 1,
      transition: { type: "spring", stiffness: 100, damping: 20 }
    }
  };

  return (
    <motion.div
      variants={containerVariants}
      initial="hidden"
      animate="show"
      className="max-w-[1400px] mx-auto px-4 md:px-8 py-6 md:py-10 pb-32"
    >
      {/* HEADER */}
      <motion.div
        variants={itemVariants}
        className="mb-8 md:mb-10"
      >
        <div className="flex flex-col sm:flex-row sm:items-baseline sm:justify-between gap-2">
          <h1 className="text-3xl md:text-4xl font-display font-bold text-zinc-900 dark:text-white">
            Привет, {userName}!
          </h1>
          <div className="flex items-center gap-2 text-zinc-600 dark:text-zinc-400">
            <MapPin size={18} className="text-violet-500" />
            <span className="text-lg font-medium">{currentWeek} из 4</span>
          </div>
        </div>
      </motion.div>

      {/* MAIN CONTENT - Two Column Layout */}
      <div className="grid grid-cols-1 md:grid-cols-5 gap-6">

        {/* LEFT COLUMN - Tasks (60% width = 3 cols out of 5) */}
        <motion.div
          variants={itemVariants}
          className="md:col-span-3 bg-white dark:bg-zinc-900 rounded-[2rem] p-6 md:p-8 border border-zinc-200 dark:border-white/5 shadow-sm hover:shadow-md transition-shadow"
        >
          {/* Tasks Header */}
          <div className="flex items-center justify-between mb-6">
            <h2 className="font-display text-2xl font-bold text-zinc-900 dark:text-white flex items-center gap-3">
              <div className="p-2 bg-violet-100 dark:bg-violet-500/10 rounded-xl">
                <ListChecks className="text-violet-600 dark:text-violet-400" size={24} />
              </div>
              Твои задачи
            </h2>
            <div className="flex items-center gap-2">
              <span className="text-sm font-medium text-zinc-500 dark:text-zinc-400">
                Выполнено:
              </span>
              <span className="text-lg font-bold bg-violet-100 dark:bg-violet-500/10 px-3 py-1 rounded-lg text-violet-700 dark:text-violet-400">
                {completedCount}/{totalTasks}
              </span>
            </div>
          </div>

          {/* Tasks List */}
          <div className="space-y-3">
            {isLoadingTasks ? (
              <div className="flex items-center justify-center py-12">
                <div className="w-8 h-8 border-4 border-violet-200 dark:border-violet-500/20 border-t-violet-600 dark:border-t-violet-400 rounded-full animate-spin" />
              </div>
            ) : tasks.length > 0 ? (
              tasks.map((task) => {
                const isDone = completedTasks.includes(task.id);
                return (
                  <motion.div
                    key={task.id}
                    initial={{ opacity: 0, x: -20 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ duration: 0.3 }}
                    onClick={() => handleTaskToggle(task.id)}
                    className={`group p-4 md:p-5 rounded-2xl border transition-all cursor-pointer relative overflow-hidden ${
                      isDone
                        ? 'bg-zinc-50 dark:bg-zinc-800/30 border-transparent opacity-60'
                        : 'bg-white dark:bg-zinc-800/50 border-zinc-100 dark:border-white/5 hover:border-violet-300 dark:hover:border-violet-500/50 hover:shadow-lg hover:shadow-violet-500/5'
                    }`}
                  >
                    <div className="flex items-start gap-4 relative z-10">
                      <div className={`mt-0.5 min-w-[24px] w-6 h-6 rounded-full border-2 flex items-center justify-center transition-all duration-300 ${
                        isDone
                          ? 'bg-violet-600 border-violet-600 text-white shadow-lg shadow-violet-500/50'
                          : 'border-zinc-300 dark:border-zinc-600 group-hover:border-violet-400 group-hover:scale-110'
                      }`}>
                        {isDone && <CheckCircle2 size={14} strokeWidth={3} />}
                      </div>
                      <span className={`text-base font-medium leading-relaxed transition-colors flex-1 ${
                        isDone ? 'text-zinc-400 line-through' : 'text-zinc-700 dark:text-zinc-200'
                      }`}>
                        {task.title}
                      </span>
                    </div>
                  </motion.div>
                );
              })
            ) : (
              <div className="text-center py-12 text-zinc-500 dark:text-zinc-400">
                <ListChecks size={48} className="mx-auto mb-3 opacity-30" />
                <p>Задачи пока не добавлены</p>
              </div>
            )}

            {/* Celebration */}
            {completedCount === totalTasks && totalTasks > 0 && (
              <motion.div
                initial={{ opacity: 0, scale: 0.8 }}
                animate={{ opacity: 1, scale: 1 }}
                className="mt-6 p-6 bg-gradient-to-br from-emerald-50 to-teal-50 dark:from-emerald-500/10 dark:to-teal-500/10 rounded-2xl border border-emerald-200 dark:border-emerald-500/20 text-center"
              >
                <div className="w-16 h-16 bg-emerald-100 dark:bg-emerald-500/20 rounded-full flex items-center justify-center mb-4 mx-auto ring-4 ring-emerald-50 dark:ring-emerald-500/10">
                  <Sparkles size={28} className="text-emerald-600 dark:text-emerald-400" />
                </div>
                <p className="text-lg font-bold text-zinc-900 dark:text-white mb-1">
                  Все задачи выполнены!
                </p>
                <p className="text-sm text-zinc-600 dark:text-zinc-400">
                  Отдохни или переходи к следующему этапу
                </p>
              </motion.div>
            )}
          </div>
        </motion.div>

        {/* RIGHT COLUMN - Tools & Call (40% width = 2 cols out of 5) */}
        <div className="md:col-span-2 flex flex-col gap-6">

          {/* Quick Access Tools */}
          <motion.div
            variants={itemVariants}
            className="bg-zinc-50 dark:bg-zinc-900/50 rounded-[2rem] p-6 border border-zinc-200 dark:border-white/5"
          >
            <h3 className="text-xs font-bold text-zinc-500 dark:text-zinc-400 uppercase tracking-wider mb-4 px-1">
              Инструменты
            </h3>
            <div className="grid grid-cols-2 gap-3">
              {[
                { id: 'styles', icon: Palette, color: 'text-fuchsia-500', label: 'Стили', bg: 'bg-fuchsia-50 dark:bg-fuchsia-500/10' },
                { id: 'prompts', icon: Terminal, color: 'text-emerald-500', label: 'Промпты', bg: 'bg-emerald-50 dark:bg-emerald-500/10' },
                { id: 'glossary', icon: Book, color: 'text-amber-500', label: 'Термины', bg: 'bg-amber-50 dark:bg-amber-500/10' },
                { id: 'assistant', icon: Bot, color: 'text-cyan-500', label: 'AI Чат', bg: 'bg-cyan-50 dark:bg-cyan-500/10' },
              ].map(item => (
                <button
                  key={item.id}
                  onClick={() => onNavigate(item.id as TabId)}
                  className="flex flex-col items-center justify-center p-4 rounded-2xl bg-white dark:bg-zinc-800 shadow-sm hover:shadow-md hover:scale-105 transition-all duration-300 group border border-transparent hover:border-zinc-200 dark:hover:border-white/10"
                >
                  <div className={`p-3 rounded-xl mb-2 ${item.bg} transition-all group-hover:scale-110 duration-300`}>
                    <item.icon size={24} className={item.color} />
                  </div>
                  <span className="text-xs font-bold text-zinc-700 dark:text-zinc-300">
                    {item.label}
                  </span>
                </button>
              ))}
            </div>
          </motion.div>

          {/* Upcoming Call */}
          {upcomingCall ? (
            <motion.div
              variants={itemVariants}
              className={`rounded-[2rem] p-6 text-white relative overflow-hidden group hover:scale-[1.02] transition-transform shadow-lg ${
                upcomingCall.status === 'live'
                  ? 'bg-gradient-to-br from-red-500 to-rose-600 shadow-red-500/20'
                  : 'bg-gradient-to-br from-violet-600 to-purple-600 shadow-violet-500/20'
              }`}
            >
              {/* Background Effects */}
              <div className="absolute top-0 right-0 w-32 h-32 bg-white/20 rounded-full blur-2xl -translate-y-1/2 translate-x-1/2 group-hover:bg-white/30 transition-colors" />
              <div className="absolute bottom-0 left-0 w-24 h-24 bg-black/10 rounded-full blur-xl translate-y-1/3 -translate-x-1/3" />

              <div className="relative z-10">
                {/* Header */}
                <div className="flex justify-between items-start mb-4">
                  <div className="p-2.5 bg-white/20 backdrop-blur-md rounded-2xl border border-white/20 shadow-inner">
                    <Calendar size={20} />
                  </div>
                  {upcomingCall.status === 'live' && (
                    <div className="px-3 py-1 bg-white/20 backdrop-blur-md rounded-full border border-white/10 text-xs font-bold uppercase tracking-wider shadow-sm flex items-center gap-2">
                      <div className="w-2 h-2 rounded-full bg-white animate-pulse" />
                      Live
                    </div>
                  )}
                </div>

                {/* Call Info */}
                <div className="mb-1">
                  <p className="text-xs font-bold uppercase tracking-widest mb-2 opacity-90">
                    Ближайший созвон
                  </p>
                  <h3 className="text-xl font-bold leading-tight mb-3">
                    {upcomingCall.topic}
                  </h3>

                  <div className="flex items-center gap-2 text-sm opacity-90">
                    <span className="font-medium">
                      {formatCallDate(upcomingCall.date)}, {upcomingCall.time}
                    </span>
                  </div>
                </div>

                {/* Action Button */}
                <div className="mt-5 pt-4 border-t border-white/20">
                  {isCallSoon && upcomingCall.meetingUrl ? (
                    <a
                      href={upcomingCall.meetingUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="block w-full py-3 px-4 bg-white text-violet-600 dark:text-violet-700 rounded-xl font-bold text-center hover:bg-white/90 transition-colors shadow-lg"
                    >
                      Подключиться
                    </a>
                  ) : (
                    <button className="w-full py-3 px-4 bg-white/20 backdrop-blur-md border border-white/20 rounded-xl font-medium text-sm hover:bg-white/30 transition-colors">
                      Добавить в календарь
                    </button>
                  )}
                </div>
              </div>
            </motion.div>
          ) : (
            <motion.div
              variants={itemVariants}
              className="bg-zinc-100 dark:bg-zinc-900 rounded-[2rem] p-6 border border-zinc-200 dark:border-white/5 flex items-center justify-center min-h-[200px]"
            >
              <div className="text-center">
                <Calendar size={40} className="mx-auto mb-3 text-zinc-400 dark:text-zinc-600" />
                <p className="text-sm font-medium text-zinc-500 dark:text-zinc-400">
                  Нет запланированных созвонов
                </p>
              </div>
            </motion.div>
          )}
        </div>
      </div>
    </motion.div>
  );
};

export default Home;
