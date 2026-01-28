# Supabase RLS Security Implementation Guide

## ⚠️ CRITICAL: IMMEDIATE ACTION REQUIRED

Your Supabase database has **Row Level Security disabled** on multiple public tables. This is a **CRITICAL security vulnerability** that could allow unauthorized access to sensitive data.

---

## 📋 Implementation Steps

### Step 1: Backup Your Database
Before making any changes, create a backup:
1. Go to your Supabase Dashboard
2. Navigate to Database → Backups
3. Create a manual backup
4. Wait for confirmation

### Step 2: Review Your Schema
1. Go to Database → Schema Visualizer
2. Identify all column names in your tables (especially `user_id`, `creator_id`, `owner_id`)
3. Note any discrepancies with the provided SQL script

### Step 3: Test in Development First (HIGHLY RECOMMENDED)
1. If you have a development/staging environment, apply there first
2. Test all application functionality
3. Check for any access issues
4. Only proceed to production after successful testing

### Step 4: Run Security Audit
1. Go to SQL Editor in Supabase Dashboard
2. Copy contents of `security_audit.sql`
3. Run the script
4. Review all findings
5. Note any additional tables not covered in the main script

### Step 5: Customize the RLS Script
Open `enable_rls_security.sql` and review:

**Things to adjust based on your schema:**
- Column names (if different from `user_id`, `creator_id`, etc.)
- Public access requirements (some tables might need public read)
- Admin role requirements (if you have admin users)
- Business logic specific to your app

**Common customizations:**

```sql
-- If your user column is named differently
-- Change: auth.uid() = user_id
-- To:     auth.uid() = owner_id  (or whatever your column is called)

-- If campaigns should be completely public
CREATE POLICY "Anyone can view campaigns"
ON public.campaigns FOR SELECT
USING (true);

-- If you have an admin role
CREATE POLICY "Admins can do anything"
ON public.campaigns FOR ALL
USING (
    auth.jwt() ->> 'role' = 'admin'
);
```

### Step 6: Apply the RLS Script
1. Open SQL Editor in Supabase Dashboard
2. Copy the **customized** `enable_rls_security.sql` script
3. Review one more time
4. Execute the script
5. Check for any errors

### Step 7: Verify RLS is Working
Run the verification queries at the end of `enable_rls_security.sql`:

```sql
-- Check RLS is enabled
SELECT schemaname, tablename, rowsecurity as rls_enabled
FROM pg_tables 
WHERE schemaname = 'public';

-- Check policies exist
SELECT tablename, policyname, cmd
FROM pg_policies 
WHERE schemaname = 'public'
ORDER BY tablename;
```

Expected result: All critical tables should show `rls_enabled = true` and have policies.

### Step 8: Test Your Application
1. Log in as a regular user
2. Try to access different features
3. Verify users can only see their own data
4. Check that creation/update/delete operations work
5. Test edge cases (accessing another user's data should fail)

### Step 9: Monitor for Issues
For the first 24-48 hours:
1. Monitor Supabase logs for policy violations
2. Watch for user reports of access issues
3. Check error reporting tools for new errors
4. Be ready to adjust policies if needed

---

## 🚨 Emergency Rollback Procedure

If something goes wrong:

```sql
-- EMERGENCY: Disable RLS (temporarily while you fix issues)
ALTER TABLE public.campaigns DISABLE ROW LEVEL SECURITY;
-- Repeat for each affected table

-- Then investigate and fix the policies
-- Re-enable RLS once fixed
ALTER TABLE public.campaigns ENABLE ROW LEVEL SECURITY;
```

**WARNING:** Only use this as a last resort. Your data is exposed while RLS is disabled.

---

## 🔍 Common Issues and Solutions

### Issue: Users can't see any data after enabling RLS
**Solution:** Your policies might be too restrictive or column names are wrong.
```sql
-- Check what's being blocked
-- Look in Supabase Dashboard → Logs → Postgres Logs
```

### Issue: Users can see other users' data
**Solution:** Policies are too permissive. Review the `USING` clauses.

### Issue: Admin users need special access
**Solution:** Add admin policies:
```sql
CREATE POLICY "Admins full access"
ON public.campaigns FOR ALL
USING (
    (auth.jwt() ->> 'user_metadata')::json ->> 'role' = 'admin'
);
```

### Issue: Service role requests failing
**Solution:** Service role bypasses RLS. If you're seeing issues, you might be using anon key instead of service_role key in your backend.

---

## 🎯 Priority Tables (Fix These First)

Based on the screenshots, prioritize in this order:
1. **public.users** - Contains user data
2. **public.wallets** - Contains financial data
3. **public.transactions** - Contains financial transactions
4. **public.campaigns** - Business critical
5. **public.channels** - Business critical
6. **public.channel_admins** - Access control
7. **public.deals** - Business transactions
8. **public.public_briefs** - May contain sensitive info
9. **public.unlisted_drafts** - User content

---

## 📚 Additional Resources

- [Supabase RLS Documentation](https://supabase.com/docs/guides/auth/row-level-security)
- [PostgreSQL RLS Documentation](https://www.postgresql.org/docs/current/ddl-rowsecurity.html)
- [Supabase Policy Examples](https://supabase.com/docs/guides/auth/row-level-security#examples)

---

## ✅ Post-Implementation Checklist

- [ ] Backup created
- [ ] Schema reviewed
- [ ] Scripts customized for your schema
- [ ] Security audit run
- [ ] RLS script executed successfully
- [ ] All tables show RLS enabled
- [ ] Policies created for all tables
- [ ] Application tested with regular user
- [ ] Application tested with different user accounts
- [ ] Edge cases tested
- [ ] No errors in Supabase logs
- [ ] Team notified of changes
- [ ] Documentation updated

---

## 🆘 Need Help?

If you run into issues:
1. Check Supabase logs in Dashboard → Logs
2. Review the PostgreSQL error messages
3. Check the Supabase Discord community
4. Review your application's error logs
5. Test policies in isolation to identify the problematic one

---

## 📊 Understanding the Policies

### Policy Structure
```sql
CREATE POLICY "policy_name"
ON table_name
FOR operation              -- SELECT, INSERT, UPDATE, DELETE, or ALL
TO role                    -- authenticated, anon, or service_role
USING (condition)          -- For SELECT, UPDATE, DELETE (reading data)
WITH CHECK (condition);    -- For INSERT, UPDATE (writing data)
```

### Common Conditions
- `auth.uid() = user_id` - User owns the record
- `auth.uid() IS NOT NULL` - Any authenticated user
- `true` - Everyone (use sparingly!)
- `auth.jwt() ->> 'role' = 'admin'` - Admin users only

---

## 🔐 Security Best Practices

1. **Principle of Least Privilege**: Give users minimum access needed
2. **Test Policies**: Always test with actual user accounts
3. **Monitor Logs**: Watch for suspicious access patterns
4. **Regular Audits**: Run security audit monthly
5. **Document Changes**: Keep track of policy changes
6. **Separate Roles**: Use service_role only in secure backend
7. **Never Expose Keys**: Never use service_role key in frontend
8. **Review Regularly**: Security is ongoing, not one-time

---

**Remember:** RLS is your last line of defense. Even with RLS enabled, follow other security best practices like input validation, authentication, and monitoring.
