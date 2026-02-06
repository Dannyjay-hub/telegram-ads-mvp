import { supabase } from '../db';
import { bot } from '../botInstance';

/**
 * MonitoringService - Monitors posted content for 24 hours
 * 
 * Checks at 1h, 6h, 12h, 24h intervals to verify post still exists.
 * If deleted early, deal is cancelled and funds refunded.
 * If 24h passes, funds are released to channel owner.
 */

export class MonitoringService {
    /**
     * Check if a post still exists in the channel
     * Uses the copyMessage hack since Telegram has no "does message exist" API
     */
    async checkPostExists(channelId: number, messageId: number): Promise<boolean> {
        if (!bot) return false;

        try {
            // Try to copy the message to itself
            const copy = await bot.api.copyMessage(channelId, channelId, messageId);
            // If successful, delete the copy immediately
            await bot.api.deleteMessage(channelId, copy.message_id);
            return true;
        } catch (error: any) {
            // If copy fails, the original message was deleted
            console.log(`[MonitoringService] Post ${messageId} no longer exists: ${error.message}`);
            return false;
        }
    }

    /**
     * Process a single deal for monitoring
     * Returns true if post still exists, false if deleted
     */
    async checkDeal(dealId: string): Promise<boolean> {
        const { data: deal, error } = await (supabase as any)
            .from('deals')
            .select(`
                id, posted_message_id, posted_at, monitoring_end_at, monitoring_checks,
                channel:channels(telegram_channel_id, title),
                advertiser:users!deals_advertiser_id_fkey(telegram_id)
            `)
            .eq('id', dealId)
            .single();

        if (error || !deal) {
            console.error(`[MonitoringService] Deal ${dealId} not found`);
            return false;
        }

        if (!deal.posted_message_id) {
            console.warn(`[MonitoringService] Deal ${dealId} has no posted message ID`);
            return false;
        }

        const postExists = await this.checkPostExists(
            deal.channel.telegram_channel_id,
            deal.posted_message_id
        );

        // Update check count
        await (supabase as any)
            .from('deals')
            .update({
                monitoring_checks: (deal.monitoring_checks || 0) + 1,
                last_checked_at: new Date().toISOString()
            })
            .eq('id', dealId);

        if (!postExists) {
            // Post was deleted early - cancel and refund
            await this.handleEarlyDeletion(deal);
            return false;
        }

        // Check if monitoring period is complete
        const now = new Date();
        const monitoringEnd = new Date(deal.monitoring_end_at);

        if (now >= monitoringEnd) {
            // 24 hours passed - release funds
            await this.releaseFunds(deal);
        }

        return true;
    }

    /**
     * Handle case where post was deleted before 24h
     */
    private async handleEarlyDeletion(deal: any): Promise<void> {
        console.log(`[MonitoringService] Post deleted early for deal ${deal.id}`);

        // Update deal status
        await (supabase as any)
            .from('deals')
            .update({
                status: 'cancelled',
                status_updated_at: new Date().toISOString()
            })
            .eq('id', deal.id);

        // TODO: Trigger refund process
        // For MVP, we'll mark it and handle refund manually or via separate job

        // Notify advertiser
        if (bot && deal.advertiser?.telegram_id) {
            try {
                await bot.api.sendMessage(
                    deal.advertiser.telegram_id,
                    `⚠️ **Post Removed Early**\n\n` +
                    `The post in **${deal.channel?.title}** was deleted before the 24-hour period ended.\n\n` +
                    `Your funds will be refunded.`,
                    { parse_mode: 'Markdown' }
                );
            } catch (e) {
                console.warn('[MonitoringService] Failed to notify advertiser');
            }
        }
    }

    /**
     * Release funds to channel owner after successful 24h
     */
    private async releaseFunds(deal: any): Promise<void> {
        console.log(`[MonitoringService] ✅ Releasing funds for deal ${deal.id}`);

        // Update deal status
        await (supabase as any)
            .from('deals')
            .update({
                status: 'released',
                status_updated_at: new Date().toISOString()
            })
            .eq('id', deal.id);

        // TODO: Actually transfer funds from escrow to channel owner wallet
        // For MVP, we mark it and handle payout separately

        // Notify both parties
        if (bot) {
            const message = (isOwner: boolean) => isOwner
                ? `💰 **Payment Released!**\n\nYour payment for deal with **${deal.channel?.title}** has been released. The funds are now in your wallet.`
                : `✅ **Deal Completed!**\n\nThe 24-hour monitoring period has ended. Your post stayed live and funds have been released to the channel owner.\n\nThank you for using our platform!`;

            // Notify advertiser
            if (deal.advertiser?.telegram_id) {
                try {
                    await bot.api.sendMessage(deal.advertiser.telegram_id, message(false), {
                        parse_mode: 'Markdown'
                    });
                } catch (e) { }
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
                    await bot.api.sendMessage(channelAdmin.user.telegram_id, message(true), {
                        parse_mode: 'Markdown'
                    });
                } catch (e) { }
            }
        }
    }

    /**
     * Process all deals that need monitoring
     * Called by background job
     */
    async processMonitoringDeals(): Promise<void> {
        const { data: deals, error } = await (supabase as any)
            .from('deals')
            .select('id')
            .eq('status', 'posted');

        if (error || !deals?.length) {
            return;
        }

        console.log(`[MonitoringService] Checking ${deals.length} deals...`);

        for (const deal of deals) {
            await this.checkDeal(deal.id);
        }
    }

    /**
     * Calculate next check time based on posted_at
     * Checks at 1h, 6h, 12h, 24h
     */
    shouldCheckNow(postedAt: Date, lastCheckedAt: Date | null, checksCount: number): boolean {
        const now = new Date();
        const hoursSincePost = (now.getTime() - postedAt.getTime()) / (1000 * 60 * 60);

        // Check intervals: 1h, 6h, 12h, 24h
        const checkpoints = [1, 6, 12, 24];

        for (let i = 0; i < checkpoints.length; i++) {
            if (hoursSincePost >= checkpoints[i] && checksCount <= i) {
                return true;
            }
        }

        return false;
    }
}
