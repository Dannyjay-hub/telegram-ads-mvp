import { serve } from '@hono/node-server';
import { Hono } from 'hono';
import { startBot } from './bot';
import deals from './routes/deals';
import dotenv from 'dotenv';
import { getChatMember, getChannelStats } from './services/telegram';

dotenv.config();

const app = new Hono();

// Enable CORS
app.use('/*', async (c, next) => {
    c.header('Access-Control-Allow-Origin', '*');
    c.header('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
    c.header('Access-Control-Allow-Headers', 'Content-Type, Authorization, X-Telegram-ID');
    if (c.req.method === 'OPTIONS') {
        return c.body(null, 204);
    }
    await next();
});

import channels from './routes/channels';
import auth from './routes/auth';
import briefs from './routes/briefs';
import campaigns from './routes/campaigns';
import wallets from './routes/wallets';

// Routes
app.route('/deals', deals);
app.route('/channels', channels);
app.route('/auth', auth);
app.route('/briefs', briefs);
app.route('/campaigns', campaigns);
app.route('/wallets', wallets);

app.get('/', (c) => c.text('Telegram Ad Marketplace Backend is Running!'));
app.get('/health', (c) => c.json({ status: 'ok', timestamp: new Date().toISOString() }));

// Dev endpoints to test mock services
app.get('/dev/chat-member', async (c) => {
    const res = await getChatMember(123, 456);
    return c.json(res);
});

app.get('/dev/channel-stats', async (c) => {
    const res = await getChannelStats(123);
    return c.json(res);
});

// Start Bot
// Run in background so it doesn't block
startBot().catch(console.error);

// Start TON Payment Monitoring
import { tonPaymentService } from './services/TonPaymentService';

// Start polling for payments (every 30 seconds)
if (process.env.ENABLE_TON_POLLING !== 'false') {
    tonPaymentService.startPolling(30000);
}

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
