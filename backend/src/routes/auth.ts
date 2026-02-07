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
        return c.json({ success: true, walletAddress });

    } catch (error: any) {
        console.error('[Auth] Wallet save error:', error.message);
        return c.json({ error: error.message }, 500);
    }
});

export default auth;
