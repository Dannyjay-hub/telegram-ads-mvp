-- Migration: Payment Window System
-- Run this in your Supabase SQL Editor

-- 1. Add payment expiry to campaigns
ALTER TABLE campaigns ADD COLUMN IF NOT EXISTS payment_expires_at TIMESTAMPTZ;

-- 2. Add draft step for resume functionality
ALTER TABLE campaigns ADD COLUMN IF NOT EXISTS draft_step INTEGER DEFAULT 0;

-- 3. Create late payments table for refund tracking
CREATE TABLE IF NOT EXISTS late_payments (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    campaign_id UUID REFERENCES campaigns(id) ON DELETE SET NULL,
    deal_id UUID REFERENCES deals(id) ON DELETE SET NULL,
    memo TEXT NOT NULL,
    amount NUMERIC,
    currency TEXT DEFAULT 'TON',
    detected_at TIMESTAMPTZ DEFAULT NOW(),
    refund_status TEXT DEFAULT 'pending' CHECK (refund_status IN ('pending', 'refunded', 'ignored')),
    tx_hash TEXT,
    notes TEXT
);

-- Add index for quick lookup
CREATE INDEX IF NOT EXISTS idx_late_payments_status ON late_payments(refund_status);
CREATE INDEX IF NOT EXISTS idx_late_payments_memo ON late_payments(memo);
