"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.SupabaseChannelRepository = void 0;
const db_1 = require("../../db");
class SupabaseChannelRepository {
    mapToDomain(row) {
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
            rateCard: row.rate_card, // Map JSONB
            createdAt: new Date(row.created_at),
            updatedAt: new Date(row.updated_at)
        };
    }
    async create(channel) {
        const { data, error } = await db_1.supabase
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
            rate_card: channel.rateCard || []
        })
            .select()
            .single();
        if (error)
            throw new Error(error.message);
        return this.mapToDomain(data);
    }
    async findByTelegramId(telegramId) {
        const { data, error } = await db_1.supabase
            .from('channels')
            .select('*')
            .eq('telegram_channel_id', telegramId)
            .single();
        if (error)
            return null;
        return this.mapToDomain(data);
    }
    async findById(id) {
        const { data, error } = await db_1.supabase
            .from('channels')
            .select('*')
            .eq('id', id)
            .single();
        if (error)
            return null;
        return this.mapToDomain(data);
    }
    async findAll(filters) {
        let query = db_1.supabase.from('channels').select('*');
        if (filters?.maxPrice) {
            query = query.lte('base_price_amount', filters.maxPrice);
        }
        // Note: Filtering by JSONB deep property 'subscribers' needs specific syntax or RPC
        // For MVP, we will filter in-memory if subscriber filtering is complex via Supabase JS
        const { data, error } = await query;
        if (error)
            throw new Error(error.message);
        const channels = data.map(this.mapToDomain);
        if (filters?.minSubscribers) {
            return channels.filter(c => {
                const subs = c.verifiedStats?.subscribers || 0;
                return subs >= filters.minSubscribers;
            });
        }
        return channels;
    }
    async saveAdmins(channelId, admins) {
        const rows = admins.map(a => ({
            channel_id: channelId,
            telegram_id: a.telegramId,
            username: a.username,
            full_name: a.fullName,
            role: a.role
        }));
        const { error } = await db_1.supabase
            .from('channel_admins')
            .upsert(rows, { onConflict: 'channel_id, telegram_id' });
        if (error) {
            console.error('Failed to sync admins:', error);
        }
    }
    async findByAdminTelegramId(telegramId) {
        // Query channel_admins to get channel_ids, then fetch channels
        // Supabase join syntax:
        const { data, error } = await db_1.supabase
            .from('channel_admins')
            .select('channel_id, channels (*)')
            .eq('telegram_id', telegramId);
        if (error) {
            console.error('Failed to fetch admin channels:', error);
            return [];
        }
        // Map the joined data
        return data.map((row) => this.mapToDomain(row.channels));
    }
    async update(id, updates) {
        const dbUpdates = {};
        if (updates.stats_json)
            dbUpdates.stats_json = updates.stats_json;
        if (updates.avg_views)
            dbUpdates.avg_views = updates.avg_views;
        if (updates.verified_stats)
            dbUpdates.verified_stats = updates.verified_stats;
        if (updates.rateCard)
            dbUpdates.rate_card = updates.rateCard;
        dbUpdates.updated_at = new Date().toISOString();
        const { data, error } = await db_1.supabase
            .from('channels')
            // @ts-ignore
            .update(dbUpdates)
            .eq('id', id)
            .select()
            .single();
        if (error)
            throw new Error(error.message);
        return this.mapToDomain(data);
    }
}
exports.SupabaseChannelRepository = SupabaseChannelRepository;
