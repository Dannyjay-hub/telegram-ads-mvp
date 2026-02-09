# Telegram Ad Marketplace

A Telegram Mini App that connects advertisers with channel owners through a secure, escrow-backed marketplace.

![Telegram](https://img.shields.io/badge/Telegram-Mini%20App-blue)
![TON](https://img.shields.io/badge/TON-Blockchain-0098ea)
![TypeScript](https://img.shields.io/badge/TypeScript-5.0-blue)

## 🎯 What It Does

**For Advertisers:**
- Browse verified Telegram channels with real stats
- Create campaigns targeting channels by category, language, subscribers
- Pay with TON cryptocurrency via secure escrow
- Get automatic refunds if content isn't delivered

**For Channel Owners:**
- List your channel with verified subscriber/view metrics
- Receive campaign requests from advertisers
- Negotiate terms and approve content drafts
- Get paid automatically after 24h post verification

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
└──────────────────────┬──────────────────────────────────┘
                       │
┌──────────────────────▼──────────────────────────────────┐
│                   Service Layer                          │
│  ┌───────────────┐ ┌──────────────┐ ┌───────────────┐   │
│  │ TonPayment    │ │ Monitoring   │ │ AutoPost      │   │
│  │ Service       │ │ Service      │ │ Service       │   │
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

## 🚀 Quick Start

### Prerequisites

- Node.js 18+
- A Telegram Bot Token (from [@BotFather](https://t.me/BotFather))
- A Supabase project
- A TON wallet (for escrow)

### 1. Clone & Install

```bash
git clone https://github.com/Dannyjay-hub/telegram-ads-mvp.git
cd telegram-ads-mvp

# Install backend dependencies
cd backend && npm install

# Install frontend dependencies
cd ../frontend && npm install
```

### 2. Configure Environment

Create `backend/.env`:

```env
# Supabase
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key

# Telegram Bot
BOT_TOKEN=your-bot-token

# TON Payments
MASTER_WALLET_ADDRESS=your-escrow-wallet-address
TON_API_KEY=your-tonapi-key
HOT_WALLET_MNEMONIC="your 24 word mnemonic phrase"

# Optional: Monitoring
VERIFICATION_CHANNEL_ID=-100xxxx  # Private channel for post verification
MONITORING_DURATION_HOURS=24      # or 6 for testing
```

Create `frontend/.env`:

```env
VITE_API_URL=http://localhost:3000
```

### 3. Setup Database

Run migrations in Supabase SQL Editor (in order):

```bash
# Apply each file in /migrations folder
migrations/create_campaigns_system.sql
migrations/add_escrow_payment_fields.sql
# ... etc
```

Or import `schema.sql` for a fresh setup.

### 4. Run Locally

```bash
# Terminal 1: Backend
cd backend && npm run dev

# Terminal 2: Frontend
cd frontend && npm run dev
```

### 5. Deploy

**Backend** (Railway/Render):
- Push to GitHub → Connect to Railway
- Set environment variables
- Deploy

**Frontend** (Vercel):
- Connect GitHub repo
- Set `VITE_API_URL` to your backend URL
- Deploy

**Bot Webhook**:
```bash
curl "https://api.telegram.org/bot<TOKEN>/setWebhook?url=https://your-backend.com/bot"
```

## 🔐 Key Security Features

### 1. Random Check Monitoring
Posts are monitored at **random unpredictable times** to prevent gaming:

```typescript
// MonitoringService.ts
generateRandomCheckTimes(postedAt: Date, durationHours: number): string[] {
    // 24h: 6-10 random checks across the period
    // Times are stored but never exposed to users
}
```

### 2. Escrow System
Funds are held in a system wallet until delivery is verified:

- Advertiser pays → Funds locked in escrow
- Content posted → 24h monitoring begins
- Monitoring passes → Funds released to channel owner
- Post deleted early → Automatic refund to advertiser

### 3. Real-Time Permission Verification
Before any sensitive action, we verify bot/user permissions via Telegram API:

```typescript
// Prevents actions if bot was removed or user lost admin rights
await bot.api.getChatMember(channelId, userId);
```

## 📋 Deal Flow States

```
draft → funded → accepted → draft_pending → approved → scheduled → posted → monitoring → released
                                                                              ↓
                                                                          cancelled (if deleted)
```

## 🛠️ Tech Stack

| Layer | Technology |
|-------|------------|
| Frontend | React, Vite, TypeScript, TailwindCSS |
| Backend | Node.js, Hono, TypeScript |
| Bot | Grammy (Telegram Bot API) |
| Database | PostgreSQL (Supabase) |
| Blockchain | TON, TonConnect |
| Hosting | Vercel (frontend), Railway (backend) |

## 📂 Project Structure

```
telegram-ads-mvp/
├── frontend/
│   ├── src/
│   │   ├── components/     # React components
│   │   ├── hooks/          # Custom hooks (useMarketplaceFilters, etc)
│   │   ├── providers/      # Context providers (Telegram, Auth)
│   │   └── lib/            # API client, utilities
│   └── package.json
├── backend/
│   ├── src/
│   │   ├── routes/         # API endpoints
│   │   ├── services/       # Business logic
│   │   │   ├── MonitoringService.ts    # 24h post verification
│   │   │   ├── TonPaymentService.ts    # Escrow deposits
│   │   │   ├── TonPayoutService.ts     # Fund releases
│   │   │   ├── AutoPostService.ts      # Scheduled posting
│   │   │   ├── DraftService.ts         # Content negotiation
│   │   │   └── CampaignService.ts      # Campaign management
│   │   └── db.ts           # Supabase client
│   └── package.json
├── migrations/             # SQL migration files
├── schema.sql              # Full database schema
└── ENGINEERING.md          # Detailed technical decisions
```

## ⚠️ Known Limitations (MVP)

1. **Centralized Escrow** - Uses a hot wallet for simplicity. Production should use smart contracts.
2. **Single Post Format** - Auto-posting supports text+media. Stories/other formats are manual.
3. **Polling-Based Monitoring** - Checks run every minute via cron, not instant detection.
4. **Bot Admin Required** - The bot must be a channel admin to post and verify content.

## 🔮 Future Roadmap

- [ ] Multi-language support (i18n)
- [ ] Smart contract escrow on TON
- [ ] Advanced analytics dashboard
- [ ] Story/Reels format support
- [ ] Reputation system with on-chain ratings

## 📜 License

MIT

---

**Demo Bot:** [@TelegramAdMarketplaceBot](https://t.me/TelegramAdMarketplaceBot)

**Mini App:** [Open in Telegram](https://t.me/TelegramAdMarketplaceBot?startapp=marketplace)
