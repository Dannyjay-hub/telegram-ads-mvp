-- Add listing details to channels table
ALTER TABLE channels ADD COLUMN IF NOT EXISTS description TEXT;
ALTER TABLE channels ADD COLUMN IF NOT EXISTS category TEXT;
ALTER TABLE channels ADD COLUMN IF NOT EXISTS tags TEXT[]; -- Postgres Array Type
