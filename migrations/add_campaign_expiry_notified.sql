-- Add expiry_notified flag to campaigns to prevent duplicate notifications
ALTER TABLE campaigns ADD COLUMN IF NOT EXISTS expiry_notified BOOLEAN DEFAULT FALSE;
