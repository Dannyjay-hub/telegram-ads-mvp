# Telegram Ad Marketplace MVP

## High-Level Architecture

This project is a Telegram Mini App designed to facilitate a transparent, escrow-backed ad marketplace.

**Stack:**
- **Backend:** Node.js (Express/NestJS) - Handles business logic, bot interaction, and background jobs.
- **Frontend:** React - A lightweight Mini App UI for deal negotiation and stats viewing.
- **Database:** PostgreSQL - Relational data storage for reliable transaction handling.
- **Bot Platform:** Telegraf/GramMY - For Telegram Bot API interactions (stats fetching, auto-posting).

**Core System Components:**
1.  **API Server:** REST/GraphQL API for the Mini App.
2.  **Bot Service:** Manages webhooks/polling, fetches channel stats, performs auto-posting, and monitors post retention (cron/queues).
3.  **Database:** Stores user profiles, channel metadata, deals, and ledger-like wallet transactions.

## Key Decisions

### 1. PR Manager & Multi-User Access
To support larger channels with dedicated PR managers, we decouple `Channels` from `Users` via a many-to-many relationship (`channel_admins`). 
- **Role-Based Access:** The `channel_admins` table includes specific permissions (e.g., `can_negotiate`, `can_approve_creative`).
- **Safety Checks:** Critical financial actions (accepting a deal, requesting withdrawal) provoke a real-time verification check against the Telegram API to ensure the user is still an admin of the channel with appropriate rights.

### 2. Escrow & Security Flow
Trust is paramount. We implement an **Internal Ledger** system rather than direct peer-to-peer payments to ensure atomicity and control.
- **Flow:** Advertiser deposits funds -> System holds logic (Draft/Funded) -> Service delivery verified -> System releases funds to Channel Owner's internal wallet.
- **Isolation:** Ideally, we would generate a unique deposit address for each non-custodial interaction, or rigorously separate user balances in a hot wallet system. For this MVP, we use a `wallets` table with strict transactional locking to prevent double-spending.
- **Auto-Refund:** Background workers monitor deal timeouts. If a channel owner doesn't accept or post within the deadline, funds are automatically returned to the advertiser's available balance.

### 3. Verification & Stats
We do not rely on user-submitted screenshots. We use the Telegram Bot API `getChatMember` and verification hooks. `verified_stats` are fetched directly from Telegram and stored as JSONB to allow for flexible schema evolution as Telegram exposes new metrics without strict schema migrations.

## Known Limitations (MVP)

1.  **Centralised Wallet:** The MVP uses a centralized internal ledger. A production version should consider on-chain escrow or a regulated payment provider.
2.  **Basic Creative Support:** Only "Post" format is fully automated. Stories and other formats are manual negotiation only in this phase.
3.  **Polling vs Webhooks:** Auto-posting verification ("stay in channel for 24h") requires periodic polling or checking, which may have latency (not instant).
4.  **Bot Admin Rights:** The system relies on the channel owner adding our bot as an admin. If the bot is removed, tracking fails.
