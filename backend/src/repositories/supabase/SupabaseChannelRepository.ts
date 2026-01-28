import { IChannelRepository } from '../interfaces';
import { Channel } from '../../domain/entities';
import { supabase } from '../../db';

export class SupabaseChannelRepository implements IChannelRepository {

    private mapToDomain(row: any): Channel {
        return {
            id: row.id,
            telegramChannelId: row.telegram_channel_id,
            title: row.title,
            username: row.username,
            photoUrl: row.photo_url,
            verifiedStats: row.verified_stats,
            statsJson: row.stats_json,
            avgViews: row.avg_views,
            basePriceAmount: row.base_price_amount,
            basePriceCurrency: row.base_price_currency,
            isActive: row.is_active,
            isVerified: row.is_verified,
            status: row.status,
            permissions: row.permissions,
            pricing: row.pricing,
            rateCard: row.rate_card, // Map JSONB
            description: row.description,
            category: row.category,
            tags: row.tags,
            createdAt: new Date(row.created_at),
            updatedAt: new Date(row.updated_at)
        };
    }

    async create(channel: Partial<Channel>): Promise<Channel> {
        const { data, error } = await supabase
            .from('channels')
            .insert({
                telegram_channel_id: channel.telegramChannelId,
                title: channel.title,
                username: channel.username,
                photo_url: channel.photoUrl,
                verified_stats: channel.verifiedStats,
                base_price_amount: channel.basePriceAmount,
                base_price_currency: channel.basePriceCurrency,
                is_active: channel.isActive,
                is_verified: channel.isVerified,
                status: channel.status,
                permissions: channel.permissions,
                pricing: channel.pricing,
                rate_card: channel.rateCard || [],
                description: channel.description,
                category: channel.category,
                tags: channel.tags
            } as any)
            .select()
            .single();

        if (error) throw new Error(error.message);
        return this.mapToDomain(data);
    }

    async findByTelegramId(telegramId: number): Promise<Channel | null> {
        const { data, error } = await supabase
            .from('channels')
            .select('*')
            .eq('telegram_channel_id', telegramId)
            .single();

        if (error) return null;
        return this.mapToDomain(data);
    }

    async findById(id: string): Promise<Channel | null> {
        const { data, error } = await supabase
            .from('channels')
            .select('*')
            .eq('id', id)
            .single();

        if (error) return null;
        return this.mapToDomain(data);
    }

    async findAll(filters?: { minSubscribers?: number, maxPrice?: number }): Promise<Channel[]> {
        let query = supabase.from('channels').select('*');

        // Only show active channels in the marketplace (exclude drafts)
        query = query.eq('is_active', true);

        if (filters?.maxPrice) {
            query = query.lte('base_price_amount', filters.maxPrice);
        }

        // Note: Filtering by JSONB deep property 'subscribers' needs specific syntax or RPC
        // For MVP, we will filter in-memory if subscriber filtering is complex via Supabase JS
        const { data, error } = await query;
        if (error) throw new Error(error.message);

        const channels = data.map(this.mapToDomain);

        if (filters?.minSubscribers) {
            return channels.filter(c => {
                const subs = c.verifiedStats?.subscribers || 0;
                return subs >= filters.minSubscribers!;
            });
        }

        return channels;
    }
    async saveAdmins(channelId: string, admins: any[]): Promise<void> {
        // 1. We must ensure these users exist in the 'users' table to get their UUIDs
        const adminRows = [];

        for (const admin of admins) {
            // Upsert user to get UUID
            const { data: userData, error: userError } = await supabase
                .from('users')
                .upsert({
                    telegram_id: admin.telegramId,
                    username: admin.username,
                    first_name: admin.fullName?.split(' ')[0] || 'Unknown',
                    // last_name ... (omitted for MVP)
                } as any, { onConflict: 'telegram_id' })
                .select('id')
                .single();

            if (userError || !userData) {
                console.error(`Failed to upsert user ${admin.telegramId}:`, userError);
                continue;
            }

            adminRows.push({
                channel_id: channelId,
                user_id: userData.id,
                is_owner: admin.role === 'creator',
                can_negotiate: true // Default permission
            });
        }

        if (adminRows.length === 0) return;

        // 2. Insert into channel_admins
        const { error } = await supabase
            .from('channel_admins')
            .upsert(adminRows as any, { onConflict: 'channel_id, user_id' });

        if (error) {
            console.error('Failed to sync admins:', error);
        }
    }

    async findByAdminTelegramId(telegramId: number): Promise<Channel[]> {
        // 1. Get User UUID from Telegram ID
        const { data: user, error: userError } = await supabase
            .from('users')
            .select('id')
            .eq('telegram_id', telegramId)
            .single();

        if (userError || !user) {
            // User not found, so no channels
            return [];
        }

        // 2. Query channel_admins using user_id
        const { data, error } = await supabase
            .from('channel_admins')
            .select('channel_id, channels (*)')
            .eq('user_id', user.id);

        if (error) {
            console.error('Failed to fetch admin channels:', error);
            return [];
        }

        // Map the joined data
        return data.map((row: any) => this.mapToDomain(row.channels));
    }

    async update(id: string, updates: any): Promise<Channel> {
        const dbUpdates: any = {};
        if (updates.stats_json !== undefined) dbUpdates.stats_json = updates.stats_json;
        if (updates.avg_views !== undefined) dbUpdates.avg_views = updates.avg_views;
        if (updates.verified_stats !== undefined) dbUpdates.verified_stats = updates.verified_stats;
        if (updates.rateCard !== undefined) dbUpdates.rate_card = updates.rateCard;
        if (updates.basePriceAmount !== undefined) dbUpdates.base_price_amount = updates.basePriceAmount;
        // Phase 1 updates
        if (updates.pricing !== undefined) dbUpdates.pricing = updates.pricing;
        if (updates.permissions !== undefined) dbUpdates.permissions = updates.permissions;
        if (updates.status !== undefined) dbUpdates.status = updates.status;
        if (updates.isVerified !== undefined) dbUpdates.is_verified = updates.isVerified;

        if (updates.description !== undefined) dbUpdates.description = updates.description;
        if (updates.category !== undefined) dbUpdates.category = updates.category;
        if (updates.tags !== undefined) dbUpdates.tags = updates.tags;
        if (updates.isActive !== undefined) dbUpdates.is_active = updates.isActive;

        dbUpdates.updated_at = new Date().toISOString();

        const { data, error } = await supabase
            .from('channels')
            .update(dbUpdates as any)
            .eq('id', id)
            .select()
            .single();

        if (error) throw new Error(error.message);
        return this.mapToDomain(data);
    }

    async delete(id: string): Promise<void> {
        const { error } = await supabase
            .from('channels')
            .delete()
            .eq('id', id);

        if (error) throw new Error(error.message);
    }

    // Phase 1: Draft Recovery
    async saveDraft(draft: any): Promise<void> {
        await supabase.from('unlisted_drafts').upsert({
            telegram_channel_id: draft.telegramChannelId || 0, // Fallback if not yet known
            user_id: draft.userId, // Required
            draft_data: {
                username: draft.username,
                first_name: draft.firstName,
                photo_url: draft.photoUrl,
                ...draft
            }
        } as any);
    }
}
