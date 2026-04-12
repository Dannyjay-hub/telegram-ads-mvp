-- Migration: Fix idempotency for payouts and posting
-- Run this BEFORE deploying code changes.

-- 1. Add 'posting' to deal_status enum (atomic claim for auto-poster)
--    This is a transient status used while the bot is actively sending the message.
ALTER TYPE deal_status ADD VALUE IF NOT EXISTS 'posting';

-- 2. Deduplicate existing pending_payouts rows before adding the unique index.
--    Keeps the row with the latest created_at for each (deal_id, type) pair.
--    Rows with NULL deal_id are left untouched (campaign refunds).
DELETE FROM pending_payouts
WHERE id IN (
    SELECT id FROM (
        SELECT
            id,
            ROW_NUMBER() OVER (
                PARTITION BY deal_id, type
                ORDER BY created_at DESC  -- keep newest
            ) AS rn
        FROM pending_payouts
        WHERE deal_id IS NOT NULL
    ) ranked
    WHERE rn > 1
);

-- 3. Now safe to add the unique index.
CREATE UNIQUE INDEX IF NOT EXISTS idx_pending_payouts_deal_type_unique
    ON pending_payouts (deal_id, type)
    WHERE deal_id IS NOT NULL;
