import { campaignService } from '../services/CampaignService';
import { SupabaseUserRepository } from '../repositories/supabase/SupabaseUserRepository';
import { SupabaseChannelRepository } from '../repositories/supabase/SupabaseChannelRepository';
import { CampaignInsert, CampaignUpdate } from '../domain/entities';
import { supabase } from '../db';
import { v4 as uuidv4 } from 'uuid';
import { createRouter } from '../types/app';

const userRepository = new SupabaseUserRepository();
const channelRepository = new SupabaseChannelRepository();

// Master hot wallet address for escrow payments (same as in DealService)
const MASTER_WALLET_ADDRESS = process.env.MASTER_WALLET_ADDRESS || 'EQA...your-wallet...';

// Flat platform fees (covers network costs for sending/releasing/refunding)
// Fee is charged in the same currency as the payment
const PLATFORM_FEE_TON = 0.01;   // 0.01 TON for native TON payments
const PLATFORM_FEE_USDT = 0.1;   // 0.1 USDT for USDT payments (Jetton gas is ~0.05 TON)

// Simple in-memory deduplication cache to prevent duplicate draft creation
// Key: `${advertiserId}:${title}`, Value: timestamp of last request
const recentDraftRequests = new Map<string, number>();
const DEDUP_WINDOW_MS = 5000; // 5 second window to prevent duplicates

const campaigns = createRouter();

// ============================================
// ADVERTISER ROUTES
// ============================================

/**
 * Create a new campaign or submit an existing draft for payment
 * If body.campaignId is provided, updates the existing draft instead of creating new
 * POST /campaigns
 */
campaigns.post('/', async (c) => {
    try {
        const body = await c.req.json();
        const telegramId = c.get('telegramId');

        // Find user by telegram ID
        const user = await userRepository.findByTelegramId(telegramId);
        if (!user) {
            return c.json({ error: 'User not found' }, 404);
        }

        // Validate currency - server-side enforcement
        const ALLOWED_CURRENCIES = ['TON', 'USDT'];
        const normalizedCurrency = (body.currency || 'TON').toUpperCase();
        if (!ALLOWED_CURRENCIES.includes(normalizedCurrency)) {
            return c.json({ error: `Unsupported currency. Allowed: ${ALLOWED_CURRENCIES.join(', ')}` }, 400);
        }

        // Generate unique payment memo for escrow tracking
        const paymentMemo = `campaign_${uuidv4().replace(/-/g, '').slice(0, 16)}`;

        // 15-minute payment window
        const PAYMENT_WINDOW_MINUTES = 15;
        const paymentExpiresAt = new Date(Date.now() + PAYMENT_WINDOW_MINUTES * 60 * 1000);

        // Check if this is updating an existing draft (resuming)
        const existingCampaignId = body.campaignId;
        let campaign;

        if (existingCampaignId) {
            // Resuming a draft - update the existing campaign
            const existing = await campaignService.getCampaign(existingCampaignId);
            if (!existing) {
                return c.json({ error: 'Draft campaign not found' }, 404);
            }
            if (existing.advertiserId !== user.id) {
                return c.json({ error: 'Not authorized to update this campaign' }, 403);
            }

            // Update the existing draft with new data and payment info
            // Note: currency is NOT updated - it's immutable after creation
            const updateData: CampaignUpdate = {
                title: body.title,
                brief: body.brief,
                mediaUrls: body.mediaUrls,
                totalBudget: body.totalBudget,
                slots: body.slots,
                campaignType: body.campaignType || 'open',
                minSubscribers: body.minSubscribers || 0,
                maxSubscribers: body.maxSubscribers,
                requiredLanguages: body.requiredLanguages,
                minAvgViews: body.minAvgViews || 0,
                requiredCategories: body.requiredCategories,
                expiresAt: body.expiresAt ? new Date(body.expiresAt) : undefined,
                paymentMemo, // New payment memo for this submission
                paymentExpiresAt
                // Status stays as 'draft' until payment is confirmed
            };

            campaign = await campaignService.updateCampaign(existingCampaignId, updateData);
            console.log(`[Campaigns] Updated existing draft ${existingCampaignId} for submission`);
        } else {
            // New campaign - create fresh
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

            campaign = await campaignService.createCampaign(campaignData);
            console.log(`[Campaigns] Created new campaign ${campaign.id}`);
        }

        // Calculate flat platform fee based on currency
        const platformFee = normalizedCurrency === 'USDT' ? PLATFORM_FEE_USDT : PLATFORM_FEE_TON;
        const totalWithFee = Math.round((body.totalBudget + platformFee) * 1e9) / 1e9; // avoid floating point issues

        // Return campaign with payment instructions including fee breakdown
        return c.json({
            campaign,
            paymentInstructions: {
                address: MASTER_WALLET_ADDRESS,
                memo: paymentMemo,
                amount: totalWithFee,
                budgetAmount: body.totalBudget,
                platformFee: platformFee,
                feeCurrency: 'TON',
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
        const telegramId = c.get('telegramId');

        const user = await userRepository.findByTelegramId(telegramId);
        if (!user) {
            return c.json({ error: 'User not found' }, 404);
        }

        // Deduplication check - prevent duplicate drafts from double-clicks or retries
        const dedupKey = `${user.id}:${body.title || 'Untitled'}`;
        const lastRequest = recentDraftRequests.get(dedupKey);
        const now = Date.now();

        if (lastRequest && (now - lastRequest) < DEDUP_WINDOW_MS) {
            console.log(`[Campaigns] Duplicate draft request detected for ${dedupKey}, ignoring`);
            // Return success but don't create duplicate - fetch existing draft instead
            const existingDrafts = await campaignService.getAdvertiserCampaigns(user.id);
            const matchingDraft = existingDrafts.find(
                c => c.status === 'draft' && c.title === (body.title || 'Untitled Draft')
            );
            if (matchingDraft) {
                return c.json({ campaign: matchingDraft, message: 'Draft saved (dedup)' }, 201);
            }
        }

        // Record this request
        recentDraftRequests.set(dedupKey, now);

        // Clean up old entries periodically
        if (recentDraftRequests.size > 100) {
            for (const [key, timestamp] of recentDraftRequests.entries()) {
                if (now - timestamp > DEDUP_WINDOW_MS * 2) {
                    recentDraftRequests.delete(key);
                }
            }
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
            draftStep: body.draftStep || 0,
            expiresInDays: body.expiresInDays || 7
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
        const telegramId = c.get('telegramId');

        const user = await userRepository.findByTelegramId(telegramId);
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
        if (body.expiresInDays !== undefined) updates.expiresInDays = body.expiresInDays;

        // If no changes, just return existing campaign as success
        if (Object.keys(updates).length === 0) {
            return c.json({ campaign: existing, message: 'Draft saved (no changes)' });
        }

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
        const telegramId = c.get('telegramId');

        const user = await userRepository.findByTelegramId(telegramId);
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
        const telegramId = c.get('telegramId');

        const user = await userRepository.findByTelegramId(telegramId);
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
        const telegramId = c.get('telegramId');

        // Verify ownership
        const user = await userRepository.findByTelegramId(telegramId);
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
        const telegramId = c.get('telegramId');

        const user = await userRepository.findByTelegramId(telegramId);
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
        const telegramId = c.get('telegramId');

        const user = await userRepository.findByTelegramId(telegramId);
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
        const telegramId = c.get('telegramId');

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
        const telegramId = c.get('telegramId');

        const user = await userRepository.findByTelegramId(telegramId);
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
        // telegramId available via c.get('telegramId') for ownership verification


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
        // telegramId available via c.get('telegramId') for ownership verification

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

/**
 * End a campaign and refund remaining budget for unfilled slots
 * Available for: active, expired campaigns
 * Refund = (slots - slotsFilled) × perChannelBudget
 * Active deals continue running — only unfilled slots are refunded
 * POST /campaigns/:id/end
 */
campaigns.post('/:id/end', async (c) => {
    try {
        const campaignId = c.req.param('id');
        const telegramId = c.get('telegramId');

        const user = await userRepository.findByTelegramId(telegramId);
        if (!user) {
            return c.json({ error: 'User not found' }, 404);
        }

        const campaign = await campaignService.getCampaign(campaignId);
        if (!campaign) {
            return c.json({ error: 'Campaign not found' }, 404);
        }

        if (campaign.advertiserId !== user.id) {
            return c.json({ error: 'Not your campaign' }, 403);
        }

        // Only active or expired campaigns can be ended
        if (!['active', 'expired', 'filled'].includes(campaign.status)) {
            return c.json({ error: `Cannot end a campaign with status '${campaign.status}'` }, 400);
        }

        // Calculate refund for unfilled slots
        const slotsLeft = campaign.slots - (campaign.slotsFilled || 0);
        const refundAmount = slotsLeft * campaign.perChannelBudget;

        // Queue refund if there's money to return
        if (refundAmount > 0 && campaign.escrowWalletAddress) {
            try {
                const { TonPayoutService } = await import('../services/TonPayoutService');
                const tonPayoutService = new TonPayoutService();
                const currency = (campaign.currency || 'TON') as 'TON' | 'USDT';
                await tonPayoutService.queueRefund(
                    campaignId, // use campaignId as the deal reference
                    campaign.escrowWalletAddress,
                    refundAmount,
                    currency,
                    `Campaign ended: refund for ${slotsLeft} unfilled slot${slotsLeft > 1 ? 's' : ''}`
                );
                console.log(`[Campaigns] Refund queued and auto-executing for ${refundAmount} ${currency}`);
            } catch (e: any) {
                console.error('[Campaigns] Refund queue error:', e.message);
            }
        }

        // Update campaign status to ended
        const updated = await campaignService.updateCampaign(campaignId, {
            status: 'ended',
            refundAmount: refundAmount,
            endedAt: new Date(),
        } as any);

        console.log(`[Campaigns] Ended campaign ${campaignId}. Refund: ${refundAmount} ${campaign.currency} for ${slotsLeft} unfilled slots.`);

        return c.json({
            campaign: updated,
            refund: {
                amount: refundAmount,
                currency: campaign.currency,
                slotsRefunded: slotsLeft,
                slotsUsed: campaign.slotsFilled || 0,
            },
            message: refundAmount > 0
                ? `Campaign ended. ${refundAmount} ${campaign.currency} will be refunded for ${slotsLeft} unfilled slot${slotsLeft > 1 ? 's' : ''}.`
                : 'Campaign ended. All slots were used — no refund needed.'
        });
    } catch (error: any) {
        console.error('[Campaigns] End campaign error:', error);
        return c.json({ error: error.message || 'Failed to end campaign' }, 400);
    }
});

/**
 * Update campaign duration (expiresAt) while campaign is active
 * Only allows setting to a future date
 * POST /campaigns/:id/duration
 */
campaigns.post('/:id/duration', async (c) => {
    try {
        const campaignId = c.req.param('id');
        const telegramId = c.get('telegramId');
        const body = await c.req.json();

        const user = await userRepository.findByTelegramId(telegramId);
        if (!user) {
            return c.json({ error: 'User not found' }, 404);
        }

        const campaign = await campaignService.getCampaign(campaignId);
        if (!campaign) {
            return c.json({ error: 'Campaign not found' }, 404);
        }

        if (campaign.advertiserId !== user.id) {
            return c.json({ error: 'Not your campaign' }, 403);
        }

        // Only active campaigns can have duration edited
        if (campaign.status !== 'active') {
            return c.json({ error: 'Can only edit duration on active campaigns' }, 400);
        }

        // Validate new expiry date
        const newExpiresAt = new Date(body.expiresAt);
        if (isNaN(newExpiresAt.getTime())) {
            return c.json({ error: 'Invalid date format' }, 400);
        }

        if (newExpiresAt <= new Date()) {
            return c.json({ error: 'New expiry date must be in the future. Use "End Campaign" to stop immediately.' }, 400);
        }

        const updated = await campaignService.updateCampaign(campaignId, {
            expiresAt: newExpiresAt,
        } as any);

        console.log(`[Campaigns] Updated duration for campaign ${campaignId} to ${newExpiresAt.toISOString()}`);

        return c.json({ campaign: updated, message: `Campaign duration updated. New expiry: ${newExpiresAt.toISOString()}` });
    } catch (error: any) {
        console.error('[Campaigns] Duration update error:', error);
        return c.json({ error: error.message || 'Failed to update duration' }, 400);
    }
});

/**
 * Extend an expired campaign by 7 days
 * Works within a 24h grace period after expiration
 * POST /campaigns/:id/extend
 */
campaigns.post('/:id/extend', async (c) => {
    try {
        const campaignId = c.req.param('id');
        const telegramId = c.get('telegramId');

        // Find user
        const user = await userRepository.findByTelegramId(telegramId);
        if (!user) {
            return c.json({ error: 'User not found' }, 404);
        }

        // Get campaign
        const campaign = await campaignService.getCampaign(campaignId);
        if (!campaign) {
            return c.json({ error: 'Campaign not found' }, 404);
        }

        // Verify ownership
        if (campaign.advertiserId !== user.id) {
            return c.json({ error: 'Not your campaign' }, 403);
        }

        // Only expired campaigns can be extended
        if (campaign.status !== 'expired') {
            return c.json({ error: 'Only expired campaigns can be extended' }, 400);
        }

        // Check 24h grace period
        const expiresAt = campaign.expiresAt ? new Date(campaign.expiresAt) : null;
        if (expiresAt) {
            const gracePeriodEnd = new Date(expiresAt.getTime() + 24 * 60 * 60 * 1000);
            if (Date.now() > gracePeriodEnd.getTime()) {
                return c.json({ error: 'Grace period has ended. Please create a new campaign.' }, 400);
            }
        }

        // Check remaining budget
        const slotsLeft = campaign.slots - (campaign.slotsFilled || 0);
        if (slotsLeft <= 0) {
            return c.json({ error: 'No slots remaining. All slots are filled.' }, 400);
        }

        // Extend by 7 days from now
        const newExpiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);

        const updated = await campaignService.updateCampaign(campaignId, {
            status: 'active',
            expiresAt: newExpiresAt.toISOString(),
            expiryNotified: false,
        } as any);

        console.log(`[Campaigns] Extended campaign ${campaignId} to ${newExpiresAt.toISOString()}`);

        return c.json({ campaign: updated, message: 'Campaign extended by 7 days' });
    } catch (error: any) {
        console.error('[Campaigns] Extension error:', error);
        return c.json({ error: error.message || 'Failed to extend campaign' }, 400);
    }
});

export default campaigns;
