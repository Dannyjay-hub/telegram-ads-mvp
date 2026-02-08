-- Migration: Add Random Scheduled Checks for Anti-Gaming
-- Security feature: makes monitoring checks unpredictable to prevent timing attacks

-- Add scheduled_checks column to store array of random check times
ALTER TABLE deals ADD COLUMN IF NOT EXISTS scheduled_checks JSONB DEFAULT '[]';

-- Add last_checked_at if not exists (for tracking)
ALTER TABLE deals ADD COLUMN IF NOT EXISTS last_checked_at TIMESTAMPTZ;

-- Add next_check_at for efficient querying (stores the earliest pending check time)
ALTER TABLE deals ADD COLUMN IF NOT EXISTS next_check_at TIMESTAMPTZ;

-- Index for efficient background job queries
CREATE INDEX IF NOT EXISTS idx_deals_next_check ON deals(next_check_at) 
    WHERE status = 'posted' AND next_check_at IS NOT NULL;

-- Comments
COMMENT ON COLUMN deals.scheduled_checks IS 'JSONB array of {time: ISO timestamp, completed: boolean} for random verification checks';
COMMENT ON COLUMN deals.next_check_at IS 'Earliest pending check time for efficient background job queries';
