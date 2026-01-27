-- Phase 1: Core Architecture & Channel Listing Schema

-- 1. Campaigns Table (One-to-Many)
CREATE TABLE IF NOT EXISTS campaigns (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    advertiser_id UUID REFERENCES users(id),
    title TEXT NOT NULL,
    brief_text TEXT,
    creative_content JSONB, -- { type: 'photo', file_id: '...' }
    total_budget NUMERIC(15, 2) NOT NULL,
    slots INTEGER NOT NULL DEFAULT 1,
    individual_slot_budget NUMERIC(15, 2) NOT NULL,
    status TEXT NOT NULL DEFAULT 'open', -- 'open', 'closed', 'completed', 'cancelled'
    type TEXT NOT NULL DEFAULT 'open', -- 'open', 'closed'
    eligibility_criteria JSONB, -- { min_subscribers: 1000, categories: [...] }
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 2. Update Channels Table
ALTER TABLE channels 
ADD COLUMN IF NOT EXISTS is_verified BOOLEAN DEFAULT FALSE,
ADD COLUMN IF NOT EXISTS stats_json JSONB DEFAULT '{}',
ADD COLUMN IF NOT EXISTS permissions JSONB DEFAULT '{}', -- Bot permissions
ADD COLUMN IF NOT EXISTS pricing JSONB DEFAULT '{}', -- { base_price: 200, custom_options: [...] }
ADD COLUMN IF NOT EXISTS status TEXT DEFAULT 'active'; -- 'active', 'paused', 'delisted'

-- 3. Update Channel Admins (PR Managers & RBAC)
ALTER TABLE channel_admins
ADD COLUMN IF NOT EXISTS role TEXT DEFAULT 'manager', -- 'owner', 'manager'
ADD COLUMN IF NOT EXISTS permissions JSONB DEFAULT '{}'; -- { can_withdraw: false, can_approve_deal: true }

-- 4. Unlisted Drafts (Resume Listing Flow)
CREATE TABLE IF NOT EXISTS unlisted_drafts (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    telegram_channel_id BIGINT NOT NULL,
    user_id UUID REFERENCES users(id),
    draft_data JSONB NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    UNIQUE(telegram_channel_id, user_id)
);

-- 5. Wallets (Mock Ledger)
CREATE TABLE IF NOT EXISTS wallets (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES users(id) UNIQUE,
    balance NUMERIC(15, 2) DEFAULT 0.00,
    currency TEXT DEFAULT 'USD',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 6. Transactions (Internal Ledger)
CREATE TABLE IF NOT EXISTS transactions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    wallet_id UUID REFERENCES wallets(id),
    amount NUMERIC(15, 2) NOT NULL,
    type TEXT NOT NULL, -- 'deposit', 'escrow', 'payout', 'refund', 'withdrawal', 'fee'
    reference_id UUID, -- campaign_id or deal_id
    description TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 7. Update Deals (Direct Offers & Bidding)
ALTER TABLE deals
ADD COLUMN IF NOT EXISTS campaign_id UUID REFERENCES campaigns(id),
ADD COLUMN IF NOT EXISTS origin TEXT DEFAULT 'direct', -- 'campaign', 'direct'
ADD COLUMN IF NOT EXISTS negotiation_status TEXT DEFAULT 'pending', -- 'pending', 'accepted', 'rejected'
ADD COLUMN IF NOT EXISTS bids_today_count INTEGER DEFAULT 0,
ADD COLUMN IF NOT EXISTS last_bid_at TIMESTAMP WITH TIME ZONE,
ADD COLUMN IF NOT EXISTS bidding_history JSONB DEFAULT '[]';
