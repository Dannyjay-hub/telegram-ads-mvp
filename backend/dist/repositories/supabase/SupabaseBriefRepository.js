"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.SupabaseBriefRepository = void 0;
const db_1 = require("../../db");
class SupabaseBriefRepository {
    mapToDomain(row) {
        return {
            id: row.id,
            advertiserId: row.advertiser_id,
            title: row.title,
            content: row.content,
            budgetRangeMin: row.budget_range_min,
            budgetRangeMax: row.budget_range_max,
            currency: row.currency,
            tags: row.tags || [],
            isActive: row.is_active,
            createdAt: new Date(row.created_at)
        };
    }
    async create(brief) {
        const { data, error } = await db_1.supabase
            .from('public_briefs')
            .insert({
            advertiser_id: brief.advertiserId,
            title: brief.title,
            content: brief.content,
            budget_range_min: brief.budgetRangeMin,
            budget_range_max: brief.budgetRangeMax,
            currency: brief.currency || 'USD',
            tags: brief.tags,
            is_active: true
        })
            .select()
            .single();
        if (error)
            throw new Error(error.message);
        return this.mapToDomain(data);
    }
    async findAll(activeOnly = true) {
        let query = db_1.supabase
            .from('public_briefs')
            .select('*')
            .order('created_at', { ascending: false });
        if (activeOnly) {
            query = query.eq('is_active', true);
        }
        const { data, error } = await query;
        if (error)
            throw new Error(error.message);
        return data.map(this.mapToDomain);
    }
    async findById(id) {
        const { data, error } = await db_1.supabase
            .from('public_briefs')
            .select('*')
            .eq('id', id)
            .single();
        if (error)
            return null;
        return this.mapToDomain(data);
    }
}
exports.SupabaseBriefRepository = SupabaseBriefRepository;
