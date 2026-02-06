# Telegram Ads Marketplace MVP - Handoff Document

> **Last Updated:** February 6, 2026  
> **Purpose:** Context transfer for continuing development in a new chat session

---

## 📍 Project Overview

A Telegram Mini App for connecting advertisers with Telegram channel owners. Built for the TON Hackathon.

**Live URLs:**
- Frontend: Vercel deployment (check `frontend/.vercel`)
- Backend: Railway deployment (check Railway dashboard)
- Mini App: Opens via Telegram bot

---

## 🏗️ Tech Stack

| Layer | Technology | Notes |
|-------|------------|-------|
| Backend | Node.js + Hono | Lightweight API framework |
| Frontend | React + Vite + TypeScript | Mini app with TON Connect |
| Database | PostgreSQL (Supabase) | Hosted, with auto-generated types |
| Bot | Grammy | Telegram bot framework |
| Payments | TON Connect + USDT Jettons | Real mainnet payments |
| Styling | Tailwind CSS | Glass morphism theme |

---

## 📂 Project Structure

```
telegram-ads-mvp/
├── backend/
│   ├── src/
│   │   ├── index.ts              # Server entry + CORS
│   │   ├── bot.ts                # Grammy bot handlers
│   │   ├── routes/               # API endpoints (7 files)
│   │   │   ├── campaigns.ts      # Campaign CRUD, escrow
│   │   │   ├── channels.ts       # Channel management
│   │   │   ├── deals.ts          # Deal lifecycle
│   │   │   ├── webhooks.ts       # TON payment webhooks
│   │   │   ├── wallets.ts        # Wallet operations
│   │   │   ├── auth.ts           # User auth
│   │   │   └── briefs.ts         # Public briefs
│   │   ├── services/             # Business logic (19 files)
│   │   │   ├── CampaignService.ts
│   │   │   ├── DealService.ts
│   │   │   ├── ChannelService.ts
│   │   │   ├── TonPaymentService.ts    # Payment polling
│   │   │   ├── TonPayoutService.ts     # Outbound payments
│   │   │   ├── TonWebhookService.ts    # Webhook registration
│   │   │   ├── NotificationService.ts  # Bot notifications
│   │   │   └── telegram.ts             # Telegram API utils
│   │   ├── repositories/supabase/
│   │   │   ├── SupabaseCampaignRepository.ts
│   │   │   ├── SupabaseChannelRepository.ts
│   │   │   ├── SupabaseDealRepository.ts
│   │   │   └── SupabaseUserRepository.ts
│   │   ├── domain/entities.ts    # Domain types
│   │   └── types/database.ts     # Auto-generated Supabase types
├── frontend/
│   ├── src/
│   │   ├── App.tsx               # Routes
│   │   ├── components/
│   │   │   ├── CampaignWizard.tsx        # 5-step campaign creation
│   │   │   ├── EscrowPaymentPage.tsx     # Campaign payment
│   │   │   ├── ChannelWizard.tsx         # Channel listing wizard
│   │   │   ├── ChannelViewPage.tsx       # Channel detail + packages
│   │   │   ├── CampaignMarketplace.tsx   # Browse campaigns
│   │   │   ├── MarketplacePage.tsx       # Browse channels
│   │   │   └── Dashboard.tsx             # Role switcher
│   │   ├── hooks/
│   │   │   ├── useTonWallet.ts   # TON Connect integration
│   │   │   └── useTelegram.ts    # Mini app context
│   │   └── lib/
│   │       ├── api.ts            # API client
│   │       └── jettons.ts        # Token definitions
└── migrations/                   # SQL migrations (8 files)
```

---

## 🗄️ Database Schema

### Tables (10 total)

| Table | Purpose |
|-------|---------|
| `users` | Telegram users, linked by `telegram_id` |
| `channels` | Listed channels with `verified_stats`, `rate_card` (JSONB) |
| `channel_admins` | Many-to-many: users ↔ channels with permissions |
| `campaigns` | Advertiser campaigns with escrow tracking |
| `campaign_applications` | Channel → Campaign applications |
| `deals` | Individual ad deals (core financial entity) |
| `wallets` | Internal wallet balances |
| `transactions` | Ledger entries |
| `pending_payouts` | Outbound payment queue |
| `public_briefs` | Public advertiser briefs |

### Deal Status Enum
```
draft → funded → approved → posted → monitoring → released
              ↘ rejected → pending_refund → refunded
```

### Key Columns on `campaigns`
- `payment_memo` - Unique memo for escrow payment
- `escrow_deposited` - Amount received
- `escrow_allocated` - Amount reserved for deals
- `slots` / `slots_filled` - Capacity tracking
- `expires_in_days` - Campaign duration (persisted in drafts)

### Key Columns on `deals`
- `payment_memo` - Unique memo format: `deal_<uuid16>`
- `status` - Enum (see above)
- `campaign_id` - Links to parent campaign (if from campaign)
- `price_currency` - `'TON'` or `'USDT'`

---

## ✅ What's Implemented

### Payment System (Complete)
- [x] TON + USDT payments via TON Connect
- [x] Webhook-based instant payment detection
- [x] Fallback polling for payments
- [x] Memo-based transaction matching (`campaign_<uuid>`, `deal_<uuid>`)
- [x] "Verifying Payment" spinner UX on both channel and campaign flows
- [x] Automatic refunds for rejected/expired deals
- [x] USDT Jetton support (hybrid webhook detection)

### Campaign System (Partial)
- [x] Campaign creation wizard (5 steps)
- [x] Draft save/resume with all fields persisted
- [x] Open + Closed campaign types
- [x] Escrow payment flow for campaigns
- [x] Campaign marketplace for channel owners
- [ ] **NOT DONE:** Channel acceptance flow (POST /campaigns/:id/accept)
- [ ] **NOT DONE:** Atomic slot allocation (DB function)
- [ ] **NOT DONE:** Deal creation from campaign acceptance

### Channel System (Complete)
- [x] Channel listing wizard
- [x] Rate card packages (mixed currency support blocked in single transaction)
- [x] PR manager roles with permissions
- [x] Real-time admin verification
- [x] Channel marketplace browsing

### Direct Deals (Complete)
- [x] Advertiser → Channel direct deals
- [x] Package selection with escrow
- [x] Accept/reject by channel owner
- [x] Escrow hold and release

---

## ❌ What's NOT Implemented (Phase 2)

### Post-Escrow Workflow
This is the next major feature set:

```
1. ESCROW DEPOSITED
        ↓
2. BRIEF SENT (advertiser → channel owner)
        ↓ [timeout: 3 days → auto-refund]
3. DRAFT SUBMITTED (channel owner → advertiser)
        ↓ [timeout: 2 days → auto-approve]
4. REVIEW LOOP (approve / request changes)
        ↓
5. SCHEDULE NEGOTIATION
        ↓
6. POST SCHEDULED (bot has content + time)
        ↓
7. AUTO-POSTED
        ↓ [monitoring: 24h]
8. VERIFIED → FUNDS RELEASED
    or
   DELETED → REFUND + WARNING
```

### Specific Features Needed
1. **Communication System**
   - Structured: Brief submission, draft review, schedule negotiation
   - Optional direct chat between advertiser ↔ channel owner (via bot)

2. **Creative Approval Workflow**
   - Channel owner drafts post from brief
   - Advertiser reviews, approves or comments
   - Iteration until approved

3. **Scheduling System**
   - Time negotiation between parties
   - Bot auto-posts at agreed time

4. **Post Monitoring**
   - 24-hour minimum post retention
   - Detect deletion/editing
   - Auto-release funds after verification

5. **Critical Security**
   - Re-verify admin status at every step
   - Only owner/authorized PR manager can withdraw

---

## 🔧 Key Engineering Decisions

### Payment Tracking
- Single platform wallet receives all payments
- Memo strings (`campaign_<uuid>`, `deal_<uuid>`) identify transactions
- Idempotency via `escrow_deposited > 0` check

### CORS Configuration
```typescript
// backend/src/index.ts
c.header('Access-Control-Allow-Methods', 'GET, POST, PUT, PATCH, DELETE, OPTIONS');
```
⚠️ PATCH was missing and caused iOS Safari "Load failed" - now fixed.

### Retry Mechanism (Frontend)
- Draft save retries 3x on network errors
- 500ms delay between attempts
- Double-click prevention

### Currency Handling
- API uses strings: `'TON'` or `'USDT'`
- Wallet ops use `JettonToken` objects with contract addresses
- Single transaction = single currency (no mixing)

---

## 🐛 Recent Bug Fixes (Feb 6, 2026)

| Bug | Cause | Fix |
|-----|-------|-----|
| "Load failed" on draft update | CORS missing `PATCH` | Added PATCH to allowed methods |
| Draft save retry needed | iOS Safari network flakiness | 3x retry with 500ms delay |
| Campaign duration not persisting | `expiresInDays` not saved | Added to all draft endpoints |
| Closed campaigns not going to escrow | Wrong navigation path | Fixed to use same escrow flow |
| No verification spinner on campaigns | Missing fullscreen UI | Added spinner like deals have |
| Escrow message only for open campaigns | Conditional render | Removed condition |

---

## 📁 Key File Paths

### Backend
- Entry: `backend/src/index.ts`
- Campaigns API: `backend/src/routes/campaigns.ts`
- Webhooks: `backend/src/routes/webhooks.ts`
- Payment Service: `backend/src/services/TonPaymentService.ts`
- Payout Service: `backend/src/services/TonPayoutService.ts`
- Domain Types: `backend/src/domain/entities.ts`

### Frontend
- App Routes: `frontend/src/App.tsx`
- Campaign Wizard: `frontend/src/components/CampaignWizard.tsx`
- Escrow Payment: `frontend/src/components/EscrowPaymentPage.tsx`
- TON Wallet Hook: `frontend/src/hooks/useTonWallet.ts`

### Database
- Types: `backend/src/types/database.ts`
- Migrations: `migrations/*.sql`

---

## 🔑 Environment Variables

### Backend (.env)
```
SUPABASE_URL=
SUPABASE_SERVICE_KEY=
BOT_TOKEN=
MASTER_WALLET_ADDRESS=      # Platform escrow wallet
MASTER_WALLET_MNEMONIC=     # For payouts
TONCENTER_API_KEY=          # TON API access
```

### Frontend (.env)
```
VITE_API_URL=               # Backend URL
VITE_TON_MANIFEST_URL=      # TON Connect manifest
```

---

## 🚀 Deployment

### Backend (Railway)
- Auto-deploys from `main` branch
- Uses `npm run start` in backend directory

### Frontend (Vercel)
- Auto-deploys from `main` branch
- Root directory: `frontend`

### Database
- Supabase project (check `.env` for URL)
- Run migrations manually via Supabase SQL editor

---

## 📋 Next Steps (To Implement)

1. **POST /campaigns/:id/accept** - Atomic slot allocation
2. **Deal message system** - Brief → Draft → Review flow
3. **Scheduling negotiation** - Time picker UI + agreement
4. **Auto-posting** - Bot posts at scheduled time
5. **Post monitoring** - 24h retention check
6. **Fund release** - After successful monitoring

---

## 📚 Reference Documents

These are in the artifacts directory from the previous conversation:
- `engineering_decisions.md` - All architectural decisions
- `implementation_plan.md.resolved.3` - Campaign escrow plan
- `task.md.resolved.0` - Original task breakdown

---

*Document created for context transfer. Start new chat and reference this file.*
