import { bot } from '../botInstance';

/**
 * NotificationService - Handles sending Telegram bot notifications to users
 * 
 * All methods are fail-safe - they log errors but don't throw,
 * so main operations continue even if notifications fail.
 * 
 * DEDUPLICATION: All notifications are tracked to prevent duplicates
 * within a 30-second window (prevents double-clicks, race conditions)
 */

// Mini App URL - update this if bot username or app short name changes
const MINI_APP_URL = 'https://t.me/DanielAdsMVP_bot/marketplace';

// ========== NOTIFICATION DEDUPLICATION ==========
// Prevents duplicate notifications within a time window

// Cache of recently sent notifications: key -> timestamp
const recentNotifications = new Map<string, number>();
const DEDUP_WINDOW_MS = 30_000; // 30 seconds

/**
 * Check if a notification was recently sent (and mark as sent if not)
 * Returns true if notification was already sent, false if it's new
 * Export so other services can use this for deduplication
 */
export function isDuplicate(userId: number | string, notificationType: string, uniqueId?: string): boolean {
    const key = `${userId}:${notificationType}:${uniqueId || ''}`;
    const now = Date.now();

    // Clean up old entries (older than dedup window)
    for (const [k, timestamp] of recentNotifications.entries()) {
        if (now - timestamp > DEDUP_WINDOW_MS) {
            recentNotifications.delete(k);
        }
    }

    // Check if this notification was recently sent
    if (recentNotifications.has(key)) {
        console.log(`[NotificationService] ⏹️ Duplicate notification blocked: ${key}`);
        return true;
    }

    // Mark as sent
    recentNotifications.set(key, now);
    return false;
}

// ===============================================

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

/**
 * Notify channel owner/PR managers about a new deal request
 */
export async function notifyNewDealRequest(
    recipientTelegramId: number,
    channelTitle: string,
    dealId: string,
    totalAmount: number,
    itemsSummary: string
): Promise<boolean> {
    if (!bot) {
        console.warn('[NotificationService] Bot not configured, skipping new deal notification');
        return false;
    }

    try {
        const message = `💰 **New Partnership Request!**

Channel: **${channelTitle}**
Amount: **$${totalAmount.toLocaleString()}**
${itemsSummary}

An advertiser wants to work with you! Review and respond to keep your response rate high.`;

        await bot.api.sendMessage(recipientTelegramId, message, {
            parse_mode: 'Markdown',
            reply_markup: {
                inline_keyboard: [[
                    {
                        text: '📋 View Deal',
                        url: `${MINI_APP_URL}?startapp=owner_deal_${dealId}`
                    }
                ]]
            }
        });

        console.log(`[NotificationService] ✅ Sent new deal notification to ${recipientTelegramId}`);
        return true;
    } catch (error: any) {
        console.warn(`[NotificationService] Failed to notify about new deal:`, error.message);
        return false;
    }
}

/**
 * Notify advertiser that their payment was confirmed
 */
export async function notifyPaymentConfirmed(
    advertiserTelegramId: number,
    channelTitle: string,
    dealId: string,
    amount: number
): Promise<boolean> {
    if (!bot) {
        console.warn('[NotificationService] Bot not configured, skipping payment confirmed notification');
        return false;
    }

    try {
        const message = `✅ **Payment Confirmed!**

Your payment of **$${amount.toLocaleString()}** for **${channelTitle}** has been received.

The channel owner will review your request shortly. You'll be notified when they respond.`;

        await bot.api.sendMessage(advertiserTelegramId, message, {
            parse_mode: 'Markdown',
            reply_markup: {
                inline_keyboard: [[
                    {
                        text: '📊 View Deal Status',
                        url: `${MINI_APP_URL}?startapp=deal_${dealId}`
                    }
                ]]
            }
        });

        console.log(`[NotificationService] ✅ Sent payment confirmed notification to ${advertiserTelegramId}`);
        return true;
    } catch (error: any) {
        console.warn(`[NotificationService] Failed to notify about payment:`, error.message);
        return false;
    }
}

/**
 * Notify about deal status change (approved, rejected, completed)
 */
export async function notifyDealStatusChange(
    recipientTelegramId: number,
    dealId: string,
    channelTitle: string,
    newStatus: 'approved' | 'rejected' | 'completed' | 'refunded',
    reason?: string
): Promise<boolean> {
    if (!bot) {
        console.warn('[NotificationService] Bot not configured, skipping deal status notification');
        return false;
    }

    // Check for duplicate notification
    if (isDuplicate(recipientTelegramId, `deal_status_${newStatus}`, dealId)) {
        return false; // Already sent this notification recently
    }

    const statusMessages: Record<string, { emoji: string; title: string; body: string }> = {
        approved: {
            emoji: '✅',
            title: 'Draft Approved - Action Required',
            body: `The advertiser approved your draft for **${channelTitle}**!\n\nPlease go to the app to **schedule the post**.`
        },
        rejected: {
            emoji: '❌',
            title: 'Deal Declined',
            body: `Unfortunately, **${channelTitle}** has declined your request.${reason ? `\n\nReason: ${reason}` : ''}\n\nYour payment will be refunded shortly.`
        },
        completed: {
            emoji: '✨',
            title: 'Deal Completed!',
            body: `Your campaign with **${channelTitle}** has been successfully completed. Thank you for using our platform!`
        },
        refunded: {
            emoji: '💸',
            title: 'Refund Processed',
            body: `Your payment for **${channelTitle}** has been refunded to your wallet.`
        }
    };

    const status = statusMessages[newStatus];

    try {
        const message = `${status.emoji} **${status.title}**\n\n${status.body}`;

        await bot.api.sendMessage(recipientTelegramId, message, {
            parse_mode: 'Markdown',
            reply_markup: {
                inline_keyboard: [[
                    {
                        text: '📋 View Details',
                        url: `${MINI_APP_URL}?startapp=deal_${dealId}`
                    }
                ]]
            }
        });

        console.log(`[NotificationService] ✅ Sent deal status notification (${newStatus}) to ${recipientTelegramId}`);
        return true;
    } catch (error: any) {
        console.warn(`[NotificationService] Failed to notify about deal status:`, error.message);
        return false;
    }
}

