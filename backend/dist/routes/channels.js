"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const hono_1 = require("hono");
const SupabaseChannelRepository_1 = require("../repositories/supabase/SupabaseChannelRepository");
const ChannelService_1 = require("../services/ChannelService");
const app = new hono_1.Hono();
// Dependency Injection
const channelRepo = new SupabaseChannelRepository_1.SupabaseChannelRepository();
const channelService = new ChannelService_1.ChannelService(channelRepo);
// GET /channels - List all channels
app.get('/', async (c) => {
    try {
        const minSubscribers = c.req.query('minSubscribers');
        const maxPrice = c.req.query('maxPrice');
        const channels = await channelService.listChannels({
            minSubscribers: minSubscribers ? Number(minSubscribers) : undefined,
            maxPrice: maxPrice ? Number(maxPrice) : undefined
        });
        return c.json(channels);
    }
    catch (e) {
        return c.json({ error: e.message }, 500);
    }
});
// GET /channels/my - Authorized user's channels
app.get('/my', async (c) => {
    try {
        // Mock Auth Header for MVP (Simulating logged in user)
        const telegramId = c.req.header('X-Telegram-ID') || '704124192';
        const channels = await channelService.listChannelsByAdmin(Number(telegramId));
        return c.json(channels);
    }
    catch (e) {
        return c.json({ error: e.message }, 500);
    }
});
// POST /channels/verify - Verify channel existence and stats
app.post('/verify', async (c) => {
    try {
        const body = await c.req.json();
        const { telegram_channel_id } = body;
        if (!telegram_channel_id) {
            return c.json({ error: 'telegram_channel_id is required' }, 400);
        }
        const result = await channelService.verifyChannel(telegram_channel_id);
        return c.json(result);
    }
    catch (e) {
        console.error('Verify error:', e);
        return c.json({ error: e.message }, 400);
    }
});
// POST /channels - Add a channel
app.post('/', async (c) => {
    try {
        const body = await c.req.json();
        const { telegram_channel_id } = body;
        // In a real app we'd get userId from Auth Middleware context
        // const userId = c.get('user').telegram_id;
        const mockUserId = 123456789;
        if (!telegram_channel_id) {
            return c.json({ error: 'telegram_channel_id is required' }, 400);
        }
        const channel = await channelService.verifyAndAddChannel(telegram_channel_id, mockUserId);
        return c.json(channel, 201);
    }
    catch (e) {
        return c.json({ error: e.message }, 400);
    }
});
// POST /channels/:id/sync_admins
app.post('/:id/sync_admins', async (c) => {
    try {
        const id = c.req.param('id');
        const admins = await channelService.syncChannelAdmins(id);
        return c.json({ success: true, admins });
    }
    catch (e) {
        return c.json({ error: e.message }, 400);
    }
});
// POST /channels/:id/sync_stats
app.post('/:id/sync_stats', async (c) => {
    try {
        const id = c.req.param('id');
        const updates = await channelService.syncChannelStats(id);
        return c.json({ success: true, updates });
    }
    catch (e) {
        return c.json({ error: e.message }, 400);
    }
});
exports.default = app;
