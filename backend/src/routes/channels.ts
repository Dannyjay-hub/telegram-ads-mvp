
import { Hono } from 'hono';
import { SupabaseChannelRepository } from '../repositories/supabase/SupabaseChannelRepository';
import { ChannelService } from '../services/ChannelService';
import { getChatMember, getChannelStats, getBotPermissions, resolveChannelId } from '../services/telegram';
import { bot } from '../botInstance';

const app = new Hono();

// Dependency Injection
const channelRepo = new SupabaseChannelRepository();
const channelService = new ChannelService(channelRepo);

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
    } catch (e: any) {
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
    } catch (e: any) {
        return c.json({ error: e.message }, 500);
    }
});

// POST /channels/verify - Verify channel existence and stats (Legacy + Basic)
app.post('/verify', async (c) => {
    try {
        const body = await c.req.json();
        const { telegram_channel_id } = body;

        if (!telegram_channel_id) {
            return c.json({ error: 'telegram_channel_id is required' }, 400);
        }

        const result = await channelService.verifyChannel(telegram_channel_id);
        return c.json(result);
    } catch (e: any) {
        console.error('Verify error:', e);
        return c.json({ error: e.message }, 400);
    }
});

// POST /channels/verify_permissions - Strict Bot Verification State Machine
app.post('/verify_permissions', async (c) => {
    try {
        const { channel_id } = await c.req.json();
        const headerId = c.req.header('X-Telegram-ID');
        const userId = headerId ? Number(headerId) : 704124192; // Mock ID default

        // Resolve ID if it's a username
        const resolvedId = await resolveChannelId(channel_id);

        if (!resolvedId) {
            return c.json({
                status: 'error',
                message: 'Channel not found or Bot not able to see it. Ensure the username is correct or try adding the bot first.'
            }, 400);
        }

        // 1. Check Bot Permissions (Strict)
        const permRes = await channelService.verifyChannelPermissions(resolvedId);

        if (permRes.state !== 'D_READY') {
            return c.json({
                state: permRes.state,
                message: 'Bot verification failed.',
                missing: permRes.missing,
                details: permRes.details || permRes.current
            });
        }

        // 2. Check User Admin Permissions (Double check)
        // Ensure the person trying to list is still an admin
        const userMember = await getChatMember(resolvedId, userId);
        if (!userMember || (userMember.status !== 'administrator' && userMember.status !== 'creator')) {
            return c.json({
                state: 'B_MISSING_PERMISSIONS',
                message: 'You are not an admin of this channel.',
                missing: ['User Admin Rights'],
                details: null
            });
        }

        // 3. State D: Ready
        const channelStats = await getChannelStats(resolvedId);

        if (!channelStats) {
            throw new Error('Failed to fetch channel info from Telegram');
        }

        return c.json({
            state: 'D_READY',
            message: 'Channel is ready for listing.',
            details: permRes.details, // Bot permissions
            channel_details: {
                title: channelStats.title,
                username: channelStats.username,
                // photo_url: (channelInfo.photo as any)?.small_file_id, 
                subscribers: channelStats.memberCount,
                avg_views: (channelStats as any).avg_views
            },
            resolved_id: resolvedId
        });

    } catch (e: any) {
        return c.json({ status: 'error', message: e.message }, 500);
    }
});

// POST /channels - Add a channel
app.post('/', async (c) => {
    try {
        const body = await c.req.json();
        const { telegram_channel_id, status } = body;

        // In a real app we'd get userId from Auth Middleware context
        // const userId = c.get('user').telegram_id;
        const headerId = c.req.header('X-Telegram-ID');
        const mockUserId = headerId ? Number(headerId) : 704124192;

        if (!telegram_channel_id) {
            return c.json({ error: 'telegram_channel_id is required' }, 400);
        }

        const channel = await channelService.verifyAndAddChannel(
            telegram_channel_id,
            mockUserId,
            undefined, // pricing (handled inside or if passed)
            status // Pass status (e.g. 'draft')
        );
        return c.json(channel, 201);
    } catch (e: any) {
        return c.json({ error: e.message }, 400);
    }
});

// POST /channels/:id/sync_admins
app.post('/:id/sync_admins', async (c) => {
    try {
        const id = c.req.param('id');
        const admins = await channelService.syncChannelAdmins(id);
        return c.json({ success: true, admins });
    } catch (e: any) {
        return c.json({ error: e.message }, 400);
    }
});

// POST /channels/:id/sync_stats
app.post('/:id/sync_stats', async (c) => {
    try {
        const id = c.req.param('id');
        const updates = await channelService.syncChannelStats(id);
        return c.json({ success: true, updates });
    } catch (e: any) {
        return c.json({ error: e.message }, 400);
    }
});

// PUT /channels/:id - Update channel details (Rate Card, Price)
app.put('/:id', async (c) => {
    try {
        const id = c.req.param('id');
        const body = await c.req.json();

        // In real app: Check ownership via X-Telegram-ID vs Channel Admins

        const updated = await channelService.updateChannel(id, body);
        return c.json(updated);
    } catch (e: any) {
        return c.json({ error: e.message }, 400);
    }
});

// DELETE /channels/:id
app.delete('/:id', async (c) => {
    try {
        const id = c.req.param('id');
        // Validation: Check if user owns channel
        await channelRepo.delete(id);
        return c.json({ success: true });
    } catch (e: any) {
        return c.json({ error: e.message }, 500);
    }
});

export default app;
