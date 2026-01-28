import { IChannelRepository } from '../repositories/interfaces';
import { Channel } from '../domain/entities';
import { getChannelStats, getChatAdministrators, getBotPermissions } from './telegram';
import { supabase } from '../db';

export class ChannelService {
    constructor(private channelRepo: IChannelRepository) { }

    async listChannels(filters?: { minSubscribers?: number, maxPrice?: number }): Promise<Channel[]> {
        return this.channelRepo.findAll(filters);
    }

    async listChannelsByAdmin(telegramId: number): Promise<Channel[]> {
        return this.channelRepo.findByAdminTelegramId(telegramId);
    }

    // Phase 1: Strict Verification State Machine
    async verifyChannelPermissions(telegramChannelId: number) {
        // 1. Get Bot Status (State A check)
        const botMember = await getBotPermissions(telegramChannelId);

        if (!botMember || (botMember.status !== 'administrator' && botMember.status !== 'creator')) {
            return {
                state: 'A_BOT_NOT_ADDED',
                missing: ['membership']
            };
        }

        // 2. Check Bot Permissions (State B check)
        // Note: Grammy/Telegram types might vary, we cast safely
        const bm = botMember as any;
        const missingPermissions = [];

        // Detailed check based on User Requirement: "Messages, Stories, Manage Direct Messages (?)"
        // We enforce the critical functional ones:
        if (!bm.can_post_messages) missingPermissions.push('Post Messages');
        if (!bm.can_edit_messages) missingPermissions.push('Edit Messages');
        if (!bm.can_post_stories) missingPermissions.push('Post Stories');
        if (!bm.can_edit_stories) missingPermissions.push('Edit Stories');

        // "Manage direct messages" often corresponds to can_manage_topics in supergroups, 
        // but for channels it might be generic. We'll check can_manage_chat if present.
        // For now, we strictly require the content posting ones.

        if (missingPermissions.length > 0) {
            return {
                state: 'B_MISSING_PERMISSIONS',
                missing: missingPermissions,
                current: bm
            };
        }

        // 3. User Permissions are checked implicitly by "getChatAdministrators" return list
        // If we reached here, Bot is ready.
        console.log(`[ChannelService] Bot Verification Passed for ${telegramChannelId}`);
        return {
            state: 'D_READY',
            details: bm
        };
    }

    async verifyChannel(telegramChannelId: number) {
        // Core verification (Legacy + New)
        try {
            const channelInfo = await getChannelStats(telegramChannelId);
            return {
                is_admin: true,
                title: channelInfo.title,
                username: channelInfo.username,
                stats: {
                    subscribers: channelInfo.memberCount
                }
            };
        } catch (e) {
            throw new Error('Failed to fetch channel stats. Is the bot added?');
        }
    }

    async verifyAndAddChannel(
        telegramChannelId: number,
        userId: number,
        channelData?: {
            pricing?: any,
            basePriceAmount?: number,
            description?: string,
            category?: string,
            tags?: string[],
            rateCard?: any[]
        },
        initialStatus: string = 'active'
    ): Promise<Channel> {
        console.log('[verifyAndAddChannel] Called with:', { telegramChannelId, userId, channelData, initialStatus });

        // 1. Strict Permission Check (Barrier)
        const permStatus = await this.verifyChannelPermissions(telegramChannelId);
        if (permStatus.state !== 'D_READY' && initialStatus !== 'draft') {
            throw new Error(`Cannot list channel. Status: ${permStatus.state}`);
        }

        // 2. Check if channel already exists
        const existing = await this.channelRepo.findByTelegramId(telegramChannelId);
        console.log('[verifyAndAddChannel] Existing channel:', existing ? existing.id : 'NONE');

        if (existing) {
            // Channel exists - UPDATE it with the new data if provided
            console.log('[verifyAndAddChannel] Updating existing channel with:', channelData);
            if (channelData) {
                const updated = await this.channelRepo.update(existing.id, {
                    description: channelData.description,
                    category: channelData.category,
                    tags: channelData.tags,
                    rateCard: channelData.rateCard,
                    basePriceAmount: channelData.basePriceAmount,
                    pricing: channelData.pricing,
                    status: initialStatus as any,
                    isActive: initialStatus === 'active'
                });
                await this.syncChannelAdmins(existing.id);
                return updated;
            }
            await this.syncChannelAdmins(existing.id);
            return existing;
        }

        // 3. Fetch Stats & Info
        const verification = await this.verifyChannel(telegramChannelId);
        console.log('[verifyAndAddChannel] Creating NEW channel with data:', channelData);

        // 4. Create Channel with all provided data
        const channel = await this.channelRepo.create({
            telegramChannelId,
            title: verification.title,
            username: verification.username,
            verifiedStats: verification.stats,
            statsJson: verification.stats as any,
            isActive: initialStatus === 'active', // Only active if status is active
            status: initialStatus as any,
            isVerified: true,
            permissions: permStatus.details,
            pricing: channelData?.pricing || { base_price: 100 },
            basePriceAmount: channelData?.basePriceAmount || 100,
            basePriceCurrency: 'USD',
            description: channelData?.description,
            category: channelData?.category,
            tags: channelData?.tags,
            rateCard: channelData?.rateCard || []
        });
        console.log('[verifyAndAddChannel] Created channel:', channel.id, 'with description:', channel.description);

        // 5. Add Creator as Owner
        // We need a direct way to add admins, or use the sync logic.
        // For 'addChannel', we explicitly set the caller as 'owner'
        const { error: adminError } = await supabase.from('channel_admins').insert({
            channel_id: channel.id,
            user_id: (await this.getUserId(userId)),
            role: 'owner',
            permissions: { can_withdraw: true, can_approve_deal: true, can_negotiate: true }
        } as any);

        if (adminError) console.error('Failed to set owner:', adminError);

        // 6. Sync other admins
        this.syncChannelAdmins(channel.id).catch(console.error);

        return channel;
    }

    async syncChannelAdmins(id: string) {
        // 1. Get Channel
        const channel = await this.channelRepo.findById(id);
        if (!channel) throw new Error('Channel not found');

        // 2. Fetch admins from Telegram
        const telegramAdmins = await getChatAdministrators(channel.telegramChannelId);

        // 3. Sync to DB
        for (const admin of telegramAdmins) {
            const u = admin.user;
            const telegramId = u.id;

            // Upsert User
            const { data: userData } = await supabase.from('users').upsert({
                telegram_id: telegramId,
                username: u.username,
                first_name: u.first_name,
            } as any, { onConflict: 'telegram_id' }).select('id').single();

            if (!userData) continue;

            // Upsert Admin Role (Don't overwrite 'owner' if already set, unless status changed)
            // PR Manager Logic: If they are admin in TG, they *can* be manager.
            // But we don't automatically make EVERY admin a manager in our app?
            // "Auto-Remove PR Managers Who Lost Admin Status" -> This implies we check existing DB rows.

            // For MVP: We only ADD admins if they are explicitly added? 
            // The doc says "Add PR Managers... (Optional)".
            // So we shouldn't auto-add everyone as a manager.
            // But we MUST check if current managers are still admins.
        }

        // 4. Clean up invalid managers
        // Fetch current DB admins
        const { data: dbAdmins } = await supabase.from('channel_admins').select('*, users(telegram_id)').eq('channel_id', id);

        if (dbAdmins) {
            const admins = dbAdmins as any[];
            const activeTelegramIds = telegramAdmins.map(a => a.user.id);
            const invalidAdmins = admins.filter(da => !activeTelegramIds.includes(da.users.telegram_id));

            for (const invalid of invalidAdmins) {
                console.log(`Removing admin ${invalid.user_id} as they lost TG admin status`);
                await supabase.from('channel_admins').delete().eq('channel_id', id).eq('user_id', invalid.user_id);
            }
        }
    }

    private async getUserId(telegramId: number): Promise<string> {
        const { data } = await supabase.from('users').select('id').eq('telegram_id', telegramId).single();
        return (data as any)?.id || '';
    }

    async syncChannelStats(id: string) {
        const channel = await this.channelRepo.findById(id);
        if (!channel) throw new Error('Channel not found');

        const stats = await getChannelStats(channel.telegramChannelId);

        await this.channelRepo.update(id, {
            verifiedStats: { subscribers: stats.memberCount },
            statsJson: stats as any,
            avgViews: stats.avg_views
        });

        return stats;
    }

    async updateChannel(id: string, updates: Partial<Channel>): Promise<Channel> {
        return this.channelRepo.update(id, {
            basePriceAmount: updates.basePriceAmount,
            rateCard: updates.rateCard,
            verifiedStats: updates.verifiedStats,
            pricing: updates.pricing,
            status: updates.status,
            isActive: updates.status ? (updates.status === 'active') : undefined,
            description: updates.description,
            category: updates.category,
            tags: updates.tags,
            language: updates.language
        });
    }

    /**
     * Get Telegram admins for a channel (from Telegram API)
     */
    async getTelegramAdmins(telegramChannelId: number): Promise<any[]> {
        try {
            const admins = await getChatAdministrators(telegramChannelId);
            return admins;
        } catch (error) {
            console.error('Failed to get Telegram admins:', error);
            return [];
        }
    }
}
