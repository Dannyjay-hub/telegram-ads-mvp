-- Post-Escrow Workflow Migration
-- Adds columns and tables for draft management, scheduling, monitoring

-- ============================================
-- 1. NEW DEAL STATUSES
-- ============================================
-- Note: PostgreSQL requires special handling for adding enum values
-- Run these separately if in transaction:

DO $$ 
BEGIN
    -- Add new statuses if they don't exist
    IF NOT EXISTS (SELECT 1 FROM pg_enum WHERE enumlabel = 'draft_pending' AND enumtypid = 'deal_status'::regtype) THEN
        ALTER TYPE deal_status ADD VALUE 'draft_pending' AFTER 'funded';
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_enum WHERE enumlabel = 'draft_submitted' AND enumtypid = 'deal_status'::regtype) THEN
        ALTER TYPE deal_status ADD VALUE 'draft_submitted' AFTER 'draft_pending';
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_enum WHERE enumlabel = 'changes_requested' AND enumtypid = 'deal_status'::regtype) THEN
        ALTER TYPE deal_status ADD VALUE 'changes_requested' AFTER 'draft_submitted';
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_enum WHERE enumlabel = 'scheduling' AND enumtypid = 'deal_status'::regtype) THEN
        ALTER TYPE deal_status ADD VALUE 'scheduling' AFTER 'approved';
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_enum WHERE enumlabel = 'scheduled' AND enumtypid = 'deal_status'::regtype) THEN
        ALTER TYPE deal_status ADD VALUE 'scheduled' AFTER 'scheduling';
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_enum WHERE enumlabel = 'failed_to_post' AND enumtypid = 'deal_status'::regtype) THEN
        ALTER TYPE deal_status ADD VALUE 'failed_to_post' AFTER 'posted';
    END IF;
END $$;

-- ============================================
-- 2. DRAFT MANAGEMENT COLUMNS
-- ============================================
ALTER TABLE deals ADD COLUMN IF NOT EXISTS draft_text TEXT;
ALTER TABLE deals ADD COLUMN IF NOT EXISTS draft_media_file_id TEXT;
ALTER TABLE deals ADD COLUMN IF NOT EXISTS draft_media_type TEXT; -- 'photo', 'video', 'document'
ALTER TABLE deals ADD COLUMN IF NOT EXISTS draft_version INTEGER DEFAULT 0;
ALTER TABLE deals ADD COLUMN IF NOT EXISTS draft_submitted_at TIMESTAMPTZ;
ALTER TABLE deals ADD COLUMN IF NOT EXISTS draft_feedback TEXT;

-- ============================================
-- 3. SCHEDULING COLUMNS
-- ============================================
ALTER TABLE deals ADD COLUMN IF NOT EXISTS proposed_post_time TIMESTAMPTZ;
ALTER TABLE deals ADD COLUMN IF NOT EXISTS time_proposed_by TEXT; -- 'advertiser' or 'channel_owner'
ALTER TABLE deals ADD COLUMN IF NOT EXISTS agreed_post_time TIMESTAMPTZ;

-- ============================================
-- 4. MONITORING COLUMNS
-- ============================================
ALTER TABLE deals ADD COLUMN IF NOT EXISTS posted_message_id BIGINT;
ALTER TABLE deals ADD COLUMN IF NOT EXISTS posted_at TIMESTAMPTZ;
ALTER TABLE deals ADD COLUMN IF NOT EXISTS monitoring_end_at TIMESTAMPTZ; -- posted_at + 24h
ALTER TABLE deals ADD COLUMN IF NOT EXISTS monitoring_checks INTEGER DEFAULT 0;
ALTER TABLE deals ADD COLUMN IF NOT EXISTS last_checked_at TIMESTAMPTZ;

-- ============================================
-- 5. TRACKING COLUMNS
-- ============================================
ALTER TABLE deals ADD COLUMN IF NOT EXISTS funded_at TIMESTAMPTZ;
ALTER TABLE deals ADD COLUMN IF NOT EXISTS status_history JSONB DEFAULT '[]';

-- ============================================
-- 6. DEAL MESSAGES TABLE
-- ============================================
CREATE TABLE IF NOT EXISTS deal_messages (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    deal_id UUID REFERENCES deals(id) ON DELETE CASCADE,
    sender_id UUID REFERENCES users(id),
    sender_role TEXT NOT NULL CHECK (sender_role IN ('advertiser', 'channel_owner')),
    message_text TEXT,
    message_type TEXT DEFAULT 'text' CHECK (message_type IN ('text', 'photo', 'action', 'system')),
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_deal_messages_deal ON deal_messages(deal_id);
CREATE INDEX IF NOT EXISTS idx_deal_messages_created ON deal_messages(deal_id, created_at DESC);

-- ============================================
-- 7. USER CONTEXTS TABLE (Bot State)
-- ============================================
CREATE TABLE IF NOT EXISTS user_contexts (
    user_id UUID PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
    context_type TEXT CHECK (context_type IN ('draft', 'chat', 'schedule', 'feedback')),
    deal_id UUID REFERENCES deals(id) ON DELETE SET NULL,
    extra_data JSONB DEFAULT '{}',
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================
-- 8. INDEXES FOR PERFORMANCE
-- ============================================
CREATE INDEX IF NOT EXISTS idx_deals_status_funded ON deals(status, funded_at) 
    WHERE status IN ('funded', 'draft_pending');
CREATE INDEX IF NOT EXISTS idx_deals_scheduled ON deals(status, agreed_post_time) 
    WHERE status = 'scheduled';
CREATE INDEX IF NOT EXISTS idx_deals_monitoring ON deals(status, monitoring_end_at) 
    WHERE status = 'monitoring';

-- ============================================
-- 9. HELPER FUNCTION: Update Status with History
-- ============================================
CREATE OR REPLACE FUNCTION update_deal_status(
    p_deal_id UUID,
    p_new_status deal_status
) RETURNS void AS $$
BEGIN
    UPDATE deals 
    SET 
        status = p_new_status,
        status_updated_at = NOW(),
        status_history = status_history || jsonb_build_object(
            'status', p_new_status::text,
            'at', NOW()
        )
    WHERE id = p_deal_id;
END;
$$ LANGUAGE plpgsql;

GRANT EXECUTE ON FUNCTION update_deal_status TO authenticated, anon, service_role;

-- ============================================
-- 10. COMMENTS
-- ============================================
COMMENT ON COLUMN deals.draft_text IS 'Current draft content (text/caption)';
COMMENT ON COLUMN deals.draft_media_file_id IS 'Telegram file_id for attached media';
COMMENT ON COLUMN deals.draft_media_type IS 'Type of media: photo, video, document';
COMMENT ON COLUMN deals.draft_version IS 'Revision count for draft iterations';
COMMENT ON COLUMN deals.draft_submitted_at IS 'When current draft was submitted for review';
COMMENT ON COLUMN deals.draft_feedback IS 'Latest feedback from advertiser on draft';

COMMENT ON COLUMN deals.proposed_post_time IS 'Currently proposed posting time';
COMMENT ON COLUMN deals.time_proposed_by IS 'Who proposed the current time: advertiser or channel_owner';
COMMENT ON COLUMN deals.agreed_post_time IS 'Locked posting time after agreement';

COMMENT ON COLUMN deals.posted_message_id IS 'Telegram message ID of the posted content';
COMMENT ON COLUMN deals.posted_at IS 'When the post went live';
COMMENT ON COLUMN deals.monitoring_end_at IS 'When 24h monitoring period ends';

COMMENT ON COLUMN deals.status_history IS 'JSON array tracking all status transitions';

COMMENT ON TABLE deal_messages IS 'Chat messages between advertiser and channel owner for a deal';
COMMENT ON TABLE user_contexts IS 'Tracks current bot conversation state per user';
