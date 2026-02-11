# Campaign System Diagnostic Guide

## Summary of Findings

### ✅ Routes are correctly configured
- `/campaigns` → CampaignsList
- `/campaigns/escrow` → EscrowPaymentPage  
- `/campaigns/:id` → CampaignDetail

### 🔍 Likely Root Cause: Corrupt Campaign Data

Your main account has a campaign with invalid data (from the failed creation attempt). This causes the frontend to crash when rendering.

---

## Step 1: Check Your Campaign Data

Run this query in your **Supabase SQL Editor**:

```sql
-- Find all campaigns for your user (replace YOUR_TELEGRAM_ID)
SELECT 
    c.id,
    c.title,
    c.status,
    c.total_budget,
    c.per_channel_budget,
    c.slots,
    c.campaign_type,
    c.created_at,
    u.telegram_id
FROM campaigns c
JOIN users u ON c.advertiser_id = u.id
WHERE u.telegram_id = 704124192  -- Your Telegram ID
ORDER BY c.created_at DESC;
```

### What to look for:
| Field | Problem if... |
|-------|---------------|
| `status` | NULL or not one of: `draft`, `active`, `filled`, `expired`, `ended` |
| `total_budget` | NULL or 0 |
| `per_channel_budget` | NULL |
| `slots` | NULL or 0 |
| `campaign_type` | NULL or not `open`/`closed` |

---

## Step 2: Delete Corrupt Campaigns (if found)

If you find campaigns with invalid data, delete them:

```sql
-- Delete corrupt campaigns (replace CAMPAIGN_ID with actual ID)
DELETE FROM campaigns WHERE id = 'CAMPAIGN_ID_HERE';
```

Or delete ALL campaigns for your user to start fresh:

```sql
-- Delete all campaigns for your user (CAREFUL - this deletes everything)
DELETE FROM campaigns 
WHERE advertiser_id IN (
    SELECT id FROM users WHERE telegram_id = 704124192
);
```

---

## Step 3: Verify the Fix

After cleaning up:
1. Refresh your Telegram Mini App
2. Go to "Your Campaigns"
3. Should now show the empty state (like the screenshot you shared)

---

## Alternative: Check Backend Logs

If the above doesn't help, check Railway/Render logs for errors when calling:
```
GET /campaigns with X-Telegram-ID: 704124192
```

Look for any error messages after `[Campaigns] List error:`.

---

## Frontend Fix Already Applied

I've already added a safety fallback in `CampaignsList.tsx`:
- If a campaign has an unknown status, it defaults to "Draft" instead of crashing
- This prevents blank screens from corrupt data going forward
