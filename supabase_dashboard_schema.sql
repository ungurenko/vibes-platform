-- ================================================================
-- VIBES Platform - Dashboard Management Schema
-- ================================================================
-- This schema provides admin panel with ability to manage:
-- - Weekly tasks for students
-- - Quick access links
-- - Dashboard settings
-- ================================================================

-- Enable UUID extension if not already enabled
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ================================================================
-- TABLE: dashboard_tasks
-- Stores weekly tasks that appear on student dashboard
-- ================================================================
CREATE TABLE IF NOT EXISTS dashboard_tasks (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    week_number INTEGER NOT NULL CHECK (week_number >= 1 AND week_number <= 4),
    title TEXT NOT NULL CHECK (char_length(title) >= 3),
    link TEXT,
    "order" INTEGER DEFAULT 0 NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Index for fast filtering by week
CREATE INDEX IF NOT EXISTS idx_dashboard_tasks_week ON dashboard_tasks(week_number);
CREATE INDEX IF NOT EXISTS idx_dashboard_tasks_order ON dashboard_tasks("order");

-- ================================================================
-- TABLE: user_dashboard_tasks
-- Tracks which tasks each user has completed
-- ================================================================
CREATE TABLE IF NOT EXISTS user_dashboard_tasks (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
    task_id UUID NOT NULL REFERENCES dashboard_tasks(id) ON DELETE CASCADE,
    completed BOOLEAN DEFAULT FALSE NOT NULL,
    completed_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT NOW(),

    -- Ensure one record per user per task
    UNIQUE(user_id, task_id)
);

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_user_dashboard_tasks_user ON user_dashboard_tasks(user_id);
CREATE INDEX IF NOT EXISTS idx_user_dashboard_tasks_task ON user_dashboard_tasks(task_id);
CREATE INDEX IF NOT EXISTS idx_user_dashboard_tasks_completed ON user_dashboard_tasks(completed);

-- ================================================================
-- TABLE: dashboard_quick_links
-- Configurable quick access links on dashboard
-- ================================================================
CREATE TABLE IF NOT EXISTS dashboard_quick_links (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    title TEXT NOT NULL CHECK (char_length(title) >= 1),
    icon TEXT NOT NULL,
    url TEXT NOT NULL,
    "order" INTEGER DEFAULT 0 NOT NULL,
    is_active BOOLEAN DEFAULT TRUE NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Index for ordering
CREATE INDEX IF NOT EXISTS idx_dashboard_quick_links_order ON dashboard_quick_links("order");
CREATE INDEX IF NOT EXISTS idx_dashboard_quick_links_active ON dashboard_quick_links(is_active);

-- ================================================================
-- TABLE: dashboard_settings
-- Global dashboard configuration
-- ================================================================
CREATE TABLE IF NOT EXISTS dashboard_settings (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    greeting_template TEXT DEFAULT 'Привет, {name}!' NOT NULL,
    show_week_indicator BOOLEAN DEFAULT TRUE NOT NULL,
    show_calls_block BOOLEAN DEFAULT TRUE NOT NULL,
    no_calls_text TEXT DEFAULT 'Нет запланированных созвонов' NOT NULL,
    cohort_start_date DATE,
    week_duration_days INTEGER DEFAULT 7 NOT NULL CHECK (week_duration_days > 0),
    total_weeks INTEGER DEFAULT 4 NOT NULL CHECK (total_weeks > 0),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Insert default settings if table is empty
INSERT INTO dashboard_settings (id)
SELECT uuid_generate_v4()
WHERE NOT EXISTS (SELECT 1 FROM dashboard_settings LIMIT 1);

-- ================================================================
-- TRIGGERS: Auto-update timestamps
-- ================================================================

-- Trigger function to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Apply triggers to tables
DROP TRIGGER IF EXISTS update_dashboard_tasks_updated_at ON dashboard_tasks;
CREATE TRIGGER update_dashboard_tasks_updated_at
    BEFORE UPDATE ON dashboard_tasks
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_dashboard_quick_links_updated_at ON dashboard_quick_links;
CREATE TRIGGER update_dashboard_quick_links_updated_at
    BEFORE UPDATE ON dashboard_quick_links
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_dashboard_settings_updated_at ON dashboard_settings;
CREATE TRIGGER update_dashboard_settings_updated_at
    BEFORE UPDATE ON dashboard_settings
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

-- ================================================================
-- ROW LEVEL SECURITY (RLS)
-- ================================================================

-- Enable RLS on all tables
ALTER TABLE dashboard_tasks ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_dashboard_tasks ENABLE ROW LEVEL SECURITY;
ALTER TABLE dashboard_quick_links ENABLE ROW LEVEL SECURITY;
ALTER TABLE dashboard_settings ENABLE ROW LEVEL SECURITY;

-- ================================================================
-- RLS POLICIES: dashboard_tasks
-- ================================================================

-- Students can read all tasks
DROP POLICY IF EXISTS "Students can view dashboard tasks" ON dashboard_tasks;
CREATE POLICY "Students can view dashboard tasks"
    ON dashboard_tasks FOR SELECT
    TO authenticated
    USING (true);

-- Admins can do everything
DROP POLICY IF EXISTS "Admins can manage dashboard tasks" ON dashboard_tasks;
CREATE POLICY "Admins can manage dashboard tasks"
    ON dashboard_tasks FOR ALL
    TO authenticated
    USING (
        EXISTS (
            SELECT 1 FROM profiles
            WHERE profiles.id = auth.uid()
            AND profiles.is_admin = true
        )
    );

-- ================================================================
-- RLS POLICIES: user_dashboard_tasks
-- ================================================================

-- Users can view their own progress
DROP POLICY IF EXISTS "Users can view own task progress" ON user_dashboard_tasks;
CREATE POLICY "Users can view own task progress"
    ON user_dashboard_tasks FOR SELECT
    TO authenticated
    USING (user_id = auth.uid());

-- Users can update their own progress
DROP POLICY IF EXISTS "Users can update own task progress" ON user_dashboard_tasks;
CREATE POLICY "Users can update own task progress"
    ON user_dashboard_tasks FOR INSERT
    TO authenticated
    WITH CHECK (user_id = auth.uid());

DROP POLICY IF EXISTS "Users can modify own task progress" ON user_dashboard_tasks;
CREATE POLICY "Users can modify own task progress"
    ON user_dashboard_tasks FOR UPDATE
    TO authenticated
    USING (user_id = auth.uid());

DROP POLICY IF EXISTS "Users can delete own task progress" ON user_dashboard_tasks;
CREATE POLICY "Users can delete own task progress"
    ON user_dashboard_tasks FOR DELETE
    TO authenticated
    USING (user_id = auth.uid());

-- Admins can view all progress
DROP POLICY IF EXISTS "Admins can view all task progress" ON user_dashboard_tasks;
CREATE POLICY "Admins can view all task progress"
    ON user_dashboard_tasks FOR SELECT
    TO authenticated
    USING (
        EXISTS (
            SELECT 1 FROM profiles
            WHERE profiles.id = auth.uid()
            AND profiles.is_admin = true
        )
    );

-- ================================================================
-- RLS POLICIES: dashboard_quick_links
-- ================================================================

-- Students can read active links
DROP POLICY IF EXISTS "Students can view active quick links" ON dashboard_quick_links;
CREATE POLICY "Students can view active quick links"
    ON dashboard_quick_links FOR SELECT
    TO authenticated
    USING (is_active = true);

-- Admins can manage all links
DROP POLICY IF EXISTS "Admins can manage quick links" ON dashboard_quick_links;
CREATE POLICY "Admins can manage quick links"
    ON dashboard_quick_links FOR ALL
    TO authenticated
    USING (
        EXISTS (
            SELECT 1 FROM profiles
            WHERE profiles.id = auth.uid()
            AND profiles.is_admin = true
        )
    );

-- ================================================================
-- RLS POLICIES: dashboard_settings
-- ================================================================

-- Everyone can read settings
DROP POLICY IF EXISTS "Everyone can read dashboard settings" ON dashboard_settings;
CREATE POLICY "Everyone can read dashboard settings"
    ON dashboard_settings FOR SELECT
    TO authenticated
    USING (true);

-- Only admins can update settings
DROP POLICY IF EXISTS "Admins can update dashboard settings" ON dashboard_settings;
CREATE POLICY "Admins can update dashboard settings"
    ON dashboard_settings FOR UPDATE
    TO authenticated
    USING (
        EXISTS (
            SELECT 1 FROM profiles
            WHERE profiles.id = auth.uid()
            AND profiles.is_admin = true
        )
    );

-- ================================================================
-- SEED DATA: Default quick links
-- ================================================================

-- Insert default quick links if none exist
INSERT INTO dashboard_quick_links (title, icon, url, "order", is_active)
SELECT * FROM (VALUES
    ('Стили', 'palette', '/styles', 1, true),
    ('Промпты', 'terminal', '/prompts', 2, true),
    ('Термины', 'book', '/glossary', 3, true),
    ('AI Чат', 'bot', '/assistant', 4, true)
) AS v(title, icon, url, "order", is_active)
WHERE NOT EXISTS (SELECT 1 FROM dashboard_quick_links);

-- ================================================================
-- SEED DATA: Default tasks for Week 1
-- ================================================================

-- Insert default tasks for Week 1 if none exist
INSERT INTO dashboard_tasks (week_number, title, link, "order")
SELECT * FROM (VALUES
    (1, 'Посмотреть "Как работает веб"', '/lessons', 1),
    (1, 'Настроить VS Code и окружение', '/lessons', 2),
    (1, 'Сгенерировать ТЗ с Ассистентом', '/assistant', 3),
    (1, 'Выбрать стиль в библиотеке', '/styles', 4)
) AS v(week_number, title, link, "order")
WHERE NOT EXISTS (SELECT 1 FROM dashboard_tasks WHERE week_number = 1);

-- ================================================================
-- HELPER FUNCTIONS
-- ================================================================

-- Function to calculate current week for a user
CREATE OR REPLACE FUNCTION get_current_week()
RETURNS INTEGER AS $$
DECLARE
    start_date DATE;
    week_duration INTEGER;
    total_weeks INTEGER;
    days_since_start INTEGER;
    current_week INTEGER;
BEGIN
    -- Get settings
    SELECT cohort_start_date, week_duration_days, total_weeks
    INTO start_date, week_duration, total_weeks
    FROM dashboard_settings
    LIMIT 1;

    -- If no start date, return week 1
    IF start_date IS NULL THEN
        RETURN 1;
    END IF;

    -- Calculate days since start
    days_since_start := CURRENT_DATE - start_date;

    -- If before start, return 0 or 1
    IF days_since_start < 0 THEN
        RETURN 1;
    END IF;

    -- Calculate current week (1-indexed)
    current_week := (days_since_start / week_duration) + 1;

    -- Cap at total_weeks
    IF current_week > total_weeks THEN
        RETURN total_weeks;
    END IF;

    RETURN current_week;
END;
$$ LANGUAGE plpgsql STABLE;

-- Function to get dashboard data for a user
CREATE OR REPLACE FUNCTION get_dashboard_data(p_user_id UUID)
RETURNS JSON AS $$
DECLARE
    result JSON;
    current_week INTEGER;
BEGIN
    current_week := get_current_week();

    SELECT json_build_object(
        'currentWeek', current_week,
        'totalWeeks', (SELECT total_weeks FROM dashboard_settings LIMIT 1),
        'tasks', (
            SELECT json_agg(
                json_build_object(
                    'id', dt.id,
                    'title', dt.title,
                    'link', dt.link,
                    'completed', COALESCE(udt.completed, false),
                    'completedAt', udt.completed_at
                )
                ORDER BY dt."order"
            )
            FROM dashboard_tasks dt
            LEFT JOIN user_dashboard_tasks udt
                ON dt.id = udt.task_id
                AND udt.user_id = p_user_id
            WHERE dt.week_number = current_week
        ),
        'quickLinks', (
            SELECT json_agg(
                json_build_object(
                    'title', title,
                    'icon', icon,
                    'url', url
                )
                ORDER BY "order"
            )
            FROM dashboard_quick_links
            WHERE is_active = true
        ),
        'settings', (
            SELECT json_build_object(
                'greetingTemplate', greeting_template,
                'showWeekIndicator', show_week_indicator,
                'showCallsBlock', show_calls_block,
                'noCallsText', no_calls_text
            )
            FROM dashboard_settings
            LIMIT 1
        )
    ) INTO result;

    RETURN result;
END;
$$ LANGUAGE plpgsql STABLE SECURITY DEFINER;

-- ================================================================
-- COMMENTS
-- ================================================================

COMMENT ON TABLE dashboard_tasks IS 'Weekly tasks displayed on student dashboard';
COMMENT ON TABLE user_dashboard_tasks IS 'Tracks task completion progress for each user';
COMMENT ON TABLE dashboard_quick_links IS 'Configurable quick access links on dashboard';
COMMENT ON TABLE dashboard_settings IS 'Global dashboard configuration settings';
COMMENT ON FUNCTION get_current_week() IS 'Calculates current week number based on cohort start date';
COMMENT ON FUNCTION get_dashboard_data(UUID) IS 'Returns complete dashboard data for a specific user';
