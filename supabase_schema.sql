-- Run this via the Supabase SQL Editor to set up your Phase 5 database for saving Dashboards.

-- 1. Create the dashboards table
CREATE TABLE dashboards (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  file_name TEXT NOT NULL,
  dashboard_config JSONB NOT NULL, -- The Gemini generated layout
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 2. Setup Row Level Security (RLS) to ensure users can only see their own dashboards
ALTER TABLE dashboards ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can only view their own dashboards" 
  ON dashboards FOR SELECT 
  USING (auth.uid() = user_id);

CREATE POLICY "Users can only insert their own dashboards" 
  ON dashboards FOR INSERT 
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can only delete their own dashboards" 
  ON dashboards FOR DELETE 
  USING (auth.uid() = user_id);
