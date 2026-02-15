# Telegram Ad Marketplace

> **A decentralized ad marketplace for Telegram channels, powered by TON blockchain escrow**

[![Telegram Mini App](https://img.shields.io/badge/Telegram-Mini%20App-0088cc)](https://t.me/DanielAdsMVP_bot)
[![TON Blockchain](https://img.shields.io/badge/TON-Escrow%20Payments-0098ea)](https://ton.org)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.0-blue)](https://www.typescriptlang.org/)
[![Status](https://img.shields.io/badge/status-MVP%20Complete-success)](https://github.com/Dannyjay-hub/telegram-ads-mvp)
[![License](https://img.shields.io/badge/license-MIT-green)](LICENSE)

---

## 🎯 Problem

Telegram advertising is fragmented and trust-dependent:

- **Advertisers** risk prepayment with no delivery guarantee
- **Channel owners** risk creating content without payment guarantee
- **No verification** — subscriber counts and engagement stats are easily faked
- **No accountability** — posts can be deleted minutes after being published
- **Manual coordination** between parties creates friction and delays

## 💡 Solution

A **trust-minimized marketplace** where code enforces fairness:

1. **Verified Channels** — Bot verifies ownership and fetches real stats from Telegram API
2. **Escrow Payments** — TON/USDT funds locked until content is delivered and verified
3. **Creative Approval** — Full draft → review → revision → approval loop
4. **Auto-Posting** — Bot publishes content at agreed time
5. **24h Monitoring** — Random checks verify post isn't deleted; funds auto-release on success
6. **PR Manager Flow** — Channel teams (not just owners) can manage deals

---

## 🔗 Live Demo

| | Link |
|--|------|
| **Mainnet Bot** | [@DanielAdsMVP_bot](https://t.me/DanielAdsMVP_bot) |
| **Testnet Bot** | [@DanielAdsMvpTestnet_bot](https://t.me/DanielAdsMvpTestnet_bot) |
| **Mini App** | [Open in Telegram](https://t.me/DanielAdsMVP_bot?startapp=marketplace) |

### Switching Wallet Network (for Testing)

To test with the **Testnet Bot**, switch your TON Wallet to testnet:

1. Open **Wallet** in Telegram → tap the `⋮` menu → **Settings**
2. Scroll to **Version & Network**
3. Under **Network**, select **Testnet** (or **Mainnet** for the production bot)
4. Get free testnet TON from the [Testnet Faucet Bot](https://t.me/testgiver_ton_bot)

> **Note:** Use the **Testnet Bot** with **Testnet wallet**, and the **Mainnet Bot** with **Mainnet wallet**. Mixing them will cause payment failures.

---

## 🏗️ Architecture

```
┌─────────────────────────────────────────────────────────┐
│                   Telegram Mini App                      │
│                    (React Frontend)                      │
└──────────────────────┬──────────────────────────────────┘
                       │ REST API
┌──────────────────────▼──────────────────────────────────┐
│                   Hono API Server                        │
│  ┌─────────────┐ ┌─────────────┐ ┌─────────────────┐   │
│  │ Auth Routes │ │ Deal Routes │ │ Campaign Routes │   │
│  └─────────────┘ └─────────────┘ └─────────────────┘   │
│  ┌─────────────┐ ┌──────────────────────────────────┐   │
│  │ Bot Webhook │ │ Webhooks (TON/USDT Payments)     │   │
│  └─────────────┘ └──────────────────────────────────┘   │
└──────────────────────┬──────────────────────────────────┘
                       │
┌──────────────────────▼──────────────────────────────────┐
│                   Service Layer                          │
│  ┌───────────────┐ ┌──────────────┐ ┌───────────────┐   │
│  │ TonPayment    │ │ Monitoring   │ │ AutoPost      │   │
│  │ Service       │ │ Service      │ │ Service       │   │
│  ├───────────────┤ ├──────────────┤ ├───────────────┤   │
│  │ DraftService  │ │ Scheduling   │ │ Campaign      │   │
│  │               │ │ Service      │ │ Service       │   │
│  └───────────────┘ └──────────────┘ └───────────────┘   │
└──────────────────────┬──────────────────────────────────┘
                       │
        ┌──────────────┼──────────────┐
        ▼              ▼              ▼
┌──────────────┐ ┌──────────────┐ ┌──────────────┐
│   Supabase   │ │ Grammy Bot   │ │ TON/TonAPI   │
│  PostgreSQL  │ │  (Telegram)  │ │  Blockchain  │
└──────────────┘ └──────────────┘ └──────────────┘
```

### Tech Stack

| Layer | Technology | Why |
|-------|------------|-----|
| Frontend | React, Vite, TypeScript, TailwindCSS | Fast dev, great for mini apps |
| Backend | Node.js, Hono, TypeScript | Lightweight, TypeScript-native |
| Bot | grammY | Modern, TypeScript-first bot framework |
| Database | PostgreSQL (Supabase) | Relational integrity for financial data |
| Blockchain | TON + USDT (Jetton) | Native Telegram wallet integration |
| Stats | Bot API + MTProto (gramjs) | Verified subscriber counts, views, language data |
| Hosting | Vercel (frontend) + Railway (backend) | Separate scaling, reliable |

---

## 📋 MVP Implementation Status

| Requirement | Status | Notes |
|-------------|--------|-------|
| **1. Marketplace Model** | ✅ Complete | Channel listings + advertiser campaigns with filters |
| **2. Verified Stats** | ✅ Complete | Bot API + MTProto for subscribers, views, language charts, boosts |
| **3. Ad Formats & Pricing** | ✅ Complete | Rate cards with post/story/repost/custom + TON/USDT pricing |
| **4. Escrow Deal Flow** | ✅ Complete | TON/USDT payments, auto-timeout, refunds, internal ledger |
| **5. Creative Approval** | ✅ Complete | Full loop: brief → draft → review → revise → approve |
| **6. Auto-Posting** | ✅ Complete | Bot posts at scheduled time + 24h random monitoring |
| **7. PR Manager Flow** | ✅ Complete | Role-based permissions, multi-admin channel management |

---

## 🚀 Quick Start

### Prerequisites

- **Node.js 18+** and npm
- **Telegram Bot Token** — create via [@BotFather](https://t.me/BotFather)
- **Supabase Project** — [supabase.com](https://supabase.com) (free tier works)
- **TON Wallet** — for escrow operations

### 1. Clone & Install

```bash
git clone https://github.com/Dannyjay-hub/telegram-ads-mvp.git
cd telegram-ads-mvp

# Backend
cd backend && npm install

# Frontend
cd ../frontend && npm install
```

### 2. Configure Environment

```bash
cp backend/.env.example backend/.env
```

Edit `backend/.env` with your credentials. See [`.env.example`](backend/.env.example) for all variables.

Create `frontend/.env`:
```env
VITE_API_URL=http://localhost:3000
```

### 3. Setup Database

Run migrations in the Supabase SQL Editor:

```bash
# Apply migration files in /migrations folder (in order)
# Or for a fresh setup:
migrations/testnet_full_setup.sql
```

### 4. Run Locally

```bash
# Terminal 1: Backend
cd backend && npm run dev

# Terminal 2: Frontend
cd frontend && npm run dev
```

Backend runs on `http://localhost:3000`, Frontend on `http://localhost:5173`.

### 5. Set Up Telegram Bot

1. Create a bot via [@BotFather](https://t.me/BotFather)
2. Get your bot token and add to `.env`
3. Configure Mini App via BotFather:
   ```
   /newapp → Select bot → Enter title/description → Upload icon → Enter web app URL
   ```
4. Set bot webhook:
   ```bash
   curl "https://api.telegram.org/bot<TOKEN>/setWebhook?url=https://your-backend.com/bot"
   ```

---

## 📦 Deployment

### Backend (Railway)

1. Push to GitHub
2. Connect repo to [Railway](https://railway.app)
3. Set all environment variables from `.env.example`
4. Deploy — Railway auto-detects Node.js

### Frontend (Vercel)

1. Connect GitHub repo to [Vercel](https://vercel.com)
2. Set `VITE_API_URL` to your Railway backend URL
3. Deploy

### Bot Webhook

```bash
curl "https://api.telegram.org/bot<TOKEN>/setWebhook?url=https://your-backend-url.com/bot"
```

---

## 📋 Deal Flow

The complete lifecycle of an advertising deal:

```
draft → submitted → negotiating → funded → draft_pending → draft_submitted
→ changes_requested → approved → scheduling → scheduled → posted
→ monitoring → released | cancelled | refunded
```

### Step-by-Step

1. **Advertiser** creates a campaign or finds a channel → initiates deal
2. **Channel side** reviews and accepts/rejects the deal
3. **Advertiser** funds escrow (TON or USDT payment)
4. **Channel side** creates a draft post via bot
5. **Advertiser** reviews draft → approves or requests changes
6. **Both sides** negotiate posting time
7. **Bot** auto-posts at scheduled time
8. **Bot** monitors post for 24h with random integrity checks
9. **System** auto-releases funds to channel owner on success

---

## 📂 Project Structure

```
telegram-ads-mvp/
├── frontend/
│   ├── src/
│   │   ├── components/          # React components
│   │   │   ├── ChannelWizard.tsx        # Channel registration wizard
│   │   │   ├── CampaignWizard.tsx       # Campaign creation wizard
│   │   │   ├── EscrowPaymentPage.tsx    # TON/USDT payment flow
│   │   │   ├── ChannelOwnerPartnerships.tsx  # Owner deal management
│   │   │   ├── PartnershipsList.tsx     # Advertiser deal tracking
│   │   │   └── TimePickerModal.tsx      # Schedule negotiation
│   │   ├── hooks/               # Custom hooks
│   │   ├── providers/           # Context providers (Telegram, Auth)
│   │   └── lib/                 # API client, utilities
│   └── package.json
├── backend/
│   ├── src/
│   │   ├── routes/              # Hono API endpoints
│   │   ├── services/            # Core business logic
│   │   │   ├── TonPaymentService.ts     # Escrow deposits + USDT detection
│   │   │   ├── TonPayoutService.ts      # Fund releases + refunds
│   │   │   ├── MonitoringService.ts     # 24h post verification
│   │   │   ├── AutoPostService.ts       # Scheduled posting
│   │   │   ├── DraftService.ts          # Content negotiation
│   │   │   ├── SchedulingService.ts     # Time negotiation
│   │   │   └── CampaignService.ts       # Campaign management
│   │   ├── repositories/        # Database access (Repository Pattern)
│   │   ├── domain/              # Entity definitions
│   │   ├── jobs/                # Background workers
│   │   └── db.ts                # Supabase client
│   ├── .env.example
│   └── package.json
├── migrations/                  # SQL migration files
├── schema.sql                   # Full database schema
└── docs/                        # Additional documentation
    ├── ENGINEERING_DECISIONS.md  # 34 detailed technical decisions
    ├── MVP_COMPLIANCE.md        # Feature compliance matrix
    ├── ESCROW_DEAL_FLOW.md      # Escrow system deep-dive
    └── TELEGRAM_DESIGN_SYSTEM.md
```

---

## 🔑 Key Technical Decisions

### 1. Memo-Based Payment Tracking
**Decision:** Use unique memo strings (`DEAL-{uuid}`) instead of generating per-deal wallet addresses.
- Single escrow wallet receives all payments
- Backend polls TON blockchain for matching memos
- Simpler infrastructure, lower gas costs

### 2. Hybrid Webhook + Polling for Payments
**Decision:** When any TON webhook fires, immediately check `/jettons/history` for USDT transfers.
- **Problem:** Jetton (USDT) transfers don't trigger main wallet webhooks
- **Solution:** Webhook triggers an immediate jetton history check
- Reduces USDT detection from ~30s to ~2-3s

### 3. Internal Ledger for Financial Operations
**Decision:** Track balances in an internal `wallets` table rather than direct P2P transfers.
- Atomic transactions (no partial states)
- Instant refunds without blockchain fees
- Enables future multi-currency support

### 4. Repository Pattern for Database Access
**Decision:** Abstract all database operations behind interfaces (`IDealRepository`, `IChannelRepository`).
- Enables database migration without business logic changes
- Auto-generated TypeScript types from Supabase schema

### 5. Random Monitoring Checks
**Decision:** Post integrity is verified at **random, unpredictable times** during the 24h monitoring window.
- Prevents gaming (channel owners can't delete post right after a check)
- 6-10 checks randomly distributed across the monitoring period
- Uses `copyMessage` API trick to verify post existence without exposing verification times

### 6. PR Manager Flow
**Decision:** Support channel teams with role-based permissions.
- `channel_admins` many-to-many table with `can_negotiate`, `can_approve_creative`, `can_manage_finance`
- Real-time permission verification via Telegram API before sensitive actions
- All deal notifications sent to **all** channel admins (owner + PR managers)

> 📄 See [docs/ENGINEERING_DECISIONS.md](docs/ENGINEERING_DECISIONS.md) for all 34 technical decisions.

---

## 🔒 Security

### Implemented
- ✅ **Telegram WebApp data validation** — cryptographic signature verification
- ✅ **Escrow system** — funds locked until delivery verified
- ✅ **Real-time permission checks** — Telegram API verification before financial actions
- ✅ **Random monitoring** — unpredictable check times prevent gaming
- ✅ **Auto-refunds** — expired deals automatically refund advertiser
- ✅ **Content moderation** — server-side blacklist checking
- ✅ **Transaction deduplication** — hash-based prevention of double-crediting

### Future (Post-MVP)
- [ ] Multi-signature escrow wallet
- [ ] Smart contract escrow on TON
- [ ] Rate limiting
- [ ] Audit logging

---

## ⚠️ Known Limitations

1. **Centralized Escrow** — Uses a server-side hot wallet. Production should migrate to smart contract escrow for trustlessness.
2. **Single Post Format** — Auto-posting supports text + single photo. Stories, videos, and multi-media require manual posting.
3. **Polling-Based Monitoring** — Post checks run via cron jobs (every minute for auto-posting, every hour for monitoring), not real-time webhooks.
4. **Bot Admin Required** — The bot must be a channel admin with `can_post_messages` to auto-post and verify content.
5. **MTProto Dependency** — Advanced stats (language charts, premium boosts) require MTProto credentials. Falls back to basic Bot API stats if not configured.

---

## 🔮 Future Roadmap

### Phase 1: Security Hardening
- [ ] Smart contract escrow on TON mainnet
- [ ] Multi-signature wallet operations
- [ ] Rate limiting and abuse prevention
- [ ] Third-party security audit

### Phase 2: Platform Growth
- [ ] Dispute resolution with evidence submission
- [ ] Analytics dashboard (earnings, performance)
- [ ] Reputation system with on-chain ratings
- [ ] Multi-language support (i18n)

### Phase 3: Scale
- [ ] Story/Reels format auto-posting
- [ ] Bulk campaign management
- [ ] API for third-party integrations
- [ ] Mobile-native companion app

---

## 🤖 AI Usage Disclosure

This project was developed with AI assistance (Google Antigravity). Approximate breakdown:

| Component | AI-Generated | Human-Written | AI % |
|-----------|-------------|---------------|------|
| **Backend Services** | Boilerplate, CRUD, handlers | Business logic, escrow flow, edge cases | **~70%** |
| **Frontend Components** | Component structure, styling | UX flows, state management, integration | **~65%** |
| **Database Schema** | Initial schema generation | Relationships, constraints, migrations | **~50%** |
| **Bot Integration** | Handler scaffolding | Conversation flows, deep links, relay | **~60%** |
| **Documentation** | Structure, formatting | Content, decisions, philosophy | **~70%** |
| **DevOps/Config** | Dockerfile templates | Environment config, deployment | **~40%** |

### Overall: **~65% AI-generated, 35% human-written**

All AI-generated code was:
1. **Reviewed** for correctness and security
2. **Tested** in development and production environments
3. **Debugged** when issues arose (many AI-generated patterns needed fixes)
4. **Refactored** to match project architecture and conventions

The AI served as a **productivity multiplier** — architecture decisions, business logic design, integration testing, and production deployment were entirely human-driven.

---

## 📄 License

MIT License — see [LICENSE](LICENSE) file.

---

## 📞 Links

| | |
|--|--|
| **GitHub** | [github.com/Dannyjay-hub/telegram-ads-mvp](https://github.com/Dannyjay-hub/telegram-ads-mvp) |
| **Mainnet Bot** | [@DanielAdsMVP_bot](https://t.me/DanielAdsMVP_bot) |
| **Testnet Bot** | [@DanielAdsMvpTestnet_bot](https://t.me/DanielAdsMvpTestnet_bot) |
| **Mini App** | [Open in Telegram](https://t.me/DanielAdsMVP_bot?startapp=marketplace) |

---

**Built for the TON Ecosystem 🚀**
