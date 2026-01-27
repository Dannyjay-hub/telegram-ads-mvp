"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.getChatMember = getChatMember;
exports.getChatAdministrators = getChatAdministrators;
exports.getChannelStats = getChannelStats;
const bot_1 = require("../bot");
async function getChatMember(chatId, userId) {
    if (!bot_1.bot) {
        throw new Error('Bot not initialized (missing BOT_TOKEN)');
    }
    try {
        const member = await bot_1.bot.api.getChatMember(chatId, userId);
        return member;
    }
    catch (e) {
        console.error('Error fetching chat member:', e.message);
        throw new Error(`Failed to verify user status: ${e.message}`);
    }
}
async function getChatAdministrators(chatId) {
    if (!bot_1.bot) {
        // Fallback for dev/mock
        console.warn('⚠️ BOT_TOKEN missing, returning mock admins');
        return [
            { user: { id: 704124192, first_name: 'Daniel', username: 'danielcrypto' }, status: 'creator' },
            { user: { id: 123456789, first_name: 'Admin2', username: 'helper' }, status: 'administrator' }
        ];
    }
    try {
        const admins = await bot_1.bot.api.getChatAdministrators(chatId);
        return admins;
    }
    catch (e) {
        console.error('Error fetching admins:', e.message);
        throw new Error(`Failed to fetch admins: ${e.message}`);
    }
}
async function getChannelStats(channelId) {
    if (!bot_1.bot) {
        // Fallback for dev if no token provided, but warn loudly
        console.warn('⚠️ BOT_TOKEN missing, using mock channel stats');
        return {
            memberCount: 10000 + Math.floor(Math.random() * 5000),
            title: `Mock Channel ${channelId}`,
            username: `mock_${channelId}`,
            avg_views: 0
        };
    }
    try {
        console.log(`Fetching stats for channel: ${channelId}`);
        // 1. Get Chat Info (Title, Username, Description)
        const chat = await bot_1.bot.api.getChat(channelId);
        // 2. Get Member Count
        const count = await bot_1.bot.api.getChatMemberCount(channelId);
        if (chat.type !== 'channel') {
            throw new Error('The ID provided is not a channel');
        }
        return {
            memberCount: count,
            title: chat.title || 'Untitled Channel',
            username: chat.username || undefined,
            description: chat.description || undefined,
            avg_views: 0
        };
    }
    catch (e) {
        console.error('Telegram API Error:', e.message);
        if (e.message.includes('chat not found')) {
            throw new Error('Channel not found. Check the ID.');
        }
        if (e.message.includes('bot is not a member')) {
            throw new Error('Bot is not a member. Please add the bot as admin.');
        }
        throw new Error(`Telegram Error: ${e.message}`);
    }
}
