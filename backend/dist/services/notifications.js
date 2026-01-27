"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.sendNotification = sendNotification;
exports.notifyUser = notifyUser;
exports.notifyChannelOwner = notifyChannelOwner;
const bot_1 = require("../bot");
const db_1 = require("../db");
/**
 * Sends a notification to a specific Telegram user via the bot.
 * Fails gracefully if the bot is not configured or user hasn't started the bot.
 */
async function sendNotification(telegramId, message) {
    if (!bot_1.bot) {
        console.log(`[MOCK NOTIFICATION] To ${telegramId}: ${message}`);
        return;
    }
    try {
        await bot_1.bot.api.sendMessage(telegramId, message);
        console.log(`[BOT] Message sent to ${telegramId}`);
    }
    catch (error) {
        console.warn(`[BOT] Failed to send message to ${telegramId}:`, error);
        console.log(`[FALLBACK LOG] To ${telegramId}: ${message}`);
    }
}
/**
 * Helper to look up a user's Telegram ID from their UUID and send a message.
 */
async function notifyUser(userId, message) {
    const { data: user, error } = await db_1.supabase
        .from('users')
        .select('telegram_id')
        .eq('id', userId)
        .single();
    if (error || !user || !user.telegram_id) {
        console.warn(`[NOTIFY] Could not find telegram_id for user ${userId}`);
        return;
    }
    await sendNotification(Number(user.telegram_id), message);
}
/**
 * Helper to notify a channel owner about a new deal request.
 */
async function notifyChannelOwner(channelId, dealId, brief) {
    // 1. Find the owner of the channel
    const { data: adminData, error } = await db_1.supabase
        .from('channel_admins')
        .select('user_id')
        .eq('channel_id', channelId)
        .eq('is_owner', true) // Assuming one owner for MVP
        .single();
    if (error || !adminData) {
        // Fallback: If no admin map exists yet (since we just created channels without admins in Phase 1)
        // We might want to look up the channel -> find who registered it? 
        // For MVP, if we don't have an owner map, we can't notify.
        console.warn(`[NOTIFY] No owner found for channel ${channelId}`);
        return;
    }
    await notifyUser(adminData.user_id, `📢 *New Deal Request!*\n\n"${brief}"\n\nReply with /accept_${dealId} or /reject_${dealId}`);
}
