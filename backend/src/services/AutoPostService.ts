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
     * Mark deal as failed to post
     */
    private async markFailed(dealId: string, reason: string): Promise<void> {
        await (supabase as any)
            .from('deals')
            .update({
                status: 'failed_to_post',
                status_updated_at: new Date().toISOString()
            })
            .eq('id', dealId);

        // TODO: Notify both parties of failure
        console.log(`[AutoPostService] Deal ${dealId} marked as failed: ${reason}`);
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
            `Channel: **${deal.channel.title}**\n` +
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
                    `✅ **Post published!**\n\nYour content is now live in **${deal.channel.title}**.\n\nThe 24-hour monitoring period has started.`,
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
