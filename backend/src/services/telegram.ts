import { bot } from '../botInstance';

export async function getChatMember(chatId: string | number, userId: number) {
    if (!bot) {
        throw new Error('Bot not initialized (missing BOT_TOKEN)');
    }
    try {
        const member = await bot.api.getChatMember(chatId, userId);
        return member;
    } catch (e: any) {
        console.error('Error fetching chat member:', e.message);
        throw new Error(`Failed to verify user status: ${e.message}`);
    }
}

export async function getChatAdministrators(chatId: string | number) {
    if (!bot) {
        // Fallback for dev/mock
        console.warn('⚠️ BOT_TOKEN missing, returning mock admins');
        return [
            { user: { id: 704124192, first_name: 'Daniel', username: 'danielcrypto' }, status: 'creator' },
            { user: { id: 123456789, first_name: 'Admin2', username: 'helper' }, status: 'administrator' }
        ];
    }
    try {
        const admins = await bot.api.getChatAdministrators(chatId);
        return admins;
    } catch (e: any) {
        console.error('Error fetching admins:', e.message);
        throw new Error(`Failed to fetch admins: ${e.message}`);
    }
}

export async function getChannelStats(channelId: string | number) {
    if (!bot) {
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
        const chat = await bot.api.getChat(channelId);

        // 2. Get Member Count
        const count = await bot.api.getChatMemberCount(channelId);

        if (chat.type !== 'channel') {
            throw new Error('The ID provided is not a channel');
        }

        return {
            memberCount: count,
            title: chat.title || 'Untitled Channel',
            username: chat.username || undefined,
            description: chat.description || undefined,
            // MVP Heuristic: Avg Views is roughly 15-25% of subscribers for active channels
            avg_views: Math.floor(count * (0.15 + Math.random() * 0.1))
        };

    } catch (e: any) {
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

export async function getBotPermissions(chatId: string | number) {
    if (!bot) {
        console.warn('⚠️ BOT_TOKEN missing during getBotPermissions. Returning RESTRICTED mock permissions.');
        return {
            status: 'administrator',
            can_post_messages: false, // Default to FALSE to force user to notice configuration issue
            can_post_stories: false,
            can_manage_chat: false,
            is_mock: true
        };
    }
    try {
        const me = await bot.api.getMe();
        console.log(`[Telegram] Checking permissions for bot ${me.username} (${me.id}) in chat ${chatId}`);
        const member = await bot.api.getChatMember(chatId, me.id);
        console.log(`[Telegram] Bot Permissions in ${chatId}:`, JSON.stringify(member, null, 2));
        return member;
    } catch (e: any) {
        console.error('Error fetching bot permissions:', e.message);
        return null;
    }
}

export async function resolveChannelId(usernameOrId: string | number): Promise<number | null> {
    if (!bot) {
        // Mock resolution for dev
        if (typeof usernameOrId === 'string' && usernameOrId.startsWith('@')) {
            return -100123456789; // Mock ID for any username
        }
        return Number(usernameOrId); // Return as is if number-like
    }

    try {
        const chat = await bot.api.getChat(usernameOrId);
        return chat.id;
    } catch (e: any) {
        console.error('Error resolving channel ID:', e.message);
        return null; // Return null to indicate failure (e.g., bot not added or bad username)
    }
}
