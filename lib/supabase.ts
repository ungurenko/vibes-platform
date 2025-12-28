
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

if (!supabaseUrl || !supabaseAnonKey || !isValidUrl(supabaseUrl)) {
  console.error('❌ Supabase configuration is invalid or missing!');
  console.info('Check your Vercel Environment Variables: VITE_SUPABASE_URL, VITE_SUPABASE_ANON_KEY');
}

const customStorage = {
    getItem: (key: string) => {
        try {
            return localStorage.getItem(key);
        } catch {
            return null;
        }
    },
    setItem: (key: string, value: string) => {
        try {
            localStorage.setItem(key, value);
        } catch (e: any) {
            // If it's a quota error, we try to clear old chat history to make room
            if (e.name === 'QuotaExceededError' || e.message?.includes('quota')) {
                const keysToRemove = [];
                for (let i = 0; i < localStorage.length; i++) {
                    const k = localStorage.key(i);
                    if (k && (k.includes('chat_history') || k.includes('vibes_chat'))) {
                        keysToRemove.push(k);
                    }
                }
                keysToRemove.forEach(k => localStorage.removeItem(k));
                
                // Try again after cleanup
                try {
                    localStorage.setItem(key, value);
                } catch {
                    console.error("Storage still full after cleanup");
                }
            }
        }
    },
    removeItem: (key: string) => {
        try {
            localStorage.removeItem(key);
        } catch {}
    }
};

export const supabase = createClient(
    supabaseUrl || 'https://placeholder-if-missing.supabase.co', 
    supabaseAnonKey || 'placeholder-key',
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

export const fetchAppContent = async (key: string) => {
    const { data, error } = await supabase
        .from('app_content')
        .select('data')
        .eq('key', key)
        .single();
    
    if (error && error.code !== 'PGRST116') { // PGRST116 is "not found"
        console.error(`Error fetching ${key}:`, error);
        return null;
    }
    return data?.data || null;
};

export const updateAppContent = async (key: string, content: any) => {
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
    // Fetch profiles
    const { data: profiles, error: pError } = await supabase
        .from('profiles')
        .select('*')
        .order('created_at', { ascending: false });
    
    if (pError) throw pError;

    // Fetch progress counts
    const { data: progress, error: prError } = await supabase
        .from('user_progress')
        .select('user_id');
        
    if (prError) throw prError;

    // Map counts
    const progressMap: Record<string, number> = {};
    progress?.forEach(p => {
        progressMap[p.user_id] = (progressMap[p.user_id] || 0) + 1;
    });

    return profiles.map(p => ({
        id: p.id,
        name: p.full_name || 'Студент',
        email: p.email,
        avatar: p.avatar_url || `https://ui-avatars.com/api/?name=${p.full_name}&background=8b5cf6&color=fff`,
        status: p.is_banned ? 'banned' : 'active',
        isBanned: p.is_banned, // Explicit flag
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

// --- Storage Helpers ---

export const uploadFile = async (file: File, path: string = 'uploads') => {
    const fileExt = file.name.split('.').pop();
    const fileName = `${Math.random().toString(36).substring(2)}_${Date.now()}.${fileExt}`;
    const filePath = `${path}/${fileName}`;

    const { error: uploadError } = await supabase.storage
        .from('course-content')
        .upload(filePath, file);

    if (uploadError) throw uploadError;

    const { data: { publicUrl } } = supabase.storage
        .from('course-content')
        .getPublicUrl(filePath);

    return publicUrl;
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

// --- Dashboard Tasks Management ---

export const fetchUserTasks = async (userId: string) => {
    const { data, error } = await supabase
        .from('user_progress')
        .select('lesson_id')
        .eq('user_id', userId)
        .like('lesson_id', 'task:%');

    if (error) {
        console.error('Error fetching tasks:', error);
        return [];
    }
    // Remove "task:" prefix and return task IDs
    return data.map(p => p.lesson_id.replace('task:', ''));
};

export const toggleTaskComplete = async (userId: string, taskId: string, isComplete: boolean) => {
    const prefixedTaskId = `task:${taskId}`;

    if (isComplete) {
        const { error } = await supabase
            .from('user_progress')
            .insert([{ user_id: userId, lesson_id: prefixedTaskId }]);
        if (error && error.code !== '23505') throw error; // Ignore duplicate error
    } else {
        const { error} = await supabase
            .from('user_progress')
            .delete()
            .eq('user_id', userId)
            .eq('lesson_id', prefixedTaskId);
        if (error) throw error;
    }
};

// --- Dashboard Tasks Management (NEW - with database tables) ---

export const fetchAllDashboardTasks = async (weekNumber?: number) => {
    let query = supabase
        .from('dashboard_tasks')
        .select('*')
        .order('order', { ascending: true });

    if (weekNumber) {
        query = query.eq('week_number', weekNumber);
    }

    const { data, error } = await query;

    if (error) throw error;
    return data || [];
};

export const createDashboardTask = async (taskData: {
    week_number: number;
    title: string;
    link?: string;
    order?: number;
}) => {
    const { data, error } = await supabase
        .from('dashboard_tasks')
        .insert([taskData])
        .select()
        .single();

    if (error) throw error;
    return data;
};

export const updateDashboardTask = async (id: string, taskData: {
    week_number?: number;
    title?: string;
    link?: string;
    order?: number;
}) => {
    const { data, error } = await supabase
        .from('dashboard_tasks')
        .update(taskData)
        .eq('id', id)
        .select()
        .single();

    if (error) throw error;
    return data;
};

export const deleteDashboardTask = async (id: string) => {
    const { error } = await supabase
        .from('dashboard_tasks')
        .delete()
        .eq('id', id);

    if (error) throw error;
};

export const reorderDashboardTasks = async (tasks: { id: string; order: number }[]) => {
    const updates = tasks.map(task =>
        supabase
            .from('dashboard_tasks')
            .update({ order: task.order })
            .eq('id', task.id)
    );

    await Promise.all(updates);
};

// --- User Dashboard Tasks Progress ---

export const fetchUserDashboardProgress = async (userId: string, weekNumber?: number) => {
    let query = supabase
        .from('user_dashboard_tasks')
        .select(`
            *,
            task:dashboard_tasks(*)
        `)
        .eq('user_id', userId);

    const { data, error } = await query;

    if (error) throw error;

    // Filter by week if specified
    if (weekNumber && data) {
        return data.filter((item: any) => item.task?.week_number === weekNumber);
    }

    return data || [];
};

export const toggleDashboardTaskComplete = async (
    userId: string,
    taskId: string,
    isComplete: boolean
) => {
    if (isComplete) {
        // Mark as complete
        const { error } = await supabase
            .from('user_dashboard_tasks')
            .upsert([
                {
                    user_id: userId,
                    task_id: taskId,
                    completed: true,
                    completed_at: new Date().toISOString()
                }
            ], {
                onConflict: 'user_id,task_id'
            });

        if (error) throw error;
    } else {
        // Mark as incomplete
        const { error } = await supabase
            .from('user_dashboard_tasks')
            .upsert([
                {
                    user_id: userId,
                    task_id: taskId,
                    completed: false,
                    completed_at: null
                }
            ], {
                onConflict: 'user_id,task_id'
            });

        if (error) throw error;
    }
};

export const getTaskStats = async () => {
    // Get all users and their task progress
    const { data: users, error: usersError } = await supabase
        .from('profiles')
        .select('id, full_name, email');

    if (usersError) throw usersError;

    const { data: allProgress, error: progressError } = await supabase
        .from('user_dashboard_tasks')
        .select('user_id, completed');

    if (progressError) throw progressError;

    // Calculate stats per user
    const stats = users?.map(user => {
        const userProgress = allProgress?.filter(p => p.user_id === user.id) || [];
        const completedCount = userProgress.filter(p => p.completed).length;

        return {
            userId: user.id,
            name: user.full_name,
            email: user.email,
            completedTasks: completedCount,
            totalTasks: userProgress.length
        };
    });

    return stats || [];
};

// --- Dashboard Quick Links Management ---

export const fetchAllQuickLinks = async (activeOnly = false) => {
    let query = supabase
        .from('dashboard_quick_links')
        .select('*')
        .order('order', { ascending: true });

    if (activeOnly) {
        query = query.eq('is_active', true);
    }

    const { data, error } = await query;

    if (error) throw error;
    return data || [];
};

export const createQuickLink = async (linkData: {
    title: string;
    icon: string;
    url: string;
    order?: number;
    is_active?: boolean;
}) => {
    const { data, error } = await supabase
        .from('dashboard_quick_links')
        .insert([linkData])
        .select()
        .single();

    if (error) throw error;
    return data;
};

export const updateQuickLink = async (id: string, linkData: {
    title?: string;
    icon?: string;
    url?: string;
    order?: number;
    is_active?: boolean;
}) => {
    const { data, error } = await supabase
        .from('dashboard_quick_links')
        .update(linkData)
        .eq('id', id)
        .select()
        .single();

    if (error) throw error;
    return data;
};

export const deleteQuickLink = async (id: string) => {
    const { error } = await supabase
        .from('dashboard_quick_links')
        .delete()
        .eq('id', id);

    if (error) throw error;
};

export const reorderQuickLinks = async (links: { id: string; order: number }[]) => {
    const updates = links.map(link =>
        supabase
            .from('dashboard_quick_links')
            .update({ order: link.order })
            .eq('id', link.id)
    );

    await Promise.all(updates);
};

// --- Dashboard Settings Management ---

export const fetchDashboardSettings = async () => {
    const { data, error } = await supabase
        .from('dashboard_settings')
        .select('*')
        .limit(1)
        .single();

    if (error && error.code !== 'PGRST116') throw error;

    // Return default settings if none exist
    return data || {
        greeting_template: 'Привет, {name}!',
        show_week_indicator: true,
        show_calls_block: true,
        no_calls_text: 'Нет запланированных созвонов',
        cohort_start_date: null,
        week_duration_days: 7,
        total_weeks: 4
    };
};

export const updateDashboardSettings = async (settings: {
    greeting_template?: string;
    show_week_indicator?: boolean;
    show_calls_block?: boolean;
    no_calls_text?: string;
    cohort_start_date?: string | null;
    week_duration_days?: number;
    total_weeks?: number;
}) => {
    // Get existing settings
    const { data: existing } = await supabase
        .from('dashboard_settings')
        .select('id')
        .limit(1)
        .single();

    if (existing) {
        // Update existing
        const { data, error } = await supabase
            .from('dashboard_settings')
            .update(settings)
            .eq('id', existing.id)
            .select()
            .single();

        if (error) throw error;
        return data;
    } else {
        // Create new
        const { data, error } = await supabase
            .from('dashboard_settings')
            .insert([settings])
            .select()
            .single();

        if (error) throw error;
        return data;
    }
};

// --- Complete Dashboard Data for Student ---

export const fetchCompleteDashboardData = async (userId: string) => {
    try {
        // Fetch settings
        const settings = await fetchDashboardSettings();

        // Calculate current week
        const currentWeek = await getCurrentWeek();

        // Fetch tasks for current week
        const tasks = await fetchAllDashboardTasks(currentWeek);

        // Fetch user's progress
        const progress = await fetchUserDashboardProgress(userId, currentWeek);

        // Create a map of completed tasks
        const completedMap = new Map(
            progress.map((p: any) => [p.task_id, p.completed])
        );

        // Merge tasks with completion status
        const tasksWithStatus = tasks.map(task => ({
            id: task.id,
            title: task.title,
            link: task.link,
            completed: completedMap.get(task.id) || false
        }));

        // Fetch quick links
        const quickLinks = await fetchAllQuickLinks(true);

        // Fetch upcoming call
        const calls = await fetchAllCalls();
        const upcomingCall = calls.find((call: any) => {
            return call.status === 'scheduled' || call.status === 'live';
        });

        return {
            currentWeek,
            totalWeeks: settings.total_weeks,
            tasks: tasksWithStatus,
            completedCount: tasksWithStatus.filter(t => t.completed).length,
            totalCount: tasksWithStatus.length,
            quickLinks: quickLinks.map(link => ({
                title: link.title,
                icon: link.icon,
                url: link.url
            })),
            upcomingCall: upcomingCall ? {
                id: upcomingCall.id,
                title: upcomingCall.topic,
                date: upcomingCall.date,
                time: upcomingCall.time,
                link: upcomingCall.meetingUrl
            } : null,
            settings: {
                greetingTemplate: settings.greeting_template,
                showWeekIndicator: settings.show_week_indicator,
                showCallsBlock: settings.show_calls_block,
                noCallsText: settings.no_calls_text
            }
        };
    } catch (error) {
        console.error('Error fetching dashboard data:', error);
        throw error;
    }
};

// --- Helper: Calculate Current Week ---

export const getCurrentWeek = async (): Promise<number> => {
    const settings = await fetchDashboardSettings();

    if (!settings.cohort_start_date) {
        return 1; // Default to week 1 if no start date
    }

    const startDate = new Date(settings.cohort_start_date);
    const now = new Date();
    const daysSinceStart = Math.floor((now.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24));

    if (daysSinceStart < 0) {
        return 1; // Before start date
    }

    const weekNumber = Math.floor(daysSinceStart / settings.week_duration_days) + 1;

    // Cap at total weeks
    return Math.min(weekNumber, settings.total_weeks);
};
