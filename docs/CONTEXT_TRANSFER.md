# Telegram Ad Marketplace MVP — Context Transfer

> Paste this into your new chat so the assistant has full context.

## Project Overview

**Telegram Mini App** for an ad marketplace connecting advertisers with Telegram channel owners. Advertisers create campaigns or buy service listings, pay via TON/USDT escrow, and channels post their ads.

**Repo**: `Dannyjay-hub/telegram-ads-mvp` on GitHub (all code pushed, up to date)
**Path**: `/Users/danieljesusegun/Desktop/telegram-ads-mvp`

## Tech Stack

| Layer | Tech |
|-------|------|
| Frontend | React + TypeScript + Vite, Telegram Mini App SDK |
| Backend | Hono (Node.js) + TypeScript |
| Bot | grammY (Telegram Bot API) |
| Database | Supabase (PostgreSQL) |
| Payments | TON blockchain (native TON + USDT Jetton) |
| Hosting | Railway (backend), Vercel/Railway (frontend) |

## Key Architecture

```
frontend/src/
├── components/
│   ├── PartnershipsList.tsx    — Channel owner's deal dashboard (pending/active/completed tabs)
│   ├── CampaignDetail.tsx      — Advertiser views their campaign
│   ├── CampaignMarketplace.tsx — Channel owners browse campaigns
│   ├── CampaignWizard.tsx      — Create/edit campaign (multi-step wizard)
│   ├── MarketplacePage.tsx     — Channel marketplace (for advertisers)
│   ├── OpenRequests.tsx        — Advertiser's pending deal requests
│   └── dashboard/              — Advertiser & channel owner dashboards
├── hooks/
│   ├── useCampaignFilters.ts   — Campaign search/filter/sort
│   └── useMarketplaceFilters.ts — Channel marketplace filters
├── lib/api.ts                  — API helpers + headers
└── providers/TelegramProvider.tsx — Auth context

backend/src/
├── routes/
│   ├── deals.ts       — Deal CRUD + post-escrow endpoints
│   ├── campaigns.ts   — Campaign CRUD + escrow + extension
│   ├── channels.ts    — Channel registration + stats
│   └── webhooks.ts    — TON payment webhooks
├── services/
│   ├── DealService.ts          — Core deal logic (create, approve, confirm payment)
│   ├── CampaignService.ts      — Campaign business logic
│   ├── DraftService.ts         — Draft post creation/review workflow
│   ├── SchedulingService.ts    — Post time negotiation
│   ├── AutoPostService.ts      — Auto-post to channels via bot
│   ├── MonitoringService.ts    — 24h post monitoring + completion
│   ├── TonPaymentService.ts    — Payment verification (polling + webhooks)
│   ├── TonPayoutService.ts     — Refunds + payouts to channel owners
│   └── NotificationService.ts  — Bot notifications (deal status, payments)
├── jobs/backgroundJobs.ts      — Cron-like jobs (auto-post, monitoring, timeouts, expiration)
├── bot.ts                      — Bot command handlers + callback queries
└── botInstance.ts              — Bot singleton
```

## The Correct Deal Flow

This is the **intended** lifecycle for ALL deals (both service listings and campaign applications):

```
draft → funded → (channel owner accepts) → draft_pending → draft_submitted → (advertiser reviews) → approved → scheduling → scheduled → posted → monitoring → released
```

| Status | What's happening | Who acts |
|--------|-----------------|----------|
| `draft` | Advertiser created deal, awaiting payment | Advertiser |
| `funded` | Payment confirmed via blockchain | Channel owner (accept/reject) |
| `draft_pending` | Channel owner creates draft post | Channel owner |
| `draft_submitted` | Draft sent for advertiser review | Advertiser (approve/request changes) |
| `changes_requested` | Advertiser asked for revisions | Channel owner |
| `approved` | Draft approved, schedule time | Either party |
| `scheduling` | Time negotiation in progress | Both |
| `scheduled` | Time agreed, waiting to post | System (auto-posts) |
| `posted` | Ad published in channel | System (monitors) |
| `monitoring` | 24h monitoring period | System |
| `released` | Funds released to channel owner | Done |

Rejection/refund statuses: `rejected`, `refunded`, `pending_refund`, `cancelled`, `disputed`

## ✅ FIXED: Deal Flow Bug (funded → draft_pending)

The `funded` accept path was skipping the draft phase entirely, jumping straight to `approved` (scheduling). **This has been fixed** in commit `2a83419`.

**What was changed:**
- `DealService.ts`: `funded` accept → `draft_pending` (not `approved`), with correct bot messages
- `NotificationService.ts`: `approved` message now says 'Draft Approved - schedule the post'
- Channel owner gets "📝 Create Draft" inline button
- Advertiser gets "✅ Deal Accepted, draft coming" message

## Pending Follow-Up Items

1. **Payment polling timeout** — The frontend payment flow sometimes shows an error even though payment succeeded on the backend. The campaign appears in the list afterward, so the transaction processed correctly. Likely a frontend poll timeout (15-30s). Need to investigate the polling logic in the payment flow.

2. **48h stalled draft reminder** — `backgroundJobs.ts` already refunds `draft_pending` deals after 12h. Consider adding a reminder notification before the refund (e.g., at 6h).

3. **Bot username env variable** — `DanielAdsMVP_bot` is hardcoded in deep link URLs. Should be an env variable.

## Pending Migrations (not yet run)

```sql
-- 1. Deal rating (⭐ on completed deals)
\i migrations/add_deal_rating.sql

-- 2. Campaign expiry notification flag
\i migrations/add_campaign_expiry_notified.sql
```

## Recently Completed Features (this session)

All committed and pushed to GitHub:

1. ✅ **Sticky marketplace header** — CSS fix for iOS rubber-banding
2. ✅ **Deal completion rating** — Inline ⭐ 1-5 buttons on deal complete
3. ✅ **Campaign filtering & sorting** — Search, budget range, sort dropdown
4. ✅ **Campaign duplication** — "Duplicate Campaign" button for ended campaigns
5. ✅ **Campaign expiration + extension** — 24h notification, 7-day extension with grace period

## Known Issues & Technical Debt

1. **`as any` casts on Supabase queries** — Used for columns added by migrations (`rating`, `avg_rating`, `total_ratings`, `expiry_notified`). Will resolve once Supabase types are regenerated.
2. **Bot username hardcoded** — `DanielAdsMVP_bot` appears in deep link URLs in `DealService.ts`. Should be env variable.
3. **No filter persistence** — Filters reset on navigation. Accepted tradeoff for Mini App context.
4. **Legacy `approveCampaign` name** — This function handles ALL deal approvals, not just campaigns. Should be renamed to `approveDeal`.

## Environment

- macOS (Mac Mini M4)
- Node.js + pnpm
- Supabase project for DB
- TON testnet/mainnet for payments
- Bot: `@DanielAdsMVP_bot`
