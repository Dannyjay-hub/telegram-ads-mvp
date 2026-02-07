-- Fix escrow_available column to be properly computed
-- Issue: Previous migration added it as DEFAULT 0, overwriting the computed column

-- Step 1: Drop the broken column
ALTER TABLE campaigns DROP COLUMN IF EXISTS escrow_available;

-- Step 2: Recreate as a GENERATED column (PostgreSQL 12+, which Supabase uses)
-- This ensures the value is ALWAYS correct: deposited - allocated
ALTER TABLE campaigns 
ADD COLUMN escrow_available DECIMAL(20, 8) 
GENERATED ALWAYS AS (COALESCE(escrow_deposited, 0) - COALESCE(escrow_allocated, 0)) STORED;

-- Add helpful comment
COMMENT ON COLUMN campaigns.escrow_available IS 'Auto-computed: escrow_deposited - escrow_allocated. Do not update directly.';
