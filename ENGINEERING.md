# Engineering Decisions

This document details the key technical decisions and design rationale for the Telegram Ad Marketplace.

## Table of Contents

1. [Monitoring System](#1-monitoring-system)
2. [Escrow & Payment Flow](#2-escrow--payment-flow)
3. [Post Verification Strategy](#3-post-verification-strategy)
4. [PR Manager Multi-User Access](#4-pr-manager-multi-user-access)
5. [Deal State Machine](#5-deal-state-machine)
6. [Channel Stats Verification](#6-channel-stats-verification)
7. [Content Moderation](#7-content-moderation)

---

## 1. Monitoring System

### Problem
Channel owners could accept payment, post content, then immediately delete it. We need to verify content stays up for the agreed duration (typically 24 hours).

### Solution: Random Check Timing

Instead of predictable intervals (e.g., every 2 hours), we use **randomized check times**:

```typescript
generateRandomCheckTimes(postedAt: Date, durationHours: number): string[] {
    // For 24h: Generate 6-10 random check times
    // For 6h (testing): Generate 3 random check times
    
    const numChecks = durationHours === 24
        ? Math.floor(Math.random() * 5) + 6  // 6-10 checks
        : 3;
    
    const checkTimes: string[] = [];
    for (let i = 0; i < numChecks; i++) {
        const randomOffset = Math.random() * (durationHours * 60 - 10);
        const checkTime = new Date(postedAt.getTime() + randomOffset * 60 * 1000);
        checkTimes.push(checkTime.toISOString());
    }
    
    return checkTimes.sort(); // Chronological order
}
```

**Why random?**
- Prevents timing attacks where users delete content between known check intervals
- Users never know when the next check will occur
- Increases unpredictability and trust in the system

### Implementation Details

1. **Check Storage**: Random check times are stored in `deal.scheduled_checks` JSONB
2. **Background Job**: Runs every minute, checks `next_check_at < NOW()`
3. **Verification Channel**: Uses a private channel to verify posts exist (see [Post Verification](#3-post-verification-strategy))

---

## 2. Escrow & Payment Flow

### Problem
Neither party trusts the other. Advertisers fear paying without receiving service. Channel owners fear doing work without payment.

### Solution: Internal Ledger Escrow

```
Advertiser Pays TON → System Escrow Wallet → Funds Locked
                                ↓
                    Content Posted & Verified
                                ↓
                    24h Monitoring Passes
                                ↓
            Funds Released → Channel Owner Wallet
```

### Key Design Decisions

1. **Hot Wallet Architecture**
   - Single master wallet receives all payments
   - Each payment has unique `memo` for identification
   - Tracked via `TonPaymentService`

2. **Payment Memo Strategy**
   ```
   Format: [TYPE]_[ID]_[TIMESTAMP]
   Example: campaign_abc123_1704067200
   ```

3. **Atomic State Transitions**
   - Database transactions ensure funds and deal status change together
   - Prevents partial states (funded but status unchanged)

4. **Automatic Refunds**
   - If channel owner doesn't accept within timeout → refund
   - If post deleted early → refund
   - Refunds tracked in `pending_payouts` table

### Why Not Smart Contracts?

For MVP:
- Faster development without Func/Tact learning curve
- Easier to handle edge cases and disputes
- Lower gas costs for small transactions

Future: Migrate to TON smart contract escrow for trustless operation.

---

## 3. Post Verification Strategy

### Problem
How do we check if a post still exists in a channel without:
- Triggering notifications to subscribers
- Requiring bot to have "post" permissions
- Being detectable by channel owners

### Solution: Forward to Verification Channel

```typescript
async checkPostExists(channelId: number, messageId: number): Promise<boolean> {
    try {
        // Forward to private verification channel
        await bot.api.forwardMessage(
            VERIFICATION_CHANNEL_ID,
            channelId,
            messageId
        );
        return true; // Post exists
    } catch (error) {
        if (error.description?.includes('message to forward not found')) {
            return false; // Post was deleted
        }
        throw error;
    }
}
```

**Why this approach?**
- `forwardMessage` fails if original message doesn't exist
- No visible action in the source channel
- Works with "read-only" bot permissions
- Creates audit trail in verification channel

### Fallback: CopyMessage
If verification channel isn't configured, fall back to `copyMessage` (but this can trigger phantom notifications).

---

## 4. PR Manager Multi-User Access

### Problem
Large channels have dedicated PR managers who negotiate deals, but shouldn't have access to withdraw funds.

### Solution: Role-Based Channel Admins

```sql
CREATE TABLE channel_admins (
    id UUID PRIMARY KEY,
    channel_id UUID REFERENCES channels(id),
    user_id UUID REFERENCES users(id),
    role TEXT DEFAULT 'manager',
    permissions JSONB DEFAULT '{}',
    is_owner BOOLEAN DEFAULT false
);
```

### Permission Levels

| Permission | Owner | Manager |
|------------|-------|---------|
| Negotiate deals | ✅ | ✅ |
| Approve content | ✅ | ✅ |
| Manage finances | ✅ | ❌ |
| Remove channel | ✅ | ❌ |

### Real-Time Verification

Before any sensitive action:

```typescript
async verifyUserPermission(userId: number, channelId: number): Promise<boolean> {
    const member = await bot.api.getChatMember(channelId, userId);
    
    // Check if still admin with required rights
    if (!['administrator', 'creator'].includes(member.status)) {
        return false;
    }
    
    // For posting content, check can_post_messages
    if (member.status === 'administrator' && !member.can_post_messages) {
        return false;
    }
    
    return true;
}
```

This prevents:
- Removed admins from taking actions
- Users with downgraded permissions from posting

---

## 5. Deal State Machine

### States

```
draft           → Initial creation, not yet funded
funded          → Advertiser paid, awaiting channel owner acceptance
accepted        → Channel owner accepted, content negotiation begins
draft_pending   → Content draft submitted, awaiting approval
approved        → Content approved, ready to schedule
scheduled       → Post scheduled for specific time
posted          → Content live in channel
monitoring      → 24h verification period
released        → Funds released, deal complete
cancelled       → Deal cancelled (refund issued if applicable)
```

### State Transition Rules

```typescript
const VALID_TRANSITIONS: Record<string, string[]> = {
    'draft': ['funded', 'cancelled'],
    'funded': ['accepted', 'cancelled'],
    'accepted': ['draft_pending', 'cancelled'],
    'draft_pending': ['approved', 'accepted'],  // Can request revisions
    'approved': ['scheduled', 'posted'],        // Skip scheduling or set time
    'scheduled': ['posted', 'cancelled'],
    'posted': ['monitoring'],
    'monitoring': ['released', 'cancelled'],
    'released': [],  // Terminal state
    'cancelled': [], // Terminal state
};
```

### Status History

Every transition is logged in `deal.status_history`:

```json
[
    {"status": "draft", "at": "2024-01-15T10:00:00Z"},
    {"status": "funded", "at": "2024-01-15T10:05:00Z", "tx_hash": "..."},
    {"status": "accepted", "at": "2024-01-15T11:00:00Z", "by": "channel_owner"}
]
```

---

## 6. Channel Stats Verification

### Problem
Users could claim inflated subscriber counts. We need verified, trustworthy metrics.

### Solution: Bot API Direct Fetch

```typescript
async fetchChannelStats(channelId: number): Promise<ChannelStats> {
    const chat = await bot.api.getChat(channelId);
    const memberCount = await bot.api.getChatMemberCount(channelId);
    
    return {
        subscribers: memberCount,
        title: chat.title,
        username: chat.username,
        photo_url: chat.photo?.big_file_id,
        fetched_at: new Date().toISOString()
    };
}
```

### JSONB Storage

Stats stored as `verified_stats JSONB`:

```json
{
    "subscribers": 50000,
    "avgViews": 2500,
    "engagementRate": 0.05,
    "fetchedAt": "2024-01-15T10:00:00Z"
}
```

**Why JSONB?**
- Schema flexibility as Telegram adds new metrics
- No migrations needed for new fields
- Easy querying with PostgreSQL JSONB operators

---

## 7. Content Moderation

### Blacklist System

```typescript
// config/blacklist.ts
export const BLACKLIST = {
    words: ['scam', 'hack', ...],
    patterns: [/\bfree\s*money\b/i, ...],
    categories: ['adult', 'gambling', ...]
};
```

### Moderation Flow

1. **Pre-Draft Check**: Validate content before submission
2. **AI Enhancement** (future): LLM-based content analysis
3. **Manual Review Flag**: High-risk content flagged for review

---

## Performance Considerations

### Database Indexes

```sql
CREATE INDEX idx_deals_status ON deals(status);
CREATE INDEX idx_deals_next_check ON deals(next_check_at) WHERE status = 'monitoring';
CREATE INDEX idx_campaigns_status ON campaigns(status) WHERE status = 'open';
```

### Background Job Optimization

- Monitoring job runs every 60 seconds
- Batch processes up to 50 deals per run
- Uses `next_check_at` index for efficient queries

### Caching Strategy

- Channel stats cached for 1 hour
- Bot API responses cached in memory (Grammy)
- Supabase handles connection pooling

---

## Future Improvements

1. **Smart Contract Escrow**: Trustless on-chain escrow on TON
2. **Distributed Monitoring**: Multiple nodes for redundancy
3. **ML Content Moderation**: Automated content analysis
4. **Real-time Updates**: WebSocket for live deal status
5. **Multi-Currency**: Support USDT and other Jettons
