"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.SupabaseUserRepository = void 0;
const db_1 = require("../../db");
class SupabaseUserRepository {
    mapToDomain(row) {
        return {
            id: row.id,
            telegramId: row.telegram_id,
            username: row.username,
            firstName: row.first_name,
            photoUrl: row.photo_url,
            currentNegotiatingDealId: row.current_negotiating_deal_id,
            createdAt: new Date(row.created_at),
            updatedAt: new Date(row.updated_at)
        };
    }
    async findByTelegramId(telegramId) {
        const { data, error } = await db_1.supabase
            .from('users')
            .select('*')
            .eq('telegram_id', telegramId)
            .single();
        if (error)
            return null;
        return this.mapToDomain(data);
    }
    async findById(id) {
        const { data, error } = await db_1.supabase
            .from('users')
            .select('*')
            .eq('id', id)
            .single();
        if (error)
            return null;
        return this.mapToDomain(data);
    }
    async create(user) {
        const { data, error } = await db_1.supabase
            .from('users')
            .insert({
            telegram_id: user.telegramId,
            username: user.username || null,
            first_name: user.firstName || null,
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString()
        })
            .select()
            .single();
        if (error)
            throw new Error(error.message);
        return this.mapToDomain(data);
    }
    async update(id, user) {
        const { data, error } = await db_1.supabase
            .from('users')
            // @ts-ignore - bypassing strict type check due to generated type mismatch
            .update({
            username: user.username || null,
            first_name: user.firstName || null,
            current_negotiating_deal_id: user.currentNegotiatingDealId,
            updated_at: new Date().toISOString()
        })
            .eq('id', id)
            .select()
            .single();
        if (error)
            throw new Error(error.message);
        return this.mapToDomain(data);
    }
}
exports.SupabaseUserRepository = SupabaseUserRepository;
