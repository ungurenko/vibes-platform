-- Calls table for managing course calls/meetings
-- Run this SQL in your Supabase SQL editor

CREATE TABLE IF NOT EXISTS calls (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  date DATE NOT NULL,
  time TEXT NOT NULL,
  duration TEXT NOT NULL,
  topic TEXT NOT NULL,
  description TEXT,
  status TEXT NOT NULL CHECK (status IN ('scheduled', 'live', 'completed')),
  meeting_url TEXT,
  recording_url TEXT,
  materials JSONB DEFAULT '[]'::jsonb,
  attendees_count INTEGER DEFAULT 0,
  reminders JSONB DEFAULT '[]'::jsonb,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Enable Row Level Security
ALTER TABLE calls ENABLE ROW LEVEL SECURITY;

-- Policy: Allow public read access (all authenticated users can view calls)
CREATE POLICY "Allow public read access to calls"
  ON calls
  FOR SELECT
  USING (true);

-- Policy: Only admins can insert/update/delete calls
-- Assuming admins have role 'admin' in profiles table
CREATE POLICY "Allow admin insert on calls"
  ON calls
  FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.role = 'admin'
    )
  );

CREATE POLICY "Allow admin update on calls"
  ON calls
  FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.role = 'admin'
    )
  );

CREATE POLICY "Allow admin delete on calls"
  ON calls
  FOR DELETE
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.role = 'admin'
    )
  );

-- Create index for faster queries by date
CREATE INDEX IF NOT EXISTS calls_date_idx ON calls(date DESC);

-- Create index for faster queries by status
CREATE INDEX IF NOT EXISTS calls_status_idx ON calls(status);

-- Optional: Update updated_at timestamp on every update
CREATE OR REPLACE FUNCTION update_calls_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER calls_updated_at_trigger
  BEFORE UPDATE ON calls
  FOR EACH ROW
  EXECUTE FUNCTION update_calls_updated_at();
