import { Hono } from 'hono';
import { SupabaseUserRepository } from '../repositories/supabase/SupabaseUserRepository';
import { UserService } from '../services/UserService';
import { supabase } from '../db';

const auth = new Hono();

// Dependency Injection
const userRepo = new SupabaseUserRepository();
const userService = new UserService(userRepo);

auth.post('/telegram', async (c) => {
    try {
        const body = await c.req.json();
        const { initData } = body;

        if (!initData) {
            return c.json({ error: 'Missing initData' }, 400);
        }

        const result = await userService.authenticateTelegramUser(initData);
        return c.json(result);

    } catch (error: any) {
        console.error('Auth error:', error.message);
        const status = error.message === 'Invalid authentication data' ? 401 : 500;
        return c.json({ error: error.message }, status);
    }
});

/**
 * Save user's TON wallet address when they connect via TonConnect
 * This is used for payouts to channel owners
 */
auth.post('/wallet', async (c) => {
    try {
        const telegramId = c.req.header('X-Telegram-Id');
        if (!telegramId) {
            return c.json({ error: 'Missing X-Telegram-Id header' }, 401);
        }

        const body = await c.req.json();
        const { walletAddress } = body;

        if (!walletAddress) {
            return c.json({ error: 'Missing walletAddress' }, 400);
        }

        // Update user's wallet address
        const { data, error } = await supabase
            .from('users')
            .update({
                ton_wallet_address: walletAddress,
                wallet_connected_at: new Date().toISOString()
            })
            .eq('telegram_id', Number(telegramId))
            .select()
            .single();

        if (error) {
            console.error('[Auth] Failed to save wallet:', error);
            return c.json({ error: 'Failed to save wallet address' }, 500);
        }

        console.log(`[Auth] ✅ Wallet saved for user ${telegramId}: ${walletAddress.slice(0, 8)}...`);

        // Also update payout_wallet on any channels this user owns
        // (in case they listed without a wallet)
        const { data: ownedChannels } = await supabase
            .from('channel_admins')
            .select('channel_id')
            .eq('user_id', (data as any).id)
            .eq('role', 'owner') as any;

        if (ownedChannels?.length) {
            const channelIds = ownedChannels.map((c: any) => c.channel_id);

            // Update channels that don't have a payout wallet yet
            await supabase
                .from('channels')
                .update({ payout_wallet: walletAddress } as any)
                .in('id', channelIds)
                .is('payout_wallet', null);

            console.log(`[Auth] Updated payout_wallet for ${channelIds.length} owned channel(s)`);

            // Check for payout_pending deals on these channels and process them
            const { data: pendingDeals } = await supabase
                .from('deals')
                .select('id, price_amount, price_currency')
                .in('channel_id', channelIds)
                .eq('status', 'payout_pending') as any;

            if (pendingDeals?.length) {
                console.log(`[Auth] 🎉 Found ${pendingDeals.length} payout_pending deal(s) — processing now`);
                const { tonPayoutService } = await import('../services/TonPayoutService');

                for (const deal of pendingDeals) {
                    try {
                        await tonPayoutService.queuePayout(
                            deal.id,
                            walletAddress,
                            deal.price_amount,
                            deal.price_currency || 'TON'
                        );

                        await supabase
                            .from('deals')
                            .update({
                                status: 'released',
                                status_updated_at: new Date().toISOString()
                            } as any)
                            .eq('id', deal.id);

                        console.log(`[Auth] ✅ Payout queued for deal ${deal.id}`);
                    } catch (e) {
                        console.error(`[Auth] Failed to process payout for deal ${deal.id}:`, e);
                    }
                }
            }
        }

        return c.json({ success: true, walletAddress });

    } catch (error: any) {
        console.error('[Auth] Wallet save error:', error.message);
        return c.json({ error: error.message }, 500);
    }
});

export default auth;
