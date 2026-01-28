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
            avg_views: 0,
            photoUrl: null
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

        // 3. Get Channel Photo URL
        let photoUrl: string | null = null;
        if (chat.photo) {
            try {
                // Get the file path for the photo
                const file = await bot.api.getFile(chat.photo.big_file_id);
                if (file.file_path) {
                    // Construct the Telegram file URL
                    photoUrl = `https://api.telegram.org/file/bot${process.env.BOT_TOKEN}/${file.file_path}`;
                }
            } catch (photoError) {
                console.warn('Could not fetch channel photo:', photoError);
            }
        }

        return {
            memberCount: count,
            title: chat.title || 'Untitled Channel',
            username: chat.username || undefined,
            description: chat.description || undefined,
            photoUrl: photoUrl,
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

export interface TeamMemberStatus {
    userId: number | string;
    username?: string;
    role: 'bot' | 'owner' | 'pr_manager';
    isValid: boolean;
    reason?: string;
}

export interface TeamVerificationResult {
    valid: boolean;
    invalidMembers: TeamMemberStatus[];
    allMembers: TeamMemberStatus[];
}

/**
 * Verify that all team members (bot, owner, PR managers) still have valid admin permissions.
 * Called before channel updates and escrow actions.
 */
export async function verifyTeamPermissions(
    channelId: string | number,
    ownerId: number | string,
    prManagers: Array<{ telegram_id: number | string; username?: string }>
): Promise<TeamVerificationResult> {
    const allMembers: TeamMemberStatus[] = [];
    const invalidMembers: TeamMemberStatus[] = [];

    if (!bot) {
        console.warn('⚠️ BOT_TOKEN missing, returning mock valid team');
        return { valid: true, invalidMembers: [], allMembers: [] };
    }

    // 1. Check Bot permissions
    try {
        const me = await bot.api.getMe();
        const botMember = await bot.api.getChatMember(channelId, me.id);
        const botStatus: TeamMemberStatus = {
            userId: me.id,
            username: me.username,
            role: 'bot',
            isValid: botMember.status === 'administrator' &&
                ('can_post_messages' in botMember && botMember.can_post_messages === true)
        };
        if (!botStatus.isValid) {
            botStatus.reason = 'Bot is not admin or lacks post_messages permission';
            invalidMembers.push(botStatus);
        }
        allMembers.push(botStatus);
    } catch (e: any) {
        const botStatus: TeamMemberStatus = {
            userId: 0,
            role: 'bot',
            isValid: false,
            reason: `Bot verification failed: ${e.message}`
        };
        invalidMembers.push(botStatus);
        allMembers.push(botStatus);
    }

    // 2. Check Owner permissions
    try {
        const ownerMember = await bot.api.getChatMember(channelId, Number(ownerId));
        const ownerStatus: TeamMemberStatus = {
            userId: ownerId,
            role: 'owner',
            isValid: ownerMember.status === 'creator' || ownerMember.status === 'administrator'
        };
        if (!ownerStatus.isValid) {
            ownerStatus.reason = 'Owner is no longer a channel admin';
            invalidMembers.push(ownerStatus);
        }
        allMembers.push(ownerStatus);
    } catch (e: any) {
        const ownerStatus: TeamMemberStatus = {
            userId: ownerId,
            role: 'owner',
            isValid: false,
            reason: `Owner verification failed: ${e.message}`
        };
        invalidMembers.push(ownerStatus);
        allMembers.push(ownerStatus);
    }

    // 3. Check each PR Manager
    for (const pm of prManagers) {
        if (!pm.telegram_id) continue; // Skip invalid entries

        try {
            const pmMember = await bot.api.getChatMember(channelId, Number(pm.telegram_id));

            // PR managers must be admins WITH posting permissions
            const isAdmin = pmMember.status === 'creator' || pmMember.status === 'administrator';
            const hasPostingRights = pmMember.status === 'creator' ||
                ('can_post_messages' in pmMember && pmMember.can_post_messages === true);

            const pmStatus: TeamMemberStatus = {
                userId: pm.telegram_id,
                username: pm.username,
                role: 'pr_manager',
                isValid: isAdmin && hasPostingRights
            };

            if (!isAdmin) {
                pmStatus.reason = `@${pm.username || pm.telegram_id} is no longer a channel admin`;
                invalidMembers.push(pmStatus);
            } else if (!hasPostingRights) {
                pmStatus.reason = `@${pm.username || pm.telegram_id} cannot post messages`;
                invalidMembers.push(pmStatus);
            }
            allMembers.push(pmStatus);
        } catch (e: any) {
            const pmStatus: TeamMemberStatus = {
                userId: pm.telegram_id,
                username: pm.username,
                role: 'pr_manager',
                isValid: false,
                reason: `@${pm.username || pm.telegram_id}: ${e.message}`
            };
            invalidMembers.push(pmStatus);
            allMembers.push(pmStatus);
        }
    }

    return {
        valid: invalidMembers.length === 0,
        invalidMembers,
        allMembers
    };
}
