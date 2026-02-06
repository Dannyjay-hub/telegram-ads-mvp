-- Migration: Add expires_in_days column to campaigns table
-- This stores the campaign duration in days for draft resume functionality

ALTER TABLE campaigns 
ADD COLUMN IF NOT EXISTS expires_in_days INTEGER DEFAULT 7;

-- Add comment for clarity
COMMENT ON COLUMN campaigns.expires_in_days IS 'Campaign duration in days, used for draft resume. Default 7 days.';
