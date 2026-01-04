-- Chat history table for AI assistant
-- Run this SQL in your Supabase SQL editor

-- =====================================================
-- STEP 1: Create the chats table
-- =====================================================
CREATE TABLE IF NOT EXISTS chats (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  messages JSONB NOT NULL DEFAULT '[]'::jsonb,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Enable Row Level Security
ALTER TABLE chats ENABLE ROW LEVEL SECURITY;

-- =====================================================
-- STEP 2: Create RLS Policies
-- =====================================================

-- Policy: Users can only read their own chats
CREATE POLICY "Users can read own chats"
  ON chats
  FOR SELECT
  USING (auth.uid() = user_id);

-- Policy: Users can insert their own chats
CREATE POLICY "Users can insert own chats"
  ON chats
  FOR INSERT
  WITH CHECK (auth.uid() = user_id);

-- Policy: Users can update their own chats
CREATE POLICY "Users can update own chats"
  ON chats
  FOR UPDATE
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- Policy: Users can delete their own chats
CREATE POLICY "Users can delete own chats"
  ON chats
  FOR DELETE
  USING (auth.uid() = user_id);

-- =====================================================
-- STEP 3: Create indexes for performance
-- =====================================================
CREATE INDEX IF NOT EXISTS chats_user_id_idx ON chats(user_id);
CREATE INDEX IF NOT EXISTS chats_updated_at_idx ON chats(updated_at DESC);

-- =====================================================
-- STEP 4: Create function to auto-update updated_at
-- =====================================================
CREATE OR REPLACE FUNCTION update_chats_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger for auto-updating updated_at
DROP TRIGGER IF EXISTS chats_updated_at_trigger ON chats;
CREATE TRIGGER chats_updated_at_trigger
  BEFORE UPDATE ON chats
  FOR EACH ROW
  EXECUTE FUNCTION update_chats_updated_at();

-- =====================================================
-- TROUBLESHOOTING
-- =====================================================
--
-- If you get permission errors, check:
-- 1. User is authenticated (has valid session)
-- 2. RLS is enabled: ALTER TABLE chats ENABLE ROW LEVEL SECURITY;
--
-- To drop and recreate policies:
-- DROP POLICY IF EXISTS "Users can read own chats" ON chats;
-- DROP POLICY IF EXISTS "Users can insert own chats" ON chats;
-- DROP POLICY IF EXISTS "Users can update own chats" ON chats;
-- DROP POLICY IF EXISTS "Users can delete own chats" ON chats;
