# Engineering Decisions & Product Thinking
## Telegram Ads Marketplace MVP - Contest Submission

This document captures all key engineering decisions and product reasoning across the entire project development.

---

## 🏗️ Architecture & Core Design

### 1. Tech Stack Selection
| Layer | Choice | Rationale |
|-------|--------|-----------|
| Backend | Node.js + Hono | Lightweight, fast, TypeScript-native |
| Frontend | React + Vite | Fast dev experience, great for mini apps |
| Database | PostgreSQL (Supabase) | Relational integrity for financial data |
| Bot | Grammy | Modern, TypeScript-first Telegram bot framework |
| Payments | TON Connect | Native Telegram wallet integration |

### 2. Repository Pattern
**Decision:** Abstract database operations behind interfaces
- `IDealRepository`, `IChannelRepository`, etc.
- `Supabase*Repository` implementations
- Enables future database migration without business logic changes

### 3. Generated TypeScript Types from Supabase
**Decision:** Auto-generate types from database schema
- Type safety across frontend/backend
- Catches schema mismatches at compile time
- Single source of truth

---

## 💰 Payment & Escrow System

### 4. Memo-Based Payment Tracking
**Decision:** Use unique memo strings instead of unique wallet addresses
- Single escrow wallet receives all payments
- `DEAL-{uuid}` or `CAMP-{uuid}` memo identifies transaction
- Backend polls blockchain for matching memos
- Simpler than generating per-transaction addresses

### 5. Two-Phase Payment Flow
**Decision:** Create deal first, then send payment
```
1. API creates deal → returns escrow address + memo
2. Frontend sends payment with memo
3. Backend polls and matches transaction
```
**Why:** Ensures deal exists before payment, enables accurate tracking

### 6. Internal Ledger vs Direct P2P
**Decision:** Internal wallet balances with ledger
- Atomic transactions (no partial states)
- Enables refunds without blockchain fees
- Wallet-to-wallet transfers instant
- Trade-off: More centralized for MVP

### 7. Multi-Currency Support (TON + USDT)
**Decision:** Support both native TON and Jetton tokens
- `JettonToken` type for wallet operations (contains contract address, decimals)
- `'TON' | 'USDT'` strings for API/database
- Database columns sized `VARCHAR(10)` for future currencies

**Bug Fixed:** Initially passed `JettonToken` object to API instead of string, causing `VARCHAR(3)` overflow.

### 8. Payment Timer Strategy
| Flow | Timer Type | Rationale |
|------|------------|-----------|
| Campaign Wizard | Backend `expiresAt` | High intent (completed wizard), draft recoverable |
| Channel Checkout | Frontend-only | Low intent (single click), no orphan records |

**Key Insight:** Don't create database records for browsing behavior.

### 9. Auto-Refund System
**Decision:** Background workers monitor deal expiration
- If channel owner doesn't approve within window → auto-refund
- Funds return to advertiser's internal wallet
- Uses `TonPayoutService` for automatic payouts

### 10. Staggered Polling
**Decision:** 5-second stagger between TON and USDT polling
- Prevents race conditions in transaction processing
- Reduces API rate limiting issues
- Configurable polling interval (60s default)

### 11. Single Currency Per Transaction
**Decision:** Cannot mix TON and USDT packages in a single checkout
- **Blockchain constraint:** A single transaction can only send one token type
- UI locks packages by currency once first selection is made
- Visual indicator shows "TON only" or "USDT only" on locked packages
- User can make separate deals for different currencies
- Haptic error feedback if user tries to select mismatched currency

### 12. Hybrid Webhook for Jetton Detection
**Decision:** When any webhook fires, immediately check `/jettons/history`
- **Problem:** Jetton (USDT) transfers don't trigger main wallet webhooks directly
- Jetton transfers go through Jetton wallet contract, not main wallet
- Webhook only receives tiny TON gas payment (no memo)
- **Solution:** On any webhook, poll `/jettons/history` to catch USDT transfers immediately
- Reduces USDT detection latency from ~30s (polling) to ~2-3s
- Reference projects (giveaway-tool, contest-tool) don't use webhooks for Jettons - we're ahead

---

## 🎨 UX & Frontend Decisions

### 11. Wizard Pattern for Complex Flows
**Decision:** Multi-step wizards for campaigns
- Step 1: Basic info
- Step 2: Channel selection
- Step 3: Budget allocation
- Step 4: Review
- Step 5: Payment

**Why:** Reduces cognitive load, enables save-as-draft

### 12. Draft Save & Resume
**Decision:** Auto-save wizard progress
- Drafts visible in "My Campaigns"
- Can resume from any step
- Step tracking via `WizardDraft` storage

### 13. Context-Aware Back Button
**Decision:** Different behavior based on navigation source
- From app navigation → go to previous page
- From deep link → go to dashboard
- Tracked via `location.state?.from`

### 14. Deep Link Handling
**Decision:** Use `openTelegramLink()` for t.me links
- Keeps mini app open (vs normal links that close it)
- Enables bot → mini app → action flows

### 15. Zero-Click Accept/Reject
**Decision:** Accept/reject from notification, not just detail page
- Reduces friction for channel owners
- Deep link with action parameter
- Immediate action on navigation

### 16. Visual Timer Consistency
**Decision:** Matching timer styles across flows
- Full-width colored box (green → yellow → red)
- "remaining" normally, "Hurry!" under 5 minutes
- Disabled button when expired

---

## 👥 User & Permission System

### 17. PR Manager Flow
**Decision:** Support channel teams, not just solo owners
- `channel_admins` many-to-many relationship
- Role-based permissions: `can_negotiate`, `can_approve_creative`
- Owner can add/remove PR managers

### 18. Real-Time Permission Verification
**Decision:** Check Telegram admin rights at action time, not just on add
- PR manager might lose rights after being added
- Verify `can_post_messages` before channel updates
- Auto-remove option for invalid managers

### 19. Wallet Address Pre-Registration
**Decision:** Require wallet address before payment actions
- Stored in user profile
- Enables automatic payouts
- Prevents "where do I send?" confusion

---

## 🤖 Telegram Bot Integration

### 20. Bot as Admin Requirement
**Decision:** Bot must be channel admin for stats verification
- Fetch `getChatMember` for permissions
- Get subscriber counts, verified stats
- Monitor post retention

**Trade-off:** If bot removed, tracking fails

### 21. Bot Notifications on Deal Events
**Decision:** Push notifications via bot
- "New deal request" to channel owner
- "Deal approved/rejected" to advertiser
- Deep links to mini app actions

### 22. Photo URL Fetching
**Decision:** Fetch channel photos from Telegram API
- Don't rely on user uploads
- Store `photoUrl` on channel sync
- Automatic updates on re-sync

### 23. Verified Stats Storage (JSONB)
**Decision:** Store Telegram stats as JSONB
- Flexible schema for new metrics
- No migrations when Telegram adds fields
- `verifiedStats.subscribers`, `verifiedStats.avgViews`

---

## 🔒 Security Considerations

### 24. User Authentication via Telegram Init Data
**Decision:** Validate `X-Telegram-Id` header from mini app
- Telegram provides cryptographically signed init data
- Backend verifies signature
- No password-based auth needed

### 25. Financial Action Verification
**Decision:** Real-time Telegram API checks for financial actions
- Accepting deals, withdrawals
- Verify user is still admin with required rights
- Prevent stale permission exploitation

### 26. Jetton Transaction Deduplication
**Decision:** Track processed transaction hashes
- Prevent double-crediting from re-polling
- `processedTransactions` Set in memory
- Consider persistent storage for production

---

## 📊 Database Design Decisions

### 27. Deal Status Enum
**Decision:** Database-level enum for deal states
```
draft → funded → approved → posted → monitoring → released
                ↘ rejected → refunded
```
Ensures valid transitions only.

### 28. Foreign Key Cascades
**Decision:** Careful cascade rules for deletions
- `channel_admins` ON DELETE CASCADE
- `deals` prevent deletion if active
- `pending_payouts` cascade with channels

### 29. Currency Column Sizing
**Decision:** `VARCHAR(10)` for currency codes
- Accommodates "USDT", "USDC", future tokens
- Original `VARCHAR(3)` caused overflow bug

---

## 🐛 Lessons Learned (Bugs & Fixes)

### 30. Stale Closure Bug
**Problem:** React state not updating in callback
**Fix:** Use refs for stable values in effects

### 31. USDT Log Spam
**Problem:** Every Jetton transfer logged, not just ours
**Fix:** Filter by memo prefix before logging

### 32. Currency Object vs String
**Problem:** Sent `JettonToken` object instead of `'USDT'` string
**Fix:** Explicit type separation for wallet ops vs API calls

### 33. Duplicate Transaction Processing
**Problem:** Same transaction credited multiple times
**Fix:** Hash-based deduplication tracking

---

## 📁 Project Structure Philosophy

```
├── backend/
│   ├── services/       # Business logic
│   ├── repositories/   # Data access (interface + implementation)
│   └── routes/         # API endpoints
├── frontend/
│   ├── components/     # React components
│   ├── hooks/          # Custom hooks (useTonWallet, useTelegram)
│   └── lib/            # Utilities, API client, constants
└── migrations/         # SQL migration files
```

**Key Principles:**
- Separation of concerns
- Repository abstraction
- Feature-based component organization
- Shared types across frontend/backend

---

*This document represents cumulative engineering wisdom from 80+ commits and multiple development sessions.*

---

## 📬 Post-Escrow Workflow (Feb 6, 2026)

### 34. Draft Creation in Bot, Not Mini App
**Decision:** All draft creation, preview, and submission happens in Telegram Bot via deep links
- Mini app text input feels like "web form", not native Telegram
- Bot receives photos/videos directly with `file_id` 
- Preview in bot shows EXACT formatting that will appear in channel
- Deep links (`t.me/Bot?start=draft_123`) provide clean context switching

### 35. Media Storage via Telegram file_id
**Decision:** Store Telegram `file_id` instead of uploading to Supabase bucket
- All media flows through bot first, so we always get `file_id`
- Same bot re-posting = `file_id` always valid
- No extra storage costs or upload complexity
- **Trade-off:** If we ever change bots, `file_id`s won't work

### 36. Post Existence Check via copyMessage Hack
**Decision:** Check if post still exists by attempting to copy it, then deleting the copy
- Telegram has no "does message exist" API
- `copyMessage` fails if original deleted
- Immediately delete the copy if successful

### 37. Admin Verification at State Transitions Only
**Decision:** Check Telegram admin status only when user takes critical actions
- Telegram API rate limits prevent checking on every page load
- State transitions (submit, approve, post, withdraw) are the critical points
- If user loses admin mid-flow, caught at next action

### 38. Sequential Time Negotiation
**Decision:** Advertiser proposes first, then turn-based counter-proposals
- Advertiser knows their marketing calendar
- Turn-based = no race conditions possible
- Database tracks `time_proposed_by` to enforce turns

### 39. Monitoring at Fixed Intervals
**Decision:** Check posts at 1h, 6h, 12h, 24h rather than continuous polling
- Reduces API calls significantly
- If post deleted at hour 3, caught at hour 6 (still before 24h)
- Background job runs every hour, checks based on `posted_at`

### 40. 12-Hour Timeouts for Contest Demo
**Decision:** Auto-refund if no draft in 12h, auto-approve if no review in 12h
- Short enough to demonstrate during live demo
- Production would use 48-72 hours

