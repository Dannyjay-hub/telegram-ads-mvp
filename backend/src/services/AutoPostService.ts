import { supabase } from '../db';
import { bot } from '../botInstance';
import { DraftService } from './DraftService';
import { MonitoringService } from './MonitoringService';

/**
 * AutoPostService - Posts approved content at scheduled times
 * 
 * This service is called by a background job that runs every minute
 */

export class AutoPostService {
    private draftService: DraftService;
    private monitoringService: MonitoringService;

    constructor() {
        this.draftService = new DraftService();
        this.monitoringService = new MonitoringService();
    }

    /**
     * Post content to a channel
     * Returns the message ID if successful
     */
    async postToChannel(dealId: string): Promise<number | null> {
        if (!bot) {
            console.error('[AutoPostService] Bot not configured');
            return null;
        }

        // Get deal with draft and channel info
        const deal = await this.draftService.getDealWithDraft(dealId);
        if (!deal) {
            console.error(`[AutoPostService] Deal ${dealId} not found`);
            return null;
        }

        // Verify bot still has posting permissions
        const botPermission = await this.draftService.verifyBotPermission(
            deal.channel.telegram_channel_id
        );
        if (!botPermission.valid) {
            console.error(`[AutoPostService] Bot lacks permission: ${botPermission.reason}`);
            await this.markFailed(dealId, botPermission.reason || 'Bot permission lost');
            return null;
        }

        try {
            let messageId: number;

            if (deal.draft_media_file_id && deal.draft_media_type === 'photo') {
                // Post photo with caption
                const result = await bot.api.sendPhoto(
                    deal.channel.telegram_channel_id,
                    deal.draft_media_file_id,
                    { caption: deal.draft_text || '' }
                );
                messageId = result.message_id;
            } else {
                // Post text only
                const result = await bot.api.sendMessage(
                    deal.channel.telegram_channel_id,
                    deal.draft_text || ''
                );
                messageId = result.message_id;
            }

            // Update deal status
            const postedAt = new Date();
            const monitoringHours = this.monitoringService.getMonitoringDurationHours();

            await (supabase as any)
                .from('deals')
                .update({
                    status: 'posted',
                    posted_message_id: messageId,
                    posted_at: postedAt.toISOString(),
                    monitoring_end_at: new Date(postedAt.getTime() + monitoringHours * 60 * 60 * 1000).toISOString(),
                    status_updated_at: postedAt.toISOString()
                })
                .eq('id', dealId);

            // Schedule random monitoring checks (anti-gaming security)
            await this.monitoringService.scheduleChecksForDeal(dealId, postedAt, monitoringHours);

            console.log(`[AutoPostService] ✅ Posted deal ${dealId}, message ID: ${messageId}`);

            // Notify both parties
            await this.notifyPosted(deal, messageId);

            return messageId;
        } catch (error: any) {
            console.error(`[AutoPostService] Failed to post deal ${dealId}:`, error);
            await this.markFailed(dealId, error.message);
            return null;
        }
    }

    /**
     * Mark deal as failed to post — with full cleanup
     * 1. Atomic guard (prevent double refund)
     * 2. Refund advertiser
     * 3. Release campaign slot
     * 4. Move channel to draft (requires re-verification)
     * 5. Notify both parties
     */
    private async markFailed(dealId: string, reason: string): Promise<void> {
        // 1. ATOMIC GUARD: check current status before proceeding
        const { data: currentDeal } = await (supabase as any)
            .from('deals')
            .select('id, status, price_amount, price_currency, advertiser_wallet_address, campaign_id, channel_id, advertiser_id')
            .eq('id', dealId)
            .single();

        if (!currentDeal) {
            console.error(`[AutoPostService] markFailed: Deal ${dealId} not found`);
            return;
        }

        // Stop if already handled
        if (['failed_to_post', 'refunded', 'cancelled', 'rejected'].includes(currentDeal.status)) {
            console.warn(`[AutoPostService] Deal ${dealId} already in terminal state (${currentDeal.status}). Skipping cleanup.`);
            return;
        }

        // 2. Update status FIRST (prevents double processing)
        await (supabase as any)
            .from('deals')
            .update({
                status: 'failed_to_post',
                status_updated_at: new Date().toISOString()
            })
            .eq('id', dealId);

        console.log(`[AutoPostService] Deal ${dealId} marked as failed: ${reason}`);

        // 3. Refund advertiser
        if (currentDeal.advertiser_wallet_address && currentDeal.price_amount) {
            try {
                const { TonPayoutService } = await import('./TonPayoutService');
                const tonPayoutService = new TonPayoutService();
                const currency = currentDeal.price_currency as 'TON' | 'USDT';
                await tonPayoutService.queueRefund(
                    dealId,
                    currentDeal.advertiser_wallet_address,
                    currentDeal.price_amount,
                    currency,
                    `Post failed: ${reason}`
                );
                console.log(`[AutoPostService] Refund queued for deal ${dealId}`);
            } catch (refundErr) {
                console.error(`[AutoPostService] Refund queue failed for deal ${dealId}:`, refundErr);
            }
        } else {
            console.warn(`[AutoPostService] No wallet address for refund on deal ${dealId}`);
        }

        // 4. Release campaign slot if this was a campaign deal
        if (currentDeal.campaign_id) {
            try {
                const { SupabaseCampaignRepository } = await import('../repositories/supabase/SupabaseCampaignRepository');
                const campaignRepo = new SupabaseCampaignRepository();
                await campaignRepo.releaseSlot(currentDeal.campaign_id, currentDeal.price_amount || 0);
                console.log(`[AutoPostService] Campaign slot released for deal ${dealId}`);
            } catch (slotErr) {
                console.error(`[AutoPostService] Slot release failed for deal ${dealId}:`, slotErr);
            }
        }

        // 5. Move channel to draft (owner must re-add bot and re-verify)
        if (currentDeal.channel_id) {
            try {
                await (supabase as any)
                    .from('channels')
                    .update({ status: 'draft', is_active: false })
                    .eq('id', currentDeal.channel_id);
                console.log(`[AutoPostService] Channel ${currentDeal.channel_id} moved to draft`);
            } catch (chErr) {
                console.error(`[AutoPostService] Channel status update failed:`, chErr);
            }
        }

        // 6. Notify both parties
        await this.notifyFailure(currentDeal, reason);
    }

    /**
     * Notify both parties about post failure
     */
    private async notifyFailure(deal: any, reason: string): Promise<void> {
        if (!bot) return;

        // Get channel title + username for hyperlink
        let channelLink = '**your channel**';
        if (deal.channel_id) {
            const { data: ch } = await (supabase as any)
                .from('channels')
                .select('title, username')
                .eq('id', deal.channel_id)
                .single();
            if (ch) {
                channelLink = ch.username
                    ? `[${ch.title}](https://t.me/${ch.username})`
                    : `**${ch.title}**`;
            }
        }

        // Notify advertiser
        if (deal.advertiser_id) {
            const { data: advertiser } = await (supabase as any)
                .from('users')
                .select('telegram_id')
                .eq('id', deal.advertiser_id)
                .single();

            if (advertiser?.telegram_id) {
                try {
                    await bot.api.sendMessage(
                        advertiser.telegram_id,
                        `⚠️ **Post Failed**\n\n` +
                        `Your ad on ${channelLink} could not be posted.\n` +
                        `Reason: ${reason}\n\n` +
                        `💰 A refund has been queued to your wallet.`,
                        { parse_mode: 'Markdown' }
                    );
                } catch (e) {
                    console.warn('[AutoPostService] Failed to notify advertiser of failure');
                }
            }
        }

        // Notify channel owner
        if (deal.channel_id) {
            const { data: ownerAdmin } = await (supabase as any)
                .from('channel_admins')
                .select('user:users(telegram_id)')
                .eq('channel_id', deal.channel_id)
                .eq('is_owner', true)
                .single();

            if (ownerAdmin?.user?.telegram_id) {
                try {
                    await bot.api.sendMessage(
                        ownerAdmin.user.telegram_id,
                        `⚠️ **Post Failed**\n\n` +
                        `A scheduled post on ${channelLink} could not go through.\n` +
                        `Reason: ${reason}\n\n` +
                        `Your channel has been moved to draft. Please re-verify bot permissions to re-list.`,
                        { parse_mode: 'Markdown' }
                    );
                } catch (e) {
                    console.warn('[AutoPostService] Failed to notify channel owner of failure');
                }
            }
        }
    }

    /**
     * Notify both parties that the post is live
     */
    private async notifyPosted(deal: any, messageId: number): Promise<void> {
        if (!bot) return;

        const channelLink = deal.channel.username
            ? `https://t.me/${deal.channel.username}/${messageId}`
            : `Post #${messageId}`;

        const message = `🎉 **Your ad is now live!**\n\n` +
            `Channel: ${deal.channel.username ? `[${deal.channel.title}](https://t.me/${deal.channel.username})` : `**${deal.channel.title}**`}\n` +
            `The post will be monitored for 24 hours.\n\n` +
            `${deal.channel.username ? `[View Post](${channelLink})` : ''}`;

        // Notify advertiser
        if (deal.advertiser?.telegram_id) {
            try {
                await bot.api.sendMessage(deal.advertiser.telegram_id, message, {
                    parse_mode: 'Markdown'
                });
            } catch (e) {
                console.warn('[AutoPostService] Failed to notify advertiser');
            }
        }

        // Notify channel owner
        const { data: channelAdmin } = await (supabase as any)
            .from('channel_admins')
            .select('user:users(telegram_id)')
            .eq('channel_id', deal.channel_id)
            .eq('is_owner', true)
            .single();

        if (channelAdmin?.user?.telegram_id) {
            try {
                await bot.api.sendMessage(
                    channelAdmin.user.telegram_id,
                    `✅ **Post published!**\n\nYour content is now live in ${deal.channel.username ? `[${deal.channel.title}](https://t.me/${deal.channel.username})` : `**${deal.channel.title}**`}.\n\nThe 24-hour monitoring period has started.`,
                    { parse_mode: 'Markdown' }
                );
            } catch (e) {
                console.warn('[AutoPostService] Failed to notify channel owner');
            }
        }
    }

    /**
     * Process all scheduled deals that are due
     * Called by background job
     */
    async processScheduledDeals(): Promise<number> {
        const now = new Date().toISOString();

        const { data: deals, error } = await (supabase as any)
            .from('deals')
            .select('id')
            .eq('status', 'scheduled')
            .lte('agreed_post_time', now);

        if (error || !deals?.length) {
            return 0;
        }

        let posted = 0;
        for (const deal of deals) {
            const result = await this.postToChannel(deal.id);
            if (result) posted++;
        }

        console.log(`[AutoPostService] Processed ${deals.length} deals, ${posted} posted successfully`);
        return posted;
    }
}
