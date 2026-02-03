-- Migration: Add missing columns to campaigns table
-- These columns are used by the repository code but were not in the original schema

-- Add media_urls for campaign images/videos
ALTER TABLE campaigns ADD COLUMN IF NOT EXISTS media_urls TEXT[];

-- Add escrow tracking columns
ALTER TABLE campaigns ADD COLUMN IF NOT EXISTS escrow_wallet_address TEXT;
ALTER TABLE campaigns ADD COLUMN IF NOT EXISTS escrow_funded BOOLEAN DEFAULT FALSE;
ALTER TABLE campaigns ADD COLUMN IF NOT EXISTS escrow_available DECIMAL(20, 8) DEFAULT 0;

-- Add scheduling column
ALTER TABLE campaigns ADD COLUMN IF NOT EXISTS starts_at TIMESTAMPTZ DEFAULT NOW();

-- Add currency column if not exists
ALTER TABLE campaigns ADD COLUMN IF NOT EXISTS currency TEXT DEFAULT 'TON';

-- Rename columns to match code expectations (using new columns + triggers for compatibility)
-- Option 1: Add alias columns that mirror existing ones
ALTER TABLE campaigns ADD COLUMN IF NOT EXISTS brief TEXT;
ALTER TABLE campaigns ADD COLUMN IF NOT EXISTS campaign_type TEXT DEFAULT 'open';
ALTER TABLE campaigns ADD COLUMN IF NOT EXISTS per_channel_budget DECIMAL(20, 8);
ALTER TABLE campaigns ADD COLUMN IF NOT EXISTS expires_at TIMESTAMPTZ;
ALTER TABLE campaigns ADD COLUMN IF NOT EXISTS min_subscribers INTEGER DEFAULT 0;

-- Copy existing data to new aliased columns (one-time)
UPDATE campaigns SET 
    brief = COALESCE(brief, brief_text),
    campaign_type = COALESCE(campaign_type, type),
    per_channel_budget = COALESCE(per_channel_budget, individual_slot_budget),
    expires_at = COALESCE(expires_at, expired_at);

-- Create triggers to keep columns in sync (for any future direct SQL updates)
CREATE OR REPLACE FUNCTION sync_campaign_columns()
RETURNS TRIGGER AS $$
BEGIN
    -- Sync brief <-> brief_text
    IF NEW.brief IS DISTINCT FROM OLD.brief THEN
        NEW.brief_text = NEW.brief;
    ELSIF NEW.brief_text IS DISTINCT FROM OLD.brief_text THEN
        NEW.brief = NEW.brief_text;
    END IF;
    
    -- Sync campaign_type <-> type
    IF NEW.campaign_type IS DISTINCT FROM OLD.campaign_type THEN
        NEW.type = NEW.campaign_type;
    ELSIF NEW.type IS DISTINCT FROM OLD.type THEN
        NEW.campaign_type = NEW.type;
    END IF;
    
    -- Sync per_channel_budget <-> individual_slot_budget
    IF NEW.per_channel_budget IS DISTINCT FROM OLD.per_channel_budget THEN
        NEW.individual_slot_budget = NEW.per_channel_budget;
    ELSIF NEW.individual_slot_budget IS DISTINCT FROM OLD.individual_slot_budget THEN
        NEW.per_channel_budget = NEW.individual_slot_budget;
    END IF;
    
    -- Sync expires_at <-> expired_at
    IF NEW.expires_at IS DISTINCT FROM OLD.expires_at THEN
        NEW.expired_at = NEW.expires_at;
    ELSIF NEW.expired_at IS DISTINCT FROM OLD.expired_at THEN
        NEW.expires_at = NEW.expired_at;
    END IF;
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Drop existing trigger if exists
DROP TRIGGER IF EXISTS campaign_column_sync ON campaigns;

-- Create trigger
CREATE TRIGGER campaign_column_sync
    BEFORE UPDATE ON campaigns
    FOR EACH ROW
    EXECUTE FUNCTION sync_campaign_columns();

-- Also handle inserts
CREATE OR REPLACE FUNCTION sync_campaign_columns_insert()
RETURNS TRIGGER AS $$
BEGIN
    -- Set defaults from existing columns for new inserts
    NEW.brief = COALESCE(NEW.brief, NEW.brief_text);
    NEW.brief_text = COALESCE(NEW.brief_text, NEW.brief);
    
    NEW.campaign_type = COALESCE(NEW.campaign_type, NEW.type, 'open');
    NEW.type = COALESCE(NEW.type, NEW.campaign_type, 'open');
    
    NEW.per_channel_budget = COALESCE(NEW.per_channel_budget, NEW.individual_slot_budget);
    NEW.individual_slot_budget = COALESCE(NEW.individual_slot_budget, NEW.per_channel_budget);
    
    NEW.expires_at = COALESCE(NEW.expires_at, NEW.expired_at);
    NEW.expired_at = COALESCE(NEW.expired_at, NEW.expires_at);
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS campaign_column_sync_insert ON campaigns;

CREATE TRIGGER campaign_column_sync_insert
    BEFORE INSERT ON campaigns
    FOR EACH ROW
    EXECUTE FUNCTION sync_campaign_columns_insert();

-- Add comments for documentation
COMMENT ON COLUMN campaigns.brief IS 'Alias for brief_text - campaign description/instructions';
COMMENT ON COLUMN campaigns.campaign_type IS 'Alias for type - open or closed';
COMMENT ON COLUMN campaigns.per_channel_budget IS 'Alias for individual_slot_budget - budget per channel';
COMMENT ON COLUMN campaigns.expires_at IS 'Alias for expired_at - campaign expiration time';
COMMENT ON COLUMN campaigns.media_urls IS 'Array of media URLs for campaign creative content';
COMMENT ON COLUMN campaigns.escrow_wallet_address IS 'TON wallet address holding escrowed funds';
COMMENT ON COLUMN campaigns.escrow_funded IS 'Whether the campaign has been funded with escrow';
COMMENT ON COLUMN campaigns.escrow_available IS 'Remaining available escrow balance';
COMMENT ON COLUMN campaigns.starts_at IS 'When the campaign becomes active';
