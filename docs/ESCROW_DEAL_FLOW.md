# Complete Escrow Deal Flow

## Flow Diagram

```
┌─────────────────────────────────────────────────────────────────┐
│                    ENTRY POINTS (2 paths)                        │
├─────────────────────────────────────────────────────────────────┤
│  Advertiser → Listed Channel  │  Channel Owner → Open Campaign   │
│  Picks package & pays         │  Applies & advertiser accepts    │
└──────────────────┬────────────┴────────────────┬────────────────┘
                   │                              │
                   └──────────┬───────────────────┘
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│                    UNIFIED FLOW STARTS                           │
├─────────────────────────────────────────────────────────────────┤
│                                                                  │
│  1. FUNDS ESCROWED ────────────────────────────────────► funded  │
│     ✅ Built                                                     │
│                                                                  │
│  2. CHANNEL OWNER ACCEPTS ─────────────────────────────► approved│
│     ✅ Built (Accept/Reject buttons)                            │
│                                                                  │
│  3. DRAFT POST REVIEW ─────────────────────────────────► drafting│
│     ❌ Not built                                                 │
│     - Channel owner creates draft from brief                    │
│     - Advertiser reviews draft                                  │
│     - Feedback loop until approved                              │
│                                                                  │
│  4. SCHEDULE AGREEMENT ────────────────────────────────► scheduled│
│     ❌ Not built                                                 │
│     - Agree on post time                                        │
│     - Bot schedules auto-post                                   │
│                                                                  │
│  5. AUTO-POST ─────────────────────────────────────────► posted  │
│     ❌ Not built                                                 │
│     - Bot posts at scheduled time                               │
│     - Warning: "Keep post up 24hrs"                             │
│                                                                  │
│  6. MONITORING (24hrs) ────────────────────────────────► monitoring│
│     ❌ Not built                                                 │
│     - Check post exists every X minutes                         │
│     - If deleted → cancelled + refund                           │
│                                                                  │
│  7. RELEASE FUNDS ─────────────────────────────────────► released│
│     ❌ Not built                                                 │
│     - After 24hrs, pay channel owner                            │
│     - Only owner/authorized PR manager can withdraw             │
│                                                                  │
└─────────────────────────────────────────────────────────────────┘
```

## Status Mapping

| Step | Status | Built? |
|------|--------|--------|
| Payment received | `funded` | ✅ |
| Channel owner accepts | `approved` | ✅ |
| Draft being created | `drafting` | ❌ |
| Draft under review | `draft_review` | ❌ |
| Time agreed, scheduled | `scheduled` | ❌ |
| Posted to channel | `posted` | ❌ |
| Monitoring 24hrs | `monitoring` | ❌ |
| Complete, funds released | `released` | ❌ |
| Rejected/deleted/timeout | `cancelled`/`refunded` | ⚠️ Status only |

---

## Security Checks (Re-verify Admin)

Must verify user is still channel admin before:
- [x] Accepting/rejecting deal
- [ ] Submitting draft
- [ ] Approving schedule  
- [ ] Withdrawing funds

---

## Build Priority

### Phase 1: Payout System 🔴
- TON/USDT transfer from platform wallet
- Refund on rejection
- Release on completion

### Phase 2: Draft Review System 🟡
- Draft creation UI
- Advertiser approval UI
- Feedback/revision loop (via bot messages)

### Phase 3: Scheduling & Auto-Post 🟡
- Time picker UI
- Grammy bot scheduled message
- Post to channel via bot

### Phase 4: Monitoring & Verification 🟡
- Background job checks post exists
- 24hr countdown
- Auto-release or cancel

---

## What's Built ✅

1. Payment detection (TON + USDT)
2. Channel owner partnerships view
3. Accept/Reject buttons
4. Deal status transitions
5. Advertiser brief input
6. Bot admin verification

## What's NOT Built ❌

1. **Payout/Refund** - Send funds from platform wallet
2. **Draft Review** - Channel owner creates post draft
3. **Scheduling** - Agree on post time
4. **Auto-Post** - Bot posts to channel
5. **24hr Monitoring** - Verify post stays up
6. **Fund Release** - Pay channel owner after success
