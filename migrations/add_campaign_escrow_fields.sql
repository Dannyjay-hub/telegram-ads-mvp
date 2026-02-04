-- Campaign Escrow Fields Migration
-- Adds escrow tracking to campaigns table for open campaign funding

-- Add escrow tracking columns
ALTER TABLE campaigns ADD COLUMN IF NOT EXISTS payment_memo TEXT UNIQUE;
ALTER TABLE campaigns ADD COLUMN IF NOT EXISTS escrow_deposited DECIMAL(18,4) DEFAULT 0;
ALTER TABLE campaigns ADD COLUMN IF NOT EXISTS escrow_allocated DECIMAL(18,4) DEFAULT 0;
ALTER TABLE campaigns ADD COLUMN IF NOT EXISTS escrow_released DECIMAL(18,4) DEFAULT 0;
ALTER TABLE campaigns ADD COLUMN IF NOT EXISTS escrow_tx_hash TEXT;
ALTER TABLE campaigns ADD COLUMN IF NOT EXISTS funded_at TIMESTAMPTZ;

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_campaigns_payment_memo ON campaigns(payment_memo) 
  WHERE payment_memo IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_campaigns_active_available ON campaigns(status, slots_filled, slots) 
  WHERE status = 'active';
CREATE INDEX IF NOT EXISTS idx_campaigns_expiring ON campaigns(expires_at, status) 
  WHERE expires_at IS NOT NULL;

-- ============================================
-- Atomic Slot Allocation Function
-- Prevents race conditions when multiple channels try to accept same campaign
-- ============================================
CREATE OR REPLACE FUNCTION allocate_campaign_slot(
    p_campaign_id UUID,
    p_per_channel_budget DECIMAL(18,4)
) RETURNS TABLE (
    id UUID,
    advertiser_id UUID,
    title TEXT,
    brief TEXT,
    media_urls TEXT[],
    total_budget DECIMAL,
    per_channel_budget DECIMAL,
    currency TEXT,
    slots INTEGER,
    slots_filled INTEGER,
    status TEXT,
    escrow_deposited DECIMAL,
    escrow_allocated DECIMAL,
    escrow_released DECIMAL
) AS $$
BEGIN
    -- Atomic: Update only if conditions met
    RETURN QUERY
    UPDATE campaigns c
    SET 
        slots_filled = c.slots_filled + 1,
        escrow_allocated = c.escrow_allocated + p_per_channel_budget
    WHERE 
        c.id = p_campaign_id
        AND c.status = 'active'
        AND c.slots_filled < c.slots  -- Space available
        AND c.escrow_allocated + p_per_channel_budget <= c.escrow_deposited  -- Funds available
    RETURNING 
        c.id,
        c.advertiser_id,
        c.title,
        c.brief,
        c.media_urls,
        c.total_budget,
        c.per_channel_budget,
        c.currency,
        c.slots,
        c.slots_filled,
        c.status,
        c.escrow_deposited,
        c.escrow_allocated,
        c.escrow_released;
END;
$$ LANGUAGE plpgsql;

-- Grant execute to authenticated role
GRANT EXECUTE ON FUNCTION allocate_campaign_slot TO authenticated, anon, service_role;

-- ============================================
-- Comments
-- ============================================
COMMENT ON COLUMN campaigns.payment_memo IS 'Unique memo string for TON transaction matching (campaign_<uuid>)';
COMMENT ON COLUMN campaigns.escrow_deposited IS 'Total amount deposited by advertiser';
COMMENT ON COLUMN campaigns.escrow_allocated IS 'Amount allocated to accepted channels';
COMMENT ON COLUMN campaigns.escrow_released IS 'Amount released to channel owners after completion';
COMMENT ON COLUMN campaigns.escrow_tx_hash IS 'Transaction hash of the escrow deposit';
COMMENT ON COLUMN campaigns.funded_at IS 'Timestamp when escrow was deposited';

COMMENT ON FUNCTION allocate_campaign_slot IS 'Atomic slot allocation - prevents race conditions when multiple channels accept';
