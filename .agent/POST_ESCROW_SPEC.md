# Post-Escrow Workflow Specification

> **Author:** User (Product Owner)  
> **Date:** February 6, 2026  
> **Status:** Approved for Implementation

---

## Overview

This document defines the complete workflow after funds have been escrowed, from deal acceptance through post completion and fund release. **All flows (open campaigns, closed campaigns, direct deals) converge into this single system.**

---

## Finalized Decisions

| Aspect | Decision |
|--------|----------|
| Draft creation | Bot (channel owner sends content to bot) |
| Draft preview | Bot shows preview before submission |
| Media storage | `file_id` from Telegram (all files go through bot) |
| Chat/messages | Bot via deep link (`t.me/Bot?start=chat_{dealId}`) |
| Time selection | Mini App (date/time picker UI) |
| Time negotiation | Advertiser proposes first, loop until agreement |
| Action buttons | Both Mini App dashboard AND Bot inline buttons |
| Timeouts | 12h for contest demo |
| Admin verification | At every state transition |

---

## Unified Post-Escrow Flow

### Entry Points (All Converge Here)
1. **Open Campaign:** Channel accepts → Deal auto-created with `status: 'funded'`
2. **Closed Campaign:** Advertiser accepts channel application → Deal created
3. **Direct Deal:** Advertiser buys channel package → Deal created after payment

### State Machine

```
funded → draft_pending → draft_submitted → approved → scheduling → scheduled → posted → monitoring → released
                ↓              ↓              ↓           ↓
           (timeout)    changes_requested  (timeout)  failed_to_post
                ↓              ↓              ↓           ↓
           refunded     (back to draft)   refunded    [reschedule/refund]
```

---

## Step-by-Step Flow

### 1. FUNDS ESCROWED
- Deal status: `funded`
- `funded_at` timestamp recorded
- Channel owner notified via bot

### 2. DRAFT CREATION (All in Bot)
- Channel owner clicks [Create Draft] in bot notification
- Opens deep link: `t.me/Bot?start=draft_{dealId}`
- Bot prompts: "Send your post content (text or photo with caption)"
- Channel owner sends message to bot
- Bot shows preview with [Submit] [Edit] buttons
- Deal status: `draft_pending` → `draft_submitted`

### 3. DRAFT REVIEW
- Advertiser receives bot notification with draft preview
- Options: [Approve] [Request Changes]
- If changes requested:
  - Advertiser types feedback
  - Channel owner notified
  - Loop back to draft creation
- Deal status: `draft_submitted` → `changes_requested` → `approved`

### 4. SCHEDULE NEGOTIATION (Time Picker in Mini App)
- Advertiser proposes time in mini app date picker
- Channel owner receives notification: [Accept] [Counter]
- Counter opens mini app date picker
- Loop until one accepts
- Deal status: `scheduling` → `scheduled`

### 5. AUTO-POST
- Bot posts at `agreed_post_time`
- Verifies bot is still admin first
- Captures `posted_message_id`
- Deal status: `scheduled` → `posted` → `monitoring`
- Notifies both parties

### 6. MONITORING
- Check at: 1h, 6h, 12h, 24h after posting
- If post deleted early → immediate refund + warning
- If 24h passes successfully → release funds
- Deal status: `monitoring` → `released` or `refunded`

---

## Communication System

### Pattern: Deep Link to Bot
Mini app has 💬 icon on each deal. Click opens:
```
t.me/YourBot?start=chat_{dealId}
```

Bot receives context, prompts: "Type your message for @partner"

Messages forwarded between parties, stored in `deal_messages` table.

### Bot Notification Templates

| Event | Recipient | Message |
|-------|-----------|---------|
| Deal funded | Channel Owner | "💰 New deal from @advertiser! [Create Draft]" |
| Draft submitted | Advertiser | "📝 @channel submitted a draft. [View] [Approve] [Changes]" |
| Changes requested | Channel Owner | "✏️ @advertiser: 'Make logo bigger' [Revise Draft]" |
| Draft approved | Channel Owner | "✅ Approved! Advertiser will propose posting time." |
| Time proposed | Channel Owner | "⏰ Proposed: Feb 8, 10 AM [Accept] [Counter]" |
| Time accepted | Both | "🎯 Scheduled for Feb 8, 10 AM. Auto-post enabled." |
| Post live | Both | "📢 POST LIVE! 24h monitoring started. Don't delete!" |
| Post deleted | Both | "⚠️ POST DELETED! Refund initiated to @advertiser." |
| Deal complete | Both | "✅ Complete! $X released to @channel." |

---

## Timeouts & Auto-Actions

| Stage | Timeout | Auto-Action |
|-------|---------|-------------|
| No draft submitted | 12 hours | Refund to advertiser |
| No review response | 12 hours | Auto-approve draft |
| Missed post window | 1 hour after scheduled | Status: `failed_to_post` |
| Post stays up | 24 hours | Auto-release funds |

---

## Security: Admin Verification

Check at these points:
1. ✅ Before submitting draft
2. ✅ Before approving draft
3. ✅ Before accepting time
4. ✅ Before auto-posting
5. ✅ Before fund release

```typescript
const member = await bot.api.getChatMember(channelId, userId);
if (!['administrator', 'creator'].includes(member.status)) {
    throw new Error('User no longer has admin permissions');
}
```

---

## Database Changes

### New Columns on deals
```sql
draft_text TEXT
draft_media_file_id TEXT
draft_media_type TEXT
draft_version INTEGER DEFAULT 0
draft_submitted_at TIMESTAMPTZ
draft_feedback TEXT
proposed_post_time TIMESTAMPTZ
time_proposed_by TEXT
agreed_post_time TIMESTAMPTZ
posted_message_id BIGINT
posted_at TIMESTAMPTZ
funded_at TIMESTAMPTZ
```

### New deal_status values
```sql
'draft_pending', 'draft_submitted', 'changes_requested', 
'scheduling', 'scheduled', 'failed_to_post'
```

### New Tables
- `deal_messages` - Chat history
- `user_contexts` - Bot state tracking

---

## UI Locations

| Action | Mini App | Bot |
|--------|----------|-----|
| View deals list | ✅ | - |
| View deal status | ✅ | ✅ |
| Create draft | - | ✅ |
| View draft | - | ✅ (forwards message) |
| Approve/Reject | ✅ (buttons) | ✅ (inline buttons) |
| Chat messages | - | ✅ |
| Set post time | ✅ (date picker) | - |
| Accept/Counter time | ✅ | ✅ |

---

*This spec is the source of truth for post-escrow workflow implementation.*
