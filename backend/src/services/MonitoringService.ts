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
    // Verification channel ID from environment - create a private channel and add bot as admin
    private verificationChannelId = process.env.VERIFICATION_CHANNEL_ID;

    /**
     * Ensure verification channel is accessible on startup
     */
    async ensureVerificationChannel(): Promise<boolean> {
        if (!this.verificationChannelId) {
            console.warn('[MonitoringService] ⚠️ VERIFICATION_CHANNEL_ID not set. Post verification disabled.');
            return false;
        }

        if (!bot) return false;

        try {
            await bot.api.getChat(this.verificationChannelId);
            console.log('[MonitoringService] ✅ Verification channel accessible');
            return true;
        } catch (error: any) {
            console.error('[MonitoringService] ❌ Verification channel not accessible:', error.message);
            console.error('  → Create a private channel, add bot as admin, set VERIFICATION_CHANNEL_ID env var');
            return false;
        }
    }

    /**
     * Check if a post still exists in the channel
     * Uses forwardMessage to a dedicated private verification channel
     * This avoids triggering public channel notifications
     * 
     * Returns: { exists: boolean, reason?: string }
     */
    async checkPostExists(channelId: number, messageId: number, dealId?: string): Promise<{ exists: boolean; reason?: string }> {
        if (!bot) return { exists: false, reason: 'Bot not initialized' };

        if (!this.verificationChannelId) {
            // No verification channel - assume post exists (fail-safe)
            console.warn('[MonitoringService] No verification channel configured, skipping check');
            return { exists: true, reason: 'Verification disabled' };
        }

        try {
            // Forward the message to our private verification channel
            const forwarded = await bot.api.forwardMessage(
                this.verificationChannelId,  // to: dedicated private channel
                channelId,                    // from: the public channel
                messageId,                    // the message we're checking
                { disable_notification: true }
            );

            // Log the verification (audit trail - keep for 24h, cleanup runs separately)
            console.log(`[MonitoringService] ✅ Verified deal ${dealId || 'unknown'}: post ${messageId} exists`);

            // Note: We don't delete immediately - keeps audit trail
            // Cleanup job will remove messages older than 24h

            return { exists: true };

        } catch (error: any) {
            const errorCode = error.error_code || (error.message?.includes('400') ? 400 : null);
            const errorMessage = error.message || 'Unknown error';

            // 400: Message doesn't exist or was deleted
            if (errorCode === 400 ||
                errorMessage.includes('message to forward not found') ||
                errorMessage.includes("message can't be forwarded") ||
                errorMessage.includes('MESSAGE_ID_INVALID')) {
                console.log(`[MonitoringService] ❌ Post ${messageId} was DELETED from channel`);
                return { exists: false, reason: 'Post was deleted' };
            }

            // 403: Bot was kicked from the channel
            if (errorCode === 403 || errorMessage.includes('bot was kicked')) {
                console.log(`[MonitoringService] ⚠️ Bot kicked from channel for deal with post ${messageId}`);
                return { exists: false, reason: 'Bot removed from channel' };
            }

            // Other errors (network, rate limit, etc) - assume exists to be safe
            console.warn(`[MonitoringService] Error checking post ${messageId}: ${errorMessage}`);
            return { exists: true, reason: `Check failed: ${errorMessage}` };
        }
    }

    /**
     * Cleanup old verification messages (run every 6 hours)
     * Keeps messages for 24h as audit trail
     */
    async cleanupVerificationChannel(): Promise<number> {
        if (!bot || !this.verificationChannelId) return 0;

        // Note: Telegram Bot API doesn't have getHistory, so we can't easily list old messages
        // Alternative: Track forwarded message IDs in DB and delete after 24h
        // For MVP: Messages will pile up, but private channel with only bot has no impact
        // TODO: Implement proper cleanup with message ID tracking if needed

        console.log('[MonitoringService] Cleanup: Private verification channel - no cleanup needed for MVP');
        return 0;
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

        const verificationResult = await this.checkPostExists(
            deal.channel.telegram_channel_id,
            deal.posted_message_id,
            dealId  // Pass dealId for audit logging
        );

        // Update check count
        await (supabase as any)
            .from('deals')
            .update({
                monitoring_checks: (deal.monitoring_checks || 0) + 1,
                last_checked_at: new Date().toISOString()
            })
            .eq('id', dealId);

        if (!verificationResult.exists) {
            // Post was deleted early - cancel and refund
            console.log(`[MonitoringService] Deal ${dealId} failed verification: ${verificationResult.reason}`);
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
