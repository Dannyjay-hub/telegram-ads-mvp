-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- 1. Users table
-- Represents any actor in the system (Advertiser, Channel Owner, PR Manager)
CREATE TABLE users (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    telegram_id BIGINT UNIQUE NOT NULL,
    username TEXT,
    first_name TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 2. Channels table
-- Stores channel metadata and verified stats
CREATE TABLE channels (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    telegram_channel_id BIGINT UNIQUE NOT NULL, -- The actual Telegram ID (e.g., -100...)
    title TEXT NOT NULL,
    username TEXT, -- e.g., @channelname
    photo_url TEXT,
    
    -- "Verified channel stats (from Telegram)" stored flexibly
    -- Structure example: { "subscribers": 10000, "avg_views": 500, "languages": {"en": 80}, "premium_rank": 5 }
    verified_stats JSONB DEFAULT '{}'::jsonb,
    
    -- Listing settings
    description TEXT,
    base_price_amount NUMERIC(10, 2), -- MVP: Simple base price
    base_price_currency VARCHAR(3) DEFAULT 'USD',
    is_active BOOLEAN DEFAULT TRUE,
    
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 3. Channel Admins (PR Manager Flow)
-- Links Users to Channels with specific permissions
CREATE TABLE channel_admins (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    channel_id UUID REFERENCES channels(id) ON DELETE CASCADE,
    user_id UUID REFERENCES users(id) ON DELETE CASCADE,
    
    -- Permissions bitmask or booleans
    can_negotiate BOOLEAN DEFAULT TRUE,
    can_approve_creative BOOLEAN DEFAULT FALSE,
    can_manage_finance BOOLEAN DEFAULT FALSE, -- Only owner should usually have this
    
    is_owner BOOLEAN DEFAULT FALSE, -- The primary owner
    
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    UNIQUE(channel_id, user_id)
);

-- 4. Wallets
-- Internal ledger for holding funds
CREATE TABLE wallets (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID REFERENCES users(id) ON DELETE CASCADE,
    balance NUMERIC(15, 2) DEFAULT 0.00 CHECK (balance >= 0),
    currency VARCHAR(3) DEFAULT 'USD'
);

-- 5. Deals (The Core)
-- Represents the ad campaign lifecycle
CREATE TYPE deal_status AS ENUM (
    'draft',        -- Advertiser creating request
    'submitted',    -- Sent to channel (Pending Acceptance)
    'negotiating',  -- Optional loop for edits
    'funded',       -- Funds locked in escrow
    'approved',     -- Channel accepted, Creative approved (Ready to post)
    'posted',       -- Auto-posted by bot
    'monitoring',   -- Waiting period (e.g. 24h) to ensure post stays up
    'released',     -- Funds released to channel owner (Success)
    'cancelled',    -- Cancelled by user or timeout (Refunded)
    'disputed'      -- Manual intervention needed
);

CREATE TABLE deals (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    advertiser_id UUID REFERENCES users(id),
    channel_id UUID REFERENCES channels(id),
    
    -- Campaign Details
    brief_text TEXT,
    creative_content JSONB, -- The actual post content (text, media_ids)
    
    -- Financials
    price_amount NUMERIC(10, 2) NOT NULL,
    price_currency VARCHAR(3) DEFAULT 'USD',
    escrow_wallet_id UUID, -- Internal system wallet holding these funds temporarily
    
    -- Scheduling
    requested_post_time TIMESTAMP WITH TIME ZONE,
    actual_post_time TIMESTAMP WITH TIME ZONE,
    min_duration_hours INT DEFAULT 24, -- How long it must stay up
    
    -- Lifecycle
    status deal_status DEFAULT 'draft',
    rejection_reason TEXT,
    
    -- Timestamps for auto-cancellation logic
    last_activity_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 6. Public Briefs (Open Marketplace Requests)
-- Advertisers post these, Channels apply to them.
CREATE TABLE public_briefs (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    advertiser_id UUID REFERENCES users(id) ON DELETE CASCADE,
    
    title TEXT NOT NULL,
    content TEXT NOT NULL, -- Detailed requirements
    budget_range_min NUMERIC(10, 2),
    budget_range_max NUMERIC(10, 2),
    currency VARCHAR(3) DEFAULT 'USD',
    
    tags TEXT[], -- e.g. ['crypto', 'tech']
    
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Index for finding timed-out deals
CREATE INDEX idx_deals_status_last_activity ON deals(status, last_activity_at);
-- Index for quick lookups of a user's deals
CREATE INDEX idx_deals_advertiser ON deals(advertiser_id);
CREATE INDEX idx_deals_channel ON deals(channel_id);
-- Index for briefs
CREATE INDEX idx_briefs_active ON public_briefs(is_active);
