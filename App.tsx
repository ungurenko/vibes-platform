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
import Practice from './views/Practice';
import AdminStudents from './views/AdminStudents';
import AdminContent from './views/AdminContent';
import AdminCalls from './views/AdminCalls';
import AdminAssistant from './views/AdminAssistant';
import AdminSettings from './views/AdminSettings';
import UserProfile from './views/UserProfile';
import Login from './views/Login';
import Register from './views/Register';
import Onboarding from './views/Onboarding';
import { TabId, InviteLink, Student, CourseModule, PromptItem, PromptCategoryItem, Roadmap, StyleCard, GlossaryTerm, DashboardStage, PracticeActivity, PracticeProgress, PracticeStreak, QuizQuestion, Flashcard, FindErrorQuestion } from './types';
import { STUDENTS_DATA, COURSE_MODULES, PROMPTS_DATA, PROMPT_CATEGORIES_DATA, ROADMAPS_DATA, STYLES_DATA, GLOSSARY_DATA, DASHBOARD_STAGES, PRACTICE_ACTIVITIES_DATA, QUIZ_WEB_BASICS_DATA, QUIZ_VIBE_TOOLS_DATA, FLASHCARDS_TERMS_DATA, FIND_ERROR_DATA } from './data';
import { motion, AnimatePresence } from 'framer-motion';
import { SoundProvider } from './SoundContext';
import {
    supabase,
    isSupabaseReady,
    fetchAppContent,
    checkInvite,
    useInvite,
    fetchUserProgress,
    toggleLessonComplete,
    completeOnboardingDB,
    fetchAllStudents,
    fetchAllInvites,
    createInviteDB,
    deleteInviteDB,
    updateStudentDB,
    deleteStudentDB,
    deactivateInviteDB
} from './lib/supabase';

const AppContent: React.FC = () => {
  // --- Auth & Routing State ---
  const [session, setSession] = useState<any>(null);
  const [profile, setProfile] = useState<any>(null);
  const [inviteCodeFromUrl, setInviteCodeFromUrl] = useState<string | null>(null);
  const [view, setView] = useState<'login' | 'register' | 'app' | 'reset-password' | 'onboarding'>('login');
  const [isAuthLoading, setIsAuthLoading] = useState(true);
  const [authError, setAuthError] = useState<string | null>(null);

  // --- App Data State ---
  const [students, setStudents] = useState<Student[]>([]);
  const [invites, setInvites] = useState<InviteLink[]>([]);
  const [completedLessons, setCompletedLessons] = useState<string[]>([]);
  
  // Dynamic Content
  const [modules, setModules] = useState<CourseModule[]>(COURSE_MODULES);
  const [prompts, setPrompts] = useState<PromptItem[]>(PROMPTS_DATA);
  const [promptCategories, setPromptCategories] = useState<PromptCategoryItem[]>(PROMPT_CATEGORIES_DATA);
  const [roadmaps, setRoadmaps] = useState<Roadmap[]>(ROADMAPS_DATA);
  const [styles, setStyles] = useState<StyleCard[]>(STYLES_DATA);
  const [glossary, setGlossary] = useState<GlossaryTerm[]>(GLOSSARY_DATA);
  const [stages, setStages] = useState<DashboardStage[]>(DASHBOARD_STAGES);

  // --- UI State ---
  const [activeTab, setActiveTab] = useState<TabId>('dashboard');
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [theme, setTheme] = useState<'dark' | 'light'>('light');
  const [mode, setMode] = useState<'student' | 'admin'>('student');
  
  const [assistantInitialMessage, setAssistantInitialMessage] = useState<string | null>(null);

  // --- Derived State ---
  const totalLessons = useMemo(() => {
      return modules.reduce((acc, m) => acc + m.lessons.length, 0);
  }, [modules]);

  const currentUser = useMemo(() => {
      if (!profile) return null;
      return {
          id: profile.id,
          name: profile.full_name || 'Студент',
          email: profile.email,
          avatar: profile.avatar_url || `https://ui-avatars.com/api/?name=${profile.full_name}&background=8b5cf6&color=fff`,
          status: 'active',
          progress: totalLessons > 0 ? Math.round((completedLessons.length / totalLessons) * 100) : 0,
          currentModule: 'Модуль 1',
          lastActive: 'Только что',
          joinedDate: profile.created_at,
          projects: {},
      } as Student;
  }, [profile, completedLessons, totalLessons]);

  // --- Effects ---

  useEffect(() => {
    // 1. Initialize Theme
    try {
        const savedTheme = localStorage.getItem('theme') as 'dark' | 'light' | null;
        if (savedTheme) setTheme(savedTheme);
    } catch (e) {
        console.warn("Theme storage access failed");
    }

    // 2. Check Invite from URL
    const params = new URLSearchParams(window.location.search);
    const inviteParam = params.get('invite');
    if (inviteParam) {
        setInviteCodeFromUrl(inviteParam);
        setView('register');
    }

    // 3. Supabase Auth Session
    supabase.auth.getSession().then(async ({ data: { session } }) => {
      setSession(session);
      if (session) {
          await fetchProfile(session.user.id);
          await loadUserProgress(session.user.id);
      }
      setIsAuthLoading(false);
    }).catch((error) => {
      console.error('Auth session error:', error);
      setAuthError('Не удалось подключиться к серверу');
      setIsAuthLoading(false);
    });

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session);
      if (session) {
          fetchProfile(session.user.id);
          loadUserProgress(session.user.id);
          setView('app');
      } else {
          setProfile(null);
          setCompletedLessons([]);
          if (!inviteParam) setView('login');
      }
    });

    // 4. Fetch Dynamic Content
    loadContent();

    return () => subscription.unsubscribe();
  }, []);

  const loadContent = async () => {
      const [dbModules, dbPrompts, dbPromptCategories, dbRoadmaps, dbStyles, dbGlossary, dbStages] = await Promise.all([
          fetchAppContent('modules'),
          fetchAppContent('prompts'),
          fetchAppContent('promptCategories'),
          fetchAppContent('roadmaps'),
          fetchAppContent('styles'),
          fetchAppContent('glossary'),
          fetchAppContent('stages')
      ]);

      if (dbModules) setModules(dbModules);
      if (dbPrompts) setPrompts(dbPrompts);
      if (dbPromptCategories) setPromptCategories(dbPromptCategories);
      if (dbRoadmaps) setRoadmaps(dbRoadmaps);
      if (dbStyles) setStyles(dbStyles);
      if (dbGlossary) setGlossary(dbGlossary);
      if (dbStages) setStages(dbStages);
  };

  const loadUserProgress = async (userId: string) => {
      const progress = await fetchUserProgress(userId);
      setCompletedLessons(progress);
  };

  const fetchProfile = async (userId: string) => {
      try {
          const { data, error } = await supabase
              .from('profiles')
              .select('*')
              .eq('id', userId)
              .single();

          if (error) {
              console.error('Ошибка загрузки профиля:', error);
              setAuthError('Не удалось загрузить профиль. Попробуйте обновить страницу.');
              return;
          }

          if (data) {
              if (data.is_banned) {
                  await supabase.auth.signOut();
                  setSession(null);
                  setProfile(null);
                  alert("Ваш аккаунт заблокирован администратором.");
                  setView('login');
                  return;
              }

              setProfile(data);
              if (data.is_admin) {
                  setMode('admin');
                  loadAdminData(); // Load students if admin
              } else {
                  setMode('student');
                  if (!data.has_onboarded) setView('onboarding');
              }
          }
      } catch (e) {
          console.error('Критическая ошибка при загрузке профиля:', e);
          setAuthError('Произошла ошибка. Попробуйте обновить страницу.');
      }
  };

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

  useEffect(() => {
    const root = window.document.documentElement;
    if (theme === 'dark') root.classList.add('dark');
    else root.classList.remove('dark');
    try {
        localStorage.setItem('theme', theme);
    } catch (e) {}
  }, [theme]);

  // --- Actions ---

  const handleToggleLesson = async (lessonId: string) => {
      if (!currentUser) return;
      
      const isComplete = !completedLessons.includes(lessonId);
      
      // Optimistic Update
      setCompletedLessons(prev => 
          isComplete ? [...prev, lessonId] : prev.filter(id => id !== lessonId)
      );

      try {
          await toggleLessonComplete(currentUser.id, lessonId, isComplete);
      } catch (e) {
          console.error("Failed to save progress", e);
          // Revert on error
          setCompletedLessons(prev => 
             !isComplete ? [...prev, lessonId] : prev.filter(id => id !== lessonId)
          );
      }
  };

  const handleLogin = async (email: string, password: string) => {
      // Check if Supabase is actually configured
      const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
      if (!supabaseUrl || supabaseUrl.includes('placeholder')) {
          const msg = "Ошибка конфигурации: Не заданы переменные окружения VITE_SUPABASE_URL / VITE_SUPABASE_ANON_KEY на Vercel.";
          alert(msg);
          throw new Error(msg);
      }

      try {
          const { error } = await supabase.auth.signInWithPassword({ email, password });
          if (error) throw error;
      } catch (e: any) {
          const isQuotaError = e.name === 'QuotaExceededError' || 
                               e.name === 'NS_ERROR_DOM_QUOTA_REACHED' ||
                               e.message?.toLowerCase().includes('quota') ||
                               e.message?.toLowerCase().includes('exceeded');

          if (isQuotaError) {
              console.warn("Storage quota exceeded. Attempting aggressive cleanup...");
              
              try {
                  const theme = localStorage.getItem('theme');
                  localStorage.clear();
                  if (theme) localStorage.setItem('theme', theme);
                  
                  const { error: retryError } = await supabase.auth.signInWithPassword({ email, password });
                  if (retryError) throw retryError;
                  
              } catch (retryE: any) {
                   const msg = "Не удалось войти из-за ограничений памяти браузера (Инкогнито или диск заполнен).";
                   alert(msg);
                   throw new Error(msg);
              }
          } else {
              // Check if Safari is blocking cross-site requests
              const isSafari = /^((?!chrome|android).)*safari/i.test(navigator.userAgent);
              const isNetworkError = e.name === 'AuthRetryableFetchError' ||
                                     e.message?.toLowerCase().includes('load failed') ||
                                     e.message?.toLowerCase().includes('network');

              if (isSafari && isNetworkError) {
                  alert("Safari блокирует подключение к серверу авторизации.\n\nРешение: Safari → Настройки → Конфиденциальность → отключите «Предотвращать перекрёстное отслеживание»\n\nИли используйте Chrome/Firefox.");
              } else {
                  alert(e.message || "Ошибка входа");
              }
              throw e; // Important: re-throw for the Login component diagnostics
          }
      }
  };

  const handleRegister = async (data: { name: string; email: string; avatar?: string; password?: string }) => {
      // Валидация пароля
      if (!data.password || data.password.length < 8) {
          alert('Пароль должен содержать минимум 8 символов');
          return;
      }

      const { data: authData, error } = await supabase.auth.signUp({
          email: data.email,
          password: data.password,
          options: {
              data: {
                  full_name: data.name,
                  avatar_url: data.avatar
              }
          }
      });

      if (error) {
          alert(error.message);
      } else {
          if (inviteCodeFromUrl) {
              await useInvite(inviteCodeFromUrl, data.email);
          }
          window.history.replaceState({}, '', window.location.pathname);
          // Onboarding will be triggered by profile fetch effect
      }
  };

  const handleLogout = async () => {
      await supabase.auth.signOut();
      setView('login');
  };

  const completeOnboarding = async () => {
      if (currentUser) {
          await completeOnboardingDB(currentUser.id);
          fetchProfile(currentUser.id); // Refresh profile to get updated status
      }
      setView('app');
  };

  const validateInvite = async (code: string): Promise<InviteLink | null> => {
      const inviteData = await checkInvite(code);
      if (!inviteData) return null;
      return {
          id: inviteData.id,
          token: inviteData.token,
          status: inviteData.status,
          created: inviteData.created_at,
          expiresAt: inviteData.expires_at
      };
  };

  // Генерация криптографически безопасного токена
  const generateSecureToken = (): string => {
      const array = new Uint8Array(16);
      crypto.getRandomValues(array);
      return 'vibes-' + Array.from(array, b => b.toString(16).padStart(2, '0')).join('');
  };

  const handleGenerateInvites = async (count: number, daysValid: number | null = null) => {
      try {
          for (let i = 0; i < count; i++) {
              const token = generateSecureToken();
              const expiresAt = daysValid
                  ? new Date(Date.now() + daysValid * 24 * 60 * 60 * 1000).toISOString()
                  : undefined;
              await createInviteDB(token, expiresAt);
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

  const handleDeactivateInvite = async (id: string) => {
      try {
          await deactivateInviteDB(id);
          setInvites(prev => prev.map(inv =>
              inv.id === id ? { ...inv, status: 'deactivated' as const } : inv
          ));
      } catch (e) {
          alert("Ошибка при деактивации инвайта");
      }
  };

  const handleUpdateStudent = async (student: Student) => {
      try {
          await updateStudentDB(student.id, { name: student.name, email: student.email });
          setStudents(prev => prev.map(s => s.id === student.id ? student : s));
      } catch (e) {
          alert("Ошибка при обновлении данных студента");
      }
  };

  const handleAddStudent = async (_student: Student) => {
      // Добавление студентов происходит через инвайт-систему
      // Эта функция оставлена для совместимости с интерфейсом
      alert("Для добавления студента создайте инвайт-ссылку в разделе 'Настройки'");
  };

  const handleDeleteStudent = async (id: string) => {
      try {
          await deleteStudentDB(id);
          setStudents(prev => prev.filter(s => s.id !== id));
      } catch (e) {
          alert("Ошибка при удалении студента");
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

  // Timeout для загрузки авторизации (10 секунд)
  useEffect(() => {
      if (!isAuthLoading) return;

      const timeout = setTimeout(() => {
          if (isAuthLoading) {
              console.error('Auth loading timeout');
              setAuthError('Превышено время ожидания. Проверьте подключение к интернету.');
              setIsAuthLoading(false);
          }
      }, 10000);

      return () => clearTimeout(timeout);
  }, [isAuthLoading]);

  // Проверка конфигурации Supabase
  if (!isSupabaseReady) {
      return (
          <div className="min-h-screen bg-zinc-950 flex items-center justify-center">
              <div className="text-center p-8 max-w-md">
                  <div className="text-yellow-500 text-5xl mb-4">⚙️</div>
                  <h2 className="text-white text-xl font-bold mb-2">Ошибка конфигурации</h2>
                  <p className="text-zinc-400 mb-4">Не заданы переменные окружения VITE_SUPABASE_URL / VITE_SUPABASE_ANON_KEY.</p>
                  <p className="text-zinc-500 text-sm">Создайте файл .env в корне проекта с вашими Supabase креденшиалами.</p>
              </div>
          </div>
      );
  }

  if (isAuthLoading) {
      return <div className="min-h-screen bg-zinc-950 flex items-center justify-center">
          <div className="w-8 h-8 border-4 border-violet-500 border-t-transparent rounded-full animate-spin"></div>
      </div>;
  }

  if (authError) {
      return (
          <div className="min-h-screen bg-zinc-950 flex items-center justify-center">
              <div className="text-center p-8 max-w-md">
                  <div className="text-red-500 text-5xl mb-4">⚠️</div>
                  <h2 className="text-white text-xl font-bold mb-2">Ошибка подключения</h2>
                  <p className="text-zinc-400 mb-6">{authError}</p>
                  <button
                      onClick={() => window.location.reload()}
                      className="px-6 py-3 bg-violet-600 text-white rounded-xl hover:bg-violet-500 font-bold"
                  >
                      Обновить страницу
                  </button>
              </div>
          </div>
      );
  }

  if (view === 'login' && !session) return <Login onLogin={handleLogin} onNavigateToRegister={() => setView('register')} onSimulateResetLink={() => setView('reset-password')} />;
  if (view === 'reset-password') return <Login onLogin={handleLogin} onNavigateToRegister={() => setView('register')} initialView="reset" onSimulateResetLink={() => {}} onResetComplete={() => setView('login')} />;
  if (view === 'register' && inviteCodeFromUrl && !session) return <Register inviteCode={inviteCodeFromUrl} validateInvite={validateInvite} onRegister={(d) => handleRegister({...d, password: (d as any).password})} onNavigateLogin={() => { window.history.replaceState({}, '', window.location.pathname); setView('login'); }} />;
  if (view === 'onboarding' && session) return <Onboarding userName={profile?.full_name || ''} onComplete={completeOnboarding} />;

  const renderContent = () => {
    if (!session) return <Login onLogin={handleLogin} onNavigateToRegister={() => setView('register')} onSimulateResetLink={() => setView('reset-password')} />;

    switch (activeTab) {
      case 'dashboard': return <Home stages={stages} onNavigate={setActiveTab} />;
      case 'lessons': return <Lessons modules={modules} completedLessons={completedLessons} onToggleLesson={handleToggleLesson} />;
      case 'roadmaps': return <Roadmaps roadmaps={roadmaps} />;
      case 'practice': return <Practice currentUserId={currentUser?.id} />;
      case 'styles': return <StyleLibrary styles={styles} />;
      case 'prompts': return <PromptBase prompts={prompts} categories={promptCategories} />;
      case 'glossary': return <Glossary glossary={glossary} onNavigate={setActiveTab} onAskAI={handleAskAI} />;
      case 'assistant': return <Assistant initialMessage={assistantInitialMessage} onMessageHandled={() => setAssistantInitialMessage(null)} />;
      case 'profile': return currentUser ? <UserProfile user={currentUser} /> : <Home stages={stages} onNavigate={setActiveTab} />;
      
      // Admin Views
      case 'admin-students': return <AdminStudents students={students} onUpdateStudent={handleUpdateStudent} onAddStudent={handleAddStudent} onDeleteStudent={handleDeleteStudent} />;
      case 'admin-content': return <AdminContent modules={modules} onUpdateModules={setModules} prompts={prompts} onUpdatePrompts={setPrompts} promptCategories={promptCategories} onUpdatePromptCategories={setPromptCategories} styles={styles} onUpdateStyles={setStyles} roadmaps={roadmaps} onUpdateRoadmaps={setRoadmaps} glossary={glossary} onUpdateGlossary={setGlossary} stages={stages} onUpdateStages={setStages} />;
      case 'admin-calls': return <AdminCalls />;
      case 'admin-assistant': return <AdminAssistant />;
      case 'admin-settings': return <AdminSettings invites={invites} onGenerateInvites={handleGenerateInvites} onDeleteInvite={handleDeleteInvite} onDeactivateInvite={handleDeactivateInvite} />;

      default: return mode === 'admin' ? <AdminStudents students={students} onUpdateStudent={handleUpdateStudent} onAddStudent={handleAddStudent} onDeleteStudent={handleDeleteStudent} /> : <Home stages={stages} onNavigate={setActiveTab} />;
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

      <main className="md:pl-72 min-h-[100dvh] flex flex-col relative">
        <header className="md:hidden h-auto pt-[max(1rem,env(safe-area-inset-top))] pb-4 flex items-center justify-between px-6 bg-white/80 dark:bg-zinc-950/80 backdrop-blur-xl sticky top-0 z-30 border-b border-zinc-200 dark:border-white/5 transition-colors duration-300">
          <div className="flex items-center gap-3">
             {mode === 'student' ? (
                 <img src="https://i.imgur.com/f3UfhpM.png" alt="ВАЙБС Logo" className="h-10 w-auto object-contain dark:brightness-0 dark:invert" />
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

        <div className="flex-1 w-full max-w-[1600px] mx-auto pt-0 pb-[env(safe-area-inset-bottom)]">
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