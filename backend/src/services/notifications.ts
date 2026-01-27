import { bot } from '../bot';
import { supabase } from '../db';

/**
 * Sends a notification to a specific Telegram user via the bot.
 * Fails gracefully if the bot is not configured or user hasn't started the bot.
 */
export async function sendNotification(telegramId: number, message: string) {
    if (!bot) {
        console.log(`[MOCK NOTIFICATION] To ${telegramId}: ${message}`);
        return;
    }

    try {
        await bot.api.sendMessage(telegramId, message);
        console.log(`[BOT] Message sent to ${telegramId}`);
    } catch (error) {
        console.warn(`[BOT] Failed to send message to ${telegramId}:`, error);
        console.log(`[FALLBACK LOG] To ${telegramId}: ${message}`);
    }
}

/**
 * Helper to look up a user's Telegram ID from their UUID and send a message.
 */
export async function notifyUser(userId: string, message: string) {
    const { data: user, error } = await (supabase
        .from('users')
        .select('telegram_id')
        .eq('id', userId)
        .single() as any);

    if (error || !user || !user.telegram_id) {
        console.warn(`[NOTIFY] Could not find telegram_id for user ${userId}`);
        return;
    }

    await sendNotification(Number(user.telegram_id), message);
}

/**
 * Helper to notify a channel owner about a new deal request.
 */
export async function notifyChannelOwner(channelId: string, dealId: string, brief: string) {
    // 1. Find the owner of the channel
    const { data: adminData, error } = await (supabase
        .from('channel_admins')
        .select('user_id')
        .eq('channel_id', channelId)
        .eq('is_owner', true) // Assuming one owner for MVP
        .single() as any);

    if (error || !adminData) {
        // Fallback: If no admin map exists yet (since we just created channels without admins in Phase 1)
        // We might want to look up the channel -> find who registered it? 
        // For MVP, if we don't have an owner map, we can't notify.
        console.warn(`[NOTIFY] No owner found for channel ${channelId}`);
        return;
    }

    await notifyUser(adminData.user_id, `📢 *New Deal Request!*\n\n"${brief}"\n\nReply with /accept_${dealId} or /reject_${dealId}`);
}
