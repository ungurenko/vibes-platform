-- Invites table for registration invite tokens
-- Run this SQL in your Supabase SQL editor

-- =====================================================
-- STEP 0: Ensure profiles table has 'role' column
-- =====================================================
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS role TEXT DEFAULT 'student';

-- IMPORTANT: Set yourself as admin (replace with your email)
-- UPDATE profiles SET role = 'admin' WHERE email = 'your-email@example.com';

-- =====================================================
-- STEP 1: Create the invites table
-- =====================================================
CREATE TABLE IF NOT EXISTS invites (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  token TEXT NOT NULL UNIQUE,
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'used', 'deactivated')),
  expires_at TIMESTAMP WITH TIME ZONE,
  used_by_email TEXT,
  used_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Enable Row Level Security
ALTER TABLE invites ENABLE ROW LEVEL SECURITY;

-- Policy: Allow public read access for invite validation (needed for registration)
CREATE POLICY "Allow public read access to invites"
  ON invites
  FOR SELECT
  USING (true);

-- Policy: Allow public update for marking invites as used (during registration)
CREATE POLICY "Allow public update on invites for using"
  ON invites
  FOR UPDATE
  USING (status = 'active')
  WITH CHECK (status IN ('used', 'deactivated'));

-- Policy: Allow authenticated users to insert invites
-- (Admin access is controlled at the application level via AdminSettings view)
CREATE POLICY "Allow all insert on invites"
  ON invites
  FOR INSERT
  WITH CHECK (true);

-- Policy: Allow authenticated users to delete invites
-- (Admin access is controlled at the application level)
CREATE POLICY "Allow all delete on invites"
  ON invites
  FOR DELETE
  USING (true);

-- Create index for faster token lookups
CREATE INDEX IF NOT EXISTS invites_token_idx ON invites(token);

-- Create index for status filtering
CREATE INDEX IF NOT EXISTS invites_status_idx ON invites(status);

-- =====================================================
-- TROUBLESHOOTING: If you still get permission errors
-- =====================================================
--
-- 1. Make sure your user has role = 'admin' in profiles table:
--    SELECT id, email, role FROM profiles WHERE id = auth.uid();
--
-- 2. If the profiles table doesn't have a 'role' column, add it:
--    ALTER TABLE profiles ADD COLUMN IF NOT EXISTS role TEXT DEFAULT 'student';
--
-- 3. Set yourself as admin:
--    UPDATE profiles SET role = 'admin' WHERE email = 'your-email@example.com';
--
-- 4. If RLS policies already exist and conflict, drop them first:
--    DROP POLICY IF EXISTS "Allow public read access to invites" ON invites;
--    DROP POLICY IF EXISTS "Allow public update on invites for using" ON invites;
--    DROP POLICY IF EXISTS "Allow admin insert on invites" ON invites;
--    DROP POLICY IF EXISTS "Allow admin delete on invites" ON invites;
--
-- Then re-run this script.
