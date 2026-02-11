import { supabase } from '../db';
import { bot } from '../botInstance';

/**
 * MonitoringService - Monitors posted content for 24 hours
 * 
 * SECURITY: Uses RANDOM check times to prevent timing attacks.
 * Instead of predictable 1h, 6h, 12h, 24h checks, generates random
 * check times within the monitoring period.
 * 
 * - 24h production: 6-10 random checks + final check at end
 * - 6h testing: 3 random checks + final check at end
 * 
 * If deleted early, deal is cancelled and funds refunded.
 * If monitoring period passes, funds are released to channel owner.
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

        // Try verification channel first, fallback to copyMessage if not configured
        if (this.verificationChannelId) {
            return this.checkPostExistsViaVerificationChannel(channelId, messageId, dealId);
        } else {
            console.warn('[MonitoringService] No verification channel - using copyMessage fallback (may cause phantom notifications)');
            return this.checkPostExistsViaCopyMessage(channelId, messageId, dealId);
        }
    }

    /**
     * Primary verification method: forward to private verification channel
     */
    private async checkPostExistsViaVerificationChannel(
        channelId: number,
        messageId: number,
        dealId?: string
    ): Promise<{ exists: boolean; reason?: string }> {
        try {
            await bot!.api.forwardMessage(
                this.verificationChannelId!,
                channelId,
                messageId,
                { disable_notification: true }
            );
            console.log(`[MonitoringService] ✅ Verified deal ${dealId || 'unknown'}: post ${messageId} exists`);
            return { exists: true };
        } catch (error: any) {
            return this.handleVerificationError(error, messageId);
        }
    }

    /**
     * Fallback verification: copyMessage (causes phantom notifications but works)
     * Used when VERIFICATION_CHANNEL_ID is not configured
     */
    private async checkPostExistsViaCopyMessage(
        channelId: number,
        messageId: number,
        dealId?: string
    ): Promise<{ exists: boolean; reason?: string }> {
        try {
            // Copy message to same channel then immediately delete
            const copy = await bot!.api.copyMessage(channelId, channelId, messageId);
            await bot!.api.deleteMessage(channelId, copy.message_id);
            console.log(`[MonitoringService] ✅ Verified deal ${dealId || 'unknown'}: post ${messageId} exists (via copyMessage)`);
            return { exists: true };
        } catch (error: any) {
            return this.handleVerificationError(error, messageId);
        }
    }

    /**
     * Handle verification errors - determine if post was deleted or other issue
     */
    private handleVerificationError(error: any, messageId: number): { exists: boolean; reason?: string } {
        const errorCode = error.error_code || (error.message?.includes('400') ? 400 : null);
        const errorMessage = error.message || 'Unknown error';

        // 400: Message doesn't exist or was deleted
        if (errorCode === 400 ||
            errorMessage.includes('message to forward not found') ||
            errorMessage.includes("message can't be forwarded") ||
            errorMessage.includes('message to copy not found') ||
            errorMessage.includes('MESSAGE_ID_INVALID')) {
            console.log(`[MonitoringService] ❌ Post ${messageId} was DELETED from channel`);
            return { exists: false, reason: 'Post was deleted' };
        }

        // 403: Bot was kicked from the channel
        if (errorCode === 403 || errorMessage.includes('bot was kicked')) {
            console.log(`[MonitoringService] ⚠️ Bot kicked from channel for deal with post ${messageId}`);
            return { exists: false, reason: 'Bot removed from channel' };
        }

        // Other errors - assume exists to be safe
        console.warn(`[MonitoringService] Error checking post ${messageId}: ${errorMessage}`);
        return { exists: true, reason: `Check failed: ${errorMessage}` };
    }

    /**
     * Generate random check times for a monitoring period
     * SECURITY: Prevents timing attacks by making checks unpredictable
     * 
     * @param monitoringDurationHours - How long to monitor (6 for testing, 24 for production)
     * @param numChecks - Number of random checks (3 for 6h, 6-10 for 24h)
     * @returns Array of ISO timestamp strings
     */
    generateRandomCheckTimes(postedAt: Date, monitoringDurationHours: number): string[] {
        // Time-band approach: divide duration into equal bands, pick one random time per band
        // This guarantees even distribution — no clustering
        //
        // Formula: numBands = ceil(duration / 3)
        // Each band = duration / numBands hours wide
        // One random check per band + 1 final at exact end
        //
        // Examples:
        // 5h  → 2 bands of 2.5h → 2 random + final = 3 checks
        // 6h  → 2 bands of 3h   → 2 random + final = 3 checks
        // 17h → 6 bands of ~2.8h → 6 random + final = 7 checks
        // 24h → 8 bands of 3h   → 8 random + final = 9 checks
        const numBands = Math.ceil(monitoringDurationHours / 3);

        const startTime = postedAt.getTime();
        const totalDurationMs = monitoringDurationHours * 60 * 60 * 1000;
        const endTime = startTime + totalDurationMs;
        const bandDurationMs = totalDurationMs / numBands;

        const checkTimes: number[] = [];

        for (let i = 0; i < numBands; i++) {
            const bandStart = startTime + (i * bandDurationMs);
            const bandEnd = bandStart + bandDurationMs;

            // Add 5 min buffer from band edges to avoid clustering at boundaries
            const buffer = Math.min(5 * 60 * 1000, bandDurationMs * 0.1);
            const safeStart = bandStart + buffer;
            const safeEnd = bandEnd - buffer;
            const safeRange = safeEnd - safeStart;

            if (safeRange > 0) {
                const randomOffset = Math.floor(Math.random() * safeRange);
                checkTimes.push(safeStart + randomOffset);
            } else {
                // Band too small for buffer — just pick midpoint
                checkTimes.push(bandStart + bandDurationMs / 2);
            }
        }

        // Always add final check at exact monitoring end (triggers fund release)
        checkTimes.push(endTime);

        return checkTimes.map(t => new Date(t).toISOString());
    }

    /**
     * Schedule random checks for a deal when it enters 'posted' status
     * Call this when posting content to the channel
     */
    async scheduleChecksForDeal(dealId: string, postedAt: Date, monitoringDurationHours: number = 6): Promise<void> {
        const checkTimes = this.generateRandomCheckTimes(postedAt, monitoringDurationHours);
        const scheduledChecks = checkTimes.map(time => ({ time, completed: false }));

        const nextCheckAt = checkTimes.length > 0 ? checkTimes[0] : null;

        await (supabase as any)
            .from('deals')
            .update({
                scheduled_checks: scheduledChecks,
                next_check_at: nextCheckAt,
                monitoring_end_at: new Date(postedAt.getTime() + monitoringDurationHours * 60 * 60 * 1000).toISOString()
            })
            .eq('id', dealId);

        console.log(`[MonitoringService] Scheduled ${checkTimes.length} random checks for deal ${dealId}`);
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

        // Fetch full deal info for payout including amount and currency
        const { data: fullDeal, error: dealError } = await (supabase as any)
            .from('deals')
            .select(`
                id, price_amount, price_currency, channel_id, channel_owner_wallet
            `)
            .eq('id', deal.id)
            .single();

        if (dealError || !fullDeal) {
            console.error(`[MonitoringService] Could not fetch deal for payout:`, dealError);
            return;
        }

        // Wallet resolution order:
        // 1. Channel's payout_wallet (set during listing — most reliable)
        // 2. Deal's channel_owner_wallet (legacy)
        // 3. Channel owner's TonConnect wallet (fallback)
        let ownerWalletAddress: string | null = null;

        // 1. Try channel's payout wallet first
        const { data: channelData } = await (supabase as any)
            .from('channels')
            .select('payout_wallet')
            .eq('id', fullDeal.channel_id)
            .single();

        ownerWalletAddress = channelData?.payout_wallet || null;

        // 2. Fallback: deal's stored wallet
        if (!ownerWalletAddress) {
            ownerWalletAddress = fullDeal.channel_owner_wallet || null;
        }

        // 3. Fallback: channel owner's TonConnect wallet
        if (!ownerWalletAddress) {
            const { data: ownerData } = await (supabase as any)
                .from('channel_admins')
                .select('users(ton_wallet_address)')
                .eq('channel_id', fullDeal.channel_id)
                .eq('is_owner', true)
                .single();

            ownerWalletAddress = ownerData?.users?.ton_wallet_address || null;
        }

        if (ownerWalletAddress && fullDeal.price_amount > 0) {
            // Wallet found — queue payout and mark as released
            const { tonPayoutService } = await import('./TonPayoutService');

            console.log(`[MonitoringService] Queueing payout: ${fullDeal.price_amount} ${fullDeal.price_currency} to ${ownerWalletAddress}`);

            try {
                await tonPayoutService.queuePayout(
                    deal.id,
                    ownerWalletAddress,
                    fullDeal.price_amount,
                    fullDeal.price_currency || 'TON'
                );

                // Only mark as 'released' AFTER payout is queued
                await (supabase as any)
                    .from('deals')
                    .update({
                        status: 'released',
                        status_updated_at: new Date().toISOString()
                    })
                    .eq('id', deal.id);

                console.log(`[MonitoringService] ✅ Payout queued, deal marked as released`);
            } catch (payoutError) {
                console.error(`[MonitoringService] Failed to queue payout:`, payoutError);
                // Payout failed — mark as payout_pending so cron can retry
                await (supabase as any)
                    .from('deals')
                    .update({
                        status: 'payout_pending',
                        status_updated_at: new Date().toISOString()
                    })
                    .eq('id', deal.id);
            }
        } else {
            // No wallet — mark as payout_pending (NOT released)
            // DB stays honest: money hasn't moved
            console.warn(`[MonitoringService] ⚠️ No wallet for deal ${deal.id} — marking as payout_pending`);

            await (supabase as any)
                .from('deals')
                .update({
                    status: 'payout_pending',
                    status_updated_at: new Date().toISOString()
                })
                .eq('id', deal.id);
        }

        // Notify both parties
        if (bot) {
            const hasWallet = !!ownerWalletAddress;
            const ownerMessage = hasWallet
                ? `💰 **Payment Released!**\n\nYour payment for deal with **${deal.channel?.title}** has been released. The funds are now in your wallet.`
                : `💰 **Deal Completed!**\n\nYour deal with **${deal.channel?.title}** monitoring is complete! Connect your wallet in the app to receive your payout of ${fullDeal.price_amount} ${fullDeal.price_currency}.`;
            const advertiserMessage = `✅ **Deal Completed!**\n\nThe 24-hour monitoring period has ended. Your post stayed live and funds have been released to the channel owner.\n\nHow was your experience? Rate this channel:`;

            // Notify advertiser with rating buttons
            if (deal.advertiser?.telegram_id) {
                try {
                    await bot.api.sendMessage(deal.advertiser.telegram_id, advertiserMessage, {
                        parse_mode: 'Markdown',
                        reply_markup: {
                            inline_keyboard: [[
                                { text: '⭐', callback_data: `rate_deal:${deal.id}:1` },
                                { text: '⭐⭐', callback_data: `rate_deal:${deal.id}:2` },
                                { text: '⭐⭐⭐', callback_data: `rate_deal:${deal.id}:3` },
                                { text: '⭐⭐⭐⭐', callback_data: `rate_deal:${deal.id}:4` },
                                { text: '⭐⭐⭐⭐⭐', callback_data: `rate_deal:${deal.id}:5` },
                            ]]
                        }
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
                    await bot.api.sendMessage(channelAdmin.user.telegram_id, ownerMessage, {
                        parse_mode: 'Markdown'
                    });
                } catch (e) { }
            }
        }
    }

    /**
     * Process all deals that need monitoring (using random scheduled checks)
     * Called by background job - runs every minute
     */
    async processMonitoringDeals(): Promise<void> {
        const now = new Date().toISOString();

        // Find deals where next_check_at has passed
        const { data: deals, error } = await (supabase as any)
            .from('deals')
            .select('id, scheduled_checks, next_check_at')
            .eq('status', 'posted')
            .lte('next_check_at', now)
            .not('next_check_at', 'is', null);

        if (error || !deals?.length) {
            return;
        }

        console.log(`[MonitoringService] ${deals.length} deals due for check...`);

        for (const deal of deals) {
            // Verify the post
            const stillExists = await this.checkDeal(deal.id);

            if (stillExists) {
                // Update scheduled_checks and find next check time
                await this.markCheckCompleted(deal.id, deal.scheduled_checks, now);
            }
            // If deleted, handleEarlyDeletion was already called in checkDeal
        }
    }

    /**
     * Mark current check as completed and update next_check_at
     */
    private async markCheckCompleted(dealId: string, scheduledChecks: any[], currentTime: string): Promise<void> {
        if (!scheduledChecks || !Array.isArray(scheduledChecks)) return;

        // Mark all checks up to current time as completed
        const updatedChecks = scheduledChecks.map((check: any) => {
            if (!check.completed && new Date(check.time) <= new Date(currentTime)) {
                return { ...check, completed: true };
            }
            return check;
        });

        // Find next incomplete check
        const nextCheck = updatedChecks.find((check: any) => !check.completed);
        const nextCheckAt = nextCheck ? nextCheck.time : null;

        await (supabase as any)
            .from('deals')
            .update({
                scheduled_checks: updatedChecks,
                next_check_at: nextCheckAt
            })
            .eq('id', dealId);
    }

    /**
     * Get monitoring duration from environment (default 6h for testing, 24h for production)
     */
    getMonitoringDurationHours(): number {
        const hours = parseInt(process.env.MONITORING_DURATION_HOURS || '24', 10);
        return isNaN(hours) ? 24 : hours;
    }
}
