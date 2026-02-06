# Post-Escrow Workflow Specification

> **Author:** User (Product Owner)  
> **Date:** February 6, 2026  
> **Status:** Approved for Implementation

---

## Overview

This document defines the complete workflow after funds have been escrowed, from deal acceptance through post completion and fund release. **All flows (open campaigns, closed campaigns, direct deals) converge into this single system.**

---

## Money Flow

```
Advertiser's Wallet
       │
       ▼ (payment with memo)
Platform Escrow Wallet (MASTER_WALLET_ADDRESS)
       │
       ▼ (when deal completed & verified)
Channel Owner's Wallet
```

---

## The Unified Post-Escrow Flow

### Entry Points (All Converge Here)
1. **Open Campaign:** Channel accepts → Deal auto-created with `status: 'funded'`
2. **Closed Campaign:** Advertiser accepts channel application → Deal created
3. **Direct Deal:** Advertiser buys channel package → Deal created after payment

### Step-by-Step Flow

```
1. FUNDS ESCROWED
   Deal status: 'funded'
        ↓
        
2. BRIEF ALREADY AVAILABLE
   (From campaign or package description)
   Advertiser can add additional notes
        ↓ [Timeout: 3 days with no activity → auto-refund]
        
3. CHANNEL OWNER DRAFTS POST
   - Uses brief as guide
   - Can be text, media, or story format
   - Submits for advertiser review
   Deal status: 'draft_submitted' (new status needed)
        ↓ [Timeout: 2 days with no review → auto-approve]
        
4. ADVERTISER REVIEWS DRAFT
   Options:
   a) APPROVE → proceed to scheduling
   b) REQUEST CHANGES → add comment, back to step 3
   Deal status: 'in_review' / 'changes_requested'
        ↓
        
5. SCHEDULE NEGOTIATION
   - Advertiser proposes time
   - Channel owner accepts or counter-proposes
   - Loop until agreement
   Deal status: 'scheduling'
        ↓
        
6. POST SCHEDULED
   - Time locked in
   - Bot prepared to auto-post
   - Channel owner informed of requirements (24h minimum)
   Deal status: 'scheduled'
        ↓
        
7. AUTO-POST EXECUTED
   - Bot posts to channel at agreed time
   - Post ID/URL captured
   - Monitoring period begins
   Deal status: 'posted'
        ↓ [Monitoring: 24 hours minimum]
        
8. MONITORING PERIOD
   - Bot checks post still exists
   - Detect deletion or significant edits
   - If deleted: immediate notification + escalation
   Deal status: 'monitoring'
        ↓
        
9. VERIFICATION & RELEASE
   a) SUCCESS: Post stayed up 24h+ unchanged
      - Funds released to channel owner
      - Deal status: 'released'
      
   b) FAILURE: Post deleted/edited
      - Funds refunded to advertiser
      - Warning issued to channel
      - Deal status: 'refunded'
```

---

## Communication System

### Two Modes of Communication

#### 1. Structured Milestones (Required)
All key actions happen through structured forms:
- Brief submission
- Draft submission
- Review approval/rejection
- Time proposals
- Final acceptance

#### 2. Direct Chat (Optional)
For nuanced discussion between parties:
- Messages tagged with channel username
- Advertiser sees grouped conversations:
  ```
  📬 Messages
  ├── @cryptonews   "Draft ready"
  ├── @techinsider  "What time works?"
  └── @memecentral  "Approved ✓"
  ```
- All messages logged for dispute resolution

### Message Routing
- Messages go through the bot (not direct DMs)
- Each deal has a unique conversation thread
- History preserved for audit

---

## Timeouts & Auto-Actions

| Stage | Timeout | Auto-Action |
|-------|---------|-------------|
| No draft submitted | 3 days | Refund to advertiser |
| No review response | 2 days | Auto-approve draft |
| No schedule agreement | 3 days | Escalate / refund option |
| Post deleted | Immediate | Refund + warning |
| Monitoring complete | 24 hours | Auto-release funds |

---

## Post Duration Options

Default minimum is 24 hours, but campaigns can specify:
- 24 hours (default)
- 48 hours
- 1 week
- Permanent

Stored in `min_duration_hours` on deals table.

---

## Security Requirements

### Admin Verification Points
At EVERY critical action, verify the acting user still has Telegram admin rights:

1. ✅ Before accepting draft review request
2. ✅ Before agreeing to schedule
3. ✅ Before auto-posting
4. ✅ Before fund withdrawal

### Verification Method
```typescript
const adminStatus = await telegram.getChatMember(channelId, userId);
if (!adminStatus.can_post_messages) {
    throw new Error('User no longer has posting permissions');
}
```

### Withdrawal Permissions
- **Phase 1:** Only channel owner can withdraw
- **Phase 2:** PR managers with `can_manage_finance: true` can withdraw

---

## Post Deletion Detection

### Detection Method
```typescript
async function checkPostExists(channelId: number, messageId: number): Promise<boolean> {
    try {
        const message = await bot.api.copyMessage(channelId, channelId, messageId, { disable_notification: true });
        await bot.api.deleteMessage(channelId, message.message_id); // Delete the copy
        return true; // Original exists
    } catch (e) {
        return false; // Post was deleted
    }
}
```

### Monitoring Schedule
- Check at: 1h, 6h, 12h, 24h after posting
- If any check fails → immediate notification

---

## Edited Post Detection

### Light Check (Feasible)
- Store original text/caption hash
- Compare on each monitoring check
- Flag if hash differs

### Heavy Check (Post-MVP)
- Store full message content
- Deep diff on each check
- Allow minor edits (typos), flag major changes

---

## Database Changes Needed

### New Deal Statuses
Add to `deal_status` enum:
- `draft_submitted`
- `in_review`
- `changes_requested`
- `scheduling`
- `scheduled`

### New Columns on Deals
```sql
-- Draft management
draft_content TEXT;
draft_submitted_at TIMESTAMPTZ;
draft_feedback TEXT; -- Advertiser comments

-- Scheduling
proposed_post_time TIMESTAMPTZ;
agreed_post_time TIMESTAMPTZ;
time_proposed_by TEXT; -- 'advertiser' or 'channel'

-- Monitoring
posted_message_id BIGINT;
posted_at TIMESTAMPTZ;
monitoring_checks INTEGER DEFAULT 0;
last_checked_at TIMESTAMPTZ;
post_content_hash TEXT;
```

### New Table: deal_messages
```sql
CREATE TABLE deal_messages (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    deal_id UUID REFERENCES deals(id),
    sender_id UUID REFERENCES users(id),
    sender_role TEXT, -- 'advertiser' or 'channel_owner'
    message TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW()
);
```

---

## UI Components Needed

### Advertiser Views
1. **Deal Detail Page** - Shows current status, actions available
2. **Draft Review Modal** - View submitted draft, approve/comment
3. **Time Picker** - Propose post time
4. **Message Thread** - Chat with channel owner

### Channel Owner Views
1. **Deal Detail Page** - Shows current status, actions available
2. **Draft Composer** - Write post based on brief
3. **Schedule Confirmation** - Accept/counter time proposals
4. **Earnings Page** - Track pending and completed deals

---

## Bot Notifications

| Event | Recipient | Message |
|-------|-----------|---------|
| Deal funded | Channel Owner | "New deal from @advertiser! Review brief and submit draft." |
| Draft submitted | Advertiser | "@channel submitted a draft. Review it now." |
| Draft approved | Channel Owner | "Draft approved! Propose a posting time." |
| Changes requested | Channel Owner | "@advertiser requested changes: [comment]" |
| Time agreed | Both | "Post scheduled for [time]. Will auto-publish." |
| Post live | Both | "Post is now live! 24h monitoring started." |
| Post deleted | Both | "⚠️ Post was deleted. Deal cancelled." |
| Deal completed | Both | "✅ Deal complete! Funds released to channel." |

---

## Implementation Priority

### Phase 1: Core Flow
1. Draft submission endpoint
2. Draft review UI (approve/comment)
3. Simple time picker (no negotiation yet)
4. Manual posting (channel owner posts, confirms)

### Phase 2: Automation
1. Auto-posting via bot
2. Post monitoring
3. Deletion detection
4. Auto-release after 24h

### Phase 3: Polish
1. Direct chat between parties
2. Time negotiation (counter-offers)
3. Edited post detection
4. PR manager withdrawal

---

*This spec is the source of truth for post-escrow workflow implementation.*
