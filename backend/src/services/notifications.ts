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
 * Helper to notify ALL channel admins (owner + PR managers) about a new deal request.
 */
export async function notifyChannelAdmins(channelId: string, dealId: string, message: string) {
    // Find ALL admins of the channel (owner + PR managers)
    const { data: admins, error } = await supabase
        .from('channel_admins')
        .select('user_id, users(telegram_id)')
        .eq('channel_id', channelId);

    if (error || !admins?.length) {
        console.warn(`[NOTIFY] No admins found for channel ${channelId}`);
        return;
    }

    // Notify each admin
    for (const admin of admins) {
        const telegramId = (admin as any).users?.telegram_id;
        if (telegramId) {
            await sendNotification(telegramId, message);
        }
    }

    console.log(`[NOTIFY] Sent notification to ${admins.length} channel admin(s)`);
}

/**
 * @deprecated Use notifyChannelAdmins instead
 */
export async function notifyChannelOwner(channelId: string, dealId: string, brief: string) {
    await notifyChannelAdmins(channelId, dealId, `📢 *New Deal Request!*\n\n"${brief}"\n\nReply with /accept_${dealId} or /reject_${dealId}`);
}
