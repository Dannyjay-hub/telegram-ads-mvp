-- ============================================================================
-- RLS TESTING QUERIES
-- ============================================================================
-- Use these queries to test that your RLS policies are working correctly
-- ============================================================================

-- ============================================================================
-- SETUP: Create Test Users (Run as admin/service_role)
-- ============================================================================

-- Note: You'll need to create test users through Supabase Auth
-- These are just example queries to understand the testing process

-- Test User IDs (replace with actual user IDs from your auth.users table)
-- User 1: 11111111-1111-1111-1111-111111111111
-- User 2: 22222222-2222-2222-2222-222222222222

-- ============================================================================
-- TEST 1: Verify RLS is Enabled on All Tables
-- ============================================================================

SELECT 
    tablename,
    CASE 
        WHEN rowsecurity THEN '✅ ENABLED'
        ELSE '❌ DISABLED'
    END as rls_status
FROM pg_tables 
WHERE schemaname = 'public' 
AND tablename IN (
    'campaigns', 'channel_admins', 'channels', 'deals', 
    'public_briefs', 'transactions', 'unlisted_drafts', 'users', 'wallets'
)
ORDER BY tablename;

-- Expected: All tables should show "✅ ENABLED"

-- ============================================================================
-- TEST 2: Verify Policies Exist
-- ============================================================================

SELECT 
    tablename,
    COUNT(DISTINCT policyname) as policy_count,
    array_agg(DISTINCT cmd::text) as operations_covered
FROM pg_policies 
WHERE schemaname = 'public'
GROUP BY tablename
ORDER BY tablename;

-- Expected: Each table should have at least 1 policy

-- ============================================================================
-- TEST 3: Test User Isolation (Run these as different authenticated users)
-- ============================================================================

-- === TEST 3A: Users Table ===
-- When logged in as User 1, should only see their own profile
SELECT * FROM public.users 
WHERE id = auth.uid();
-- Expected: 1 row (your profile)

SELECT * FROM public.users 
WHERE id != auth.uid();
-- Expected: 0 rows OR public profiles only (depending on your policies)

-- === TEST 3B: Wallets Table ===
-- Should only see own wallet
SELECT * FROM public.wallets;
-- Expected: Only wallets where user_id = your user ID

-- Try to access another user's wallet
SELECT * FROM public.wallets 
WHERE user_id = '22222222-2222-2222-2222-222222222222';
-- Expected: 0 rows (unless you are that user)

-- === TEST 3C: Transactions Table ===
-- Should only see transactions you're involved in
SELECT * FROM public.transactions;
-- Expected: Only transactions where you are sender, recipient, or user

-- === TEST 3D: Campaigns Table ===
-- Can see all campaigns (if public read is enabled)
SELECT COUNT(*) FROM public.campaigns;
-- Expected: All campaigns OR only your campaigns (depends on policies)

-- Can only modify own campaigns
UPDATE public.campaigns 
SET title = 'Test Update'
WHERE id = 'some-campaign-id-you-dont-own';
-- Expected: 0 rows updated (should fail silently)

-- ============================================================================
-- TEST 4: Test Anonymous Access (Run without authentication)
-- ============================================================================

-- Set role to anonymous
SET LOCAL ROLE anon;

-- Try to access users table
SELECT * FROM public.users;
-- Expected: 0 rows or error (unless you have public read policy)

-- Try to access wallets
SELECT * FROM public.wallets;
-- Expected: 0 rows or error

-- Reset role
RESET ROLE;

-- ============================================================================
-- TEST 5: Test INSERT Operations
-- ============================================================================

-- As authenticated user, try to create record for another user
INSERT INTO public.wallets (id, user_id, balance)
VALUES (
    gen_random_uuid(),
    '22222222-2222-2222-2222-222222222222',  -- Different user
    100
);
-- Expected: Error or 0 rows inserted (policy should block this)

-- As authenticated user, create record for yourself
INSERT INTO public.wallets (id, user_id, balance)
VALUES (
    gen_random_uuid(),
    auth.uid(),  -- Your user ID
    100
);
-- Expected: Success (1 row inserted)

-- ============================================================================
-- TEST 6: Test UPDATE Operations
-- ============================================================================

-- Try to update another user's campaign
UPDATE public.campaigns 
SET description = 'Hacked!'
WHERE user_id != auth.uid()
LIMIT 1;
-- Expected: 0 rows updated

-- Update your own campaign
UPDATE public.campaigns 
SET description = 'My updated campaign'
WHERE user_id = auth.uid()
LIMIT 1;
-- Expected: 1 row updated (if you have campaigns)

-- ============================================================================
-- TEST 7: Test DELETE Operations
-- ============================================================================

-- Try to delete another user's draft
DELETE FROM public.unlisted_drafts
WHERE user_id != auth.uid()
LIMIT 1;
-- Expected: 0 rows deleted

-- Delete your own draft (if you have one)
DELETE FROM public.unlisted_drafts
WHERE user_id = auth.uid()
AND id = 'some-draft-id-you-want-to-delete';
-- Expected: 1 row deleted

-- ============================================================================
-- TEST 8: Test Complex Policies (Channel Admins)
-- ============================================================================

-- Create a test channel (as authenticated user)
INSERT INTO public.channels (id, owner_id, name)
VALUES (
    gen_random_uuid(),
    auth.uid(),
    'Test Channel'
)
RETURNING id;
-- Expected: Success, note the channel ID

-- Try to add admin to someone else's channel
INSERT INTO public.channel_admins (channel_id, user_id)
VALUES (
    'someone-elses-channel-id',
    auth.uid()
);
-- Expected: Error or 0 rows (you're not the channel owner)

-- ============================================================================
-- TEST 9: Test Service Role Bypass
-- ============================================================================

-- This must be run using service_role key (backend only)
-- Service role should bypass ALL RLS policies

-- As service role, you should be able to:
-- - Read all data from all tables
-- - Insert/update/delete any data
-- - Ignore all RLS restrictions

-- Example:
SELECT COUNT(*) FROM public.users;
-- Expected: Total count of ALL users (service role sees everything)

-- ⚠️ WARNING: Never use service_role key in frontend code!

-- ============================================================================
-- TEST 10: Stress Test - Multiple Concurrent Users
-- ============================================================================

-- Have 2-3 test users perform these operations simultaneously:
-- 1. Create their own campaigns
-- 2. Try to view each other's wallets
-- 3. Create transactions
-- 4. Update their own profiles

-- Monitor logs in Supabase Dashboard → Logs → Postgres Logs
-- Look for any policy violations or unexpected access

-- ============================================================================
-- TEST 11: Edge Cases
-- ============================================================================

-- === Test NULL values ===
-- Try to access records where user_id is NULL
SELECT * FROM public.campaigns WHERE user_id IS NULL;
-- Ensure these are handled correctly by your policies

-- === Test with fake/invalid UUID ===
-- Try to access with non-existent user ID
SELECT * FROM public.wallets 
WHERE user_id = '00000000-0000-0000-0000-000000000000';
-- Expected: 0 rows

-- === Test unauthenticated access ===
-- What happens if auth.uid() returns NULL?
-- Your policies should handle this gracefully

-- ============================================================================
-- INTERPRETING TEST RESULTS
-- ============================================================================

-- ✅ GOOD SIGNS:
-- - Users can only see their own data
-- - Attempts to access other users' data return 0 rows
-- - Service role can see everything
-- - Anonymous users have limited/no access
-- - All RLS tables show as enabled

-- ❌ BAD SIGNS:
-- - Users can see other users' sensitive data
-- - RLS disabled on any table
-- - Tables with no policies
-- - Errors when accessing own data
-- - Service role blocked by policies (shouldn't happen)

-- ============================================================================
-- CONTINUOUS TESTING
-- ============================================================================

-- Run these queries:
-- 1. After initial RLS setup
-- 2. After any policy changes
-- 3. After schema changes
-- 4. Monthly as part of security audit
-- 5. Before and after major deployments

-- ============================================================================
-- LOGGING AND MONITORING
-- ============================================================================

-- To see what's being blocked:
-- 1. Go to Supabase Dashboard
-- 2. Navigate to Logs → Postgres Logs
-- 3. Filter for "policy" or "permission denied"
-- 4. Analyze patterns of blocked access

-- To track policy performance:
SELECT 
    schemaname,
    tablename,
    policyname,
    'Run EXPLAIN ANALYZE on queries to see policy impact' as note
FROM pg_policies 
WHERE schemaname = 'public';

-- Example EXPLAIN with policy:
EXPLAIN ANALYZE
SELECT * FROM public.campaigns 
WHERE user_id = auth.uid();

-- ============================================================================
-- TROUBLESHOOTING FAILED TESTS
-- ============================================================================

-- If users can't access their own data:
-- 1. Check auth.uid() is returning correct value
SELECT auth.uid();

-- 2. Check user_id column name matches policy
\d public.campaigns  -- Shows table structure

-- 3. Check policy conditions
SELECT * FROM pg_policies 
WHERE tablename = 'campaigns';

-- If users can access other users' data:
-- 1. Check for overly permissive policies (USING true)
-- 2. Verify WHERE clauses in policies
-- 3. Check for missing policies on certain operations

-- ============================================================================
-- SUCCESS CRITERIA
-- ============================================================================

-- Your RLS implementation is successful when:
-- ✓ All tables have RLS enabled
-- ✓ All tables have appropriate policies
-- ✓ Users can only access their own data
-- ✓ Users can perform authorized operations
-- ✓ Unauthorized access attempts return 0 rows (not errors)
-- ✓ Service role has full access
-- ✓ No legitimate user complaints about access
-- ✓ Security audit shows no critical issues
-- ✓ Application performance is acceptable
-- ✓ Logs show normal activity, no excessive policy violations

-- ============================================================================
