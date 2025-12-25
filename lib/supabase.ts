
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

export const supabase = createClient(
    supabaseUrl || 'https://placeholder-if-missing.supabase.co', 
    supabaseAnonKey || 'placeholder-key',
    {
        auth: {
            persistSession: true,
            autoRefreshToken: true,
            detectSessionInUrl: true,
            storageKey: 'vibes_auth_token'
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
