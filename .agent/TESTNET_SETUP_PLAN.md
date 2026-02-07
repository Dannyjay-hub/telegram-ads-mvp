# Testnet Demo Setup Plan

> **Status:** Postponed until core features complete  
> **Time estimate:** ~2 hours  
> **Do this:** 2-3 days before submission

---

## Strategy: Two Bots, One Codebase

| Component | Mainnet (Production) | Testnet (Demo/Judges) |
|-----------|---------------------|----------------------|
| Bot | `@DanielAdsMVP_bot` | `@YourApp_DemoBot` (TBD) |
| Database | Current Supabase | New Supabase project |
| Hot Wallet | Current mainnet wallet | User's testnet wallet |
| USDT | Real USDT | Testnet Jetton |
| Deployment | Current Vercel | New Vercel deployment |

---

## Prerequisites

1. [ ] Create new demo bot via @BotFather
2. [ ] Create new Supabase project: `telegram-ads-testnet`
3. [ ] Get testnet TON from faucet: https://t.me/testgiver_ton_bot
4. [ ] Find/deploy testnet Jetton for USDT simulation

---

## Environment Variables Per Deployment

### Mainnet (Current)
```env
NETWORK_TYPE=mainnet
BOT_TOKEN=<current-token>
SUPABASE_URL=<current-url>
SUPABASE_KEY=<current-key>
TON_CENTER_URL=https://toncenter.com/api/v2
TONAPI_URL=https://tonapi.io/v2
USDT_MASTER_ADDRESS=EQCxE6mUtQJKFnGfaROTKOt1lZbDiiX1kCixRv7Nw2Id_sDs
MASTER_WALLET_ADDRESS=<mainnet-hot-wallet>
HOT_WALLET_MNEMONIC=<mainnet-mnemonic>
```

### Testnet (New)
```env
NETWORK_TYPE=testnet
BOT_TOKEN=<demo-bot-token>
SUPABASE_URL=<testnet-supabase-url>
SUPABASE_KEY=<testnet-supabase-key>
TON_CENTER_URL=https://testnet.toncenter.com/api/v2
TONAPI_URL=https://testnet.tonapi.io/v2
USDT_MASTER_ADDRESS=<testnet-jetton-address>
MASTER_WALLET_ADDRESS=<testnet-hot-wallet>
HOT_WALLET_MNEMONIC=<testnet-mnemonic>
```

---

## Code Changes Required

### Backend
- [ ] Read `NETWORK_TYPE` from env (already mostly done)
- [ ] Ensure all API URLs use env vars
- [ ] Handle testnet Jetton address

### Frontend
- [ ] TON Connect manifest for testnet
- [ ] Network indicator badge in UI
- [ ] Different Mini App URL in bot

---

## Database Setup (Testnet Supabase)

1. Create new Supabase project
2. Run all migrations from `/migrations` folder
3. Copy environment variables

---

## Deployment Steps

1. Create new Vercel project: `telegram-ads-testnet`
2. Connect same GitHub repo
3. Set testnet environment variables
4. Deploy

---

## README Instructions for Judges

```markdown
## Testing the App

### Demo Bot (Testnet) - For Judges
- **Bot:** @YourApp_DemoBot
- Uses TON Testnet (no real funds needed)
- Get testnet TON from: https://t.me/testgiver_ton_bot

### Production Bot (Mainnet)
- **Bot:** @DanielAdsMVP_bot  
- Live with real payments
- See video demo for proof of real transactions
```

---

## Notes from Gemini Conversation

- TON Connect cannot programmatically switch wallet networks
- Judges need to manually switch wallet to testnet
- Include clear instructions in README with screenshots
- Video demo should show mainnet (real money) as proof
