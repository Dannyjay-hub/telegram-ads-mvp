-- ================================================================
-- TESTNET FULL DATABASE SETUP
-- Run this on a fresh Supabase project to create all tables
-- matching the current mainnet schema exactly.
-- ================================================================

-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ================================================================
-- 1. ENUMS
-- ================================================================
DO $$ BEGIN
    CREATE TYPE deal_status AS ENUM (
        'pending',
        'draft',
        'funded',
        'draft_pending',
        'draft_submitted',
        'changes_requested',
        'approved',
        'scheduling',
        'scheduled',
        'posted',
        'failed_to_post',
        'monitoring',
        'completed',
        'disputed',
        'refunded',
        'cancelled'
    );
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

-- ================================================================
-- 2. USERS (base table - no foreign key deps)
-- ================================================================
CREATE TABLE IF NOT EXISTS public.users (
    id UUID NOT NULL DEFAULT uuid_generate_v4(),
    telegram_id BIGINT NOT NULL UNIQUE,
    username TEXT,
    first_name TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    current_negotiating_deal_id UUID,  -- FK added later (circular ref with deals)
    ton_wallet_address TEXT,
    wallet_connected_at TIMESTAMPTZ,
    CONSTRAINT users_pkey PRIMARY KEY (id)
);

CREATE INDEX IF NOT EXISTS idx_users_wallet_address ON users(ton_wallet_address);

-- ================================================================
-- 3. CHANNELS (depends on: nothing)
-- ================================================================
CREATE TABLE IF NOT EXISTS public.channels (
    id UUID NOT NULL DEFAULT uuid_generate_v4(),
    telegram_channel_id BIGINT NOT NULL UNIQUE,
    title TEXT NOT NULL,
    username TEXT,
    photo_url TEXT,
    verified_stats JSONB DEFAULT '{}'::jsonb,
    description TEXT,
    base_price_amount NUMERIC,
    base_price_currency VARCHAR DEFAULT 'USD',
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    stats_json JSONB,
    avg_views INTEGER DEFAULT 0,
    rate_card JSONB DEFAULT '[]'::jsonb,
    is_verified BOOLEAN DEFAULT FALSE,
    permissions JSONB DEFAULT '{}'::jsonb,
    pricing JSONB DEFAULT '{}'::jsonb,
    status TEXT DEFAULT 'active',
    category JSONB,
    tags TEXT[],
    language JSONB,
    payout_wallet TEXT,
    avg_rating NUMERIC DEFAULT NULL,
    total_ratings INTEGER DEFAULT 0,
    CONSTRAINT channels_pkey PRIMARY KEY (id)
);

-- ================================================================
-- 4. CHANNEL_ADMINS (depends on: channels, users)
-- ================================================================
CREATE TABLE IF NOT EXISTS public.channel_admins (
    id UUID NOT NULL DEFAULT uuid_generate_v4(),
    channel_id UUID REFERENCES public.channels(id),
    user_id UUID REFERENCES public.users(id),
    can_negotiate BOOLEAN DEFAULT TRUE,
    can_approve_creative BOOLEAN DEFAULT FALSE,
    can_manage_finance BOOLEAN DEFAULT FALSE,
    is_owner BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    role TEXT DEFAULT 'manager',
    permissions JSONB DEFAULT '{}'::jsonb,
    CONSTRAINT channel_admins_pkey PRIMARY KEY (id)
);

-- ================================================================
-- 5. CAMPAIGNS (depends on: users)
-- ================================================================
CREATE TABLE IF NOT EXISTS public.campaigns (
    id UUID NOT NULL DEFAULT gen_random_uuid(),
    advertiser_id UUID REFERENCES public.users(id),
    title TEXT NOT NULL,
    brief_text TEXT,
    creative_content JSONB,
    total_budget NUMERIC NOT NULL,
    slots INTEGER NOT NULL DEFAULT 1,
    individual_slot_budget NUMERIC NOT NULL,
    status TEXT NOT NULL DEFAULT 'open',
    type TEXT NOT NULL DEFAULT 'open',
    eligibility_criteria JSONB,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    escrow_deposited NUMERIC DEFAULT 0,
    escrow_allocated NUMERIC DEFAULT 0,
    required_languages TEXT[],
    required_categories TEXT[],
    min_avg_views INTEGER DEFAULT 0,
    max_subscribers INTEGER,
    slots_filled INTEGER DEFAULT 0,
    expired_at TIMESTAMPTZ,
    media_urls TEXT[],
    escrow_wallet_address TEXT,
    escrow_funded BOOLEAN DEFAULT FALSE,
    starts_at TIMESTAMPTZ DEFAULT NOW(),
    currency TEXT DEFAULT 'TON',
    brief TEXT,
    campaign_type TEXT DEFAULT 'open',
    per_channel_budget NUMERIC,
    expires_at TIMESTAMPTZ,
    min_subscribers INTEGER DEFAULT 0,
    payment_memo TEXT UNIQUE,
    escrow_released NUMERIC DEFAULT 0,
    escrow_tx_hash TEXT,
    funded_at TIMESTAMPTZ,
    payment_expires_at TIMESTAMPTZ,
    draft_step INTEGER DEFAULT 0,
    expires_in_days INTEGER DEFAULT 7,
    escrow_available NUMERIC DEFAULT (COALESCE(escrow_deposited, 0) - COALESCE(escrow_allocated, 0)),
    expiry_notified BOOLEAN DEFAULT FALSE,
    refund_amount NUMERIC DEFAULT 0,
    ended_at TIMESTAMPTZ,
    CONSTRAINT campaigns_pkey PRIMARY KEY (id)
);

-- ================================================================
-- 6. PUBLIC_BRIEFS (depends on: users)
-- ================================================================
CREATE TABLE IF NOT EXISTS public.public_briefs (
    id UUID NOT NULL DEFAULT uuid_generate_v4(),
    advertiser_id UUID REFERENCES public.users(id),
    title TEXT NOT NULL,
    content TEXT NOT NULL,
    budget_range_min NUMERIC,
    budget_range_max NUMERIC,
    currency VARCHAR DEFAULT 'USD',
    tags TEXT[],
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    CONSTRAINT public_briefs_pkey PRIMARY KEY (id)
);

-- ================================================================
-- 7. WALLETS (depends on: users)
-- ================================================================
CREATE TABLE IF NOT EXISTS public.wallets (
    id UUID NOT NULL DEFAULT uuid_generate_v4(),
    user_id UUID REFERENCES public.users(id),
    balance NUMERIC DEFAULT 0.00 CHECK (balance >= 0),
    currency VARCHAR DEFAULT 'USD',
    CONSTRAINT wallets_pkey PRIMARY KEY (id)
);

-- ================================================================
-- 8. DEALS (depends on: users, channels, public_briefs, campaigns)
-- ================================================================
CREATE TABLE IF NOT EXISTS public.deals (
    id UUID NOT NULL DEFAULT uuid_generate_v4(),
    advertiser_id UUID REFERENCES public.users(id),
    channel_id UUID REFERENCES public.channels(id),
    brief_text TEXT,
    creative_content JSONB,
    price_amount NUMERIC NOT NULL,
    price_currency VARCHAR DEFAULT 'USD',
    escrow_wallet_id UUID,
    requested_post_time TIMESTAMPTZ,
    actual_post_time TIMESTAMPTZ,
    min_duration_hours INTEGER DEFAULT 24,
    status deal_status DEFAULT 'draft',
    rejection_reason TEXT,
    last_activity_at TIMESTAMPTZ DEFAULT NOW(),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    brief_id UUID REFERENCES public.public_briefs(id),
    package_title TEXT,
    package_description TEXT,
    campaign_id UUID REFERENCES public.campaigns(id),
    origin TEXT DEFAULT 'direct',
    negotiation_status TEXT DEFAULT 'pending',
    bids_today_count INTEGER DEFAULT 0,
    last_bid_at TIMESTAMPTZ,
    bidding_history JSONB DEFAULT '[]'::jsonb,
    content_items JSONB,
    payment_memo TEXT UNIQUE,
    advertiser_wallet_address TEXT,
    channel_owner_wallet TEXT,
    payment_tx_hash TEXT,
    payment_confirmed_at TIMESTAMPTZ,
    payout_tx_hash TEXT,
    payout_at TIMESTAMPTZ,
    refund_tx_hash TEXT,
    refund_at TIMESTAMPTZ,
    expires_at TIMESTAMPTZ,
    status_updated_at TIMESTAMPTZ DEFAULT NOW(),
    draft_text TEXT,
    draft_media_file_id TEXT,
    draft_media_type TEXT,
    draft_version INTEGER DEFAULT 0,
    draft_submitted_at TIMESTAMPTZ,
    draft_feedback TEXT,
    proposed_post_time TIMESTAMPTZ,
    time_proposed_by TEXT,
    agreed_post_time TIMESTAMPTZ,
    posted_message_id BIGINT,
    posted_at TIMESTAMPTZ,
    monitoring_end_at TIMESTAMPTZ,
    monitoring_checks INTEGER DEFAULT 0,
    last_checked_at TIMESTAMPTZ,
    funded_at TIMESTAMPTZ,
    status_history JSONB DEFAULT '[]'::jsonb,
    scheduled_checks JSONB DEFAULT '[]'::jsonb,
    next_check_at TIMESTAMPTZ,
    rating INTEGER CHECK (rating >= 1 AND rating <= 5),
    CONSTRAINT deals_pkey PRIMARY KEY (id)
);

-- Add circular FK from users → deals
ALTER TABLE users ADD CONSTRAINT users_current_negotiating_deal_id_fkey
    FOREIGN KEY (current_negotiating_deal_id) REFERENCES deals(id);

-- Deal indexes
CREATE INDEX IF NOT EXISTS idx_deals_next_check ON deals(next_check_at) 
    WHERE status = 'posted' AND next_check_at IS NOT NULL;

-- ================================================================
-- 9. CAMPAIGN_APPLICATIONS (depends on: campaigns, channels, deals)
-- ================================================================
CREATE TABLE IF NOT EXISTS public.campaign_applications (
    id UUID NOT NULL DEFAULT gen_random_uuid(),
    campaign_id UUID NOT NULL REFERENCES public.campaigns(id),
    channel_id UUID NOT NULL REFERENCES public.channels(id),
    status VARCHAR DEFAULT 'pending',
    deal_id UUID REFERENCES public.deals(id),
    applied_at TIMESTAMPTZ DEFAULT NOW(),
    reviewed_at TIMESTAMPTZ,
    CONSTRAINT campaign_applications_pkey PRIMARY KEY (id)
);

CREATE INDEX IF NOT EXISTS idx_applications_campaign ON campaign_applications(campaign_id);
CREATE INDEX IF NOT EXISTS idx_applications_channel ON campaign_applications(channel_id);

-- ================================================================
-- 10. DEAL_MESSAGES (depends on: deals, users)
-- ================================================================
CREATE TABLE IF NOT EXISTS public.deal_messages (
    id UUID NOT NULL DEFAULT gen_random_uuid(),
    deal_id UUID REFERENCES public.deals(id),
    sender_id UUID REFERENCES public.users(id),
    sender_role TEXT NOT NULL CHECK (sender_role = ANY (ARRAY['advertiser'::text, 'channel_owner'::text])),
    message_text TEXT,
    message_type TEXT DEFAULT 'text' CHECK (message_type = ANY (ARRAY['text'::text, 'photo'::text, 'action'::text, 'system'::text])),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    CONSTRAINT deal_messages_pkey PRIMARY KEY (id)
);

-- ================================================================
-- 11. TRANSACTIONS (depends on: wallets)
-- ================================================================
CREATE TABLE IF NOT EXISTS public.transactions (
    id UUID NOT NULL DEFAULT gen_random_uuid(),
    wallet_id UUID REFERENCES public.wallets(id),
    amount NUMERIC NOT NULL,
    type TEXT NOT NULL,
    reference_id UUID,
    description TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    CONSTRAINT transactions_pkey PRIMARY KEY (id)
);

-- ================================================================
-- 12. LATE_PAYMENTS (depends on: campaigns, deals)
-- ================================================================
CREATE TABLE IF NOT EXISTS public.late_payments (
    id UUID NOT NULL DEFAULT gen_random_uuid(),
    campaign_id UUID REFERENCES public.campaigns(id),
    deal_id UUID REFERENCES public.deals(id),
    memo TEXT NOT NULL,
    amount NUMERIC,
    currency TEXT DEFAULT 'TON',
    detected_at TIMESTAMPTZ DEFAULT NOW(),
    refund_status TEXT DEFAULT 'pending' CHECK (refund_status = ANY (ARRAY['pending'::text, 'refunded'::text, 'ignored'::text])),
    tx_hash TEXT,
    notes TEXT,
    CONSTRAINT late_payments_pkey PRIMARY KEY (id)
);

-- ================================================================
-- 13. PENDING_PAYOUTS (depends on: deals)
-- ================================================================
CREATE TABLE IF NOT EXISTS public.pending_payouts (
    id UUID NOT NULL DEFAULT gen_random_uuid(),
    deal_id UUID REFERENCES public.deals(id),
    recipient_address TEXT NOT NULL,
    amount_ton NUMERIC NOT NULL,
    memo TEXT,
    type TEXT DEFAULT 'payout',
    status TEXT DEFAULT 'pending',
    reason TEXT,
    tx_hash TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    completed_at TIMESTAMPTZ,
    error_message TEXT,
    retry_count INTEGER DEFAULT 0,
    currency TEXT DEFAULT 'TON',
    CONSTRAINT pending_payouts_pkey PRIMARY KEY (id)
);

CREATE INDEX IF NOT EXISTS idx_pending_payouts_status ON pending_payouts(status);
CREATE INDEX IF NOT EXISTS idx_pending_payouts_deal ON pending_payouts(deal_id);

-- ================================================================
-- 14. USER_CONTEXTS (depends on: users, deals)
-- ================================================================
CREATE TABLE IF NOT EXISTS public.user_contexts (
    user_id UUID NOT NULL REFERENCES public.users(id),
    context_type TEXT CHECK (context_type = ANY (ARRAY['draft'::text, 'chat'::text, 'schedule'::text, 'feedback'::text])),
    deal_id UUID REFERENCES public.deals(id),
    extra_data JSONB DEFAULT '{}'::jsonb,
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    CONSTRAINT user_contexts_pkey PRIMARY KEY (user_id)
);

-- ================================================================
-- 15. UNLISTED_DRAFTS (depends on: users)
-- ================================================================
CREATE TABLE IF NOT EXISTS public.unlisted_drafts (
    id UUID NOT NULL DEFAULT gen_random_uuid(),
    telegram_channel_id BIGINT NOT NULL,
    user_id UUID REFERENCES public.users(id),
    draft_data JSONB NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    CONSTRAINT unlisted_drafts_pkey PRIMARY KEY (id)
);

-- ================================================================
-- 16. BOT_CHANNEL_EVENTS (standalone)
-- ================================================================
CREATE TABLE IF NOT EXISTS public.bot_channel_events (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    chat_id BIGINT NOT NULL,
    chat_title TEXT,
    chat_username TEXT,
    chat_type TEXT DEFAULT 'channel',
    added_by_user_id BIGINT NOT NULL,
    bot_status TEXT NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_bot_channel_events_user ON bot_channel_events(added_by_user_id, created_at DESC);

-- ================================================================
-- DONE! Testnet database matches mainnet schema exactly.
-- ================================================================
