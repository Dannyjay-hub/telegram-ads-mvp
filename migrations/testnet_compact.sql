SET statement_timeout = 0;
SET lock_timeout = 0;
SET idle_in_transaction_session_timeout = 0;
SET transaction_timeout = 0;
SET client_encoding = 'UTF8';
SET standard_conforming_strings = on;
SELECT pg_catalog.set_config('search_path', '', false);
SET check_function_bodies = false;
SET xmloption = content;
SET client_min_messages = warning;
SET row_security = off;
CREATE SCHEMA IF NOT EXISTS public;
COMMENT ON SCHEMA public IS 'standard public schema';
CREATE TYPE public.deal_status AS ENUM (
    'pending',
    'draft',
    'submitted',
    'negotiating',
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
    'released',
    'cancelled',
    'disputed',
    'rejected',
    'pending_refund',
    'refunded'
);
CREATE FUNCTION public.allocate_campaign_slot(p_campaign_id uuid, p_per_channel_budget numeric) RETURNS TABLE(id uuid, advertiser_id uuid, title text, brief text, media_urls text[], total_budget numeric, per_channel_budget numeric, currency text, slots integer, slots_filled integer, status text, escrow_deposited numeric, escrow_allocated numeric, escrow_released numeric)
    LANGUAGE plpgsql
    AS $$
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
$$;
COMMENT ON FUNCTION public.allocate_campaign_slot(p_campaign_id uuid, p_per_channel_budget numeric) IS 'Atomic slot allocation - prevents race conditions when multiple channels accept';
CREATE FUNCTION public.sync_campaign_columns() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
BEGIN
    -- Sync brief <-> brief_text
    IF NEW.brief IS DISTINCT FROM OLD.brief THEN
        NEW.brief_text = NEW.brief;
    ELSIF NEW.brief_text IS DISTINCT FROM OLD.brief_text THEN
        NEW.brief = NEW.brief_text;
    END IF;
    
    -- Sync campaign_type <-> type
    IF NEW.campaign_type IS DISTINCT FROM OLD.campaign_type THEN
        NEW.type = NEW.campaign_type;
    ELSIF NEW.type IS DISTINCT FROM OLD.type THEN
        NEW.campaign_type = NEW.type;
    END IF;
    
    -- Sync per_channel_budget <-> individual_slot_budget
    IF NEW.per_channel_budget IS DISTINCT FROM OLD.per_channel_budget THEN
        NEW.individual_slot_budget = NEW.per_channel_budget;
    ELSIF NEW.individual_slot_budget IS DISTINCT FROM OLD.individual_slot_budget THEN
        NEW.per_channel_budget = NEW.individual_slot_budget;
    END IF;
    
    -- Sync expires_at <-> expired_at
    IF NEW.expires_at IS DISTINCT FROM OLD.expires_at THEN
        NEW.expired_at = NEW.expires_at;
    ELSIF NEW.expired_at IS DISTINCT FROM OLD.expired_at THEN
        NEW.expires_at = NEW.expired_at;
    END IF;
    
    RETURN NEW;
END;
$$;
CREATE FUNCTION public.sync_campaign_columns_insert() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
BEGIN
    -- Set defaults from existing columns for new inserts
    NEW.brief = COALESCE(NEW.brief, NEW.brief_text);
    NEW.brief_text = COALESCE(NEW.brief_text, NEW.brief);
    
    NEW.campaign_type = COALESCE(NEW.campaign_type, NEW.type, 'open');
    NEW.type = COALESCE(NEW.type, NEW.campaign_type, 'open');
    
    NEW.per_channel_budget = COALESCE(NEW.per_channel_budget, NEW.individual_slot_budget);
    NEW.individual_slot_budget = COALESCE(NEW.individual_slot_budget, NEW.per_channel_budget);
    
    NEW.expires_at = COALESCE(NEW.expires_at, NEW.expired_at);
    NEW.expired_at = COALESCE(NEW.expired_at, NEW.expires_at);
    
    RETURN NEW;
END;
$$;
SET default_tablespace = '';
SET default_table_access_method = heap;
CREATE TABLE public.bot_channel_events (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    chat_id bigint NOT NULL,
    chat_title text,
    chat_username text,
    chat_type text DEFAULT 'channel'::text,
    added_by_user_id bigint NOT NULL,
    bot_status text NOT NULL,
    created_at timestamp with time zone DEFAULT now()
);
CREATE TABLE public.campaign_applications (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    campaign_id uuid NOT NULL,
    channel_id uuid NOT NULL,
    status character varying(20) DEFAULT 'pending'::character varying,
    deal_id uuid,
    applied_at timestamp with time zone DEFAULT now(),
    reviewed_at timestamp with time zone
);
CREATE TABLE public.campaigns (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    advertiser_id uuid,
    title text NOT NULL,
    brief_text text,
    creative_content jsonb,
    total_budget numeric(15,2) NOT NULL,
    slots integer DEFAULT 1 NOT NULL,
    individual_slot_budget numeric(15,2) NOT NULL,
    status text DEFAULT 'open'::text NOT NULL,
    type text DEFAULT 'open'::text NOT NULL,
    eligibility_criteria jsonb,
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now(),
    escrow_deposited numeric(18,4) DEFAULT 0,
    escrow_allocated numeric(18,4) DEFAULT 0,
    required_languages character varying(10)[],
    required_categories character varying(50)[],
    min_avg_views integer DEFAULT 0,
    max_subscribers integer,
    slots_filled integer DEFAULT 0,
    expired_at timestamp with time zone,
    media_urls text[],
    escrow_wallet_address text,
    escrow_funded boolean DEFAULT false,
    starts_at timestamp with time zone DEFAULT now(),
    currency text DEFAULT 'TON'::text,
    brief text,
    campaign_type text DEFAULT 'open'::text,
    per_channel_budget numeric(20,8),
    expires_at timestamp with time zone,
    min_subscribers integer DEFAULT 0,
    payment_memo text,
    escrow_released numeric(18,4) DEFAULT 0,
    escrow_tx_hash text,
    funded_at timestamp with time zone,
    payment_expires_at timestamp with time zone,
    draft_step integer DEFAULT 0,
    expires_in_days integer DEFAULT 7,
    escrow_available numeric(20,8) GENERATED ALWAYS AS ((COALESCE(escrow_deposited, (0)::numeric) - COALESCE(escrow_allocated, (0)::numeric))) STORED,
    expiry_notified boolean DEFAULT false,
    refund_amount numeric DEFAULT 0,
    ended_at timestamp with time zone
);
COMMENT ON COLUMN public.campaigns.escrow_deposited IS 'Total amount deposited by advertiser';
COMMENT ON COLUMN public.campaigns.escrow_allocated IS 'Amount allocated to accepted channels';
COMMENT ON COLUMN public.campaigns.media_urls IS 'Array of media URLs for campaign creative content';
COMMENT ON COLUMN public.campaigns.escrow_wallet_address IS 'TON wallet address holding escrowed funds';
COMMENT ON COLUMN public.campaigns.escrow_funded IS 'Whether the campaign has been funded with escrow';
COMMENT ON COLUMN public.campaigns.starts_at IS 'When the campaign becomes active';
COMMENT ON COLUMN public.campaigns.brief IS 'Alias for brief_text - campaign description/instructions';
COMMENT ON COLUMN public.campaigns.campaign_type IS 'Alias for type - open or closed';
COMMENT ON COLUMN public.campaigns.per_channel_budget IS 'Alias for individual_slot_budget - budget per channel';
COMMENT ON COLUMN public.campaigns.expires_at IS 'Alias for expired_at - campaign expiration time';
COMMENT ON COLUMN public.campaigns.payment_memo IS 'Unique memo string for TON transaction matching (campaign_<uuid>)';
COMMENT ON COLUMN public.campaigns.escrow_released IS 'Amount released to channel owners after completion';
COMMENT ON COLUMN public.campaigns.escrow_tx_hash IS 'Transaction hash of the escrow deposit';
COMMENT ON COLUMN public.campaigns.funded_at IS 'Timestamp when escrow was deposited';
COMMENT ON COLUMN public.campaigns.escrow_available IS 'Auto-computed: escrow_deposited - escrow_allocated. Do not update directly.';
CREATE TABLE public.channel_admins (
    id uuid DEFAULT extensions.uuid_generate_v4() NOT NULL,
    channel_id uuid,
    user_id uuid,
    can_negotiate boolean DEFAULT true,
    can_approve_creative boolean DEFAULT false,
    can_manage_finance boolean DEFAULT false,
    is_owner boolean DEFAULT false,
    created_at timestamp with time zone DEFAULT now(),
    role text DEFAULT 'manager'::text,
    permissions jsonb DEFAULT '{}'::jsonb
);
CREATE TABLE public.channels (
    id uuid DEFAULT extensions.uuid_generate_v4() NOT NULL,
    telegram_channel_id bigint NOT NULL,
    title text NOT NULL,
    username text,
    photo_url text,
    verified_stats jsonb DEFAULT '{}'::jsonb,
    description text,
    base_price_amount numeric(10,2),
    base_price_currency character varying(10) DEFAULT 'USD'::character varying,
    is_active boolean DEFAULT true,
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now(),
    stats_json jsonb,
    avg_views integer DEFAULT 0,
    rate_card jsonb DEFAULT '[]'::jsonb,
    is_verified boolean DEFAULT false,
    permissions jsonb DEFAULT '{}'::jsonb,
    pricing jsonb DEFAULT '{}'::jsonb,
    status text DEFAULT 'active'::text,
    category jsonb,
    tags text[],
    language jsonb,
    payout_wallet text,
    avg_rating numeric(3,2) DEFAULT NULL::numeric,
    total_ratings integer DEFAULT 0
);
COMMENT ON COLUMN public.channels.payout_wallet IS 'TON wallet address for receiving payouts, set by channel owner during listing';
CREATE TABLE public.deal_messages (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    deal_id uuid,
    sender_id uuid,
    sender_role text NOT NULL,
    message_text text,
    message_type text DEFAULT 'text'::text,
    created_at timestamp with time zone DEFAULT now(),
    CONSTRAINT deal_messages_message_type_check CHECK ((message_type = ANY (ARRAY['text'::text, 'photo'::text, 'action'::text, 'system'::text]))),
    CONSTRAINT deal_messages_sender_role_check CHECK ((sender_role = ANY (ARRAY['advertiser'::text, 'channel_owner'::text])))
);
COMMENT ON TABLE public.deal_messages IS 'Chat messages between advertiser and channel owner for a deal';
CREATE TABLE public.deals (
    id uuid DEFAULT extensions.uuid_generate_v4() NOT NULL,
    advertiser_id uuid,
    channel_id uuid,
    brief_text text,
    creative_content jsonb,
    price_amount numeric(10,2) NOT NULL,
    price_currency character varying(10) DEFAULT 'USD'::character varying,
    escrow_wallet_id uuid,
    requested_post_time timestamp with time zone,
    actual_post_time timestamp with time zone,
    min_duration_hours integer DEFAULT 24,
    status public.deal_status DEFAULT 'draft'::public.deal_status,
    rejection_reason text,
    last_activity_at timestamp with time zone DEFAULT now(),
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now(),
    brief_id uuid,
    package_title text,
    package_description text,
    campaign_id uuid,
    origin text DEFAULT 'direct'::text,
    negotiation_status text DEFAULT 'pending'::text,
    bids_today_count integer DEFAULT 0,
    last_bid_at timestamp with time zone,
    bidding_history jsonb DEFAULT '[]'::jsonb,
    content_items jsonb,
    payment_memo text,
    advertiser_wallet_address text,
    channel_owner_wallet text,
    payment_tx_hash text,
    payment_confirmed_at timestamp with time zone,
    payout_tx_hash text,
    payout_at timestamp with time zone,
    refund_tx_hash text,
    refund_at timestamp with time zone,
    expires_at timestamp with time zone,
    status_updated_at timestamp with time zone DEFAULT now(),
    draft_text text,
    draft_media_file_id text,
    draft_media_type text,
    draft_version integer DEFAULT 0,
    draft_submitted_at timestamp with time zone,
    draft_feedback text,
    proposed_post_time timestamp with time zone,
    time_proposed_by text,
    agreed_post_time timestamp with time zone,
    posted_message_id bigint,
    posted_at timestamp with time zone,
    monitoring_end_at timestamp with time zone,
    monitoring_checks integer DEFAULT 0,
    last_checked_at timestamp with time zone,
    funded_at timestamp with time zone,
    status_history jsonb DEFAULT '[]'::jsonb,
    scheduled_checks jsonb DEFAULT '[]'::jsonb,
    next_check_at timestamp with time zone,
    rating integer,
    CONSTRAINT deals_rating_check CHECK (((rating >= 1) AND (rating <= 5)))
);
COMMENT ON COLUMN public.deals.content_items IS 'Array of selected packages: [{type, title, quantity, unit_price}]';
COMMENT ON COLUMN public.deals.payment_memo IS 'Unique memo string for TON transaction matching';
COMMENT ON COLUMN public.deals.advertiser_wallet_address IS 'TON wallet address for refunds';
COMMENT ON COLUMN public.deals.channel_owner_wallet IS 'TON wallet address for payouts';
COMMENT ON COLUMN public.deals.draft_text IS 'Current draft content (text/caption)';
COMMENT ON COLUMN public.deals.draft_media_file_id IS 'Telegram file_id for attached media';
COMMENT ON COLUMN public.deals.draft_media_type IS 'Type of media: photo, video, document';
COMMENT ON COLUMN public.deals.draft_version IS 'Revision count for draft iterations';
COMMENT ON COLUMN public.deals.draft_submitted_at IS 'When current draft was submitted for review';
COMMENT ON COLUMN public.deals.draft_feedback IS 'Latest feedback from advertiser on draft';
COMMENT ON COLUMN public.deals.proposed_post_time IS 'Currently proposed posting time';
COMMENT ON COLUMN public.deals.time_proposed_by IS 'Who proposed the current time: advertiser or channel_owner';
COMMENT ON COLUMN public.deals.agreed_post_time IS 'Locked posting time after agreement';
COMMENT ON COLUMN public.deals.posted_message_id IS 'Telegram message ID of the posted content';
COMMENT ON COLUMN public.deals.posted_at IS 'When the post went live';
COMMENT ON COLUMN public.deals.monitoring_end_at IS 'When 24h monitoring period ends';
COMMENT ON COLUMN public.deals.status_history IS 'JSON array tracking all status transitions';
COMMENT ON COLUMN public.deals.scheduled_checks IS 'JSONB array of {time: ISO timestamp, completed: boolean} for random verification checks';
COMMENT ON COLUMN public.deals.next_check_at IS 'Earliest pending check time for efficient background job queries';
CREATE TABLE public.late_payments (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    campaign_id uuid,
    deal_id uuid,
    memo text NOT NULL,
    amount numeric,
    currency text DEFAULT 'TON'::text,
    detected_at timestamp with time zone DEFAULT now(),
    refund_status text DEFAULT 'pending'::text,
    tx_hash text,
    notes text,
    CONSTRAINT late_payments_refund_status_check CHECK ((refund_status = ANY (ARRAY['pending'::text, 'refunded'::text, 'ignored'::text])))
);
CREATE TABLE public.pending_payouts (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    deal_id uuid,
    recipient_address text NOT NULL,
    amount_ton numeric(15,9) NOT NULL,
    memo text,
    type text DEFAULT 'payout'::text,
    status text DEFAULT 'pending'::text,
    reason text,
    tx_hash text,
    created_at timestamp with time zone DEFAULT now(),
    completed_at timestamp with time zone,
    error_message text,
    retry_count integer DEFAULT 0,
    currency text DEFAULT 'TON'::text
);
COMMENT ON TABLE public.pending_payouts IS 'Queue of pending TON payouts and refunds for manual or automated execution';
CREATE TABLE public.public_briefs (
    id uuid DEFAULT extensions.uuid_generate_v4() NOT NULL,
    advertiser_id uuid,
    title text NOT NULL,
    content text NOT NULL,
    budget_range_min numeric(10,2),
    budget_range_max numeric(10,2),
    currency character varying(10) DEFAULT 'USD'::character varying,
    tags text[],
    is_active boolean DEFAULT true,
    created_at timestamp with time zone DEFAULT now()
);
CREATE TABLE public.transactions (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    wallet_id uuid,
    amount numeric(15,2) NOT NULL,
    type text NOT NULL,
    reference_id uuid,
    description text,
    created_at timestamp with time zone DEFAULT now()
);
CREATE TABLE public.unlisted_drafts (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    telegram_channel_id bigint NOT NULL,
    user_id uuid,
    draft_data jsonb NOT NULL,
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now()
);
CREATE TABLE public.user_contexts (
    user_id uuid NOT NULL,
    context_type text,
    deal_id uuid,
    extra_data jsonb DEFAULT '{}'::jsonb,
    updated_at timestamp with time zone DEFAULT now(),
    CONSTRAINT user_contexts_context_type_check CHECK ((context_type = ANY (ARRAY['draft'::text, 'chat'::text, 'schedule'::text, 'feedback'::text])))
);
COMMENT ON TABLE public.user_contexts IS 'Tracks current bot conversation state per user';
CREATE TABLE public.users (
    id uuid DEFAULT extensions.uuid_generate_v4() NOT NULL,
    telegram_id bigint NOT NULL,
    username text,
    first_name text,
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now(),
    current_negotiating_deal_id uuid,
    ton_wallet_address text,
    wallet_connected_at timestamp with time zone
);
CREATE TABLE public.wallets (
    id uuid DEFAULT extensions.uuid_generate_v4() NOT NULL,
    user_id uuid,
    balance numeric(15,2) DEFAULT 0.00,
    currency character varying(10) DEFAULT 'USD'::character varying,
    CONSTRAINT wallets_balance_check CHECK ((balance >= (0)::numeric))
);
ALTER TABLE ONLY public.bot_channel_events
    ADD CONSTRAINT bot_channel_events_pkey PRIMARY KEY (id);
ALTER TABLE ONLY public.campaign_applications
    ADD CONSTRAINT campaign_applications_campaign_id_channel_id_key UNIQUE (campaign_id, channel_id);
ALTER TABLE ONLY public.campaign_applications
    ADD CONSTRAINT campaign_applications_pkey PRIMARY KEY (id);
ALTER TABLE ONLY public.campaigns
    ADD CONSTRAINT campaigns_payment_memo_key UNIQUE (payment_memo);
ALTER TABLE ONLY public.campaigns
    ADD CONSTRAINT campaigns_pkey PRIMARY KEY (id);
ALTER TABLE ONLY public.channel_admins
    ADD CONSTRAINT channel_admins_channel_id_user_id_key UNIQUE (channel_id, user_id);
ALTER TABLE ONLY public.channel_admins
    ADD CONSTRAINT channel_admins_pkey PRIMARY KEY (id);
ALTER TABLE ONLY public.channels
    ADD CONSTRAINT channels_pkey PRIMARY KEY (id);
ALTER TABLE ONLY public.channels
    ADD CONSTRAINT channels_telegram_channel_id_key UNIQUE (telegram_channel_id);
ALTER TABLE ONLY public.deal_messages
    ADD CONSTRAINT deal_messages_pkey PRIMARY KEY (id);
ALTER TABLE ONLY public.deals
    ADD CONSTRAINT deals_payment_memo_key UNIQUE (payment_memo);
ALTER TABLE ONLY public.deals
    ADD CONSTRAINT deals_pkey PRIMARY KEY (id);
ALTER TABLE ONLY public.late_payments
    ADD CONSTRAINT late_payments_pkey PRIMARY KEY (id);
ALTER TABLE ONLY public.pending_payouts
    ADD CONSTRAINT pending_payouts_pkey PRIMARY KEY (id);
ALTER TABLE ONLY public.public_briefs
    ADD CONSTRAINT public_briefs_pkey PRIMARY KEY (id);
ALTER TABLE ONLY public.transactions
    ADD CONSTRAINT transactions_pkey PRIMARY KEY (id);
ALTER TABLE ONLY public.unlisted_drafts
    ADD CONSTRAINT unlisted_drafts_pkey PRIMARY KEY (id);
ALTER TABLE ONLY public.unlisted_drafts
    ADD CONSTRAINT unlisted_drafts_telegram_channel_id_user_id_key UNIQUE (telegram_channel_id, user_id);
ALTER TABLE ONLY public.user_contexts
    ADD CONSTRAINT user_contexts_pkey PRIMARY KEY (user_id);
ALTER TABLE ONLY public.users
    ADD CONSTRAINT users_pkey PRIMARY KEY (id);
ALTER TABLE ONLY public.users
    ADD CONSTRAINT users_telegram_id_key UNIQUE (telegram_id);
ALTER TABLE ONLY public.wallets
    ADD CONSTRAINT wallets_pkey PRIMARY KEY (id);
CREATE INDEX idx_bot_channel_events_user ON public.bot_channel_events USING btree (added_by_user_id, created_at DESC);
CREATE INDEX idx_briefs_active ON public.public_briefs USING btree (is_active);
CREATE INDEX idx_campaign_apps_campaign ON public.campaign_applications USING btree (campaign_id);
CREATE INDEX idx_campaign_apps_channel ON public.campaign_applications USING btree (channel_id);
CREATE INDEX idx_campaigns_active_available ON public.campaigns USING btree (status, slots_filled, slots) WHERE (status = 'active'::text);
CREATE INDEX idx_campaigns_advertiser ON public.campaigns USING btree (advertiser_id);
CREATE INDEX idx_campaigns_expiring ON public.campaigns USING btree (expires_at, status) WHERE (expires_at IS NOT NULL);
CREATE INDEX idx_campaigns_payment_memo ON public.campaigns USING btree (payment_memo) WHERE (payment_memo IS NOT NULL);
CREATE INDEX idx_campaigns_status ON public.campaigns USING btree (status);
CREATE INDEX idx_deal_messages_created ON public.deal_messages USING btree (deal_id, created_at DESC);
CREATE INDEX idx_deal_messages_deal ON public.deal_messages USING btree (deal_id);
CREATE INDEX idx_deals_advertiser ON public.deals USING btree (advertiser_id);
CREATE INDEX idx_deals_campaign ON public.deals USING btree (campaign_id);
CREATE INDEX idx_deals_channel ON public.deals USING btree (channel_id);
CREATE INDEX idx_deals_expires ON public.deals USING btree (expires_at) WHERE (status = ANY (ARRAY['draft'::public.deal_status, 'submitted'::public.deal_status, 'funded'::public.deal_status]));
CREATE INDEX idx_deals_next_check ON public.deals USING btree (next_check_at) WHERE ((status = 'posted'::public.deal_status) AND (next_check_at IS NOT NULL));
CREATE INDEX idx_deals_payment_memo ON public.deals USING btree (payment_memo);
CREATE INDEX idx_deals_status_last_activity ON public.deals USING btree (status, last_activity_at);
CREATE INDEX idx_late_payments_memo ON public.late_payments USING btree (memo);
CREATE INDEX idx_late_payments_status ON public.late_payments USING btree (refund_status);
CREATE INDEX idx_pending_payouts_deal ON public.pending_payouts USING btree (deal_id);
CREATE INDEX idx_pending_payouts_status ON public.pending_payouts USING btree (status);
CREATE INDEX idx_users_wallet_address ON public.users USING btree (ton_wallet_address);
CREATE TRIGGER campaign_column_sync BEFORE UPDATE ON public.campaigns FOR EACH ROW EXECUTE FUNCTION public.sync_campaign_columns();
CREATE TRIGGER campaign_column_sync_insert BEFORE INSERT ON public.campaigns FOR EACH ROW EXECUTE FUNCTION public.sync_campaign_columns_insert();
ALTER TABLE ONLY public.campaign_applications
    ADD CONSTRAINT campaign_applications_campaign_id_fkey FOREIGN KEY (campaign_id) REFERENCES public.campaigns(id) ON DELETE CASCADE;
ALTER TABLE ONLY public.campaign_applications
    ADD CONSTRAINT campaign_applications_channel_id_fkey FOREIGN KEY (channel_id) REFERENCES public.channels(id) ON DELETE CASCADE;
ALTER TABLE ONLY public.campaign_applications
    ADD CONSTRAINT campaign_applications_deal_id_fkey FOREIGN KEY (deal_id) REFERENCES public.deals(id);
ALTER TABLE ONLY public.campaigns
    ADD CONSTRAINT campaigns_advertiser_id_fkey FOREIGN KEY (advertiser_id) REFERENCES public.users(id);
ALTER TABLE ONLY public.channel_admins
    ADD CONSTRAINT channel_admins_channel_id_fkey FOREIGN KEY (channel_id) REFERENCES public.channels(id) ON DELETE CASCADE;
ALTER TABLE ONLY public.channel_admins
    ADD CONSTRAINT channel_admins_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(id) ON DELETE CASCADE;
ALTER TABLE ONLY public.deal_messages
    ADD CONSTRAINT deal_messages_deal_id_fkey FOREIGN KEY (deal_id) REFERENCES public.deals(id) ON DELETE CASCADE;
ALTER TABLE ONLY public.deal_messages
    ADD CONSTRAINT deal_messages_sender_id_fkey FOREIGN KEY (sender_id) REFERENCES public.users(id);
ALTER TABLE ONLY public.deals
    ADD CONSTRAINT deals_advertiser_id_fkey FOREIGN KEY (advertiser_id) REFERENCES public.users(id);
ALTER TABLE ONLY public.deals
    ADD CONSTRAINT deals_brief_id_fkey FOREIGN KEY (brief_id) REFERENCES public.public_briefs(id);
ALTER TABLE ONLY public.deals
    ADD CONSTRAINT deals_campaign_id_fkey FOREIGN KEY (campaign_id) REFERENCES public.campaigns(id);
ALTER TABLE ONLY public.deals
    ADD CONSTRAINT deals_channel_id_fkey FOREIGN KEY (channel_id) REFERENCES public.channels(id);
ALTER TABLE ONLY public.late_payments
    ADD CONSTRAINT late_payments_campaign_id_fkey FOREIGN KEY (campaign_id) REFERENCES public.campaigns(id) ON DELETE SET NULL;
ALTER TABLE ONLY public.late_payments
    ADD CONSTRAINT late_payments_deal_id_fkey FOREIGN KEY (deal_id) REFERENCES public.deals(id) ON DELETE SET NULL;
ALTER TABLE ONLY public.pending_payouts
    ADD CONSTRAINT pending_payouts_deal_id_fkey FOREIGN KEY (deal_id) REFERENCES public.deals(id);
ALTER TABLE ONLY public.public_briefs
    ADD CONSTRAINT public_briefs_advertiser_id_fkey FOREIGN KEY (advertiser_id) REFERENCES public.users(id) ON DELETE CASCADE;
ALTER TABLE ONLY public.transactions
    ADD CONSTRAINT transactions_wallet_id_fkey FOREIGN KEY (wallet_id) REFERENCES public.wallets(id);
ALTER TABLE ONLY public.unlisted_drafts
    ADD CONSTRAINT unlisted_drafts_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(id);
ALTER TABLE ONLY public.user_contexts
    ADD CONSTRAINT user_contexts_deal_id_fkey FOREIGN KEY (deal_id) REFERENCES public.deals(id) ON DELETE SET NULL;
ALTER TABLE ONLY public.user_contexts
    ADD CONSTRAINT user_contexts_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(id) ON DELETE CASCADE;
ALTER TABLE ONLY public.users
    ADD CONSTRAINT users_current_negotiating_deal_id_fkey FOREIGN KEY (current_negotiating_deal_id) REFERENCES public.deals(id);
ALTER TABLE ONLY public.wallets
    ADD CONSTRAINT wallets_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(id) ON DELETE CASCADE;
