import { bot } from '../botInstance';

/**
 * NotificationService - Handles sending Telegram bot notifications to users
 * 
 * All methods are fail-safe - they log errors but don't throw,
 * so main operations continue even if notifications fail.
 */

// Mini App URL - update this if bot username or app short name changes
const MINI_APP_URL = 'https://t.me/DanielAdsMVP_bot/marketplace';

/**
 * Notify a user that they've been added as a PR manager for a channel
 */
export async function notifyPRManagerAdded(
    prManagerTelegramId: number,
    channelTitle: string,
    channelId: string,
    addedByUsername?: string
): Promise<boolean> {
    if (!bot) {
        console.warn('[NotificationService] Bot not configured, skipping PR manager notification');
        return false;
    }

    try {
        const message = `🎉 You've been added as a **PR Manager** for **${channelTitle}**!

You can now:
• View and manage partnership requests
• Approve ad placements
• Coordinate with advertisers

${addedByUsername ? `Added by: @${addedByUsername}` : ''}`;

        await bot.api.sendMessage(prManagerTelegramId, message, {
            parse_mode: 'Markdown',
            reply_markup: {
                inline_keyboard: [[
                    {
                        text: '📺 View Channel',
                        url: `${MINI_APP_URL}?startapp=channel_${channelId}`
                    }
                ]]
            }
        });

        console.log(`[NotificationService] ✅ Sent PR manager notification to ${prManagerTelegramId}`);
        return true;
    } catch (error: any) {
        // Common case: user hasn't started bot or blocked it
        console.warn(`[NotificationService] Failed to notify PR manager ${prManagerTelegramId}:`, error.message);
        return false;
    }
}

/**
 * Notify the channel owner that their channel is now live on the marketplace
 */
export async function notifyChannelPublished(
    ownerTelegramId: number,
    channelTitle: string,
    channelId: string
): Promise<boolean> {
    if (!bot) {
        console.warn('[NotificationService] Bot not configured, skipping channel published notification');
        return false;
    }

    try {
        const message = `🚀 **${channelTitle}** is now live on the marketplace!

Advertisers can now discover your channel and send partnership requests.

💡 **Tips for success:**
• Keep your rate card up to date
• Respond quickly to requests
• Maintain your channel's quality`;

        await bot.api.sendMessage(ownerTelegramId, message, {
            parse_mode: 'Markdown',
            reply_markup: {
                inline_keyboard: [[
                    {
                        text: '📊 View My Channel',
                        url: `${MINI_APP_URL}?startapp=channel_${channelId}`
                    },
                    {
                        text: '🏠 Dashboard',
                        url: `${MINI_APP_URL}?startapp=dashboard`
                    }
                ]]
            }
        });

        console.log(`[NotificationService] ✅ Sent channel published notification to ${ownerTelegramId}`);
        return true;
    } catch (error: any) {
        console.warn(`[NotificationService] Failed to notify owner ${ownerTelegramId}:`, error.message);
        return false;
    }
}

/**
 * Notify a user about a general event (extensible for future notifications)
 */
export async function sendNotification(
    telegramId: number,
    message: string,
    buttons?: Array<{ text: string; url: string }>
): Promise<boolean> {
    if (!bot) {
        console.warn('[NotificationService] Bot not configured, skipping notification');
        return false;
    }

    try {
        const options: any = { parse_mode: 'Markdown' };

        if (buttons && buttons.length > 0) {
            options.reply_markup = {
                inline_keyboard: [buttons.map(b => ({ text: b.text, url: b.url }))]
            };
        }

        await bot.api.sendMessage(telegramId, message, options);
        return true;
    } catch (error: any) {
        console.warn(`[NotificationService] Failed to send notification to ${telegramId}:`, error.message);
        return false;
    }
}
