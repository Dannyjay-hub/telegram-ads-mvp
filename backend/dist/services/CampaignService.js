"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.CampaignService = void 0;
const db_1 = require("../db");
class CampaignService {
    async createCampaign(campaign) {
        // Validation: Verify budget vs wallet happens in WalletService/Composer, 
        // but here we just ensure basic validity.
        if (campaign.total_budget <= 0)
            throw new Error("Total budget must be positive");
        if (campaign.individual_slot_budget > campaign.total_budget)
            throw new Error("Individual budget cannot exceed total budget");
        const { data, error } = await db_1.supabase
            .from('campaigns')
            .insert(campaign)
            .select()
            .single();
        if (error)
            throw new Error(error.message);
        return data;
    }
    async getCampaign(id) {
        const { data, error } = await db_1.supabase
            .from('campaigns')
            .select('*')
            .eq('id', id)
            .single();
        if (error)
            return null;
        return data;
    }
    async listAdvertiserCampaigns(advertiserId) {
        const { data, error } = await db_1.supabase
            .from('campaigns')
            .select('*')
            .eq('advertiser_id', advertiserId)
            .order('created_at', { ascending: false });
        if (error)
            throw new Error(error.message);
        return data;
    }
    async listOpenCampaigns(filters) {
        let query = db_1.supabase
            .from('campaigns')
            .select('*')
            .eq('status', 'open')
            .eq('type', 'open')
            .order('created_at', { ascending: false });
        // Filter details (like eligibility) usually happen in application layer for complex JSON
        // but simple budget filters can be DB side.
        if (filters?.minBudget) {
            query = query.gte('individual_slot_budget', filters.minBudget);
        }
        const { data, error } = await query;
        if (error)
            throw new Error(error.message);
        return data;
    }
    async updateStatus(id, status) {
        const { data, error } = await db_1.supabase
            .from('campaigns')
            .update({ status })
            .eq('id', id)
            .select()
            .single();
        if (error)
            throw new Error(error.message);
        return data;
    }
}
exports.CampaignService = CampaignService;
