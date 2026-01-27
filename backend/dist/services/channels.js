"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.verify_channel_admin = verify_channel_admin;
exports.register_channel = register_channel;
const db_1 = require("../db");
const bot_1 = require("../bot");
/**
 * Verifies if the bot is an admin in the channel.
 * Returns the chat member info if successful.
 */
async function verify_channel_admin(telegramChannelId) {
    if (!bot_1.bot) {
        throw new Error('Bot not initialized');
    }
    try {
        const chatMember = await bot_1.bot.api.getChatMember(telegramChannelId, bot_1.bot.botInfo.id);
        if (chatMember.status === 'administrator' || chatMember.status === 'creator') {
            // Fetch real channel info
            const chatInfo = await bot_1.bot.api.getChat(telegramChannelId);
            // For now, subscriber count is only available via getChatMemberCount or if returned in getChat (depends on bot permissions)
            // getChat often returns `title`, `username`, `description`, `photo`
            // `linked_chat_id` etc.
            // To get member count:
            const memberCount = await bot_1.bot.api.getChatMemberCount(telegramChannelId);
            return {
                is_admin: true,
                title: chatInfo.title || 'Unknown Channel',
                username: chatInfo.username ? `@${chatInfo.username}` : undefined,
                stats: {
                    subscribers: memberCount,
                    avg_views: 0, // Not available via simple Bot API, need MTProto or stats API
                    engagement_rate: "N/A"
                }
            };
        }
        return { is_admin: false };
    }
    catch (error) {
        console.error('Telegram verification failed:', error);
        throw new Error('Could not verify channel. Make sure the bot is added as an admin.');
    }
}
/**
 * Registers a new channel in the database.
 */
async function register_channel(channelData) {
    // 1. Verify uniqueness (Telegram ID)
    const { data: existing } = await db_1.supabase
        .from('channels')
        .select('id')
        .eq('telegram_channel_id', channelData.telegram_channel_id)
        .single();
    if (existing) {
        throw new Error('Channel already registered');
    }
    // 2. Fetch Initial Stats (Mocked for now, but structure is ready)
    // const stats = await getChannelStats(channelData.telegram_channel_id);
    // 2. Fetch Initial Stats
    // We expect basic stats to be passed in channelData.verified_stats if coming from the wizard
    // But for now, let's keep the random views/premium rank since we can't fetch them easily via Bot API
    const mockViewStats = {
        avg_views: Math.floor(Math.random() * 5000) + 500,
        premium_rank: Math.floor(Math.random() * 100)
    };
    // Merge provided stats (like subscribers from verification) with mock view stats
    const providedStats = channelData.verified_stats || {};
    const finalStats = {
        ...providedStats,
        ...mockViewStats,
        // Ensure subscribers is kept if provided, otherwise mock it? 
        // Actually, let's trust the frontend passed what it got from verification step
    };
    if (!finalStats.subscribers) {
        finalStats.subscribers = Math.floor(Math.random() * 50000) + 1000;
    }
    const newChannel = {
        ...channelData,
        verified_stats: finalStats,
        is_active: true,
        created_at: new Date().toISOString()
    };
    // 3. Insert into DB
    const { data, error } = await db_1.supabase.from('channels')
        .insert(newChannel)
        .select()
        .single();
    if (error) {
        throw new Error(error.message);
    }
    return data;
}
