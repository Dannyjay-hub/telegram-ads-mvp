import { Hono } from 'hono';
import { campaignService } from '../services/CampaignService';
import { SupabaseUserRepository } from '../repositories/supabase/SupabaseUserRepository';
import { SupabaseChannelRepository } from '../repositories/supabase/SupabaseChannelRepository';
import { CampaignInsert, CampaignUpdate } from '../domain/entities';
import { supabase } from '../db';
import { v4 as uuidv4 } from 'uuid';

const userRepository = new SupabaseUserRepository();
const channelRepository = new SupabaseChannelRepository();

// Master hot wallet address for escrow payments (same as in DealService)
const MASTER_WALLET_ADDRESS = process.env.MASTER_WALLET_ADDRESS || 'EQA...your-wallet...';

const campaigns = new Hono();

// ============================================
// ADVERTISER ROUTES
// ============================================

/**
 * Create a new campaign
 * POST /campaigns
 */
campaigns.post('/', async (c) => {
    try {
        const body = await c.req.json();
        const telegramId = c.req.header('X-Telegram-ID');

        if (!telegramId) {
            return c.json({ error: 'Telegram ID required' }, 401);
        }

        // Find user by telegram ID
        const user = await userRepository.findByTelegramId(parseInt(telegramId));
        if (!user) {
            return c.json({ error: 'User not found' }, 404);
        }

        // Generate unique payment memo for escrow tracking
        const paymentMemo = `campaign_${uuidv4().replace(/-/g, '').slice(0, 16)}`;

        // 15-minute payment window
        const PAYMENT_WINDOW_MINUTES = 15;
        const paymentExpiresAt = new Date(Date.now() + PAYMENT_WINDOW_MINUTES * 60 * 1000);

        const campaignData: CampaignInsert = {
            advertiserId: user.id,
            title: body.title,
            brief: body.brief,
            mediaUrls: body.mediaUrls,
            totalBudget: body.totalBudget,
            currency: body.currency || 'TON',
            slots: body.slots,
            campaignType: body.campaignType || 'open',
            minSubscribers: body.minSubscribers || 0,
            maxSubscribers: body.maxSubscribers,
            requiredLanguages: body.requiredLanguages,
            minAvgViews: body.minAvgViews || 0,
            requiredCategories: body.requiredCategories,
            startsAt: body.startsAt ? new Date(body.startsAt) : undefined,
            expiresAt: body.expiresAt ? new Date(body.expiresAt) : undefined,
            paymentMemo, // Store for webhook verification
            paymentExpiresAt // 15-minute payment window
        };

        const campaign = await campaignService.createCampaign(campaignData);

        // Return campaign with payment instructions including expiry
        return c.json({
            campaign,
            paymentInstructions: {
                address: MASTER_WALLET_ADDRESS,
                memo: paymentMemo,
                amount: body.totalBudget,
                expiresAt: paymentExpiresAt.toISOString()
            }
        }, 201);
    } catch (error: any) {
        console.error('[Campaigns] Create error:', error);
        return c.json({ error: error.message || 'Failed to create campaign' }, 400);
    }
});

/**
 * Save campaign as draft
 * POST /campaigns/draft
 */
campaigns.post('/draft', async (c) => {
    try {
        const body = await c.req.json();
        const telegramId = c.req.header('X-Telegram-ID');

        if (!telegramId) {
            return c.json({ error: 'Telegram ID required' }, 401);
        }

        const user = await userRepository.findByTelegramId(parseInt(telegramId));
        if (!user) {
            return c.json({ error: 'User not found' }, 404);
        }

        // Draft doesn't need payment memo - that's generated when publishing
        const campaignData: CampaignInsert = {
            advertiserId: user.id,
            title: body.title || 'Untitled Draft',
            brief: body.brief || '',
            totalBudget: body.totalBudget || 0,
            currency: body.currency || 'TON',
            slots: body.slots || 1,
            campaignType: body.campaignType || 'open',
            minSubscribers: body.minSubscribers || 0,
            maxSubscribers: body.maxSubscribers,
            requiredLanguages: body.requiredLanguages || [],
            requiredCategories: body.requiredCategories || [],
            minAvgViews: body.minAvgViews || 0,
            draftStep: body.draftStep || 0
        };

        const campaign = await campaignService.createCampaign(campaignData);

        return c.json({ campaign, message: 'Draft saved' }, 201);
    } catch (error: any) {
        console.error('[Campaigns] Draft save error:', error);
        return c.json({ error: error.message || 'Failed to save draft' }, 400);
    }
});

/**
 * Update an existing draft campaign
 * PATCH /campaigns/:id/draft
 */
campaigns.patch('/:id/draft', async (c) => {
    try {
        const campaignId = c.req.param('id');
        const body = await c.req.json();
        const telegramId = c.req.header('X-Telegram-ID');

        if (!telegramId) {
            return c.json({ error: 'Telegram ID required' }, 401);
        }

        const user = await userRepository.findByTelegramId(parseInt(telegramId));
        if (!user) {
            return c.json({ error: 'User not found' }, 404);
        }

        // Get campaign and verify ownership
        const existing = await campaignService.getCampaign(campaignId);
        if (!existing) {
            return c.json({ error: 'Campaign not found' }, 404);
        }

        if (existing.advertiserId !== user.id) {
            return c.json({ error: 'Not authorized' }, 403);
        }

        if (existing.status !== 'draft') {
            return c.json({ error: 'Can only update draft campaigns' }, 400);
        }

        // Update the draft with new values
        const updates: any = {};
        if (body.title !== undefined) updates.title = body.title;
        if (body.brief !== undefined) updates.brief = body.brief;
        if (body.totalBudget !== undefined) updates.totalBudget = body.totalBudget;
        if (body.currency !== undefined) updates.currency = body.currency;
        if (body.slots !== undefined) updates.slots = body.slots;
        if (body.campaignType !== undefined) updates.campaignType = body.campaignType;
        if (body.minSubscribers !== undefined) updates.minSubscribers = body.minSubscribers;
        if (body.maxSubscribers !== undefined) updates.maxSubscribers = body.maxSubscribers;
        if (body.requiredLanguages !== undefined) updates.requiredLanguages = body.requiredLanguages;
        if (body.requiredCategories !== undefined) updates.requiredCategories = body.requiredCategories;
        if (body.minAvgViews !== undefined) updates.minAvgViews = body.minAvgViews;
        if (body.draftStep !== undefined) updates.draftStep = body.draftStep;

        const campaign = await campaignService.updateCampaign(campaignId, updates);

        return c.json({ campaign, message: 'Draft updated' });
    } catch (error: any) {
        console.error('[Campaigns] Draft update error:', error);
        return c.json({ error: error.message || 'Failed to update draft' }, 400);
    }
});

/**
 * Get advertiser's campaigns
 * GET /campaigns
 */
campaigns.get('/', async (c) => {
    try {
        const telegramId = c.req.header('X-Telegram-ID');

        if (!telegramId) {
            return c.json({ error: 'Telegram ID required' }, 401);
        }

        const user = await userRepository.findByTelegramId(parseInt(telegramId));
        if (!user) {
            return c.json({ error: 'User not found' }, 404);
        }

        const campaignsList = await campaignService.getAdvertiserCampaigns(user.id);

        return c.json({ campaigns: campaignsList });
    } catch (error: any) {
        console.error('[Campaigns] List error:', error);
        return c.json({ error: error.message || 'Failed to list campaigns' }, 500);
    }
});

/**
 * Delete a draft campaign
 * DELETE /campaigns/:id
 */
campaigns.delete('/:id', async (c) => {
    try {
        const campaignId = c.req.param('id');
        const telegramId = c.req.header('X-Telegram-ID');

        if (!telegramId) {
            return c.json({ error: 'Telegram ID required' }, 401);
        }

        const user = await userRepository.findByTelegramId(parseInt(telegramId));
        if (!user) {
            return c.json({ error: 'User not found' }, 404);
        }

        // Get campaign and verify ownership
        const campaign = await campaignService.getCampaign(campaignId);
        if (!campaign) {
            return c.json({ error: 'Campaign not found' }, 404);
        }

        if (campaign.advertiserId !== user.id) {
            return c.json({ error: 'Not authorized' }, 403);
        }

        // Only allow deleting draft campaigns
        if (campaign.status !== 'draft') {
            return c.json({ error: 'Can only delete draft campaigns' }, 400);
        }

        // Delete directly from supabase
        const { error: deleteError } = await supabase
            .from('campaigns')
            .delete()
            .eq('id', campaignId);

        if (deleteError) throw deleteError;

        return c.json({ success: true });
    } catch (error: any) {
        console.error('[Campaigns] Delete error:', error);
        return c.json({ error: error.message || 'Failed to delete campaign' }, 500);
    }
});

/**
 * Get active campaigns in marketplace (Channel Owner View)
 * GET /campaigns/marketplace
 */
campaigns.get('/marketplace', async (c) => {
    try {
        const campaignsList = await campaignService.getActiveCampaigns();
        return c.json({ campaigns: campaignsList });
    } catch (error: any) {
        console.error('[Campaigns] Marketplace list error:', error);
        return c.json({ error: error.message || 'Failed to list campaigns' }, 500);
    }
});

/**
 * Get campaigns eligible for a specific channel
 * GET /campaigns/eligible/:channelId
 */
campaigns.get('/eligible/:channelId', async (c) => {
    try {
        const channelId = c.req.param('channelId');
        const campaignsList = await campaignService.getEligibleCampaigns(channelId);
        return c.json({ campaigns: campaignsList });
    } catch (error: any) {
        console.error('[Campaigns] Eligible list error:', error);
        return c.json({ error: error.message || 'Failed to list eligible campaigns' }, 500);
    }
});

/**
 * Get single campaign
 * GET /campaigns/:id
 */
campaigns.get('/:id', async (c) => {
    try {
        const id = c.req.param('id');

        // Skip special routes
        if (id === 'marketplace' || id === 'eligible') {
            return c.json({ error: 'Invalid campaign ID' }, 400);
        }

        const campaign = await campaignService.getCampaign(id);

        if (!campaign) {
            return c.json({ error: 'Campaign not found' }, 404);
        }

        return c.json({ campaign });
    } catch (error: any) {
        console.error('[Campaigns] Get error:', error);
        return c.json({ error: error.message || 'Failed to get campaign' }, 500);
    }
});

/**
 * Update campaign (draft only)
 * PUT /campaigns/:id
 */
campaigns.put('/:id', async (c) => {
    try {
        const id = c.req.param('id');
        const body = await c.req.json();
        const telegramId = c.req.header('X-Telegram-ID');

        if (!telegramId) {
            return c.json({ error: 'Telegram ID required' }, 401);
        }

        // Verify ownership
        const user = await userRepository.findByTelegramId(parseInt(telegramId));
        if (!user) {
            return c.json({ error: 'User not found' }, 404);
        }

        const existing = await campaignService.getCampaign(id);
        if (!existing) {
            return c.json({ error: 'Campaign not found' }, 404);
        }

        if (existing.advertiserId !== user.id) {
            return c.json({ error: 'Not authorized' }, 403);
        }

        const updates: CampaignUpdate = {};
        if (body.title !== undefined) updates.title = body.title;
        if (body.brief !== undefined) updates.brief = body.brief;
        if (body.mediaUrls !== undefined) updates.mediaUrls = body.mediaUrls;
        if (body.totalBudget !== undefined) updates.totalBudget = body.totalBudget;
        if (body.slots !== undefined) updates.slots = body.slots;
        if (body.minSubscribers !== undefined) updates.minSubscribers = body.minSubscribers;
        if (body.maxSubscribers !== undefined) updates.maxSubscribers = body.maxSubscribers;
        if (body.requiredLanguages !== undefined) updates.requiredLanguages = body.requiredLanguages;
        if (body.minAvgViews !== undefined) updates.minAvgViews = body.minAvgViews;
        if (body.requiredCategories !== undefined) updates.requiredCategories = body.requiredCategories;
        if (body.expiresAt !== undefined) updates.expiresAt = new Date(body.expiresAt);

        const campaign = await campaignService.updateCampaign(id, updates);

        return c.json({ campaign });
    } catch (error: any) {
        console.error('[Campaigns] Update error:', error);
        return c.json({ error: error.message || 'Failed to update campaign' }, 400);
    }
});

/**
 * Delete campaign
 * DELETE /campaigns/:id
 */
campaigns.delete('/:id', async (c) => {
    try {
        const id = c.req.param('id');
        const telegramId = c.req.header('X-Telegram-ID');

        if (!telegramId) {
            return c.json({ error: 'Telegram ID required' }, 401);
        }

        const user = await userRepository.findByTelegramId(parseInt(telegramId));
        if (!user) {
            return c.json({ error: 'User not found' }, 404);
        }

        const existing = await campaignService.getCampaign(id);
        if (!existing) {
            return c.json({ error: 'Campaign not found' }, 404);
        }

        if (existing.advertiserId !== user.id) {
            return c.json({ error: 'Not authorized' }, 403);
        }

        await campaignService.deleteCampaign(id);

        return c.json({ success: true });
    } catch (error: any) {
        console.error('[Campaigns] Delete error:', error);
        return c.json({ error: error.message || 'Failed to delete campaign' }, 400);
    }
});

/**
 * Publish campaign to marketplace
 * POST /campaigns/:id/publish
 */
campaigns.post('/:id/publish', async (c) => {
    try {
        const id = c.req.param('id');
        const telegramId = c.req.header('X-Telegram-ID');

        if (!telegramId) {
            return c.json({ error: 'Telegram ID required' }, 401);
        }

        const user = await userRepository.findByTelegramId(parseInt(telegramId));
        if (!user) {
            return c.json({ error: 'User not found' }, 404);
        }

        const existing = await campaignService.getCampaign(id);
        if (!existing) {
            return c.json({ error: 'Campaign not found' }, 404);
        }

        if (existing.advertiserId !== user.id) {
            return c.json({ error: 'Not authorized' }, 403);
        }

        const campaign = await campaignService.publishCampaign(id);

        return c.json({ campaign });
    } catch (error: any) {
        console.error('[Campaigns] Publish error:', error);
        return c.json({ error: error.message || 'Failed to publish campaign' }, 400);
    }
});

/**
 * Apply to a campaign
 * POST /campaigns/:id/apply
 */
campaigns.post('/:id/apply', async (c) => {
    try {
        const campaignId = c.req.param('id');
        const body = await c.req.json();
        const channelId = body.channelId;

        if (!channelId) {
            return c.json({ error: 'Channel ID required' }, 400);
        }

        // Verify channel ownership
        const telegramId = c.req.header('X-Telegram-ID');
        if (!telegramId) {
            return c.json({ error: 'Telegram ID required' }, 401);
        }

        // Get channel and verify owner
        const channel = await channelRepository.findById(channelId);
        if (!channel) {
            return c.json({ error: 'Channel not found' }, 404);
        }

        // TODO: Verify channel ownership via PR managers

        const result = await campaignService.applyToCampaign(campaignId, channelId);

        if (!result.success) {
            return c.json({ error: result.error }, 400);
        }

        return c.json({
            success: true,
            application: result.application,
            dealId: result.dealId
        }, 201);
    } catch (error: any) {
        console.error('[Campaigns] Apply error:', error);
        return c.json({ error: error.message || 'Failed to apply to campaign' }, 400);
    }
});

// ============================================
// APPLICATION REVIEW ROUTES (Advertiser)
// ============================================

/**
 * Get applications for a campaign
 * GET /campaigns/:id/applications
 */
campaigns.get('/:id/applications', async (c) => {
    try {
        const campaignId = c.req.param('id');
        const telegramId = c.req.header('X-Telegram-ID');

        if (!telegramId) {
            return c.json({ error: 'Telegram ID required' }, 401);
        }

        const user = await userRepository.findByTelegramId(parseInt(telegramId));
        if (!user) {
            return c.json({ error: 'User not found' }, 404);
        }

        const campaign = await campaignService.getCampaign(campaignId);
        if (!campaign) {
            return c.json({ error: 'Campaign not found' }, 404);
        }

        if (campaign.advertiserId !== user.id) {
            return c.json({ error: 'Not authorized' }, 403);
        }

        const applications = await (campaignService as any).campaignRepo.findApplicationsByCampaign(campaignId);

        // Enrich with channel data
        const enriched = await Promise.all(applications.map(async (app: any) => {
            const channel = await channelRepository.findById(app.channelId);
            return {
                ...app,
                channel: channel ? {
                    id: channel.id,
                    title: channel.title,
                    username: channel.username,
                    photoUrl: channel.photoUrl,
                    subscribers: channel.verifiedStats?.subscribers,
                    language: channel.language,
                    category: channel.category
                } : null
            };
        }));

        return c.json({ applications: enriched });
    } catch (error: any) {
        console.error('[Campaigns] Applications list error:', error);
        return c.json({ error: error.message || 'Failed to list applications' }, 500);
    }
});

/**
 * Approve an application (closed campaigns)
 * POST /campaigns/applications/:id/approve
 */
campaigns.post('/applications/:id/approve', async (c) => {
    try {
        const applicationId = c.req.param('id');
        const telegramId = c.req.header('X-Telegram-ID');

        if (!telegramId) {
            return c.json({ error: 'Telegram ID required' }, 401);
        }

        // TODO: Verify advertiser owns the campaign

        const result = await campaignService.approveApplication(applicationId);

        if (!result.success) {
            return c.json({ error: result.error }, 400);
        }

        return c.json({
            success: true,
            dealId: result.dealId
        });
    } catch (error: any) {
        console.error('[Campaigns] Approve error:', error);
        return c.json({ error: error.message || 'Failed to approve application' }, 400);
    }
});

/**
 * Reject an application (closed campaigns)
 * POST /campaigns/applications/:id/reject
 */
campaigns.post('/applications/:id/reject', async (c) => {
    try {
        const applicationId = c.req.param('id');
        const telegramId = c.req.header('X-Telegram-ID');

        if (!telegramId) {
            return c.json({ error: 'Telegram ID required' }, 401);
        }

        // TODO: Verify advertiser owns the campaign

        const result = await campaignService.rejectApplication(applicationId);

        if (!result.success) {
            return c.json({ error: result.error }, 400);
        }

        return c.json({ success: true });
    } catch (error: any) {
        console.error('[Campaigns] Reject error:', error);
        return c.json({ error: error.message || 'Failed to reject application' }, 400);
    }
});

// ============================================
// ESCROW ROUTES
// ============================================

/**
 * Record escrow deposit for open campaign
 * POST /campaigns/:id/escrow
 */
campaigns.post('/:id/escrow', async (c) => {
    try {
        const campaignId = c.req.param('id');
        const body = await c.req.json();

        const campaign = await campaignService.recordEscrowDeposit(
            campaignId,
            body.amount,
            body.walletAddress
        );

        return c.json({ campaign });
    } catch (error: any) {
        console.error('[Campaigns] Escrow error:', error);
        return c.json({ error: error.message || 'Failed to record escrow' }, 400);
    }
});

export default campaigns;
