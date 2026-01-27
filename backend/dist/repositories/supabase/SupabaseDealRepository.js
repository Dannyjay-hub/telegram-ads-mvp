"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.SupabaseDealRepository = void 0;
const db_1 = require("../../db");
class SupabaseDealRepository {
    mapToDomain(row) {
        return {
            id: row.id,
            advertiserId: row.advertiser_id,
            channelId: row.channel_id,
            briefText: row.brief_text,
            creativeContent: row.creative_content,
            priceAmount: row.price_amount,
            priceCurrency: row.price_currency,
            status: row.status,
            createdAt: new Date(row.created_at),
            updatedAt: new Date(row.updated_at),
            packageTitle: row.package_title,
            packageDescription: row.package_description,
            rejectionReason: row.rejection_reason
        };
    }
    async create(deal, briefId) {
        const insertPayload = {
            advertiser_id: deal.advertiserId,
            channel_id: deal.channelId,
            brief_text: deal.briefText,
            creative_content: deal.creativeContent,
            price_amount: deal.priceAmount,
            price_currency: deal.priceCurrency,
            status: deal.status || 'draft',
            package_title: deal.packageTitle,
            package_description: deal.packageDescription,
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString()
        };
        if (briefId) {
            insertPayload.brief_id = briefId;
        }
        const { data, error } = await db_1.supabase
            .from('deals')
            .insert(insertPayload)
            .select()
            .single();
        if (error)
            throw new Error(error.message);
        return this.mapToDomain(data);
    }
    async findById(id) {
        const { data, error } = await db_1.supabase
            .from('deals')
            .select('*')
            .eq('id', id)
            .single();
        if (error)
            return null;
        return this.mapToDomain(data);
    }
    async findByChannelId(channelId) {
        const { data, error } = await db_1.supabase
            .from('deals')
            .select('*')
            .eq('channel_id', channelId)
            .order('created_at', { ascending: false });
        if (error)
            throw new Error(error.message);
        return data.map(this.mapToDomain);
    }
    async findAll() {
        const { data, error } = await db_1.supabase
            .from('deals')
            .select('*')
            .limit(50)
            .order('created_at', { ascending: false });
        if (error)
            throw new Error(error.message);
        return data.map(this.mapToDomain);
    }
    async updateStatus(id, status, reason) {
        const updatePayload = {
            status,
            updated_at: new Date().toISOString()
        };
        if (reason)
            updatePayload.rejection_reason = reason;
        const { data, error } = await db_1.supabase
            .from('deals')
            // @ts-ignore
            .update(updatePayload)
            .eq('id', id)
            .select()
            .single();
        if (error)
            throw new Error(error.message);
        return this.mapToDomain(data);
    }
}
exports.SupabaseDealRepository = SupabaseDealRepository;
