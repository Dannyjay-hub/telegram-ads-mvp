-- ============================================================================
-- SUPABASE SECURITY AUDIT SCRIPT
-- ============================================================================
-- Run this script to identify other potential security issues
-- ============================================================================

-- ============================================================================
-- 1. CHECK ALL TABLES WITHOUT RLS ENABLED
-- ============================================================================
SELECT 
    schemaname,
    tablename,
    'RLS NOT ENABLED' as issue,
    'CRITICAL' as severity
FROM pg_tables 
WHERE schemaname = 'public' 
AND tablename NOT LIKE 'pg_%'
AND tablename NOT IN (
    SELECT tablename 
    FROM pg_tables 
    WHERE rowsecurity = true
)
ORDER BY tablename;

-- ============================================================================
-- 2. CHECK TABLES WITH RLS ENABLED BUT NO POLICIES
-- ============================================================================
SELECT 
    t.schemaname,
    t.tablename,
    'RLS ENABLED BUT NO POLICIES' as issue,
    'CRITICAL' as severity
FROM pg_tables t
WHERE t.schemaname = 'public'
AND t.rowsecurity = true
AND NOT EXISTS (
    SELECT 1 
    FROM pg_policies p 
    WHERE p.schemaname = t.schemaname 
    AND p.tablename = t.tablename
)
ORDER BY t.tablename;

-- ============================================================================
-- 3. CHECK FOR OVERLY PERMISSIVE POLICIES (USING true)
-- ============================================================================
SELECT 
    schemaname,
    tablename,
    policyname,
    cmd,
    'POLICY ALLOWS ALL ACCESS' as issue,
    'HIGH' as severity
FROM pg_policies 
WHERE schemaname = 'public'
AND (qual = 'true' OR with_check = 'true')
AND roles @> ARRAY['public']
ORDER BY tablename, policyname;

-- ============================================================================
-- 4. CHECK FOR PUBLICLY ACCESSIBLE FUNCTIONS
-- ============================================================================
SELECT 
    n.nspname as schema,
    p.proname as function_name,
    pg_get_function_arguments(p.oid) as arguments,
    'PUBLIC FUNCTION' as issue,
    'MEDIUM' as severity
FROM pg_proc p
LEFT JOIN pg_namespace n ON p.pronamespace = n.oid
WHERE n.nspname = 'public'
AND p.proacl IS NULL  -- No explicit ACL means public access
ORDER BY p.proname;

-- ============================================================================
-- 5. CHECK FOR TABLES WITH PUBLIC INSERT/UPDATE/DELETE GRANTS
-- ============================================================================
SELECT 
    schemaname,
    tablename,
    'PUBLIC GRANTS DETECTED' as issue,
    'CRITICAL' as severity,
    array_agg(privilege_type) as grants
FROM information_schema.table_privileges
WHERE grantee = 'PUBLIC'
AND table_schema = 'public'
AND privilege_type IN ('INSERT', 'UPDATE', 'DELETE')
GROUP BY schemaname, tablename
ORDER BY tablename;

-- ============================================================================
-- 6. LIST ALL CURRENT POLICIES BY TABLE
-- ============================================================================
SELECT 
    tablename,
    COUNT(*) as policy_count,
    array_agg(policyname) as policies,
    array_agg(cmd::text) as operations
FROM pg_policies 
WHERE schemaname = 'public'
GROUP BY tablename
ORDER BY tablename;

-- ============================================================================
-- 7. CHECK FOR EXPOSED API KEYS OR SECRETS IN DATABASE
-- ============================================================================
-- This checks for common secret column names
SELECT 
    table_schema,
    table_name,
    column_name,
    'POTENTIAL SECRET COLUMN' as issue,
    'HIGH' as severity
FROM information_schema.columns
WHERE table_schema = 'public'
AND (
    column_name ILIKE '%secret%'
    OR column_name ILIKE '%api_key%'
    OR column_name ILIKE '%password%'
    OR column_name ILIKE '%token%'
    OR column_name ILIKE '%credential%'
)
ORDER BY table_name, column_name;

-- ============================================================================
-- 8. CHECK FOR FOREIGN KEY RELATIONSHIPS (for policy design)
-- ============================================================================
SELECT
    tc.table_schema, 
    tc.constraint_name, 
    tc.table_name, 
    kcu.column_name,
    ccu.table_schema AS foreign_table_schema,
    ccu.table_name AS foreign_table_name,
    ccu.column_name AS foreign_column_name 
FROM information_schema.table_constraints AS tc 
JOIN information_schema.key_column_usage AS kcu
    ON tc.constraint_name = kcu.constraint_name
    AND tc.table_schema = kcu.table_schema
JOIN information_schema.constraint_column_usage AS ccu
    ON ccu.constraint_name = tc.constraint_name
WHERE tc.constraint_type = 'FOREIGN KEY' 
AND tc.table_schema = 'public'
ORDER BY tc.table_name, kcu.column_name;

-- ============================================================================
-- 9. SUMMARY REPORT
-- ============================================================================
SELECT 
    'Total Public Tables' as metric,
    COUNT(*)::text as value
FROM pg_tables 
WHERE schemaname = 'public'
UNION ALL
SELECT 
    'Tables with RLS Enabled' as metric,
    COUNT(*)::text as value
FROM pg_tables 
WHERE schemaname = 'public' AND rowsecurity = true
UNION ALL
SELECT 
    'Tables without RLS' as metric,
    COUNT(*)::text as value
FROM pg_tables 
WHERE schemaname = 'public' AND (rowsecurity = false OR rowsecurity IS NULL)
UNION ALL
SELECT 
    'Total Policies' as metric,
    COUNT(*)::text as value
FROM pg_policies 
WHERE schemaname = 'public';

-- ============================================================================
-- RECOMMENDED ACTIONS BASED ON FINDINGS:
-- ============================================================================
-- 1. Any table showing "RLS NOT ENABLED" should have RLS enabled immediately
-- 2. Tables with "NO POLICIES" need policies created before they're secure
-- 3. Review "OVERLY PERMISSIVE POLICIES" and restrict as needed
-- 4. Check "PUBLIC FUNCTIONS" and add security definer where appropriate
-- 5. Review "PUBLIC GRANTS" and revoke unnecessary permissions
-- 6. Ensure secret columns have proper encryption and access controls
-- ============================================================================
