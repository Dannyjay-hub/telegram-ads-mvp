import { SupabaseUserRepository } from '../repositories/supabase/SupabaseUserRepository';
import { UserService } from '../services/UserService';
import { supabase } from '../db';
import { createRouter } from '../types/app';
import { authMiddleware } from '../middleware/authMiddleware';
import { Address } from '@ton/core';

const auth = createRouter();

// Apply auth middleware ONLY to /wallet (login endpoint must remain public)
auth.use('/wallet', authMiddleware);

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
        const telegramId = c.get('telegramId');

        const body = await c.req.json();
        const { walletAddress } = body;

        if (!walletAddress) {
            return c.json({ error: 'Missing walletAddress' }, 400);
        }

        // Validate address checksum before saving
        // TonConnect/wallets can occasionally provide addresses with invalid checksums
        let validatedAddress: string;
        try {
            const parsed = Address.parse(walletAddress);
            validatedAddress = parsed.toString({ bounceable: false, urlSafe: true });
        } catch (e: any) {
            console.error(`[Auth] ❌ Invalid wallet address from TonConnect: ${walletAddress}`, e.message);
            return c.json({ error: 'Invalid wallet address checksum' }, 400);
        }

        // Update user's wallet address (using validated/normalized address)
        const { data, error } = await supabase
            .from('users')
            .update({
                ton_wallet_address: validatedAddress,
                wallet_connected_at: new Date().toISOString()
            })
            .eq('telegram_id', telegramId)
            .select()
            .single();

        if (error) {
            console.error('[Auth] Failed to save wallet:', error);
            return c.json({ error: 'Failed to save wallet address' }, 500);
        }

        console.log(`[Auth] ✅ Wallet saved for user ${telegramId}: ${validatedAddress.slice(0, 8)}...`);

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
                .update({ payout_wallet: validatedAddress } as any)
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
                            validatedAddress,
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
