# Telegram Ad Marketplace MVP

A Telegram Mini App that connects advertisers with channel owners through a TON blockchain escrow system.

**Mainnet Bot:** [@DanielAdsMVP_bot](https://t.me/DanielAdsMVP_bot)
**Testnet Bot:** [@DanielAdsMvpTestnet_bot](https://t.me/DanielAdsMvpTestnet_bot)

---

## Prerequisites

Before you begin, make sure you have the following:

- **Node.js 18+** and **npm** installed
- A **Supabase** account and project ([supabase.com](https://supabase.com))
- A **Telegram Bot** created via [@BotFather](https://t.me/BotFather)
- A **TON Wallet** with a 24-word mnemonic (this will be the escrow wallet)
- A **TonCenter API key** from [@tonapibot](https://t.me/tonapibot) (free tier available)
- A **TonAPI key** from [tonapi.io](https://tonapi.io) (for payment webhooks)

---

## Step 1: Clone the Repository

```bash
git clone https://github.com/Dannyjay-hub/telegram-ads-mvp.git
cd telegram-ads-mvp
```

---

## Step 2: Create Your Telegram Bot

1. Open Telegram and message [@BotFather](https://t.me/BotFather)
2. Send `/newbot` and follow the prompts to create a bot
3. Save the **bot token** — you'll need it for the backend `.env`
4. Note your **bot username** (e.g. `MyAdBot_bot`)

> **Tip:** If you want separate bots for testing and production, create two bots — a mainnet bot and a testnet bot.

### Configure the Bot in BotFather

Set these up for a polished experience:

1. **Bot description** — send `/setdescription`, select your bot, then enter a description (shown when users open the bot for the first time)
2. **Bot about text** — send `/setabouttext` to set the short bio visible in the bot's profile
3. **Bot profile picture** — send `/setuserpic` and upload a profile picture
4. **Inline mode** — send `/setinline` if you want to enable inline mode (optional)
5. **Bot commands** — send `/setcommands` and set:
   ```
   start - Start the bot
   negotiate - Enter deal negotiation mode
   stop - Exit negotiation
   ```

### Set Up the Mini App

Still in BotFather:

1. Send `/newapp`
2. Select your bot
3. Enter an app title (e.g. "Ad Marketplace")
4. Enter a short description
5. Upload an icon (512×512px)
6. For the **Web App URL**, enter your frontend URL (e.g. `https://your-app.vercel.app`)
   - You can set a placeholder and update this after deployment (Step 8c)
7. Set the **short name** to `marketplace` — this is critical because the app links use `https://t.me/<bot_username>/marketplace`

### Enable Group Privacy Mode

The bot needs to receive `edited_channel_post` updates to detect when monitored posts are edited:

1. Send `/setprivacy` and select your bot
2. Choose **Disable** (this allows the bot to see all messages in groups/channels it's added to)

---

## Step 3: Set Up Supabase

### 3a. Create a Project

1. Go to [supabase.com](https://supabase.com) and create a new project
2. Once created, go to **Project Settings → API** and copy:
   - **Project URL** (e.g. `https://xxxx.supabase.co`)
   - **Service Role Key** (under "Project API keys" — use the `service_role` key, **not** the `anon` key)

### 3b. Run the Database Schema

1. Go to **SQL Editor** in your Supabase dashboard
2. Open the file `schema.sql` from the repo root
3. Paste the entire contents into the SQL Editor and click **Run**

This creates all required tables (`users`, `channels`, `channel_admins`, `deals`, `campaigns`, `campaign_slots`, `wallets`, `pending_payouts`, `deal_messages`, `user_contexts`, `bot_channel_events`) and all associated enums, indexes, and foreign keys.

> The `migrations/` folder contains incremental migration files used during development. For a fresh setup, `schema.sql` is all you need.

### 3c. Create the Storage Bucket

The app stores channel profile photos in Supabase Storage.

1. In Supabase, go to **Storage** (left sidebar)
2. Click **New bucket**
3. Name it exactly: `channel-photos`
4. Set it to **Public** (so the frontend can display channel avatars)
5. Click **Create bucket**

### 3d. Set Storage Policy

After creating the bucket, you need to allow uploads:

1. Click on the `channel-photos` bucket
2. Go to the **Policies** tab
3. Click **New Policy** → **For full customization**
4. Create a policy that allows `INSERT` and `SELECT` for the `service_role`:
   - **Policy name:** `Allow service role uploads`
   - **Allowed operations:** `SELECT`, `INSERT`
   - **Target roles:** Leave default (applies to all, service role bypasses RLS anyway)
   - **Policy definition:** `true`
5. Click **Save**

### 3e. Create a Verification Channel (Optional but Recommended)

The monitoring system can log verification checks to a private Telegram channel for transparency:

1. Create a **new private channel** in Telegram (e.g. "Ad Verification Logs")
2. Add your bot as an **admin** of this channel (with permission to post messages)
3. Get the channel ID:
   - Forward any message from the channel to [@userinfobot](https://t.me/userinfobot)
   - Or forward a message from the channel to your bot — it will reply with the channel ID
   - The ID will be a negative number like `-1001234567890`
4. Add this ID to your `backend/.env` as `VERIFICATION_CHANNEL_ID`

When set, the monitoring service will post check results (pass/fail) to this channel during the 24h post monitoring window.

---

## Step 4: Set Up TON Wallet

You need a TON wallet that the backend will use to receive and send escrow payments.

### Option A: Use an Existing Wallet

If you already have a TON wallet with a 24-word mnemonic, use that. You need:
- The **wallet address** (starts with `UQ` for mainnet, `0Q` for testnet)
- The **24-word mnemonic phrase**

### Option B: Create a New Wallet

1. Open the **Wallet** bot in Telegram (@wallet)
2. Create a wallet and back up your mnemonic
3. Copy the wallet address

> **Important:** For testnet, use the testnet version of your wallet. The address format changes from `UQ...` (mainnet) to `0Q...` (testnet).

### Get API Keys

1. **TonCenter API Key:** Message [@tonapibot](https://t.me/tonapibot) on Telegram → get a free API key
   - For testnet, request a separate testnet key
2. **TonAPI Key:** Go to [tonapi.io](https://tonapi.io) → create an account → generate an API key

---

## Step 5: Configure Environment Variables

### Backend

```bash
cp backend/.env.example backend/.env
```

Edit `backend/.env` and fill in all values:

```env
# ── Supabase ──
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key

# ── Telegram Bot ──
BOT_TOKEN=your-bot-token
BOT_USERNAME=YourBotUsername_bot

# ── MTProto (optional — for advanced channel stats) ──
# Get from https://my.telegram.org/apps
TELEGRAM_API_ID=your-api-id
TELEGRAM_API_HASH=your-api-hash

# ── TON Payments ──
MASTER_WALLET_ADDRESS=UQxxxxxxx     # Your mainnet escrow wallet
HOT_WALLET_MNEMONIC="word1 word2 word3 ... word24"
TON_API_KEY=your-toncenter-api-key
TONAPI_KEY=your-tonapi-key

# ── TON Webhook ──
# Your deployed backend URL (set after deployment)
WEBHOOK_URL=https://your-backend-url.com/webhooks/ton

# ── Post Monitoring ──
VERIFICATION_CHANNEL_ID=            # Optional: private channel for verification logs
MONITORING_DURATION_HOURS=24        # How long to monitor posts (24 for production, 6 for testing)

# ── Network ──
# Set to 'testnet' for testing, 'mainnet' for production
TON_NETWORK=testnet

# ── Testnet-Specific (used when TON_NETWORK=testnet) ──
TESTNET_BOT_TOKEN=your-testnet-bot-token
TESTNET_MASTER_WALLET_ADDRESS=0Qxxxxxxx    # Testnet wallet address (0Q prefix)
TESTNET_HOT_WALLET_MNEMONIC="word1 word2 word3 ... word24"
TESTNET_TON_API_KEY=your-testnet-toncenter-api-key
```

**How network switching works:** When `TON_NETWORK=testnet`, the app automatically uses:
- `TESTNET_BOT_TOKEN` instead of `BOT_TOKEN`
- `TESTNET_MASTER_WALLET_ADDRESS` instead of `MASTER_WALLET_ADDRESS`
- `TESTNET_HOT_WALLET_MNEMONIC` instead of `HOT_WALLET_MNEMONIC`
- Testnet API endpoints (testnet.toncenter.com, testnet.tonapi.io)

### Frontend

Create `frontend/.env`:

```env
VITE_API_URL=http://localhost:3000
VITE_BOT_USERNAME=YourBotUsername_bot
VITE_TON_NETWORK=testnet
```

For production, create `frontend/.env.production`:

```env
VITE_API_URL=https://your-backend-url.com
VITE_BOT_USERNAME=YourBotUsername_bot
VITE_TON_NETWORK=mainnet
```

| Variable | Description |
|----------|-------------|
| `VITE_API_URL` | Backend API URL |
| `VITE_BOT_USERNAME` | Your bot's username (without @) |
| `VITE_TON_NETWORK` | `testnet` or `mainnet` — controls which TON Connect network the wallet modal shows |
| `VITE_PLATFORM_WALLET_ADDRESS` | *(optional)* Overrides the platform wallet address shown in the payment UI |

---

## Step 6: Install Dependencies

```bash
# Backend
cd backend
npm install

# Frontend
cd ../frontend
npm install
```

---

## Step 7: Run Locally

Open two terminal windows:

```bash
# Terminal 1 — Backend
cd backend
npm run dev
```

```bash
# Terminal 2 — Frontend
cd frontend
npm run dev
```

- Backend runs on **http://localhost:3000**
- Frontend runs on **http://localhost:5173**

The bot will automatically start polling for Telegram updates when the backend starts.

> **Note:** The Mini App won't work locally in Telegram since it requires an HTTPS URL. You'll need to deploy to test the full Telegram integration. For local development, you can open the frontend directly in a browser.

---

## Step 8: Deploy

### 8a. Backend — Railway

1. Push your code to GitHub
2. Go to [railway.app](https://railway.app) and create a new project
3. Select **Deploy from GitHub repo** and pick your repository
4. Set the **Root Directory** to `backend`
5. Railway auto-detects Node.js — it will run `npm install` and `npm start` automatically
6. Go to **Variables** and add all the env vars from your `backend/.env`
7. After the first deploy, copy the Railway URL (e.g. `https://your-project.up.railway.app`)
8. Go back to Variables and set `WEBHOOK_URL` to `https://your-railway-url.com/webhooks/ton`

### 8b. Frontend — Vercel

1. Go to [vercel.com](https://vercel.com) and create a new project
2. Import your GitHub repository
3. Set the **Root Directory** to `frontend`
4. Add these environment variables:
   - `VITE_API_URL` = your Railway backend URL
   - `VITE_BOT_USERNAME` = your bot username
   - `VITE_TON_NETWORK` = `mainnet` or `testnet`
5. Vercel will build and deploy automatically

### 8c. Update BotFather

Once the frontend is deployed, go back to BotFather and update the Mini App URL:

1. Message [@BotFather](https://t.me/BotFather)
2. Send `/myapps`
3. Select your bot → select your app
4. Tap **Edit Web App URL**
5. Enter your Vercel URL (e.g. `https://your-app.vercel.app`)

---

## Step 9: Switch Wallet Network (For Testing)

If you're running the **Testnet Bot**, you need to switch your TON Wallet to testnet:

1. Open **Wallet** in Telegram → tap the `⋮` menu → **Settings**
2. Scroll down and tap **Version & Network**
3. Under **Network**, select **Testnet**
4. To get free testnet TON, message the [Testnet Faucet Bot](https://t.me/testgiver_ton_bot)

To switch back to mainnet, repeat the same steps and select **Mainnet**.

> **Important:** Always match the wallet network to the bot you're using. Testnet Bot → Testnet Wallet. Mainnet Bot → Mainnet Wallet.

---

## Project Structure

```
telegram-ads-mvp/
├── backend/
│   ├── src/
│   │   ├── index.ts              # Hono server entry point
│   │   ├── bot.ts                # Grammy bot handlers
│   │   ├── botInstance.ts        # Bot singleton & deep link helpers
│   │   ├── config/
│   │   │   └── tonConfig.ts      # TON network config (auto testnet/mainnet)
│   │   ├── routes/               # API endpoints
│   │   ├── services/             # Business logic
│   │   ├── repositories/         # Database access layer
│   │   ├── domain/               # Entity type definitions
│   │   ├── jobs/                 # Background workers (monitoring, timeouts)
│   │   └── db.ts                 # Supabase client
│   ├── .env.example
│   └── package.json
├── frontend/
│   ├── src/
│   │   ├── components/           # React components
│   │   ├── hooks/                # Custom React hooks
│   │   ├── providers/            # Context providers (Auth, Telegram)
│   │   ├── lib/                  # API client, utilities, TON config
│   │   └── api/                  # API client
│   └── package.json
├── migrations/                   # Incremental SQL migration files
├── schema.sql                    # Full database schema (pg_dump)
└── docs/                         # Additional documentation
    ├── ENGINEERING_DECISIONS.md
    ├── MVP_COMPLIANCE.md
    ├── ESCROW_DEAL_FLOW.md
    └── TELEGRAM_DESIGN_SYSTEM.md
```

---

## Troubleshooting

### Bot not responding

- Check that `BOT_TOKEN` is correct in `.env`
- If using testnet, make sure `TON_NETWORK=testnet` and `TESTNET_BOT_TOKEN` is set
- Check Railway logs for startup errors

### Payments not detected

- Verify `TONAPI_KEY` and `TON_API_KEY` are set
- Check that `MASTER_WALLET_ADDRESS` matches the wallet you're sending to
- For testnet, make sure both the wallet and the bot are on testnet
- Check the `/admin/transactions` endpoint to see if transactions are being picked up

### Mini App shows blank or won't load

- Verify that the BotFather Mini App URL matches your Vercel deployment URL
- Check that `VITE_API_URL` points to the correct backend URL
- Open browser DevTools console for errors

### Channel stats not loading

- The bot must be an **admin** of the channel (add the bot to the channel as admin)
- MTProto stats (language charts, boosts) require `TELEGRAM_API_ID` and `TELEGRAM_API_HASH` — these are optional but recommended

---

## License

MIT
