-- Migration: Add language column to channels table
-- Run this in your Supabase SQL Editor

ALTER TABLE channels ADD COLUMN IF NOT EXISTS language TEXT;

-- Optional: Add other missing columns that may have been added in code
ALTER TABLE channels ADD COLUMN IF NOT EXISTS category TEXT;
ALTER TABLE channels ADD COLUMN IF NOT EXISTS tags TEXT[];
ALTER TABLE channels ADD COLUMN IF NOT EXISTS rate_card JSONB DEFAULT '[]'::jsonb;
ALTER TABLE channels ADD COLUMN IF NOT EXISTS pricing JSONB DEFAULT '{}'::jsonb;
ALTER TABLE channels ADD COLUMN IF NOT EXISTS status TEXT DEFAULT 'active';
ALTER TABLE channels ADD COLUMN IF NOT EXISTS is_verified BOOLEAN DEFAULT FALSE;
ALTER TABLE channels ADD COLUMN IF NOT EXISTS permissions JSONB DEFAULT '{}'::jsonb;
ALTER TABLE channels ADD COLUMN IF NOT EXISTS stats_json JSONB DEFAULT '{}'::jsonb;
ALTER TABLE channels ADD COLUMN IF NOT EXISTS avg_views INTEGER DEFAULT 0;

-- Add role column to channel_admins if missing
ALTER TABLE channel_admins ADD COLUMN IF NOT EXISTS role TEXT DEFAULT 'admin';
ALTER TABLE channel_admins ADD COLUMN IF NOT EXISTS permissions JSONB DEFAULT '{}'::jsonb;
