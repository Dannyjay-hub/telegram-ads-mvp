-- Campaign System Migration
-- Creates campaigns and campaign_applications tables with full escrow tracking

-- ============================================
-- 1. CREATE CAMPAIGNS TABLE
-- ============================================

CREATE TABLE campaigns (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  advertiser_id UUID REFERENCES users(id) NOT NULL,
  
  -- Content
  title VARCHAR(200) NOT NULL,
  brief TEXT NOT NULL,
  media_urls TEXT[],
  
  -- Budget
  total_budget DECIMAL(18,4) NOT NULL,
  currency VARCHAR(10) DEFAULT 'TON',
  slots INT NOT NULL DEFAULT 1,
  per_channel_budget DECIMAL(18,4) GENERATED ALWAYS AS (total_budget / slots) STORED,
  
  -- Campaign Type: 'open' (auto-accept) or 'closed' (manual review)
  campaign_type VARCHAR(20) DEFAULT 'open' CHECK (campaign_type IN ('open', 'closed')),
  
  -- Eligibility Criteria
  min_subscribers INT DEFAULT 0,
  max_subscribers INT,
  required_languages VARCHAR(10)[],
  min_avg_views INT DEFAULT 0,
  required_categories VARCHAR(50)[],
  
  -- Duration
  starts_at TIMESTAMPTZ DEFAULT NOW(),
  expires_at TIMESTAMPTZ,
  
  -- Status: draft, active, filled, expired, expired_pending, ended
  status VARCHAR(20) DEFAULT 'draft' CHECK (status IN ('draft', 'active', 'filled', 'expired', 'expired_pending', 'ended')),
  slots_filled INT DEFAULT 0,
  
  -- Escrow Tracking (for open campaigns)
  escrow_wallet_address VARCHAR(100),
  escrow_deposited DECIMAL(18,4) DEFAULT 0,
  escrow_allocated DECIMAL(18,4) DEFAULT 0,
  escrow_available DECIMAL(18,4) GENERATED ALWAYS AS (escrow_deposited - escrow_allocated) STORED,
  escrow_funded BOOLEAN GENERATED ALWAYS AS (escrow_deposited >= total_budget) STORED,
  
  -- Timestamps
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  expired_at TIMESTAMPTZ,
  
  -- Constraints
  CONSTRAINT valid_slots CHECK (slots > 0),
  CONSTRAINT valid_budget CHECK (total_budget > 0),
  CONSTRAINT valid_dates CHECK (expires_at IS NULL OR expires_at > starts_at),
  CONSTRAINT escrow_not_exceeded CHECK (escrow_allocated <= escrow_deposited)
);

-- ============================================
-- 2. CREATE CAMPAIGN_APPLICATIONS TABLE
-- ============================================

CREATE TABLE campaign_applications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  campaign_id UUID REFERENCES campaigns(id) ON DELETE CASCADE NOT NULL,
  channel_id UUID REFERENCES channels(id) ON DELETE CASCADE NOT NULL,
  
  -- Status: pending, approved, rejected
  status VARCHAR(20) DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected')),
  
  -- When approved, a deal is created
  deal_id UUID REFERENCES deals(id),
  
  -- Timestamps
  applied_at TIMESTAMPTZ DEFAULT NOW(),
  reviewed_at TIMESTAMPTZ,
  
  -- Prevent duplicate applications
  UNIQUE(campaign_id, channel_id),
  
  -- Ensure approved applications have deals
  CONSTRAINT approved_has_deal CHECK (
    (status = 'approved' AND deal_id IS NOT NULL) OR
    (status != 'approved')
  )
);

-- ============================================
-- 3. MODIFY DEALS TABLE
-- ============================================

-- Add campaign reference and escrow source
ALTER TABLE deals ADD COLUMN IF NOT EXISTS campaign_id UUID REFERENCES campaigns(id);
ALTER TABLE deals ADD COLUMN IF NOT EXISTS escrow_source VARCHAR(20) DEFAULT 'direct' CHECK (escrow_source IN ('direct', 'campaign'));

-- ============================================
-- 4. CREATE INDEXES FOR PERFORMANCE
-- ============================================

-- Campaign indexes
CREATE INDEX idx_campaigns_status ON campaigns(status);
CREATE INDEX idx_campaigns_advertiser ON campaigns(advertiser_id);
CREATE INDEX idx_campaigns_active_slots ON campaigns(status, slots_filled, slots) WHERE status = 'active';
CREATE INDEX idx_campaigns_expires ON campaigns(expires_at) WHERE expires_at IS NOT NULL AND status = 'active';
CREATE INDEX idx_campaigns_eligibility ON campaigns(min_subscribers, max_subscribers, min_avg_views) WHERE status = 'active';

-- Application indexes
CREATE INDEX idx_applications_campaign ON campaign_applications(campaign_id);
CREATE INDEX idx_applications_channel ON campaign_applications(channel_id);
CREATE INDEX idx_applications_status ON campaign_applications(status);
CREATE INDEX idx_applications_pending ON campaign_applications(campaign_id, status) WHERE status = 'pending';

-- Deal campaign reference
CREATE INDEX idx_deals_campaign ON deals(campaign_id) WHERE campaign_id IS NOT NULL;

-- ============================================
-- 5. AUTO-UPDATE updated_at TRIGGER
-- ============================================

CREATE OR REPLACE FUNCTION update_campaigns_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_campaigns_updated_at
  BEFORE UPDATE ON campaigns
  FOR EACH ROW
  EXECUTE FUNCTION update_campaigns_updated_at();

-- ============================================
-- 6. ENABLE RLS (Row Level Security)
-- ============================================

ALTER TABLE campaigns ENABLE ROW LEVEL SECURITY;
ALTER TABLE campaign_applications ENABLE ROW LEVEL SECURITY;

-- Campaigns: Anyone can read active campaigns, only advertiser can modify their own
CREATE POLICY campaigns_read_active ON campaigns
  FOR SELECT
  USING (status = 'active' OR status = 'filled');

CREATE POLICY campaigns_read_own ON campaigns
  FOR SELECT
  USING (true); -- Will be restricted by application logic

CREATE POLICY campaigns_insert ON campaigns
  FOR INSERT
  WITH CHECK (true); -- Controlled by backend

CREATE POLICY campaigns_update ON campaigns
  FOR UPDATE
  USING (true); -- Controlled by backend

-- Applications: Channel can see their own, Advertiser can see all for their campaigns
CREATE POLICY applications_read ON campaign_applications
  FOR SELECT
  USING (true); -- Controlled by backend

CREATE POLICY applications_insert ON campaign_applications
  FOR INSERT
  WITH CHECK (true); -- Controlled by backend

CREATE POLICY applications_update ON campaign_applications
  FOR UPDATE
  USING (true); -- Controlled by backend
