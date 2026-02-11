# Engineering Decisions & Product Thinking
## Telegram Ads Marketplace MVP

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
| Hosting | Railway (backend) + Vercel (frontend) | Separate scaling, free tiers |

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
- Haptic error feedback if user tries to select mismatched currency

### 12. Hybrid Webhook for Jetton Detection
**Decision:** When any webhook fires, immediately check `/jettons/history`
- **Problem:** Jetton (USDT) transfers don't trigger main wallet webhooks directly
- Jetton transfers go through Jetton wallet contract, not main wallet
- Webhook only receives tiny TON gas payment (no memo)
- **Solution:** On any webhook, poll `/jettons/history` to catch USDT transfers immediately
- Reduces USDT detection latency from ~30s (polling) to ~2-3s

### 13. Payment Polling Timeout (Frontend)
**Decision:** 2-minute adaptive polling with exponential backoff
- Polls up to 60 times: 1s → 2s → 3s intervals
- On timeout: redirects with `paymentPending` state (not error)
- **Why:** Blockchain confirmations can take 30-90 seconds; showing error prematurely frustrates users

---

## 🎨 UX & Frontend Decisions

### 14. Wizard Pattern for Complex Flows
**Decision:** Multi-step wizards for campaigns
- Step 1: Basic info → Step 2: Channel selection → Step 3: Budget → Step 4: Review → Step 5: Payment
- Reduces cognitive load, enables save-as-draft

### 15. Draft Save & Resume
**Decision:** Auto-save wizard progress
- Drafts visible in "My Campaigns"
- Can resume from any step

### 16. Context-Aware Back Button
**Decision:** Different behavior based on navigation source
- From app navigation → go to previous page
- From deep link → go to dashboard
- Tracked via `location.state?.from`

### 17. Deep Link Handling
**Decision:** Use `openTelegramLink()` for t.me links
- Keeps mini app open (vs normal links that close it)
- Enables bot → mini app → action flows

### 18. Zero-Click Accept/Reject
**Decision:** Accept/reject from notification, not just detail page
- Reduces friction for channel owners
- Deep link with action parameter

### 19. Native Body Scroll (Not Flex Containers)
**Decision:** Use `min-h-screen` with native `<body>` scrolling
- Mobile browsers are optimized for body scroll physics
- Nested `overflow-y: auto` inside `height: 100%` flex containers causes padding/layout bugs, keyboard issues on Android, and double-scrollbar problems
- Individual pages (Marketplace, Partnerships) manage their own scroll containment where needed

### 20. Bot Username as Environment Variable
**Decision:** Centralized `BOT_USERNAME` env var with helpers
- Backend: `getMiniAppUrl()`, `getBotDeepLink()` in `botInstance.ts`
- Frontend: `getBotUrl()`, `getBotDeepLinkUrl()` in `telegram.ts`
- Fallback default: `DanielAdsMVP_bot`
- Enables switching bots without code changes

---

## 👥 User & Permission System

### 21. PR Manager Flow
**Decision:** Support channel teams, not just solo owners
- `channel_admins` many-to-many relationship
- Role-based permissions: `can_negotiate`, `can_approve_creative`
- Owner can add/remove PR managers

### 22. Real-Time Permission Verification
**Decision:** Check Telegram admin rights at action time, not just on add
- PR manager might lose rights after being added
- Verify `can_post_messages` before channel updates
- Auto-remove option for invalid managers

### 23. Wallet Address Pre-Registration
**Decision:** Require wallet address before payment actions
- Stored in user profile
- Enables automatic payouts

---

## 🤖 Telegram Bot Integration

### 24. Bot as Admin Requirement
**Decision:** Bot must be channel admin for stats verification
- Fetch `getChatMember` for permissions
- Get subscriber counts, verified stats
- Monitor post retention
- **Trade-off:** If bot removed, tracking fails

### 25. Bot Notifications on Deal Events
**Decision:** Push notifications via bot with deep links
- "New deal request" to channel owner
- "Deal approved/rejected" to advertiser
- Deep links to mini app actions

### 26. Verified Stats Storage (JSONB)
**Decision:** Store Telegram stats as JSONB
- Flexible schema for new metrics
- No migrations when Telegram adds fields

### 27. Haptic Feedback Everywhere
**Decision:** Add native haptic feedback to all interactive elements
- Button taps: `impactOccurred('light')`
- Toggle switches: `impactOccurred('soft')`
- Success: `notificationOccurred('success')`
- Errors: `notificationOccurred('error')`
- **Impact:** Makes the app feel native — official Telegram apps do this extensively

---

## 🔒 Security Considerations

### 28. User Authentication via Telegram Init Data
**Decision:** Validate `X-Telegram-Id` header from mini app
- Telegram provides cryptographically signed init data
- Backend verifies signature
- No password-based auth needed

### 29. Financial Action Verification
**Decision:** Real-time Telegram API checks for financial actions
- Accepting deals, withdrawals
- Verify user is still admin with required rights

### 30. Jetton Transaction Deduplication
**Decision:** Track processed transaction hashes
- Prevent double-crediting from re-polling
- `processedTransactions` Set in memory

### 31. Content Moderation
**Decision:** Server-side blacklist checking before channel registration/updates
- `ContentModerationService` checks description, category, rate card text
- Prevents policy violations from being saved to DB

---

## 📊 Database Design

### 32. Deal Status State Machine
```
draft → submitted → negotiating → funded → draft_pending → draft_submitted
→ changes_requested → approved → scheduling → scheduled → posted
→ monitoring → released | cancelled | disputed | refunded
```

### 33. Foreign Key Cascades
**Decision:** Careful cascade rules
- `channel_admins` ON DELETE CASCADE
- `deals` prevent deletion if active
- `pending_payouts` cascade with channels

### 34. Currency Column Sizing
**Decision:** `VARCHAR(10)` for currency codes
- Accommodates "USDT", "USDC", future tokens
- Original `VARCHAR(3)` caused overflow bug

---

## 🐛 Lessons Learned (Bugs & Fixes)

| # | Problem | Fix |
|---|---------|-----|
| 1 | Stale React closure in polling callback | Use refs for stable values in effects |
| 2 | Every Jetton transfer logged (spam) | Filter by memo prefix before logging |
| 3 | `JettonToken` object sent instead of `'USDT'` string | Explicit type separation for wallet ops vs API calls |
| 4 | Same transaction credited multiple times | Hash-based deduplication |
| 5 | `funded` accept skipped draft phase | Fixed: `funded` → `draft_pending` (not `approved`) |
| 6 | Rigid flex scroll layout broke multiple pages | Reverted to native body scroll |
| 7 | Hardcoded bot URLs across 12+ files | Centralized to env var with helper functions |

---

*Cumulative engineering wisdom from 80+ commits and multiple development sessions.*
