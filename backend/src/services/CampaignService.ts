import { campaignRepository, SupabaseCampaignRepository } from '../repositories/supabase/SupabaseCampaignRepository';
import { SupabaseChannelRepository } from '../repositories/supabase/SupabaseChannelRepository';
import { SupabaseDealRepository } from '../repositories/supabase/SupabaseDealRepository';
import { SupabaseUserRepository } from '../repositories/supabase/SupabaseUserRepository';
import { Campaign, CampaignApplication, CampaignInsert, CampaignUpdate, Channel } from '../domain/entities';

export interface ApplyResult {
    success: boolean;
    error?: string;
    application?: CampaignApplication;
    dealId?: string;
}

export interface EligibilityResult {
    eligible: boolean;
    reason?: string;
}

// Instantiate repositories
const channelRepository = new SupabaseChannelRepository();
const dealRepository = new SupabaseDealRepository();
const userRepository = new SupabaseUserRepository();

export class CampaignService {
    private campaignRepo: SupabaseCampaignRepository;

    constructor() {
        this.campaignRepo = campaignRepository;
    }

    // ============================================
    // CAMPAIGN CRUD
    // ============================================

    async createCampaign(data: CampaignInsert): Promise<Campaign> {
        // Verify advertiser exists
        const advertiser = await userRepository.findById(data.advertiserId);
        if (!advertiser) {
            throw new Error('Advertiser not found');
        }

        // Validate budget and slots - only for publishing (drafts can have 0 budget)
        // Drafts are identified by NOT having a paymentMemo (payment memo is set when submitting for payment)
        const isDraft = !data.paymentMemo;
        if (!isDraft && data.totalBudget <= 0) {
            throw new Error('Total budget must be greater than 0');
        }

        if (data.slots <= 0) {
            throw new Error('Number of slots must be greater than 0');
        }

        const perChannelBudget = data.totalBudget / data.slots;
        console.log(`[CampaignService] Creating campaign: budget=${data.totalBudget}, slots=${data.slots}, perChannel=${perChannelBudget}`);

        return this.campaignRepo.create(data);
    }

    async getCampaign(id: string): Promise<Campaign | null> {
        return this.campaignRepo.findById(id);
    }

    async getAdvertiserCampaigns(advertiserId: string): Promise<Campaign[]> {
        return this.campaignRepo.findByAdvertiserId(advertiserId);
    }

    async updateCampaign(id: string, updates: CampaignUpdate): Promise<Campaign | null> {
        const campaign = await this.campaignRepo.findById(id);
        if (!campaign) throw new Error('Campaign not found');

        // Only allow updates if campaign is in draft status
        if (campaign.status !== 'draft' && updates.totalBudget !== undefined) {
            throw new Error('Cannot update budget after campaign is published');
        }

        return this.campaignRepo.update(id, updates);
    }

    async deleteCampaign(id: string): Promise<boolean> {
        const campaign = await this.campaignRepo.findById(id);
        if (!campaign) throw new Error('Campaign not found');

        // Check for active deals
        if (campaign.slotsFilled > 0) {
            throw new Error('Cannot delete campaign with active deals. Cancel all deals first.');
        }

        // Refund any deposited escrow
        if (campaign.escrowDeposited > 0) {
            console.log(`[CampaignService] Refunding unused escrow: ${campaign.escrowDeposited} ${campaign.currency}`);
            // TODO: Queue refund via PayoutService
        }

        return this.campaignRepo.delete(id);
    }

    // ============================================
    // PUBLISH CAMPAIGN
    // ============================================

    async publishCampaign(id: string): Promise<Campaign> {
        const campaign = await this.campaignRepo.findById(id);
        if (!campaign) throw new Error('Campaign not found');

        if (campaign.status !== 'draft') {
            throw new Error('Only draft campaigns can be published');
        }

        // For open campaigns, verify escrow is funded
        if (campaign.campaignType === 'open') {
            if (!campaign.escrowFunded) {
                throw new Error('Open campaigns require full escrow funding before publishing');
            }
        }

        const updated = await this.campaignRepo.update(id, { status: 'active' });
        if (!updated) throw new Error('Failed to publish campaign');

        console.log(`[CampaignService] Campaign ${id} published to marketplace`);

        return updated;
    }

    // ============================================
    // MARKETPLACE
    // ============================================

    async getActiveCampaigns(): Promise<Campaign[]> {
        return this.campaignRepo.findActiveCampaigns();
    }

    async getEligibleCampaigns(channelId: string): Promise<Campaign[]> {
        const channel = await channelRepository.findById(channelId);
        if (!channel) throw new Error('Channel not found');

        return this.campaignRepo.findEligibleCampaigns(channel);
    }

    // ============================================
    // ELIGIBILITY CHECK
    // ============================================

    checkEligibility(campaign: Campaign, channel: Channel): EligibilityResult {
        const subscribers = channel.verifiedStats?.subscribers || 0;
        const avgViews = channel.avgViews || 0;

        // Check subscriber range
        if (subscribers < campaign.minSubscribers) {
            return {
                eligible: false,
                reason: `Minimum ${campaign.minSubscribers.toLocaleString()} subscribers required (you have ${subscribers.toLocaleString()})`
            };
        }

        if (campaign.maxSubscribers && subscribers > campaign.maxSubscribers) {
            return {
                eligible: false,
                reason: `Maximum ${campaign.maxSubscribers.toLocaleString()} subscribers allowed`
            };
        }

        // Check language (normalize to handle 'en' vs 'English' mismatch)
        if (campaign.requiredLanguages && campaign.requiredLanguages.length > 0) {
            const normalizeLanguage = (lang: string): string => {
                const lower = lang.toLowerCase().trim();
                const map: Record<string, string> = {
                    'en': 'english', 'eng': 'english',
                    'ru': 'russian', 'rus': 'russian',
                    'es': 'spanish', 'spa': 'spanish',
                    'pt': 'portuguese', 'por': 'portuguese',
                    'zh': 'chinese', 'chi': 'chinese', 'cn': 'chinese',
                    'ar': 'arabic', 'ara': 'arabic',
                    'hi': 'hindi', 'hin': 'hindi',
                    'fr': 'french', 'fra': 'french',
                    'de': 'german', 'deu': 'german', 'ger': 'german',
                    'ja': 'japanese', 'jpn': 'japanese', 'jp': 'japanese',
                    'ko': 'korean', 'kor': 'korean', 'kr': 'korean',
                    'id': 'indonesian', 'ind': 'indonesian',
                    'tr': 'turkish', 'tur': 'turkish',
                    'it': 'italian', 'ita': 'italian'
                };
                return map[lower] || lower;
            };

            const channelLang = normalizeLanguage(channel.language || '');
            const meetsLanguage = campaign.requiredLanguages.some(
                reqLang => normalizeLanguage(reqLang) === channelLang
            );

            if (!meetsLanguage) {
                return {
                    eligible: false,
                    reason: `Language must be one of: ${campaign.requiredLanguages.join(', ')}`
                };
            }
        }

        // Check category
        if (campaign.requiredCategories && campaign.requiredCategories.length > 0) {
            if (!channel.category || !campaign.requiredCategories.includes(channel.category)) {
                return {
                    eligible: false,
                    reason: `Category must be one of: ${campaign.requiredCategories.join(', ')}`
                };
            }
        }

        // Check avg views
        if (campaign.minAvgViews && avgViews < campaign.minAvgViews) {
            return {
                eligible: false,
                reason: `Minimum ${campaign.minAvgViews.toLocaleString()} average views required`
            };
        }

        return { eligible: true };
    }

    // ============================================
    // APPLY TO CAMPAIGN (Core Logic)
    // ============================================

    async applyToCampaign(campaignId: string, channelId: string): Promise<ApplyResult> {
        console.log(`[CampaignService] Channel ${channelId} applying to campaign ${campaignId}`);

        // Fetch campaign and channel
        const [campaign, channel] = await Promise.all([
            this.campaignRepo.findById(campaignId),
            channelRepository.findById(channelId)
        ]);

        if (!campaign) {
            return { success: false, error: 'Campaign not found' };
        }

        if (!channel) {
            return { success: false, error: 'Channel not found' };
        }

        // Check campaign is active
        if (campaign.status !== 'active') {
            return { success: false, error: 'Campaign is not active' };
        }

        // Check slots available
        if (campaign.slotsFilled >= campaign.slots) {
            return { success: false, error: 'Campaign is full' };
        }

        // Check expiration
        if (campaign.expiresAt && new Date(campaign.expiresAt) < new Date()) {
            return { success: false, error: 'Campaign has expired' };
        }

        // Check eligibility
        const eligibility = this.checkEligibility(campaign, channel);
        if (!eligibility.eligible) {
            return { success: false, error: eligibility.reason };
        }

        // Check for existing application
        const existingApp = await this.campaignRepo.findApplicationByCampaignAndChannel(campaignId, channelId);
        if (existingApp) {
            return { success: false, error: 'Already applied to this campaign' };
        }

        // Route based on campaign type
        if (campaign.campaignType === 'open') {
            return this.applyToOpenCampaign(campaign, channel);
        } else {
            return this.applyToClosedCampaign(campaign, channel);
        }
    }

    private async applyToOpenCampaign(campaign: Campaign, channel: Channel): Promise<ApplyResult> {
        console.log(`[CampaignService] Open campaign apply: ${channel.id} → ${campaign.id}`);

        // Atomic slot allocation
        const updatedCampaign = await this.campaignRepo.atomicAllocateSlot(
            campaign.id,
            campaign.perChannelBudget
        );

        if (!updatedCampaign) {
            return { success: false, error: 'Campaign full or insufficient escrow' };
        }

        // Create deal with draft_pending status (channel needs to draft post first)
        const deal = await dealRepository.create({
            advertiserId: campaign.advertiserId,
            channelId: channel.id,
            priceAmount: campaign.perChannelBudget,
            priceCurrency: campaign.currency,
            briefText: campaign.brief,
            status: 'draft_pending', // Requires channel owner to draft post
            campaignId: campaign.id
        });

        // Create application record
        const application = await this.campaignRepo.createApplication(campaign.id, channel.id);
        await this.campaignRepo.updateApplication(application.id, 'approved', deal.id);

        console.log(`[CampaignService] Open campaign deal created: ${deal.id}`);

        // Send notifications
        try {
            const { bot } = await import('../botInstance');
            const { supabase } = await import('../db');

            // Get advertiser info
            const advertiser = await userRepository.findById(campaign.advertiserId);

            // Get channel owner info from channel_admins table
            const { data: ownerData } = await supabase
                .from('channel_admins')
                .select('users(telegram_id, first_name)')
                .eq('channel_id', channel.id)
                .eq('is_owner', true)
                .single();

            // Notify advertiser: Channel joined their campaign
            if (advertiser?.telegramId && bot) {
                await bot.api.sendMessage(
                    advertiser.telegramId,
                    `✅ **New Channel Joined!**\n\n` +
                    `**${channel.title}** has joined your campaign.\n` +
                    `They will now draft a post based on your brief.\n\n` +
                    `You'll be notified when the draft is ready for review.`,
                    {
                        parse_mode: 'Markdown',
                        reply_markup: {
                            inline_keyboard: [
                                [{ text: '📱 View Partnership', url: `https://t.me/DanielAdsMVP_bot/marketplace?startapp=deal_${deal.id}` }]
                            ]
                        }
                    }
                );
                console.log(`[CampaignService] ✅ Notified advertiser ${advertiser.telegramId}`);
            }

            // Notify channel owner: Create draft post
            const ownerTelegramId = (ownerData?.users as any)?.telegram_id;
            if (ownerTelegramId && bot) {
                await bot.api.sendMessage(
                    ownerTelegramId,
                    `📝 **Create Draft Post**\n\n` +
                    `You've joined a campaign! Please draft a post based on the brief:\n\n` +
                    `"${campaign.brief || 'No brief provided'}"\n\n` +
                    `**Next step:** Open the app and create your draft post.`,
                    {
                        parse_mode: 'Markdown',
                        reply_markup: {
                            inline_keyboard: [
                                [{ text: '📝 Create Draft', url: `https://t.me/DanielAdsMVP_bot/marketplace?startapp=owner_deal_${deal.id}` }]
                            ]
                        }
                    }
                );
                console.log(`[CampaignService] ✅ Notified channel owner ${ownerTelegramId}`);
            }
        } catch (notifyError) {
            console.error('[CampaignService] Failed to send notifications:', notifyError);
            // Don't fail the apply - notifications are not critical
        }

        return {
            success: true,
            application,
            dealId: deal.id
        };
    }

    private async applyToClosedCampaign(campaign: Campaign, channel: Channel): Promise<ApplyResult> {
        console.log(`[CampaignService] Closed campaign apply: ${channel.id} → ${campaign.id}`);

        // Create pending application (no slot allocation yet)
        const application = await this.campaignRepo.createApplication(campaign.id, channel.id);

        console.log(`[CampaignService] Closed campaign application created: ${application.id}`);

        // TODO: Notify advertiser of new application

        return {
            success: true,
            application
        };
    }

    // ============================================
    // APPLICATION REVIEW (Closed Campaigns)
    // ============================================

    async approveApplication(applicationId: string): Promise<ApplyResult> {
        const application = await this.campaignRepo.findApplicationById(applicationId);
        if (!application) {
            return { success: false, error: 'Application not found' };
        }

        if (application.status !== 'pending') {
            return { success: false, error: 'Application already processed' };
        }

        const campaign = await this.campaignRepo.findById(application.campaignId);
        if (!campaign) {
            return { success: false, error: 'Campaign not found' };
        }

        if (campaign.campaignType !== 'closed') {
            return { success: false, error: 'Only closed campaign applications can be manually approved' };
        }

        // Check slots still available
        if (campaign.slotsFilled >= campaign.slots) {
            return { success: false, error: 'Campaign is now full' };
        }

        const channel = await channelRepository.findById(application.channelId);
        if (!channel) {
            return { success: false, error: 'Channel not found' };
        }

        // For closed campaigns, we need to handle escrow now
        // TODO: Implement per-channel escrow for closed campaigns

        // Allocate slot
        const updatedCampaign = await this.campaignRepo.atomicAllocateSlot(
            campaign.id,
            campaign.perChannelBudget
        );

        if (!updatedCampaign) {
            return { success: false, error: 'Failed to allocate slot' };
        }

        // Create deal
        const deal = await dealRepository.create({
            advertiserId: campaign.advertiserId,
            channelId: channel.id,
            priceAmount: campaign.perChannelBudget,
            priceCurrency: campaign.currency,
            briefText: campaign.brief,
            status: 'approved',
            campaignId: campaign.id
        });

        // Update application
        await this.campaignRepo.updateApplication(applicationId, 'approved', deal.id);

        console.log(`[CampaignService] Application ${applicationId} approved, deal ${deal.id} created`);

        return {
            success: true,
            dealId: deal.id
        };
    }

    async rejectApplication(applicationId: string): Promise<ApplyResult> {
        const application = await this.campaignRepo.findApplicationById(applicationId);
        if (!application) {
            return { success: false, error: 'Application not found' };
        }

        if (application.status !== 'pending') {
            return { success: false, error: 'Application already processed' };
        }

        await this.campaignRepo.updateApplication(applicationId, 'rejected');

        console.log(`[CampaignService] Application ${applicationId} rejected`);

        // TODO: Notify channel owner

        return { success: true };
    }

    // ============================================
    // DEAL CANCELLATION
    // ============================================

    async cancelCampaignDeal(dealId: string, reason: string): Promise<boolean> {
        const deal = await dealRepository.findById(dealId);
        if (!deal || !(deal as any).campaignId) {
            throw new Error('Deal not found or not part of a campaign');
        }

        const campaign = await this.campaignRepo.findById((deal as any).campaignId);
        if (!campaign) {
            throw new Error('Campaign not found');
        }

        // Release slot and escrow back to campaign pool
        await this.campaignRepo.releaseSlot(campaign.id, deal.priceAmount);

        // Update deal status
        await dealRepository.updateStatus(dealId, 'cancelled', reason);

        console.log(`[CampaignService] Campaign deal ${dealId} cancelled, slot released`);

        return true;
    }

    // ============================================
    // ESCROW OPERATIONS
    // ============================================

    async recordEscrowDeposit(campaignId: string, amount: number, walletAddress: string): Promise<Campaign> {
        const campaign = await this.campaignRepo.findById(campaignId);
        if (!campaign) throw new Error('Campaign not found');

        const updated = await this.campaignRepo.update(campaignId, {
            escrowDeposited: (campaign.escrowDeposited || 0) + amount
        } as any);

        if (!updated) throw new Error('Failed to record escrow deposit');

        console.log(`[CampaignService] Escrow deposit recorded: ${amount} ${campaign.currency} for campaign ${campaignId}`);

        return updated;
    }

    // ============================================
    // EXPIRATION HANDLING
    // ============================================

    async processExpiredCampaigns(): Promise<number> {
        const expired = await this.campaignRepo.findExpiredCampaigns();
        let processed = 0;

        for (const campaign of expired) {
            try {
                // Calculate unused escrow
                const unusedEscrow = campaign.escrowDeposited - campaign.escrowAllocated;

                // Check for pending deals
                const applications = await this.campaignRepo.findApplicationsByCampaign(campaign.id);
                const pendingDeals = applications.filter(a =>
                    a.status === 'approved' && a.dealId
                );

                if (pendingDeals.length > 0) {
                    // Mark as pending expiration - wait for deals to complete
                    await this.campaignRepo.update(campaign.id, { status: 'expired_pending' } as any);
                    console.log(`[CampaignService] Campaign ${campaign.id} has ${pendingDeals.length} pending deals, marked as expired_pending`);
                    continue;
                }

                // Refund unused escrow
                if (unusedEscrow > 0) {
                    console.log(`[CampaignService] Refunding ${unusedEscrow} ${campaign.currency} for expired campaign ${campaign.id}`);
                    // TODO: Queue refund via PayoutService
                }

                await this.campaignRepo.markExpired(campaign.id);
                processed++;

                console.log(`[CampaignService] Campaign ${campaign.id} expired`);

            } catch (error) {
                console.error(`[CampaignService] Error processing expired campaign ${campaign.id}:`, error);
            }
        }

        return processed;
    }
}

export const campaignService = new CampaignService();
