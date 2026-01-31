-- Migration: Add escrow payment tracking fields to deals table
-- This supports the memo-based payment architecture for TON Connect

-- Add new columns for memo-based payment tracking
ALTER TABLE deals ADD COLUMN IF NOT EXISTS content_items JSONB;  -- [{type, title, quantity, unit_price}]
ALTER TABLE deals ADD COLUMN IF NOT EXISTS payment_memo TEXT UNIQUE;  -- "deal_{uuid}" for matching transactions
ALTER TABLE deals ADD COLUMN IF NOT EXISTS advertiser_wallet_address TEXT;  -- For refunds
ALTER TABLE deals ADD COLUMN IF NOT EXISTS channel_owner_wallet TEXT;  -- For payouts

-- Transaction tracking
ALTER TABLE deals ADD COLUMN IF NOT EXISTS payment_tx_hash TEXT;
ALTER TABLE deals ADD COLUMN IF NOT EXISTS payment_confirmed_at TIMESTAMPTZ;
ALTER TABLE deals ADD COLUMN IF NOT EXISTS payout_tx_hash TEXT;
ALTER TABLE deals ADD COLUMN IF NOT EXISTS payout_at TIMESTAMPTZ;
ALTER TABLE deals ADD COLUMN IF NOT EXISTS refund_tx_hash TEXT;
ALTER TABLE deals ADD COLUMN IF NOT EXISTS refund_at TIMESTAMPTZ;

-- Auto-cancel timeout tracking
ALTER TABLE deals ADD COLUMN IF NOT EXISTS expires_at TIMESTAMPTZ;
ALTER TABLE deals ADD COLUMN IF NOT EXISTS status_updated_at TIMESTAMPTZ DEFAULT NOW();

-- Create index for payment memo lookups
CREATE INDEX IF NOT EXISTS idx_deals_payment_memo ON deals(payment_memo);

-- Create index for timeout job queries
CREATE INDEX IF NOT EXISTS idx_deals_expires ON deals(expires_at) WHERE status IN ('draft', 'submitted', 'funded');

-- Add 'pending' status if not exists (for new flow)
-- Note: You may need to run this in Supabase SQL editor:
-- ALTER TYPE deal_status ADD VALUE IF NOT EXISTS 'pending' BEFORE 'draft';
-- ALTER TYPE deal_status ADD VALUE IF NOT EXISTS 'refunded' AFTER 'disputed';
-- ALTER TYPE deal_status ADD VALUE IF NOT EXISTS 'in_progress' AFTER 'approved';

COMMENT ON COLUMN deals.payment_memo IS 'Unique memo string for TON transaction matching';
COMMENT ON COLUMN deals.content_items IS 'Array of selected packages: [{type, title, quantity, unit_price}]';
COMMENT ON COLUMN deals.advertiser_wallet_address IS 'TON wallet address for refunds';
COMMENT ON COLUMN deals.channel_owner_wallet IS 'TON wallet address for payouts';
