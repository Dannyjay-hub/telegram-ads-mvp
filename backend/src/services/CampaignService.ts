import { supabase } from '../db';
import { Database } from '../types';

type Campaign = Database['public']['Tables']['campaigns']['Row'];
type CampaignInsert = Database['public']['Tables']['campaigns']['Insert'];

export class CampaignService {
    async createCampaign(campaign: CampaignInsert): Promise<Campaign> {
        // Validation: Verify budget vs wallet happens in WalletService/Composer, 
        // but here we just ensure basic validity.
        if (campaign.total_budget <= 0) throw new Error("Total budget must be positive");
        if (campaign.individual_slot_budget > campaign.total_budget) throw new Error("Individual budget cannot exceed total budget");

        const { data, error } = await supabase
            .from('campaigns')
            .insert(campaign)
            .select()
            .single();

        if (error) throw new Error(error.message);
        return data;
    }

    async getCampaign(id: string): Promise<Campaign | null> {
        const { data, error } = await supabase
            .from('campaigns')
            .select('*')
            .eq('id', id)
            .single();

        if (error) return null;
        return data;
    }

    async listAdvertiserCampaigns(advertiserId: string): Promise<Campaign[]> {
        const { data, error } = await supabase
            .from('campaigns')
            .select('*')
            .eq('advertiser_id', advertiserId)
            .order('created_at', { ascending: false });

        if (error) throw new Error(error.message);
        return data;
    }

    async listOpenCampaigns(filters?: { minBudget?: number }): Promise<Campaign[]> {
        let query = supabase
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
        if (error) throw new Error(error.message);
        return data;
    }

    async updateStatus(id: string, status: Campaign['status']): Promise<Campaign> {
        const { data, error } = await supabase
            .from('campaigns')
            .update({ status })
            .eq('id', id)
            .select()
            .single();

        if (error) throw new Error(error.message);
        return data;
    }
}
