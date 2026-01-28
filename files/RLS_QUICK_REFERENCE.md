# Supabase RLS Quick Reference Guide

## 🎯 Common Policy Patterns

### 1. User Owns Record
```sql
-- Users can only access their own records
CREATE POLICY "users_own_records"
ON table_name FOR ALL
USING (auth.uid() = user_id);
```

### 2. Public Read, Owner Write
```sql
-- Anyone can read, only owner can modify
CREATE POLICY "public_read"
ON table_name FOR SELECT
USING (true);

CREATE POLICY "owner_write"
ON table_name FOR INSERT
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "owner_update"
ON table_name FOR UPDATE
USING (auth.uid() = user_id);

CREATE POLICY "owner_delete"
ON table_name FOR DELETE
USING (auth.uid() = user_id);
```

### 3. Authenticated Users Only
```sql
-- Only logged-in users can access
CREATE POLICY "authenticated_only"
ON table_name FOR ALL
TO authenticated
USING (true);
```

### 4. Admin Full Access
```sql
-- Admins can do anything
CREATE POLICY "admin_all_access"
ON table_name FOR ALL
USING (
    (auth.jwt() -> 'user_metadata' ->> 'role') = 'admin'
);
```

### 5. Relationship-Based Access
```sql
-- Access based on foreign key relationship
CREATE POLICY "access_via_relationship"
ON comments FOR SELECT
USING (
    post_id IN (
        SELECT id FROM posts WHERE user_id = auth.uid()
    )
);
```

### 6. Multi-Party Access (Transactions)
```sql
-- Multiple users involved in a record
CREATE POLICY "transaction_parties"
ON transactions FOR SELECT
USING (
    auth.uid() = sender_id OR 
    auth.uid() = recipient_id
);
```

### 7. Time-Based Access
```sql
-- Access based on time conditions
CREATE POLICY "active_only"
ON table_name FOR SELECT
USING (
    auth.uid() = user_id AND
    expires_at > NOW()
);
```

### 8. Organization/Team Access
```sql
-- Team members can access team data
CREATE POLICY "team_access"
ON projects FOR ALL
USING (
    team_id IN (
        SELECT team_id FROM team_members 
        WHERE user_id = auth.uid()
    )
);
```

---

## 🔑 Auth Helper Functions

### Get Current User ID
```sql
auth.uid()  -- Returns UUID of authenticated user
```

### Get JWT Claims
```sql
auth.jwt()  -- Returns full JWT
auth.jwt() ->> 'role'  -- Get role from JWT
auth.jwt() -> 'user_metadata' ->> 'admin'  -- Get custom claim
```

### Check Authentication Status
```sql
auth.uid() IS NOT NULL  -- User is authenticated
auth.uid() IS NULL      -- User is anonymous
```

---

## 📋 Policy Operations

### FOR Operations
- `SELECT` - Reading data
- `INSERT` - Creating new records
- `UPDATE` - Modifying existing records
- `DELETE` - Removing records
- `ALL` - All operations

### Role Targets
- `TO authenticated` - Only logged-in users
- `TO anon` - Only anonymous users
- `TO service_role` - Only service role (usually not needed)
- No TO clause = applies to all roles

---

## 🛠️ Management Commands

### Enable RLS
```sql
ALTER TABLE table_name ENABLE ROW LEVEL SECURITY;
```

### Disable RLS (⚠️ Use with caution)
```sql
ALTER TABLE table_name DISABLE ROW LEVEL SECURITY;
```

### Create Policy
```sql
CREATE POLICY "policy_name"
ON table_name
FOR operation
TO role
USING (read_condition)
WITH CHECK (write_condition);
```

### Drop Policy
```sql
DROP POLICY IF EXISTS "policy_name" ON table_name;
```

### View All Policies
```sql
SELECT * FROM pg_policies WHERE schemaname = 'public';
```

### View Policies for Specific Table
```sql
SELECT * FROM pg_policies 
WHERE schemaname = 'public' 
AND tablename = 'your_table_name';
```

---

## ⚡ Quick Fixes

### Users Can't See Their Own Data
```sql
-- Check column name
\d table_name

-- Ensure policy uses correct column
CREATE POLICY "fix_access"
ON table_name FOR SELECT
USING (auth.uid() = correct_column_name);  -- Not user_id if wrong
```

### Users Can See Too Much
```sql
-- Add more restrictive condition
DROP POLICY "too_permissive" ON table_name;

CREATE POLICY "more_restrictive"
ON table_name FOR SELECT
USING (auth.uid() = user_id AND status = 'active');
```

### Service Role Not Working
```sql
-- Service role bypasses RLS automatically
-- If not working, check you're using service_role key, not anon key
-- In your backend code:
const { data } = await supabase
  .from('table_name')
  .select('*')
// Make sure supabase client is initialized with service_role key
```

---

## 🔍 Debugging Queries

### Check If RLS is Enabled
```sql
SELECT tablename, rowsecurity 
FROM pg_tables 
WHERE schemaname = 'public' 
AND tablename = 'your_table';
```

### Count Policies Per Table
```sql
SELECT tablename, COUNT(*) as policies
FROM pg_policies 
WHERE schemaname = 'public'
GROUP BY tablename;
```

### See Current User
```sql
SELECT auth.uid();
```

### Test Policy Effect
```sql
-- See what you can access
SELECT * FROM table_name;

-- See query plan with policy
EXPLAIN SELECT * FROM table_name WHERE user_id = auth.uid();
```

---

## 🚨 Common Mistakes

### ❌ Mistake 1: RLS Enabled But No Policies
```sql
-- This blocks EVERYTHING
ALTER TABLE users ENABLE ROW LEVEL SECURITY;
-- Without any policies, no one can access data
```

### ❌ Mistake 2: Using USING for INSERT
```sql
-- Wrong - USING is for reading data
CREATE POLICY "bad_insert"
ON table_name FOR INSERT
USING (auth.uid() = user_id);

-- Correct - WITH CHECK is for writing data
CREATE POLICY "good_insert"
ON table_name FOR INSERT
WITH CHECK (auth.uid() = user_id);
```

### ❌ Mistake 3: Overly Permissive
```sql
-- Too open - anyone can do anything
CREATE POLICY "too_open"
ON sensitive_data FOR ALL
USING (true);
```

### ❌ Mistake 4: Forgetting Service Role Needs
```sql
-- If your backend needs to override RLS, use service_role key
-- Don't create special policies for service_role, it bypasses RLS
```

### ❌ Mistake 5: Column Name Mismatch
```sql
-- If your column is 'owner_id' not 'user_id'
CREATE POLICY "wrong_column"
ON table_name FOR ALL
USING (auth.uid() = user_id);  -- ❌ Wrong if column is owner_id

-- Correct
CREATE POLICY "right_column"
ON table_name FOR ALL
USING (auth.uid() = owner_id);  -- ✅ Matches actual column
```

---

## 📊 Performance Tips

### Use Indexes
```sql
-- Index the column used in RLS policies
CREATE INDEX idx_table_user_id ON table_name(user_id);
```

### Keep Policies Simple
```sql
-- ✅ Good - simple and fast
USING (auth.uid() = user_id)

-- ❌ Slow - complex subquery
USING (
    id IN (
        SELECT item_id FROM complex_view 
        WHERE condition1 AND condition2
    )
)
```

### Avoid Complex JOINs in Policies
```sql
-- If you need complex access logic, consider:
-- 1. Materializing the relationship in a column
-- 2. Using database functions
-- 3. Denormalizing data
```

---

## 🎓 Learning Examples

### Example 1: Blog Platform
```sql
-- Posts are public, only authors can edit
CREATE POLICY "anyone_read_posts"
ON posts FOR SELECT
USING (true);

CREATE POLICY "authors_write_posts"
ON posts FOR INSERT
WITH CHECK (auth.uid() = author_id);

CREATE POLICY "authors_edit_posts"
ON posts FOR UPDATE
USING (auth.uid() = author_id);
```

### Example 2: E-commerce Orders
```sql
-- Users see only their orders, admins see all
CREATE POLICY "users_own_orders"
ON orders FOR SELECT
USING (
    auth.uid() = user_id 
    OR (auth.jwt() ->> 'role') = 'admin'
);
```

### Example 3: Private Messaging
```sql
-- Users see messages they sent or received
CREATE POLICY "message_participants"
ON messages FOR SELECT
USING (
    auth.uid() = sender_id OR 
    auth.uid() = recipient_id
);
```

---

## 📝 Policy Naming Convention

Use descriptive names:
- `users_read_own_profile`
- `public_read_posts`
- `admins_full_access`
- `team_members_crud_projects`

Avoid:
- `policy1`, `policy2`
- `test_policy`
- `temp`

---

## 🔗 Quick Links

- [Supabase RLS Docs](https://supabase.com/docs/guides/auth/row-level-security)
- [PostgreSQL RLS](https://www.postgresql.org/docs/current/ddl-rowsecurity.html)
- [Supabase Discord](https://discord.supabase.com)

---

## ✅ Pre-Deployment Checklist

Before going to production:
- [ ] RLS enabled on all tables
- [ ] At least one policy per table
- [ ] Tested with multiple user accounts
- [ ] Tested anonymous access
- [ ] Verified service role access
- [ ] Indexes on policy columns
- [ ] Monitoring set up
- [ ] Backup created
- [ ] Rollback plan ready
- [ ] Team notified

---

**Remember:** RLS is your safety net. When in doubt, start restrictive and open up gradually.
