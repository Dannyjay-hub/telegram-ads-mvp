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
     * Uses forwardMessage to bot's Saved Messages since Telegram has no "does message exist" API
     * This avoids triggering channel notifications that confuse users
     */
    async checkPostExists(channelId: number, messageId: number): Promise<boolean> {
        if (!bot) return false;

        try {
            // Get bot's own user ID to use as destination (Saved Messages)
            const botInfo = await bot.api.getMe();

            // Forward the message to bot's Saved Messages (silent, no notification to channel)
            const forwarded = await bot.api.forwardMessage(
                botInfo.id,     // to: bot's Saved Messages
                channelId,      // from: the channel
                messageId       // the message we're checking
            );

            // Delete the forwarded message from bot's Saved Messages to keep it clean
            await bot.api.deleteMessage(botInfo.id, forwarded.message_id);

            return true;
        } catch (error: any) {
            // If forward fails with "message to forward not found", post was deleted
            if (error.message?.includes('message to forward not found') ||
                error.message?.includes("message can't be forwarded")) {
                console.log(`[MonitoringService] Post ${messageId} was deleted from channel`);
                return false;
            }

            // Other errors (network, etc) - assume post still exists to be safe
            console.warn(`[MonitoringService] Error checking post ${messageId}: ${error.message}`);
            return true; // Fail-safe: assume exists if we can't check
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

        // Update deal status first
        await (supabase as any)
            .from('deals')
            .update({
                status: 'released',
                status_updated_at: new Date().toISOString()
            })
            .eq('id', deal.id);

        // Fetch full deal info for payout including amount and currency
        const { data: fullDeal, error: dealError } = await (supabase as any)
            .from('deals')
            .select(`
                id, amount, currency, channel_id, channel_owner_wallet
            `)
            .eq('id', deal.id)
            .single();

        if (dealError || !fullDeal) {
            console.error(`[MonitoringService] Could not fetch deal for payout:`, dealError);
            return;
        }

        // Try to get wallet: first from deal, then from channel owner's TonConnect
        let ownerWalletAddress = fullDeal.channel_owner_wallet;

        if (!ownerWalletAddress) {
            // Fallback: get from channel owner's connected wallet
            const { data: ownerData } = await (supabase as any)
                .from('channel_admins')
                .select('users(ton_wallet_address)')
                .eq('channel_id', fullDeal.channel_id)
                .eq('is_owner', true)
                .single();

            ownerWalletAddress = ownerData?.users?.ton_wallet_address;
        }

        if (ownerWalletAddress && fullDeal.amount > 0) {
            // Import the payout service dynamically to avoid circular deps
            const { tonPayoutService } = await import('./TonPayoutService');

            console.log(`[MonitoringService] Queueing payout: ${fullDeal.amount} ${fullDeal.currency} to ${ownerWalletAddress}`);

            try {
                await tonPayoutService.queuePayout(
                    deal.id,
                    ownerWalletAddress,
                    fullDeal.amount,
                    fullDeal.currency || 'TON'
                );
                console.log(`[MonitoringService] Payout queued successfully`);
            } catch (payoutError) {
                console.error(`[MonitoringService] Failed to queue payout:`, payoutError);
                // Don't fail the release - payout can be retried
            }
        } else {
            console.warn(`[MonitoringService] No wallet address or 0 amount for deal ${deal.id}`);
        }

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
