
import React, { useState, useEffect, useMemo } from 'react';
import { Menu } from 'lucide-react';
import Sidebar from './components/Sidebar';
import Home from './views/Home';
import StyleLibrary from './views/StyleLibrary';
import Glossary from './views/Glossary';
import Assistant from './views/Assistant';
import Lessons from './views/Lessons';
import PromptBase from './views/PromptBase';
import Roadmaps from './views/Roadmaps';
import AdminStudents from './views/AdminStudents';
import AdminContent from './views/AdminContent';
import AdminCalls from './views/AdminCalls';
import AdminAssistant from './views/AdminAssistant';
import AdminSettings from './views/AdminSettings';
import UserProfile from './views/UserProfile'; 
import Login from './views/Login';
import Register from './views/Register';
import Onboarding from './views/Onboarding';
import { TabId, InviteLink, Student, CourseModule, PromptItem, Roadmap, StyleCard } from './types';
import { STUDENTS_DATA, COURSE_MODULES, PROMPTS_DATA, ROADMAPS_DATA, STYLES_DATA } from './data';
import { motion, AnimatePresence } from 'framer-motion';
import { SoundProvider } from './SoundContext';
import { 
    supabase, 
    fetchAppContent, 
    checkInvite, 
    useInvite, 
    fetchUserProgress, 
    toggleLessonComplete, 
    completeOnboardingDB, 
    fetchAllStudents,
    fetchAllInvites,
    createInviteDB,
    deleteInviteDB
} from './lib/supabase';

const AppContent: React.FC = () => {
  // ... (предыдущие состояния)
  const [session, setSession] = useState<any>(null);
  const [profile, setProfile] = useState<any>(null);
  const [inviteCodeFromUrl, setInviteCodeFromUrl] = useState<string | null>(null);
  const [view, setView] = useState<'login' | 'register' | 'app' | 'reset-password' | 'onboarding'>('login');
  const [isAuthLoading, setIsAuthLoading] = useState(true);

  // --- App Data State ---
  const [students, setStudents] = useState<Student[]>([]);
  const [invites, setInvites] = useState<InviteLink[]>([]);
  const [completedLessons, setCompletedLessons] = useState<string[]>([]);
  
  // ... (остальной стейт)

  const loadAdminData = async () => {
      try {
          const [allStudents, allInvites] = await Promise.all([
              fetchAllStudents(),
              fetchAllInvites()
          ]);
          setStudents(allStudents as Student[]);
          setInvites(allInvites as InviteLink[]);
      } catch (e) {
          console.error("Failed to load admin data:", e);
      }
  };

  // ... (handleRegister и другие функции)

  const handleGenerateInvites = async (count: number) => {
      try {
          // Generate simple random tokens for now
          for (let i = 0; i < count; i++) {
              const token = `vibes-${Math.random().toString(36).substring(2, 7)}`;
              await createInviteDB(token);
          }
          await loadAdminData(); // Refresh list
      } catch (e) {
          alert("Ошибка при создании инвайта");
      }
  };

  const handleDeleteInvite = async (id: string) => {
      try {
          await deleteInviteDB(id);
          setInvites(prev => prev.filter(inv => inv.id !== id));
      } catch (e) {
          alert("Ошибка при удалении");
      }
  };

  // ... (внутри renderContent)
  // Находим кейс 'admin-settings' и обновляем пропсы
  const renderContent = () => {
    // ...
    switch (activeTab) {
      // ...
      case 'admin-settings': return <AdminSettings invites={invites} onGenerateInvites={handleGenerateInvites} onDeleteInvite={handleDeleteInvite} onDeactivateInvite={() => {}} />;
      // ...
    }
  };



  const handleAskAI = (prompt: string) => {
      setAssistantInitialMessage(prompt);
      setActiveTab('assistant');
  };

  const toggleTheme = () => {
    setTheme(prev => prev === 'dark' ? 'light' : 'dark');
  };

  // --- Render Views ---

  if (isAuthLoading) {
      return <div className="min-h-screen bg-zinc-950 flex items-center justify-center">
          <div className="w-8 h-8 border-4 border-violet-500 border-t-transparent rounded-full animate-spin"></div>
      </div>;
  }

  if (view === 'login' && !session) return <Login onLogin={handleLogin} onNavigateToRegister={() => setView('register')} onSimulateResetLink={() => setView('reset-password')} />;
  if (view === 'reset-password') return <Login onLogin={handleLogin} onNavigateToRegister={() => setView('register')} initialView="reset" onSimulateResetLink={() => {}} onResetComplete={() => setView('login')} />;
  if (view === 'register' && inviteCodeFromUrl && !session) return <Register inviteCode={inviteCodeFromUrl} validateInvite={validateInvite} onRegister={(d) => handleRegister({...d, password: (d as any).password})} onNavigateLogin={() => { window.history.replaceState({}, '', window.location.pathname); setView('login'); }} />;
  if (view === 'onboarding' && session) return <Onboarding userName={profile?.full_name || ''} onComplete={completeOnboarding} />;

  const renderContent = () => {
    if (!session) return <Login onLogin={handleLogin} onNavigateToRegister={() => setView('register')} onSimulateResetLink={() => setView('reset-password')} />;

    switch (activeTab) {
      case 'dashboard': return <Home onNavigate={setActiveTab} />;
      case 'lessons': return <Lessons modules={modules} />;
      // Pass dynamic data to views
      case 'roadmaps': return <Roadmaps roadmaps={roadmaps} />;
      case 'styles': return <StyleLibrary styles={styles} />;
      case 'prompts': return <PromptBase prompts={prompts} />;
      case 'glossary': return <Glossary onNavigate={setActiveTab} onAskAI={handleAskAI} />;
      case 'assistant': return <Assistant initialMessage={assistantInitialMessage} onMessageHandled={() => setAssistantInitialMessage(null)} />;
      case 'profile': return currentUser ? <UserProfile user={currentUser} /> : <Home onNavigate={setActiveTab} />;
      
      // Admin Views
      case 'admin-students': return <AdminStudents students={students} onUpdateStudent={() => {}} onAddStudent={() => {}} onDeleteStudent={() => {}} />;
      // Pass updaters to admin views
      case 'admin-content': return <AdminContent modules={modules} onUpdateModules={setModules} prompts={prompts} onUpdatePrompts={setPrompts} styles={styles} onUpdateStyles={setStyles} roadmaps={roadmaps} onUpdateRoadmaps={setRoadmaps} />;
      case 'admin-calls': return <AdminCalls />;
      case 'admin-assistant': return <AdminAssistant />;
      case 'admin-settings': return <AdminSettings invites={invites} onGenerateInvites={() => {}} onDeleteInvite={() => {}} onDeactivateInvite={() => {}} />;

      default: return mode === 'admin' ? <AdminStudents students={students} onUpdateStudent={() => {}} onAddStudent={() => {}} onDeleteStudent={() => {}} /> : <Home onNavigate={setActiveTab} />;
    }
  };

  return (
    <div className={`min-h-[100dvh] bg-slate-50 dark:bg-zinc-950 text-zinc-900 dark:text-zinc-100 font-sans overflow-hidden selection:bg-violet-500/30 selection:text-violet-900 dark:selection:text-white transition-colors duration-300 ${mode === 'admin' ? 'admin-mode' : ''}`}>
      <div className="fixed inset-0 z-0 pointer-events-none overflow-hidden gpu-accelerated">
          {mode === 'student' ? (
              <>
                <div className="absolute top-[-10%] left-[-10%] w-[40%] h-[40%] bg-violet-600/10 dark:bg-violet-900/10 rounded-full blur-[120px] animate-blob" />
                <div className="absolute bottom-[10%] right-[0%] w-[30%] h-[30%] bg-fuchsia-600/10 dark:bg-fuchsia-900/10 rounded-full blur-[100px] animate-blob animation-delay-2000" />
              </>
          ) : (
              <>
                 <div className="absolute top-0 right-0 w-[50%] h-[50%] bg-emerald-900/5 rounded-full blur-[150px] animate-blob" />
                 <div className="absolute bottom-0 left-0 w-[40%] h-[40%] bg-zinc-500/5 rounded-full blur-[120px] animate-blob animation-delay-2000" />
              </>
          )}
      </div>

      <Sidebar activeTab={activeTab} setActiveTab={setActiveTab} isOpen={isSidebarOpen} setIsOpen={setIsSidebarOpen} theme={theme} toggleTheme={toggleTheme} mode={mode} setMode={setMode} />

      <main className="md:pl-72 min-h-[100dvh] flex flex-col relative z-10">
        <header className="md:hidden h-auto py-4 flex items-center justify-between px-6 bg-white/80 dark:bg-zinc-950/80 backdrop-blur-xl sticky top-0 z-30 border-b border-zinc-200 dark:border-white/5 transition-colors duration-300">
          <div className="flex items-center gap-3">
             {mode === 'student' ? (
                 <img src="https://i.imgur.com/f3UfhpM.png" alt="VIBES Logo" className="h-10 w-auto object-contain dark:brightness-0 dark:invert" />
             ) : (
                 <span className="font-bold text-lg">ADMIN</span>
             )}
          </div>
          <button onClick={() => setIsSidebarOpen(true)} className="p-2 text-zinc-500 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-white transition-colors">
            <Menu size={24} />
          </button>
        </header>

        <div className="hidden md:flex justify-end items-center px-8 py-6 w-full max-w-[1600px] mx-auto">
            <div className="flex items-center gap-4">
                <div className="flex flex-col items-end">
                    <span className="text-sm font-bold text-zinc-900 dark:text-white">{currentUser?.name}</span>
                    <button onClick={handleLogout} className="text-xs text-zinc-400 hover:text-red-500 transition-colors">Выйти</button>
                </div>
                <button onClick={() => setActiveTab('profile')} className={`w-10 h-10 rounded-full p-0.5 transition-transform hover:scale-105 ${mode === 'admin' ? 'bg-gradient-to-tr from-emerald-500 to-cyan-500' : 'bg-gradient-to-tr from-violet-500 to-fuchsia-500'}`}>
                    {currentUser?.avatar && !currentUser.avatar.includes('ui-avatars') ? (
                        <img src={currentUser.avatar} alt="Profile" className="w-full h-full rounded-full object-cover border-2 border-white dark:border-zinc-900" />
                    ) : (
                        <div className="w-full h-full rounded-full bg-white dark:bg-zinc-900 flex items-center justify-center font-bold text-violet-600">{currentUser?.name?.[0]}</div>
                    )}
                </button>
            </div>
        </div>

        <div className="flex-1 w-full max-w-[1600px] mx-auto pt-0">
           <AnimatePresence mode="wait">
            <motion.div
              key={activeTab}
              initial={{ opacity: 0, y: 15, scale: 0.99 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: -15, scale: 0.99 }}
              transition={{ duration: 0.25, ease: "easeOut" }}
              className="h-full"
            >
              {renderContent()}
            </motion.div>
          </AnimatePresence>
        </div>
      </main>
    </div>
  );
};

const App: React.FC = () => {
  return (
    <SoundProvider>
      <AppContent />
    </SoundProvider>
  );
}

export default App;
