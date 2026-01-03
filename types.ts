
import React from 'react';

export type TabId =
  | 'dashboard' | 'lessons' | 'roadmaps' | 'practice' | 'styles' | 'prompts' | 'glossary' | 'assistant' | 'profile'
  | 'admin-students' | 'admin-content' | 'admin-calls' | 'admin-assistant' | 'admin-settings';

export interface NavItem {
  id: TabId;
  label: string;
  icon: React.ElementType;
}

export type StyleCategory = 'Все' | 'Светлые' | 'Тёмные' | 'Яркие' | 'Минимализм';

export interface StyleCard {
  id: string;
  name: string;
  gradient: string; // Keeping for fallback/backgrounds
  image: string;    // New: for visual preview
  description: string;
  longDescription?: string; // New: for modal details
  prompt: string;
  tags: string[];   // New: characteristics
  category: StyleCategory; // New: for filtering
  // Admin specific
  usageCount?: number;
  status?: 'published' | 'draft' | 'archived';
}

export type GlossaryCategory = 'Все' | 'Базовые' | 'Код' | 'Инструменты' | 'API' | 'Ошибки' | 'Вайб-кодинг';

export interface GlossaryTerm {
  id: string;
  term: string;
  slang?: string;
  definition: string;
  category: GlossaryCategory;
}

export interface ChatMessage {
  id: string;
  role: 'user' | 'assistant';
  text: string;
  timestamp: Date;
}

export type LessonStatus = 'locked' | 'available' | 'completed' | 'current' | 'draft' | 'hidden';

export interface LessonMaterial {
  id: string;
  title: string;
  type: 'pdf' | 'link' | 'code' | 'figma';
  url: string;
}

export interface LessonTask {
  id: string;
  text: string;
  completed: boolean;
}

export interface Lesson {
  id: string;
  moduleId: string;
  title: string;
  description: string;
  duration: string;
  videoUrl?: string; // Placeholder for embed URL
  status: LessonStatus;
  materials: LessonMaterial[];
  tasks: LessonTask[];
  // Admin specific
  views?: number;
  completions?: number;
  order?: number;
}

export interface CourseModule {
  id: string;
  title: string;
  description: string;
  status: 'available' | 'locked' | 'completed';
  lessons: Lesson[];
}

// Dynamic prompt category type (stored in database)
export type PromptCategory = string;

export interface PromptCategoryItem {
  id: string;
  name: string;
  icon: string;
  color: string; // Tailwind color class prefix (e.g., 'violet', 'blue', 'pink')
  order: number;
}

export interface PromptStep {
  title: string;
  description?: string;
  content: string;
}

export interface PromptItem {
  id: string;
  title: string;
  description: string;
  content?: string; // Optional if using steps
  steps?: PromptStep[]; // New: Chain of prompts
  usage: string; // Instruction on how to use
  category: PromptCategory;
  tags: string[];
  // Admin specific
  copyCount?: number;
  status?: 'published' | 'draft';
}

export interface StageTask {
  id: string;
  title: string;
  completed: boolean;
}

export interface DashboardStage {
  id: number;
  title: string;
  subtitle: string;
  status: 'completed' | 'current' | 'locked';
  tasks: StageTask[];
}

// Roadmap Types
export type RoadmapCategory = 'Подготовка' | 'Лендинг' | 'Веб-сервис' | 'Полезное';

export interface RoadmapStep {
  id: string;
  title: string;
  description: string;
  linkUrl?: string;
  linkText?: string;
}

export interface Roadmap {
  id: string;
  title: string;
  description: string;
  category: RoadmapCategory;
  icon: string; // Emoji
  estimatedTime: string; // e.g., "15 мин"
  difficulty: 'Легко' | 'Средне' | 'Сложно';
  steps: RoadmapStep[];
}

// Admin Types
export interface StudentProjects {
  landing?: string; // URL or null
  service?: string; // URL or null
  github?: string;  // URL or null
}

export interface Student {
  id: string;
  name: string;
  avatar: string;
  email: string;
  status: 'active' | 'inactive' | 'completed' | 'stalled' | 'banned';
  isBanned?: boolean;
  progress: number;
  currentModule: string;
  lastActive: string; // ISO Date string or relative time for mocks
  joinedDate: string; // ISO Date string
  projects: StudentProjects;
  notes?: string;
}

export interface AdminStat {
  label: string;
  value: string;
  change: string;
  isPositive: boolean;
}

export interface ActivityLogItem {
  id: string;
  studentId: string;
  action: string;
  target: string;
  date: string;
  iconType: 'lesson' | 'project' | 'chat' | 'login';
}

export interface InviteLink {
  id: string;
  token: string;
  status: 'active' | 'used' | 'deactivated';
  created: string; // ISO Date
  expiresAt?: string | null; // ISO Date or null for infinite
  usedByEmail?: string;
  usedByName?: string;
  usedAt?: string; // ISO Date
}

// === PRACTICE TYPES ===

export type PracticeActivityType = 'quiz' | 'flashcard' | 'find-error';
export type PracticeActivityStatus = 'not_started' | 'in_progress' | 'completed';

export interface PracticeActivity {
  id: string;
  title: string;
  description: string;
  type: PracticeActivityType;
  icon: string;
  estimatedTime: string;
  totalItems: number;
  difficulty: 'Легко' | 'Средне' | 'Сложно';
  category: string;
}

export interface QuizOption {
  id: string;
  text: string;
  isCorrect: boolean;
}

export interface QuizQuestion {
  id: string;
  activityId: string;
  question: string;
  options: QuizOption[];
  explanation: string;
  order: number;
}

export interface Flashcard {
  id: string;
  activityId: string;
  term: string;
  definition: string;
  order: number;
}

export interface FindErrorQuestion {
  id: string;
  activityId: string;
  scenario: string;
  code?: string;
  options: QuizOption[];
  explanation: string;
  order: number;
}

export interface PracticeProgress {
  id?: string;
  user_id: string;
  activity_id: string;
  status: PracticeActivityStatus;
  score?: number;
  completed_at?: string;
  last_attempt_at?: string;
}

export interface FlashcardProgress {
  id?: string;
  user_id: string;
  flashcard_id: string;
  status: 'learning' | 'known';
  last_reviewed_at?: string;
}

export interface PracticeStreak {
  user_id: string;
  current_streak: number;
  last_practice_date: string;
  longest_streak: number;
}

// === AUTH & PROFILE TYPES ===

export interface UserProfileData {
  id: string;
  email: string;
  full_name: string | null;
  avatar_url: string | null;
  is_admin: boolean;
  is_banned: boolean;
  has_onboarded: boolean;
  created_at: string;
  updated_at?: string;
}

export interface SupabaseUser {
  id: string;
  email?: string;
  created_at: string;
}

export interface SupabaseSession {
  access_token: string;
  refresh_token: string;
  expires_in: number;
  expires_at?: number;
  token_type: string;
  user: SupabaseUser;
}

// === CALLS TYPES ===

export type CallStatus = 'scheduled' | 'live' | 'completed' | 'cancelled';

export interface CallMaterial {
  id: string;
  title: string;
  url: string;
  type: 'pdf' | 'link' | 'video';
}

export interface Call {
  id: string;
  date: string;
  time: string;
  duration: string;
  topic: string;
  description?: string;
  status: CallStatus;
  meetingUrl?: string;
  recordingUrl?: string;
  materials: CallMaterial[];
  attendeesCount: number;
  reminders: string[];
}
