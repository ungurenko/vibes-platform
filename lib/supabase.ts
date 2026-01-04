
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL || '';
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY || '';

// Basic validation to prevent "Network connection lost" errors due to invalid URLs
const isValidUrl = (url: string) => {
    try {
        new URL(url);
        return true;
    } catch {
        return false;
    }
};

const isSupabaseConfigured = supabaseUrl && supabaseAnonKey && isValidUrl(supabaseUrl);

if (!isSupabaseConfigured) {
  console.error('❌ Supabase configuration is invalid or missing!');
  console.info('Check your Environment Variables: VITE_SUPABASE_URL, VITE_SUPABASE_ANON_KEY');
}

// Keys that are critical for auth - never delete these
const PROTECTED_KEYS = ['sb-', 'supabase.auth'];

const cleanupStorage = () => {
    const keysToRemove: string[] = [];
    for (let i = 0; i < localStorage.length; i++) {
        const k = localStorage.key(i);
        if (k && !PROTECTED_KEYS.some(pk => k.includes(pk))) {
            // Remove non-critical keys (chat history, theme, etc.)
            keysToRemove.push(k);
        }
    }
    keysToRemove.forEach(k => localStorage.removeItem(k));
    console.log(`Cleared ${keysToRemove.length} items from localStorage to free space`);
};

const customStorage = {
    getItem: (key: string): Promise<string | null> => {
        try {
            const value = localStorage.getItem(key);
            return Promise.resolve(value);
        } catch {
            return Promise.resolve(null);
        }
    },
    setItem: (key: string, value: string): Promise<void> => {
        try {
            localStorage.setItem(key, value);
        } catch (e: any) {
            // If it's a quota error, aggressively clear non-auth data
            if (e.name === 'QuotaExceededError' || e.message?.includes('quota')) {
                cleanupStorage();

                // Try again after cleanup
                try {
                    localStorage.setItem(key, value);
                } catch {
                    console.error("Storage still full after cleanup - auth may fail");
                }
            }
        }
        return Promise.resolve();
    },
    removeItem: (key: string): Promise<void> => {
        try {
            localStorage.removeItem(key);
        } catch {}
        return Promise.resolve();
    }
};

// Экспортируем флаг для проверки в приложении
export const isSupabaseReady = isSupabaseConfigured;

// Export cleanup function for manual use
export { cleanupStorage };

export const supabase = createClient(
    supabaseUrl || 'https://example.supabase.co',
    supabaseAnonKey || 'placeholder',
    {
        auth: {
            persistSession: true,
            autoRefreshToken: true,
            detectSessionInUrl: true,
            storage: customStorage
        }
    }
);

// --- Content Helpers ---

// Simple in-memory cache for app content
interface CacheEntry<T> {
    data: T;
    timestamp: number;
}

const contentCache = new Map<string, CacheEntry<unknown>>();
const CACHE_TTL = 5 * 60 * 1000; // 5 minutes cache TTL

export const fetchAppContent = async (key: string, bypassCache = false) => {
    // Check cache first
    if (!bypassCache) {
        const cached = contentCache.get(key);
        if (cached && Date.now() - cached.timestamp < CACHE_TTL) {
            return cached.data;
        }
    }

    const { data, error } = await supabase
        .from('app_content')
        .select('data')
        .eq('key', key)
        .single();

    if (error && error.code !== 'PGRST116') { // PGRST116 is "not found"
        console.error(`Error fetching ${key}:`, error);
        return null;
    }

    const result = data?.data || null;

    // Update cache
    if (result !== null) {
        contentCache.set(key, { data: result, timestamp: Date.now() });
    }

    return result;
};

// Clear specific cache entry (call after updates)
export const invalidateContentCache = (key: string) => {
    contentCache.delete(key);
};

// Clear all cache entries
export const clearContentCache = () => {
    contentCache.clear();
};

export const updateAppContent = async (key: string, content: unknown) => {
    // Check if exists
    const { data } = await supabase.from('app_content').select('key').eq('key', key).single();

    if (data) {
        const { error } = await supabase
            .from('app_content')
            .update({ data: content, updated_at: new Date().toISOString() })
            .eq('key', key);
        if (error) throw error;
    } else {
        const { error } = await supabase
            .from('app_content')
            .insert([{ key, data: content }]);
        if (error) throw error;
    }

    // Invalidate cache after update
    invalidateContentCache(key);
};

// --- Invite Helpers ---

export const checkInvite = async (token: string) => {
    const { data, error } = await supabase
        .from('invites')
        .select('*')
        .eq('token', token)
        .single();
    
    if (error || !data) return null;
    
    // Check if expired
    if (data.expires_at && new Date(data.expires_at) < new Date()) return null;
    
    // Check if active
    if (data.status !== 'active') return null;

    return data;
};

export const useInvite = async (token: string, email: string) => {
    const { error } = await supabase
        .from('invites')
        .update({ 
            status: 'used', 
            used_by_email: email, 
            used_at: new Date().toISOString() 
        })
        .eq('token', token);
    
    if (error) console.error('Error using invite:', error);
};

// --- Invite Management (Admin) ---

export const fetchAllInvites = async () => {
    const { data, error } = await supabase
        .from('invites')
        .select('*')
        .order('created_at', { ascending: false });
    
    if (error) throw error;
    return data.map(inv => ({
        id: inv.id,
        token: inv.token,
        status: inv.status,
        created: inv.created_at,
        expiresAt: inv.expires_at,
        usedBy: inv.used_by_email,
        usedAt: inv.used_at
    }));
};

export const createInviteDB = async (token: string, expiresAt?: string) => {
    const { data, error } = await supabase
        .from('invites')
        .insert([{ 
            token, 
            status: 'active', 
            expires_at: expiresAt || null 
        }])
        .select()
        .single();
    
    if (error) throw error;
    return data;
};

export const deleteInviteDB = async (id: string) => {
    const { error } = await supabase
        .from('invites')
        .delete()
        .eq('id', id);
    
    if (error) throw error;
};
export const fetchUserProgress = async (userId: string) => {
    const { data, error } = await supabase
        .from('user_progress')
        .select('lesson_id')
        .eq('user_id', userId);
    
    if (error) {
        console.error('Error fetching progress:', error);
        return [];
    }
    return data.map(p => p.lesson_id);
};

export const toggleLessonComplete = async (userId: string, lessonId: string, isComplete: boolean) => {
    if (isComplete) {
        const { error } = await supabase
            .from('user_progress')
            .insert([{ user_id: userId, lesson_id: lessonId }]);
        if (error && error.code !== '23505') throw error; // Ignore duplicate error
    } else {
        const { error } = await supabase
            .from('user_progress')
            .delete()
            .eq('user_id', userId)
            .eq('lesson_id', lessonId);
        if (error) throw error;
    }
};

export const completeOnboardingDB = async (userId: string) => {
    const { error } = await supabase
        .from('profiles')
        .update({ has_onboarded: true })
        .eq('id', userId);
    if (error) console.error('Error updating onboarding:', error);
};

// --- Admin Helpers ---

export const fetchAllStudents = async () => {
    // Execute both queries in parallel for better performance
    const [profilesResult, progressResult] = await Promise.all([
        supabase
            .from('profiles')
            .select('id, email, full_name, avatar_url, is_admin, is_banned, has_onboarded, created_at')
            .order('created_at', { ascending: false }),
        supabase
            .from('user_progress')
            .select('user_id')
    ]);

    if (profilesResult.error) throw profilesResult.error;
    if (progressResult.error) throw progressResult.error;

    const profiles = profilesResult.data;
    const progress = progressResult.data;

    // Map counts
    const progressMap: Record<string, number> = {};
    progress?.forEach(p => {
        progressMap[p.user_id] = (progressMap[p.user_id] || 0) + 1;
    });

    return profiles.map(p => ({
        id: p.id,
        name: p.full_name || 'Студент',
        email: p.email,
        avatar: p.avatar_url || `https://ui-avatars.com/api/?name=${encodeURIComponent(p.full_name || 'User')}&background=8b5cf6&color=fff`,
        status: p.is_banned ? 'banned' : 'active',
        isBanned: p.is_banned,
        progress: progressMap[p.id] || 0,
        currentModule: 'Записанные уроки',
        lastActive: new Date(p.created_at).toLocaleDateString(),
        joinedDate: p.created_at,
        projects: {}
    }));
};

export const toggleUserBan = async (userId: string, isBanned: boolean) => {
    const { error } = await supabase
        .from('profiles')
        .update({ is_banned: isBanned })
        .eq('id', userId);
    
    if (error) throw error;
};

export const resetUserProgressDB = async (userId: string) => {
    const { error } = await supabase
        .from('user_progress')
        .delete()
        .eq('user_id', userId);
    
    if (error) throw error;
};

export const sendPasswordReset = async (email: string) => {
    const { error } = await supabase.auth.resetPasswordForEmail(email, {
        redirectTo: `${window.location.origin}/?view=reset-password`,
    });
    if (error) throw error;
};

export const updateStudentDB = async (studentId: string, data: { name?: string; email?: string }) => {
    const updateData: Record<string, any> = {};
    if (data.name) updateData.full_name = data.name;
    if (data.email) updateData.email = data.email;

    const { error } = await supabase
        .from('profiles')
        .update(updateData)
        .eq('id', studentId);

    if (error) throw error;
};

export const deleteStudentDB = async (studentId: string) => {
    // Сначала удаляем прогресс
    await supabase
        .from('user_progress')
        .delete()
        .eq('user_id', studentId);

    // Затем удаляем профиль (auth user останется, но профиль будет удален)
    const { error } = await supabase
        .from('profiles')
        .delete()
        .eq('id', studentId);

    if (error) throw error;
};

export const deactivateInviteDB = async (inviteId: string) => {
    const { error } = await supabase
        .from('invites')
        .update({ status: 'deactivated' })
        .eq('id', inviteId);

    if (error) throw error;
};

// --- Storage Helpers ---

export const uploadFile = async (file: File, path: string = 'uploads') => {
    console.log('📤 Uploading file:', file.name, 'size:', file.size, 'to:', path);

    const fileExt = file.name.split('.').pop();
    const fileName = `${Math.random().toString(36).substring(2)}_${Date.now()}.${fileExt}`;
    const filePath = `${path}/${fileName}`;

    try {
        const { error: uploadError, data } = await supabase.storage
            .from('course-content')
            .upload(filePath, file);

        if (uploadError) {
            console.error('❌ Upload error:', uploadError);
            throw new Error(uploadError.message || 'Ошибка загрузки файла');
        }

        console.log('✅ Upload success:', data);

        const { data: { publicUrl } } = supabase.storage
            .from('course-content')
            .getPublicUrl(filePath);

        console.log('🔗 Public URL:', publicUrl);
        return publicUrl;
    } catch (error: any) {
        console.error('❌ Upload failed:', error);
        throw new Error(error.message || 'Не удалось загрузить файл');
    }
};

// --- Calls Management ---

export const fetchAllCalls = async () => {
    const { data, error } = await supabase
        .from('calls')
        .select('*')
        .order('date', { ascending: false })
        .order('time', { ascending: false });

    if (error) throw error;

    return data.map(call => ({
        id: call.id,
        date: call.date,
        time: call.time,
        duration: call.duration,
        topic: call.topic,
        description: call.description,
        status: call.status,
        meetingUrl: call.meeting_url,
        recordingUrl: call.recording_url,
        materials: call.materials || [],
        attendeesCount: call.attendees_count || 0,
        reminders: call.reminders || []
    }));
};

export const createCall = async (callData: any) => {
    const { data, error } = await supabase
        .from('calls')
        .insert([{
            date: callData.date,
            time: callData.time,
            duration: callData.duration,
            topic: callData.topic,
            description: callData.description,
            status: callData.status,
            meeting_url: callData.meetingUrl,
            recording_url: callData.recordingUrl,
            materials: callData.materials || [],
            attendees_count: callData.attendeesCount || 0,
            reminders: callData.reminders || []
        }])
        .select()
        .single();

    if (error) throw error;

    return {
        id: data.id,
        date: data.date,
        time: data.time,
        duration: data.duration,
        topic: data.topic,
        description: data.description,
        status: data.status,
        meetingUrl: data.meeting_url,
        recordingUrl: data.recording_url,
        materials: data.materials || [],
        attendeesCount: data.attendees_count || 0,
        reminders: data.reminders || []
    };
};

export const updateCall = async (id: string, callData: any) => {
    const { data, error } = await supabase
        .from('calls')
        .update({
            date: callData.date,
            time: callData.time,
            duration: callData.duration,
            topic: callData.topic,
            description: callData.description,
            status: callData.status,
            meeting_url: callData.meetingUrl,
            recording_url: callData.recordingUrl,
            materials: callData.materials || [],
            attendees_count: callData.attendeesCount || 0,
            reminders: callData.reminders || []
        })
        .eq('id', id)
        .select()
        .single();

    if (error) throw error;

    return {
        id: data.id,
        date: data.date,
        time: data.time,
        duration: data.duration,
        topic: data.topic,
        description: data.description,
        status: data.status,
        meetingUrl: data.meeting_url,
        recordingUrl: data.recording_url,
        materials: data.materials || [],
        attendeesCount: data.attendees_count || 0,
        reminders: data.reminders || []
    };
};

export const deleteCall = async (id: string) => {
    const { error } = await supabase
        .from('calls')
        .delete()
        .eq('id', id);

    if (error) throw error;
};

// === PRACTICE HELPERS ===

export const fetchPracticeActivities = async () => {
    const { data, error } = await supabase
        .from('practice_activities')
        .select('*')
        .eq('is_published', true)
        .order('order_index');

    if (error) throw error;
    return data;
};

export const fetchQuizQuestions = async (activityId: string) => {
    const { data, error } = await supabase
        .from('quiz_questions')
        .select('*')
        .eq('activity_id', activityId)
        .order('order_index');

    if (error) throw error;
    return data;
};

export const fetchFlashcards = async (activityId: string) => {
    const { data, error } = await supabase
        .from('flashcards')
        .select('*')
        .eq('activity_id', activityId)
        .order('order_index');

    if (error) throw error;
    return data;
};

export const fetchPracticeProgress = async (userId: string) => {
    const { data, error } = await supabase
        .from('practice_progress')
        .select('*')
        .eq('user_id', userId);

    if (error) throw error;
    return data || [];
};

export const updatePracticeProgress = async (
    userId: string,
    activityId: string,
    status: string,
    score?: number
) => {
    const { error } = await supabase
        .from('practice_progress')
        .upsert({
            user_id: userId,
            activity_id: activityId,
            status,
            score,
            last_attempt_at: new Date().toISOString(),
            completed_at: status === 'completed' ? new Date().toISOString() : null
        }, { onConflict: 'user_id,activity_id' });

    if (error) throw error;
};

export const fetchFlashcardProgress = async (userId: string, activityId: string) => {
    const { data, error } = await supabase
        .from('flashcard_progress')
        .select('*, flashcards!inner(activity_id)')
        .eq('user_id', userId)
        .eq('flashcards.activity_id', activityId);

    if (error) throw error;
    return data || [];
};

export const updateFlashcardProgress = async (
    userId: string,
    flashcardId: string,
    status: 'learning' | 'known'
) => {
    const { error } = await supabase
        .from('flashcard_progress')
        .upsert({
            user_id: userId,
            flashcard_id: flashcardId,
            status,
            last_reviewed_at: new Date().toISOString()
        }, { onConflict: 'user_id,flashcard_id' });

    if (error) throw error;
};

export const fetchPracticeStreak = async (userId: string) => {
    const { data, error } = await supabase
        .from('practice_streaks')
        .select('*')
        .eq('user_id', userId)
        .single();

    if (error && error.code !== 'PGRST116') throw error;
    return data;
};

export const updatePracticeStreak = async (userId: string) => {
    const today = new Date().toISOString().split('T')[0];

    const { data: current } = await supabase
        .from('practice_streaks')
        .select('*')
        .eq('user_id', userId)
        .single();

    let newStreak = 1;
    let longestStreak = 1;

    if (current) {
        const lastDate = new Date(current.last_practice_date);
        const todayDate = new Date(today);
        const diffDays = Math.floor((todayDate.getTime() - lastDate.getTime()) / (1000 * 60 * 60 * 24));

        if (diffDays === 0) return current;
        else if (diffDays === 1) newStreak = current.current_streak + 1;

        longestStreak = Math.max(newStreak, current.longest_streak);
    }

    const { data, error } = await supabase
        .from('practice_streaks')
        .upsert({
            user_id: userId,
            current_streak: newStreak,
            last_practice_date: today,
            longest_streak: longestStreak
        }, { onConflict: 'user_id' })
        .select()
        .single();

    if (error) throw error;
    return data;
};
