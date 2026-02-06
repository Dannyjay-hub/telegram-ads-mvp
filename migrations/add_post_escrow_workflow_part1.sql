-- Post-Escrow Workflow Migration
-- PART 1: Add enum values (RUN THIS FIRST, THEN PART 2)

-- Add new statuses to deal_status enum
-- These must be committed before being used in indexes
ALTER TYPE deal_status ADD VALUE IF NOT EXISTS 'draft_pending' AFTER 'funded';
ALTER TYPE deal_status ADD VALUE IF NOT EXISTS 'draft_submitted' AFTER 'draft_pending';
ALTER TYPE deal_status ADD VALUE IF NOT EXISTS 'changes_requested' AFTER 'draft_submitted';
ALTER TYPE deal_status ADD VALUE IF NOT EXISTS 'scheduling' AFTER 'approved';
ALTER TYPE deal_status ADD VALUE IF NOT EXISTS 'scheduled' AFTER 'scheduling';
ALTER TYPE deal_status ADD VALUE IF NOT EXISTS 'failed_to_post' AFTER 'posted';
