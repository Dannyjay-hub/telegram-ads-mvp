-- Migration: Create pending_payouts table for payout/refund queue
-- This table tracks outgoing payments that need to be manually executed

CREATE TABLE IF NOT EXISTS pending_payouts (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    deal_id UUID REFERENCES deals(id),
    
    -- Recipient details
    recipient_address TEXT NOT NULL,
    amount_ton DECIMAL(15, 9) NOT NULL,
    memo TEXT,
    
    -- Type and status
    type TEXT DEFAULT 'payout', -- 'payout' or 'refund'
    status TEXT DEFAULT 'pending', -- 'pending', 'processing', 'completed', 'failed'
    reason TEXT, -- For refunds, the reason
    
    -- Transaction tracking
    tx_hash TEXT,
    
    -- Timestamps
    created_at TIMESTAMPTZ DEFAULT NOW(),
    completed_at TIMESTAMPTZ,
    
    -- Error tracking
    error_message TEXT,
    retry_count INT DEFAULT 0
);

-- Index for fetching pending payouts
CREATE INDEX IF NOT EXISTS idx_pending_payouts_status ON pending_payouts(status);
CREATE INDEX IF NOT EXISTS idx_pending_payouts_deal ON pending_payouts(deal_id);

COMMENT ON TABLE pending_payouts IS 'Queue of pending TON payouts and refunds for manual or automated execution';
