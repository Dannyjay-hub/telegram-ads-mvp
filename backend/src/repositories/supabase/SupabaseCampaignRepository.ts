import { supabase } from '../../db';
import { Campaign, CampaignApplication, CampaignInsert, CampaignUpdate, Channel } from '../../domain/entities';

/**
 * Repository for Campaign operations with atomic slot allocation
 */
export class SupabaseCampaignRepository {

    // ============================================
    // CAMPAIGN CRUD
    // ============================================

    private mapRowToCampaign(row: any): Campaign {
        return {
            id: row.id,
            advertiserId: row.advertiser_id,
            title: row.title,
            brief: row.brief,
            mediaUrls: row.media_urls,
            totalBudget: parseFloat(row.total_budget),
            currency: row.currency,
            slots: row.slots,
            perChannelBudget: parseFloat(row.per_channel_budget),
            campaignType: row.campaign_type,
            minSubscribers: row.min_subscribers,
            maxSubscribers: row.max_subscribers,
            requiredLanguages: row.required_languages,
            minAvgViews: row.min_avg_views,
            requiredCategories: row.required_categories,
            startsAt: new Date(row.starts_at),
            expiresAt: row.expires_at ? new Date(row.expires_at) : undefined,
            status: row.status,
            slotsFilled: row.slots_filled,
            escrowWalletAddress: row.escrow_wallet_address,
            escrowDeposited: parseFloat(row.escrow_deposited || 0),
            escrowAllocated: parseFloat(row.escrow_allocated || 0),
            escrowAvailable: parseFloat(row.escrow_available || 0),
            escrowFunded: row.escrow_funded,
            createdAt: new Date(row.created_at),
            updatedAt: new Date(row.updated_at),
            expiredAt: row.expired_at ? new Date(row.expired_at) : undefined
        };
    }

    private mapRowToApplication(row: any): CampaignApplication {
        return {
            id: row.id,
            campaignId: row.campaign_id,
            channelId: row.channel_id,
            status: row.status,
            dealId: row.deal_id,
            appliedAt: new Date(row.applied_at),
            reviewedAt: row.reviewed_at ? new Date(row.reviewed_at) : undefined
        };
    }

    async create(data: CampaignInsert): Promise<Campaign> {
        // Calculate per-channel budget
        const perChannelBudget = data.totalBudget / data.slots;

        const { data: campaign, error } = await supabase
            .from('campaigns')
            .insert({
                advertiser_id: data.advertiserId,
                title: data.title,
                brief: data.brief,
                media_urls: data.mediaUrls,
                total_budget: data.totalBudget,
                per_channel_budget: perChannelBudget,
                currency: data.currency || 'TON',
                slots: data.slots,
                campaign_type: data.campaignType || 'open',
                min_subscribers: data.minSubscribers || 0,
                max_subscribers: data.maxSubscribers,
                required_languages: data.requiredLanguages,
                min_avg_views: data.minAvgViews || 0,
                required_categories: data.requiredCategories,
                starts_at: data.startsAt || new Date(),
                expires_at: data.expiresAt
            })
            .select()
            .single();

        if (error) throw new Error(`Failed to create campaign: ${error.message}`);
        return this.mapRowToCampaign(campaign);
    }

    async findById(id: string): Promise<Campaign | null> {
        const { data, error } = await supabase
            .from('campaigns')
            .select('*')
            .eq('id', id)
            .single();

        if (error || !data) return null;
        return this.mapRowToCampaign(data);
    }

    async findByAdvertiserId(advertiserId: string): Promise<Campaign[]> {
        const { data, error } = await supabase
            .from('campaigns')
            .select('*')
            .eq('advertiser_id', advertiserId)
            .order('created_at', { ascending: false });

        if (error) throw new Error(`Failed to fetch campaigns: ${error.message}`);
        return (data || []).map(this.mapRowToCampaign);
    }

    async update(id: string, updates: CampaignUpdate): Promise<Campaign | null> {
        const dbUpdates: any = {};

        if (updates.title !== undefined) dbUpdates.title = updates.title;
        if (updates.brief !== undefined) dbUpdates.brief = updates.brief;
        if (updates.mediaUrls !== undefined) dbUpdates.media_urls = updates.mediaUrls;
        if (updates.totalBudget !== undefined) dbUpdates.total_budget = updates.totalBudget;
        if (updates.slots !== undefined) dbUpdates.slots = updates.slots;
        if (updates.status !== undefined) dbUpdates.status = updates.status;
        if (updates.minSubscribers !== undefined) dbUpdates.min_subscribers = updates.minSubscribers;
        if (updates.maxSubscribers !== undefined) dbUpdates.max_subscribers = updates.maxSubscribers;
        if (updates.requiredLanguages !== undefined) dbUpdates.required_languages = updates.requiredLanguages;
        if (updates.minAvgViews !== undefined) dbUpdates.min_avg_views = updates.minAvgViews;
        if (updates.requiredCategories !== undefined) dbUpdates.required_categories = updates.requiredCategories;
        if (updates.expiresAt !== undefined) dbUpdates.expires_at = updates.expiresAt;
        if (updates.escrowDeposited !== undefined) dbUpdates.escrow_deposited = updates.escrowDeposited;
        if (updates.escrowAllocated !== undefined) dbUpdates.escrow_allocated = updates.escrowAllocated;
        if (updates.slotsFilled !== undefined) dbUpdates.slots_filled = updates.slotsFilled;

        const { data, error } = await supabase
            .from('campaigns')
            .update(dbUpdates)
            .eq('id', id)
            .select()
            .single();

        if (error || !data) return null;
        return this.mapRowToCampaign(data);
    }

    async delete(id: string): Promise<boolean> {
        const { error } = await supabase
            .from('campaigns')
            .delete()
            .eq('id', id);

        return !error;
    }

    // ============================================
    // MARKETPLACE QUERIES
    // ============================================

    /**
     * Get active campaigns visible in marketplace
     */
    async findActiveCampaigns(): Promise<Campaign[]> {
        const { data, error } = await supabase
            .from('campaigns')
            .select('*')
            .eq('status', 'active')
            .order('created_at', { ascending: false });

        if (error) throw new Error(`Failed to fetch active campaigns: ${error.message}`);
        return (data || []).map(this.mapRowToCampaign);
    }

    /**
     * Get campaigns that a channel is eligible for
     */
    async findEligibleCampaigns(channel: Channel): Promise<Campaign[]> {
        // Base query for active campaigns
        let query = supabase
            .from('campaigns')
            .select('*')
            .eq('status', 'active')
            .lte('min_subscribers', channel.verifiedStats?.subscribers || 0);

        // Filter by max subscribers if set
        // Note: Supabase doesn't support OR with null easily, so we handle in JS

        const { data, error } = await query.order('created_at', { ascending: false });

        if (error) throw new Error(`Failed to fetch eligible campaigns: ${error.message}`);

        // Additional filtering in JS for complex conditions
        const campaigns = (data || []).map(this.mapRowToCampaign);

        return campaigns.filter((campaign: Campaign) => {
            // Check if slots available
            if (campaign.slotsFilled >= campaign.slots) {
                return false;
            }

            // Check max subscribers
            if (campaign.maxSubscribers && (channel.verifiedStats?.subscribers || 0) > campaign.maxSubscribers) {
                return false;
            }

            // Check language
            if (campaign.requiredLanguages && campaign.requiredLanguages.length > 0) {
                if (!channel.language || !campaign.requiredLanguages.includes(channel.language)) {
                    return false;
                }
            }

            // Check category
            if (campaign.requiredCategories && campaign.requiredCategories.length > 0) {
                if (!channel.category || !campaign.requiredCategories.includes(channel.category)) {
                    return false;
                }
            }

            // Check avg views
            if (campaign.minAvgViews && (channel.avgViews || 0) < campaign.minAvgViews) {
                return false;
            }

            // Check expiration
            if (campaign.expiresAt && new Date(campaign.expiresAt) < new Date()) {
                return false;
            }

            return true;
        });
    }

    /**
     * Atomically allocate a slot and escrow for open campaigns
     * Returns updated campaign if successful, null if campaign full/unavailable
     * 
     * Note: For true atomicity, this should be an RPC function in PostgreSQL.
     * This implementation does a conditional update which is atomic at the row level.
     */
    async atomicAllocateSlot(campaignId: string, perChannelBudget: number): Promise<Campaign | null> {
        // First, fetch the current campaign to check conditions
        const campaign = await this.findById(campaignId);
        if (!campaign) return null;

        // Check conditions
        if (campaign.status !== 'active') return null;
        if (campaign.slotsFilled >= campaign.slots) return null;
        if (campaign.escrowAvailable < perChannelBudget) return null;

        // Perform update with version check (optimistic locking via slots_filled)
        const { data, error } = await supabase
            .from('campaigns')
            .update({
                slots_filled: campaign.slotsFilled + 1,
                escrow_allocated: campaign.escrowAllocated + perChannelBudget
            })
            .eq('id', campaignId)
            .eq('slots_filled', campaign.slotsFilled) // Optimistic lock
            .select()
            .single();

        if (error || !data) {
            console.log(`[CampaignRepo] Atomic slot allocation failed for campaign ${campaignId}`);
            return null;
        }

        const updated = this.mapRowToCampaign(data);

        // Check if campaign is now full
        if (updated.slotsFilled >= updated.slots) {
            await this.update(campaignId, { status: 'filled' });
            updated.status = 'filled';
        }

        return updated;
    }

    /**
     * Release a slot and escrow (for cancellation)
     */
    async releaseSlot(campaignId: string, amount: number): Promise<Campaign | null> {
        const campaign = await this.findById(campaignId);
        if (!campaign) return null;
        if (campaign.slotsFilled <= 0) return null;

        const wasFilled = campaign.status === 'filled';
        const newStatus = wasFilled ? 'active' : campaign.status;

        const { data, error } = await supabase
            .from('campaigns')
            .update({
                slots_filled: campaign.slotsFilled - 1,
                escrow_allocated: campaign.escrowAllocated - amount,
                status: newStatus
            })
            .eq('id', campaignId)
            .select()
            .single();

        if (error || !data) return null;
        return this.mapRowToCampaign(data);
    }

    // ============================================
    // APPLICATIONS
    // ============================================

    async createApplication(campaignId: string, channelId: string): Promise<CampaignApplication> {
        const { data, error } = await supabase
            .from('campaign_applications')
            .insert({
                campaign_id: campaignId,
                channel_id: channelId,
                status: 'pending'
            })
            .select()
            .single();

        if (error) {
            if (error.code === '23505') { // Unique constraint violation
                throw new Error('Already applied to this campaign');
            }
            throw new Error(`Failed to create application: ${error.message}`);
        }

        return this.mapRowToApplication(data);
    }

    async findApplicationById(id: string): Promise<CampaignApplication | null> {
        const { data, error } = await supabase
            .from('campaign_applications')
            .select('*')
            .eq('id', id)
            .single();

        if (error || !data) return null;
        return this.mapRowToApplication(data);
    }

    async findApplicationByCampaignAndChannel(campaignId: string, channelId: string): Promise<CampaignApplication | null> {
        const { data, error } = await supabase
            .from('campaign_applications')
            .select('*')
            .eq('campaign_id', campaignId)
            .eq('channel_id', channelId)
            .single();

        if (error || !data) return null;
        return this.mapRowToApplication(data);
    }

    async findApplicationsByCampaign(campaignId: string): Promise<CampaignApplication[]> {
        const { data, error } = await supabase
            .from('campaign_applications')
            .select('*')
            .eq('campaign_id', campaignId)
            .order('applied_at', { ascending: false });

        if (error) throw new Error(`Failed to fetch applications: ${error.message}`);
        return (data || []).map(this.mapRowToApplication);
    }

    async findApplicationsByChannel(channelId: string): Promise<CampaignApplication[]> {
        const { data, error } = await supabase
            .from('campaign_applications')
            .select('*')
            .eq('channel_id', channelId)
            .order('applied_at', { ascending: false });

        if (error) throw new Error(`Failed to fetch applications: ${error.message}`);
        return (data || []).map(this.mapRowToApplication);
    }

    async updateApplication(id: string, status: 'approved' | 'rejected', dealId?: string): Promise<CampaignApplication | null> {
        const { data, error } = await supabase
            .from('campaign_applications')
            .update({
                status,
                deal_id: dealId,
                reviewed_at: new Date().toISOString()
            })
            .eq('id', id)
            .select()
            .single();

        if (error || !data) return null;
        return this.mapRowToApplication(data);
    }

    // ============================================
    // EXPIRATION HANDLING
    // ============================================

    async findExpiredCampaigns(): Promise<Campaign[]> {
        const now = new Date().toISOString();

        const { data, error } = await supabase
            .from('campaigns')
            .select('*')
            .in('status', ['active', 'draft'])
            .lt('expires_at', now);

        if (error) throw new Error(`Failed to fetch expired campaigns: ${error.message}`);
        return (data || []).map(this.mapRowToCampaign);
    }

    async markExpired(id: string): Promise<Campaign | null> {
        return this.update(id, { status: 'expired' });
    }
}

export const campaignRepository = new SupabaseCampaignRepository();
