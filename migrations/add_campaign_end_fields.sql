-- Add fields for campaign end/refund tracking
ALTER TABLE campaigns ADD COLUMN IF NOT EXISTS refund_amount numeric DEFAULT 0;
ALTER TABLE campaigns ADD COLUMN IF NOT EXISTS ended_at timestamptz;
