-- ============================================================================
-- SUPABASE ROW LEVEL SECURITY (RLS) FIX
-- ============================================================================
-- This script enables RLS and creates security policies for all exposed tables
-- Review and adjust policies based on your specific business requirements
-- ============================================================================

-- ============================================================================
-- STEP 1: ENABLE RLS ON ALL TABLES
-- ============================================================================

ALTER TABLE public.campaigns ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.channel_admins ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.channels ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.deals ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.public_briefs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.transactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.unlisted_drafts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.users ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.wallets ENABLE ROW LEVEL SECURITY;

-- ============================================================================
-- STEP 2: DROP EXISTING POLICIES (IF ANY)
-- ============================================================================
-- This ensures a clean slate. Remove this section if you want to keep existing policies

DO $$ 
DECLARE 
    r RECORD;
BEGIN
    FOR r IN (
        SELECT schemaname, tablename, policyname 
        FROM pg_policies 
        WHERE schemaname = 'public' 
        AND tablename IN (
            'campaigns', 'channel_admins', 'channels', 'deals', 
            'public_briefs', 'transactions', 'unlisted_drafts', 'users', 'wallets'
        )
    ) LOOP
        EXECUTE format('DROP POLICY IF EXISTS %I ON %I.%I', 
            r.policyname, r.schemaname, r.tablename);
    END LOOP;
END $$;

-- ============================================================================
-- STEP 3: CREATE RLS POLICIES
-- ============================================================================

-- ----------------------------------------------------------------------------
-- USERS TABLE POLICIES
-- ----------------------------------------------------------------------------
-- Users can read their own profile
CREATE POLICY "Users can view own profile"
ON public.users FOR SELECT
USING (auth.uid() = id);

-- Users can update their own profile
CREATE POLICY "Users can update own profile"
ON public.users FOR UPDATE
USING (auth.uid() = id);

-- Users can insert their own profile (for registration)
CREATE POLICY "Users can insert own profile"
ON public.users FOR INSERT
WITH CHECK (auth.uid() = id);

-- Optional: Allow public read of basic user info (username, avatar, etc.)
-- Uncomment if needed for public profiles
-- CREATE POLICY "Public profiles viewable"
-- ON public.users FOR SELECT
-- USING (true);

-- ----------------------------------------------------------------------------
-- WALLETS TABLE POLICIES
-- ----------------------------------------------------------------------------
-- Users can only view their own wallet
CREATE POLICY "Users can view own wallet"
ON public.wallets FOR SELECT
USING (auth.uid() = user_id);

-- Users can update their own wallet
CREATE POLICY "Users can update own wallet"
ON public.wallets FOR UPDATE
USING (auth.uid() = user_id);

-- Users can insert their own wallet
CREATE POLICY "Users can insert own wallet"
ON public.wallets FOR INSERT
WITH CHECK (auth.uid() = user_id);

-- ----------------------------------------------------------------------------
-- TRANSACTIONS TABLE POLICIES
-- ----------------------------------------------------------------------------
-- Users can view transactions they're involved in
CREATE POLICY "Users can view own transactions"
ON public.transactions FOR SELECT
USING (
    auth.uid() = user_id 
    OR auth.uid() = sender_id 
    OR auth.uid() = recipient_id
);

-- Users can create transactions (sender must be authenticated user)
CREATE POLICY "Users can create transactions"
ON public.transactions FOR INSERT
WITH CHECK (auth.uid() = sender_id OR auth.uid() = user_id);

-- Transactions are immutable after creation (no updates or deletes)
-- If you need to allow updates, add specific conditions

-- ----------------------------------------------------------------------------
-- CAMPAIGNS TABLE POLICIES
-- ----------------------------------------------------------------------------
-- Users can view all campaigns (assuming campaigns are public)
CREATE POLICY "Campaigns are viewable by all authenticated users"
ON public.campaigns FOR SELECT
TO authenticated
USING (true);

-- Users can view their own campaigns
CREATE POLICY "Users can view own campaigns"
ON public.campaigns FOR SELECT
USING (auth.uid() = user_id OR auth.uid() = creator_id);

-- Users can create campaigns
CREATE POLICY "Users can create campaigns"
ON public.campaigns FOR INSERT
WITH CHECK (auth.uid() = user_id OR auth.uid() = creator_id);

-- Users can update their own campaigns
CREATE POLICY "Users can update own campaigns"
ON public.campaigns FOR UPDATE
USING (auth.uid() = user_id OR auth.uid() = creator_id);

-- Users can delete their own campaigns
CREATE POLICY "Users can delete own campaigns"
ON public.campaigns FOR DELETE
USING (auth.uid() = user_id OR auth.uid() = creator_id);

-- ----------------------------------------------------------------------------
-- CHANNELS TABLE POLICIES
-- ----------------------------------------------------------------------------
-- All authenticated users can view channels
CREATE POLICY "Channels viewable by authenticated users"
ON public.channels FOR SELECT
TO authenticated
USING (true);

-- Only channel owners can create channels
CREATE POLICY "Users can create own channels"
ON public.channels FOR INSERT
WITH CHECK (auth.uid() = owner_id OR auth.uid() = user_id);

-- Only channel owners can update their channels
CREATE POLICY "Users can update own channels"
ON public.channels FOR UPDATE
USING (auth.uid() = owner_id OR auth.uid() = user_id);

-- Only channel owners can delete their channels
CREATE POLICY "Users can delete own channels"
ON public.channels FOR DELETE
USING (auth.uid() = owner_id OR auth.uid() = user_id);

-- ----------------------------------------------------------------------------
-- CHANNEL_ADMINS TABLE POLICIES
-- ----------------------------------------------------------------------------
-- Users can view admin assignments for channels they own or are admins of
CREATE POLICY "View channel admins"
ON public.channel_admins FOR SELECT
USING (
    auth.uid() IN (
        SELECT owner_id FROM public.channels WHERE id = channel_id
    )
    OR auth.uid() = user_id
);

-- Only channel owners can add admins
CREATE POLICY "Channel owners can add admins"
ON public.channel_admins FOR INSERT
WITH CHECK (
    auth.uid() IN (
        SELECT owner_id FROM public.channels WHERE id = channel_id
    )
);

-- Only channel owners can remove admins
CREATE POLICY "Channel owners can remove admins"
ON public.channel_admins FOR DELETE
USING (
    auth.uid() IN (
        SELECT owner_id FROM public.channels WHERE id = channel_id
    )
);

-- ----------------------------------------------------------------------------
-- DEALS TABLE POLICIES
-- ----------------------------------------------------------------------------
-- Users can view deals they're involved in
CREATE POLICY "Users can view related deals"
ON public.deals FOR SELECT
USING (
    auth.uid() = creator_id 
    OR auth.uid() = buyer_id 
    OR auth.uid() = seller_id
    OR auth.uid() = user_id
);

-- Users can create deals
CREATE POLICY "Users can create deals"
ON public.deals FOR INSERT
WITH CHECK (auth.uid() = creator_id OR auth.uid() = user_id);

-- Users can update deals they created
CREATE POLICY "Users can update own deals"
ON public.deals FOR UPDATE
USING (auth.uid() = creator_id OR auth.uid() = user_id);

-- ----------------------------------------------------------------------------
-- PUBLIC_BRIEFS TABLE POLICIES
-- ----------------------------------------------------------------------------
-- All authenticated users can view public briefs
CREATE POLICY "Public briefs viewable by authenticated users"
ON public.public_briefs FOR SELECT
TO authenticated
USING (true);

-- Users can create their own briefs
CREATE POLICY "Users can create public briefs"
ON public.public_briefs FOR INSERT
WITH CHECK (auth.uid() = user_id OR auth.uid() = creator_id);

-- Users can update their own briefs
CREATE POLICY "Users can update own public briefs"
ON public.public_briefs FOR UPDATE
USING (auth.uid() = user_id OR auth.uid() = creator_id);

-- Users can delete their own briefs
CREATE POLICY "Users can delete own public briefs"
ON public.public_briefs FOR DELETE
USING (auth.uid() = user_id OR auth.uid() = creator_id);

-- ----------------------------------------------------------------------------
-- UNLISTED_DRAFTS TABLE POLICIES
-- ----------------------------------------------------------------------------
-- Users can only view their own drafts
CREATE POLICY "Users can view own unlisted drafts"
ON public.unlisted_drafts FOR SELECT
USING (auth.uid() = user_id OR auth.uid() = creator_id);

-- Users can create their own drafts
CREATE POLICY "Users can create unlisted drafts"
ON public.unlisted_drafts FOR INSERT
WITH CHECK (auth.uid() = user_id OR auth.uid() = creator_id);

-- Users can update their own drafts
CREATE POLICY "Users can update own unlisted drafts"
ON public.unlisted_drafts FOR UPDATE
USING (auth.uid() = user_id OR auth.uid() = creator_id);

-- Users can delete their own drafts
CREATE POLICY "Users can delete own unlisted drafts"
ON public.unlisted_drafts FOR DELETE
USING (auth.uid() = user_id OR auth.uid() = creator_id);

-- ============================================================================
-- STEP 4: VERIFICATION QUERIES
-- ============================================================================
-- Run these to verify RLS is enabled and policies are created

-- Check RLS is enabled on all tables
SELECT 
    schemaname, 
    tablename, 
    rowsecurity as rls_enabled
FROM pg_tables 
WHERE schemaname = 'public' 
AND tablename IN (
    'campaigns', 'channel_admins', 'channels', 'deals', 
    'public_briefs', 'transactions', 'unlisted_drafts', 'users', 'wallets'
)
ORDER BY tablename;

-- Check all policies created
SELECT 
    schemaname,
    tablename,
    policyname,
    permissive,
    roles,
    cmd,
    qual,
    with_check
FROM pg_policies 
WHERE schemaname = 'public'
ORDER BY tablename, policyname;

-- ============================================================================
-- IMPORTANT NOTES:
-- ============================================================================
-- 1. These policies assume standard column names (user_id, creator_id, etc.)
--    Adjust based on your actual schema
-- 
-- 2. Some policies are commented out - uncomment if needed for your use case
--
-- 3. Test thoroughly in a development environment before applying to production
--
-- 4. After applying, test with different user roles to ensure access works correctly
--
-- 5. Consider creating custom database roles for admin/moderator access if needed
--
-- 6. Monitor your Supabase logs for policy violations to identify issues
--
-- 7. For service_role access (backend operations), policies are bypassed
--    Use service_role key only in secure server environments
-- ============================================================================
