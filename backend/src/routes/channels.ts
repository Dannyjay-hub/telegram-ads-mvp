
import { Hono } from 'hono';
import { SupabaseChannelRepository } from '../repositories/supabase/SupabaseChannelRepository';
import { ChannelService } from '../services/ChannelService';
import { getChatMember, getChannelStats, getBotPermissions, resolveChannelId, verifyTeamPermissions } from '../services/telegram';
import { bot } from '../botInstance';
import { supabase } from '../db';

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

// GET /channels/:id - Get single channel details
app.get('/:id', async (c) => {
    try {
        const id = c.req.param('id');
        const channel = await channelRepo.findById(id);
        if (!channel) {
            return c.json({ error: 'Channel not found' }, 404);
        }
        return c.json(channel);
    } catch (e: any) {
        return c.json({ error: e.message }, 500);
    }
});

// GET /channels/:id/admins - Get channel admins with role hierarchy
app.get('/:id/admins', async (c) => {
    try {
        const id = c.req.param('id');
        const { data, error } = await supabase
            .from('channel_admins')
            .select('user_id, role, permissions, created_at, users(telegram_id, username, first_name)')
            .eq('channel_id', id);

        if (error) throw error;

        // Separate owner from PR managers
        const owner = (data || []).find((a: any) => a.role === 'owner');
        const prManagers = (data || [])
            .filter((a: any) => a.role === 'pr_manager')
            // Only include entries with valid telegram_id (filter out orphaned records)
            .filter((a: any) => a.users?.telegram_id);

        console.log('[GET /admins] Found', prManagers.length, 'valid PR managers');

        return c.json({
            owner: owner ? {
                user_id: owner.user_id,
                telegram_id: owner.users?.telegram_id,
                username: owner.users?.username || owner.users?.first_name || 'Owner',
                role: 'owner',
                permissions: owner.permissions
            } : null,
            pr_managers: prManagers.map((pm: any) => ({
                user_id: pm.user_id,
                telegram_id: pm.users?.telegram_id,
                username: pm.users?.username || pm.users?.first_name || `User ${pm.users?.telegram_id}`,
                role: 'pr_manager',
                permissions: pm.permissions,
                added_at: pm.created_at
            })),
            // For backward compatibility, include flat list
            all: (data || []).map((admin: any) => ({
                user_id: admin.user_id,
                role: admin.role,
                telegram_id: admin.users?.telegram_id
            }))
        });
    } catch (e: any) {
        return c.json({ error: e.message }, 500);
    }
});

// POST /channels/:id/verify-team - Verify all team members (bot, owner, PR managers) still have admin perms
app.post('/:id/verify-team', async (c) => {
    try {
        const id = c.req.param('id');

        // 1. Get channel info (need telegram_channel_id and owner)
        const { data: channel, error: channelError } = await supabase
            .from('channels')
            .select('telegram_channel_id, owner_id')
            .eq('id', id)
            .single();

        if (channelError || !channel) {
            return c.json({ error: 'Channel not found' }, 404);
        }

        // 2. Get all PR managers for this channel
        const { data: admins } = await supabase
            .from('channel_admins')
            .select('users(telegram_id, username)')
            .eq('channel_id', id)
            .eq('role', 'pr_manager');

        const prManagers = (admins || [])
            .filter((a: any) => a.users?.telegram_id)
            .map((a: any) => ({
                telegram_id: a.users.telegram_id,
                username: a.users.username
            }));

        // 3. Verify team permissions via Telegram API
        const result = await verifyTeamPermissions(
            channel.telegram_channel_id,
            channel.owner_id,
            prManagers
        );

        console.log('[verify-team] Result:', JSON.stringify(result, null, 2));

        return c.json(result);
    } catch (e: any) {
        console.error('[verify-team] Error:', e.message);
        return c.json({ error: e.message }, 500);
    }
});

// GET /channels/:id/eligible-pr-managers - Telegram admins who can be added as PR managers
app.get('/:id/eligible-pr-managers', async (c) => {
    try {
        const id = c.req.param('id');

        // Get channel's telegram ID
        const channel = await channelRepo.findById(id);
        if (!channel) return c.json({ error: 'Channel not found' }, 404);

        // Get current admins from our DB
        const { data: currentAdmins } = await supabase
            .from('channel_admins')
            .select('users(telegram_id)')
            .eq('channel_id', id);

        const existingTelegramIds = (currentAdmins || []).map((a: any) => a.users?.telegram_id);

        // Get Telegram admins for this channel
        const telegramAdmins = await channelService.getTelegramAdmins(channel.telegramChannelId);

        // Filter out those who are already in our system
        const eligible = telegramAdmins.filter((ta: any) =>
            !existingTelegramIds.includes(ta.user.id) && !ta.user.is_bot
        );

        return c.json(eligible.map((e: any) => ({
            telegram_id: e.user.id,
            username: e.user.username || e.user.first_name,
            first_name: e.user.first_name,
            status: e.status
        })));
    } catch (e: any) {
        return c.json({ error: e.message }, 500);
    }
});

// POST /channels/:id/pr-managers - Add a PR manager
app.post('/:id/pr-managers', async (c) => {
    try {
        const id = c.req.param('id');
        const body = await c.req.json();
        let { telegram_id, username } = body;
        const requesterId = Number(c.req.header('X-Telegram-ID'));

        // Check if requester is the owner
        const { data: ownerCheck, error: ownerError } = await supabase
            .from('channel_admins')
            .select('role, users(telegram_id)')
            .eq('channel_id', id)
            .eq('role', 'owner')
            .single();

        console.log('[PR Manager] Ownership check:', {
            requesterId,
            ownerCheck,
            ownerError,
            ownerTelegramId: (ownerCheck as any)?.users?.telegram_id
        });

        if (!ownerCheck || (ownerCheck as any).users?.telegram_id !== requesterId) {
            return c.json({ error: 'Only the channel owner can add PR managers' }, 403);
        }

        // Get channel info
        const channel = await channelRepo.findById(id);
        if (!channel) return c.json({ error: 'Channel not found' }, 404);

        // Get Telegram admins for this channel
        const telegramAdmins = await channelService.getTelegramAdmins(channel.telegramChannelId);
        console.log('[PR Manager] Telegram admins:', telegramAdmins.map((a: any) => ({ id: a.user.id, username: a.user.username })));

        // If username provided, find the admin by username
        let targetAdmin: any = null;
        if (username) {
            username = username.replace('@', '').toLowerCase();
            targetAdmin = telegramAdmins.find((ta: any) =>
                ta.user.username?.toLowerCase() === username
            );
            if (!targetAdmin) {
                return c.json({ error: `@${username} is not an admin of this Telegram channel. Add them as admin on Telegram first.` }, 400);
            }
            telegram_id = targetAdmin.user.id;
        } else if (telegram_id) {
            // Verify by telegram_id
            targetAdmin = telegramAdmins.find((ta: any) => ta.user.id === telegram_id);
            if (!targetAdmin) {
                return c.json({ error: 'User must be a Telegram admin of this channel' }, 400);
            }
        } else {
            return c.json({ error: 'Either username or telegram_id is required' }, 400);
        }

        // Check that the admin has actual permissions (not just admin status with 0 permissions)
        console.log('[PR Manager] Target admin permissions:', targetAdmin);
        const hasPermissions = targetAdmin.can_post_messages ||
            targetAdmin.can_edit_messages ||
            targetAdmin.can_delete_messages ||
            targetAdmin.status === 'creator';

        if (!hasPermissions) {
            return c.json({
                error: `@${targetAdmin.user.username || username} has no admin permissions. They must have at least one permission (post, edit, or delete messages) on Telegram to be a PR manager.`
            }, 400);
        }

        // Create or get user
        let { data: existingUser } = await supabase
            .from('users')
            .select('id')
            .eq('telegram_id', telegram_id)
            .single();

        if (!existingUser) {
            const telegramUser = telegramAdmins.find((ta: any) => ta.user.id === telegram_id)?.user;
            const { data: newUser } = await supabase
                .from('users')
                .insert({
                    telegram_id,
                    username: telegramUser?.username,
                    first_name: telegramUser?.first_name,
                    role: 'publisher'
                })
                .select('id')
                .single();
            existingUser = newUser;
        }

        // Check if already added
        const { data: existingAdmin } = await supabase
            .from('channel_admins')
            .select('role')
            .eq('channel_id', id)
            .eq('user_id', existingUser.id)
            .single();

        if (existingAdmin) {
            return c.json({ error: `@${username || targetAdmin.user.username} is already a ${existingAdmin.role} of this channel.` }, 400);
        }

        // Add as PR manager
        const { error: insertError } = await supabase
            .from('channel_admins')
            .insert({
                channel_id: id,
                user_id: existingUser?.id,
                role: 'pr_manager',
                permissions: {
                    can_approve_deal: true,
                    can_negotiate: true,
                    can_withdraw: false
                }
            });

        if (insertError) throw insertError;

        return c.json({
            success: true,
            telegram_id,
            username: targetAdmin?.user?.username || username
        });
    } catch (e: any) {
        return c.json({ error: e.message }, 500);
    }
});

// DELETE /channels/:id/pr-managers/:telegramId - Remove a PR manager
app.delete('/:id/pr-managers/:telegramId', async (c) => {
    try {
        const id = c.req.param('id');
        const telegramId = Number(c.req.param('telegramId'));
        const requesterId = Number(c.req.header('X-Telegram-ID'));

        console.log('[DELETE PR] Starting deletion for telegramId:', telegramId, 'in channel:', id);

        // Check if requester is the owner
        const { data: ownerCheck, error: ownerError } = await supabase
            .from('channel_admins')
            .select('role, users(telegram_id)')
            .eq('channel_id', id)
            .eq('role', 'owner')
            .single();

        console.log('[DELETE PR] Requester ID:', requesterId, typeof requesterId);
        console.log('[DELETE PR] Owner check result:', ownerCheck, 'Error:', ownerError);
        console.log('[DELETE PR] Owner telegram_id:', ownerCheck?.users?.telegram_id, typeof ownerCheck?.users?.telegram_id);

        // Use String comparison to handle bigint/number type mismatches
        const ownerTelegramId = ownerCheck?.users?.telegram_id;
        if (!ownerCheck || String(ownerTelegramId) !== String(requesterId)) {
            console.log('[DELETE PR] Owner check FAILED - IDs do not match');
            return c.json({ error: 'Only the channel owner can remove PR managers' }, 403);
        }

        console.log('[DELETE PR] Owner check PASSED');

        // Find the user entry for this telegram_id
        console.log('[DELETE PR] Looking up user with telegram_id:', telegramId);
        const { data: pmUser, error: userError } = await supabase
            .from('users')
            .select('id')
            .eq('telegram_id', telegramId)
            .single();

        console.log('[DELETE PR] User lookup result:', pmUser, 'Error:', userError);

        if (!pmUser) {
            console.log('[DELETE PR] User not found in database, returning 404');
            return c.json({ error: 'User not found' }, 404);
        }

        console.log('[DELETE PR] Found user_id:', pmUser.id, '- now deleting from channel_admins');

        const { error: deleteError, count } = await supabase
            .from('channel_admins')
            .delete()
            .eq('channel_id', id)
            .eq('user_id', pmUser.id)
            .eq('role', 'pr_manager');

        console.log('[DELETE PR] Delete result - Error:', deleteError, 'Count:', count);

        if (deleteError) {
            console.log('[DELETE PR] Delete failed with error:', deleteError);
            throw deleteError;
        }

        console.log('[DELETE PR] Successfully deleted PR manager');
        return c.json({ success: true });
    } catch (e: any) {
        console.log('[DELETE PR] Exception:', e.message);
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
        const { channel_id, skip_existing_check } = await c.req.json();
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

        // 1. Check if channel already exists in database (fast, DB-only check)
        // Skip this check if we're just re-verifying permissions for an update
        if (!skip_existing_check) {
            console.log('[Duplicate Check] Looking for channel with telegram_channel_id:', resolvedId, typeof resolvedId);
            const { data: existingChannel, error: checkError } = await supabase
                .from('channels')
                .select('id, title, status, telegram_channel_id')
                .eq('telegram_channel_id', resolvedId)
                .maybeSingle();

            console.log('[Duplicate Check] Result:', existingChannel, 'Error:', checkError);

            if (existingChannel) {
                return c.json({
                    state: 'ALREADY_LISTED',
                    message: `This channel "${existingChannel.title || 'Unknown'}" is already listed on the platform.`,
                    existing_channel_id: existingChannel.id,
                    status: existingChannel.status
                }, 409); // 409 Conflict
            }
        }

        // 2. Check Bot Permissions (Strict)
        const permRes = await channelService.verifyChannelPermissions(resolvedId);

        if (permRes.state !== 'D_READY') {
            return c.json({
                state: permRes.state,
                message: 'Bot verification failed.',
                missing: permRes.missing,
                details: permRes.details || permRes.current
            });
        }

        // 3. Check User is OWNER (Creator) - Only channel owners can list
        // This is a critical security check: PR managers and other admins cannot list channels
        const userMember = await getChatMember(resolvedId, userId);
        if (!userMember || userMember.status !== 'creator') {
            return c.json({
                state: 'NOT_OWNER',
                message: 'Only the channel owner can list this channel. You must be the creator of the channel.',
                missing: ['Channel Ownership'],
                details: userMember ? { status: userMember.status } : null
            });
        }

        // 4. State D: Ready
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
                photoUrl: channelStats.photoUrl,
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
        const {
            telegram_channel_id,
            status,
            description,
            category,
            tags,
            base_price_amount,
            pricing,
            rateCard
        } = body;

        // In a real app we'd get userId from Auth Middleware context
        const headerId = c.req.header('X-Telegram-ID');
        const mockUserId = headerId ? Number(headerId) : 704124192;

        if (!telegram_channel_id) {
            return c.json({ error: 'telegram_channel_id is required' }, 400);
        }

        const channel = await channelService.verifyAndAddChannel(
            telegram_channel_id,
            mockUserId,
            {
                pricing: pricing,
                basePriceAmount: base_price_amount,
                description,
                category,
                tags,
                rateCard
            },
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

        // Convert snake_case from frontend to camelCase expected by service layer
        const updates = {
            basePriceAmount: body.base_price_amount,
            pricing: body.pricing,
            rateCard: body.rateCard,
            verifiedStats: body.verifiedStats,
            status: body.status,
            description: body.description,
            category: body.category,
            tags: body.tags,
            language: body.language
        };

        console.log('[PUT /channels/:id] Received body:', body);
        console.log('[PUT /channels/:id] Converted updates:', updates);

        const updated = await channelService.updateChannel(id, updates);
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
