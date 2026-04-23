import { serve } from '@hono/node-server';
import { Hono } from 'hono';
import { startBot } from './bot';
import deals from './routes/deals';
import dotenv from 'dotenv';
import { getChatMember, getChannelStats } from './services/telegram';
import { authMiddleware } from './middleware/authMiddleware';

dotenv.config();

// C-03: Crash on startup if critical env vars are missing — never boot with fallbacks
const REQUIRED_ENV_VARS = ['JWT_SECRET', 'BOT_TOKEN', 'SUPABASE_URL', 'SUPABASE_SERVICE_ROLE_KEY'];
for (const key of REQUIRED_ENV_VARS) {
    if (!process.env[key]) {
        console.error(`FATAL: Required environment variable ${key} is not set. Refusing to start.`);
        process.exit(1);
    }
}

// Type-safe context variables set by auth middleware
type AppVariables = {
    telegramId: number;
    userId: string;
};

const app = new Hono<{ Variables: AppVariables }>();

// Enable CORS
app.use('/*', async (c, next) => {
    c.header('Access-Control-Allow-Origin', '*');
    c.header('Access-Control-Allow-Methods', 'GET, POST, PUT, PATCH, DELETE, OPTIONS');
    c.header('Access-Control-Allow-Headers', 'Content-Type, Authorization');
    if (c.req.method === 'OPTIONS') {
        return c.body(null, 204);
    }
    await next();
});

import channels from './routes/channels';
import auth from './routes/auth';
import briefs from './routes/briefs';
import campaigns from './routes/campaigns';

import webhooks from './routes/webhooks';

// Apply auth middleware to all protected routes
// Exclude: /auth/* (login), /webhooks/* (bot/TON callbacks), /health, public GET endpoints
app.use('/deals/*', authMiddleware);
app.use('/channels/*', authMiddleware);
app.use('/briefs/*', authMiddleware);
app.use('/campaigns/*', authMiddleware);
app.use('/admin/*', authMiddleware); // C-01: admin routes require authentication


// Routes
app.route('/deals', deals);
app.route('/channels', channels);
app.route('/auth', auth);
app.route('/briefs', briefs);
app.route('/campaigns', campaigns);

app.route('/webhooks', webhooks);

app.get('/', (c) => c.text('Telegram Ad Marketplace Backend is Running!'));
app.get('/health', (c) => c.json({ status: 'ok', timestamp: new Date().toISOString() }));

// H-08: /dev/* endpoints removed — used hardcoded dummy IDs, served no production
// purpose, and were publicly accessible with no authentication.

// Start Bot
// Run in background so it doesn't block
startBot().catch(console.error);

// Start TON Payment Monitoring
import { tonPaymentService } from './services/TonPaymentService';
import { tonWebhookService } from './services/TonWebhookService';

// Register webhooks for instant payment detection (preferred)
tonWebhookService.registerWebhooks().catch(console.error);

// Start polling for payments as backup
// Disable with ENABLE_TON_POLLING=false if webhooks are working
// Increase interval with TON_POLL_INTERVAL_MS (default: 60000 = 1 minute)
if (process.env.ENABLE_TON_POLLING !== 'false') {
    const pollInterval = parseInt(process.env.TON_POLL_INTERVAL_MS || '15000', 10);
    console.log(`TON Polling enabled with interval: ${pollInterval / 1000}s`);
    tonPaymentService.startPolling(pollInterval);
} else {
    console.log('TON Polling disabled (using webhooks only)');
}

// Start Post-Escrow Background Jobs (auto-posting, monitoring, timeouts)
import { startBackgroundJobs } from './jobs/backgroundJobs';
startBackgroundJobs();

// Admin endpoint to check recent transactions
app.get('/admin/transactions', async (c) => {
    try {
        const transactions = await tonPaymentService.getRecentTransactions(20);
        return c.json({ ok: true, transactions });
    } catch (e: any) {
        return c.json({ ok: false, error: e.message }, 500);
    }
});

// Admin endpoint to manually trigger payment check
app.post('/admin/check-payments', async (c) => {
    try {
        await tonPaymentService.pollTransactions();
        return c.json({ ok: true, message: 'Payment check triggered' });
    } catch (e: any) {
        return c.json({ ok: false, error: e.message }, 500);
    }
});

// Start Server
const port = Number(process.env.PORT) || 3000;
console.log(`Server is running on port ${port}`);

serve({
    fetch: app.fetch,
    port
});
