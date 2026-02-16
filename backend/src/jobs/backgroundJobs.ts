import { AutoPostService } from '../services/AutoPostService';
import { MonitoringService } from '../services/MonitoringService';
import { supabase } from '../db';
import { bot } from '../botInstance';

/**
 * Background Jobs for Post-Escrow Workflow
 * 
 * These should be run via cron or a scheduler (e.g., every minute)
 * For MVP, we use setInterval when the server starts
 */

const autoPostService = new AutoPostService();
const monitoringService = new MonitoringService();

/**
 * Process scheduled posts - runs every minute
 */
async function runAutoPosting() {
    try {
        const count = await autoPostService.processScheduledDeals();
        if (count > 0) {
            console.log(`[BackgroundJobs] Posted ${count} scheduled deals`);
        }
    } catch (error) {
        console.error('[BackgroundJobs] Auto-posting failed:', error);
    }
}

/**
 * Process monitoring checks - runs every hour
 */
async function runMonitoring() {
    try {
        await monitoringService.processMonitoringDeals();
    } catch (error) {
        console.error('[BackgroundJobs] Monitoring failed:', error);
    }
}

/**
 * Process timeouts - runs every hour
 * - Draft pending > 12h → refund
 * - Draft submitted (no review) > 12h → auto-approve
 */
async function runTimeouts() {
    const TWELVE_HOURS_AGO = new Date(Date.now() - 12 * 60 * 60 * 1000).toISOString();

    try {
        // Find deals stuck in draft_pending too long
        const { data: stuckDrafts } = await (supabase as any)
            .from('deals')
            .select('id, advertiser_id')
            .eq('status', 'draft_pending')
            .lt('funded_at', TWELVE_HOURS_AGO);

        for (const deal of stuckDrafts || []) {
            console.log(`[BackgroundJobs] Refunding deal ${deal.id} - no draft after 12h`);
            // TODO: Trigger refund process
            await (supabase as any)
                .from('deals')
                .update({
                    status: 'refunded',
                    status_updated_at: new Date().toISOString()
                })
                .eq('id', deal.id);
        }

        // Find drafts waiting for review too long → cancel & refund
        const { data: pendingReviews } = await (supabase as any)
            .from('deals')
            .select('id, advertiser_id, price_amount, price_currency, advertiser_wallet_address')
            .eq('status', 'draft_submitted')
            .lt('draft_submitted_at', TWELVE_HOURS_AGO);

        for (const deal of pendingReviews || []) {
            console.log(`[BackgroundJobs] Cancelling deal ${deal.id} - no draft review after 12h`);
            await (supabase as any)
                .from('deals')
                .update({
                    status: 'refunded',
                    status_updated_at: new Date().toISOString()
                })
                .eq('id', deal.id);

            // Queue refund
            if (deal.advertiser_wallet_address && deal.price_amount > 0) {
                try {
                    await (supabase as any)
                        .from('pending_payouts')
                        .insert({
                            recipient_address: deal.advertiser_wallet_address,
                            amount_ton: deal.price_amount,
                            currency: deal.price_currency || 'TON',
                            type: 'refund',
                            status: 'pending',
                            reason: `Deal timeout: no draft review after 12h`,
                            memo: `timeout_refund_${deal.id.substring(0, 8)}`
                        });
                } catch (e: any) {
                    console.error(`[BackgroundJobs] Failed to queue refund for deal ${deal.id}:`, e.message);
                }
            }

            // Notify advertiser
            if (bot && deal.advertiser_id) {
                const { data: advertiser } = await (supabase as any)
                    .from('users')
                    .select('telegram_id')
                    .eq('id', deal.advertiser_id)
                    .single();
                if (advertiser?.telegram_id) {
                    try {
                        await bot.api.sendMessage(
                            advertiser.telegram_id,
                            `⏰ **Deal Cancelled — Draft Review Timeout**\n\nYour submitted draft received no review within 12 hours. The deal has been cancelled and your escrow of **${deal.price_amount} ${deal.price_currency || 'TON'}** will be refunded.`,
                            { parse_mode: 'Markdown' }
                        );
                    } catch (e) { /* ignore send errors */ }
                }
            }
        }

        // ── Funded too long (48h) → auto-refund ──
        const FORTYEIGHT_HOURS_AGO = new Date(Date.now() - 48 * 60 * 60 * 1000).toISOString();
        const { data: stuckFunded } = await (supabase as any)
            .from('deals')
            .select('id, advertiser_id')
            .eq('status', 'funded')
            .lt('funded_at', FORTYEIGHT_HOURS_AGO);

        for (const deal of stuckFunded || []) {
            console.log(`[BackgroundJobs] Refunding deal ${deal.id} - no channel owner response after 48h`);
            await (supabase as any)
                .from('deals')
                .update({
                    status: 'refunded',
                    status_updated_at: new Date().toISOString()
                })
                .eq('id', deal.id);
        }

        // ── Scheduling too long (24h) → cancel & refund ──
        const TWENTYFOUR_HOURS_AGO = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
        const { data: stuckScheduling } = await (supabase as any)
            .from('deals')
            .select('id, advertiser_id, price_amount, price_currency, advertiser_wallet_address, proposed_post_time')
            .eq('status', 'scheduling')
            .not('proposed_post_time', 'is', null)
            .lt('status_updated_at', TWENTYFOUR_HOURS_AGO);

        for (const deal of stuckScheduling || []) {
            console.log(`[BackgroundJobs] Cancelling deal ${deal.id} - no scheduling response after 24h`);
            await (supabase as any)
                .from('deals')
                .update({
                    status: 'refunded',
                    status_updated_at: new Date().toISOString()
                })
                .eq('id', deal.id);

            // Queue refund
            if (deal.advertiser_wallet_address && deal.price_amount > 0) {
                try {
                    await (supabase as any)
                        .from('pending_payouts')
                        .insert({
                            recipient_address: deal.advertiser_wallet_address,
                            amount_ton: deal.price_amount,
                            currency: deal.price_currency || 'TON',
                            type: 'refund',
                            status: 'pending',
                            reason: `Deal timeout: no scheduling response after 24h`,
                            memo: `timeout_refund_${deal.id.substring(0, 8)}`
                        });
                } catch (e: any) {
                    console.error(`[BackgroundJobs] Failed to queue refund for deal ${deal.id}:`, e.message);
                }
            }

            // Notify advertiser
            if (bot && deal.advertiser_id) {
                const { data: advertiser } = await (supabase as any)
                    .from('users')
                    .select('telegram_id')
                    .eq('id', deal.advertiser_id)
                    .single();
                if (advertiser?.telegram_id) {
                    try {
                        await bot.api.sendMessage(
                            advertiser.telegram_id,
                            `⏰ **Deal Cancelled — Scheduling Timeout**\n\nNo response to the proposed posting time within 24 hours. The deal has been cancelled and your escrow of **${deal.price_amount} ${deal.price_currency || 'TON'}** will be refunded.`,
                            { parse_mode: 'Markdown' }
                        );
                    } catch (e) { /* ignore send errors */ }
                }
            }
        }

    } catch (error) {
        console.error('[BackgroundJobs] Timeout processing failed:', error);
    }
}

/**
 * Check campaign expirations - runs every hour
 * - Notify advertisers 24h before expiry
 * - Auto-expire campaigns past their deadline
 */
async function runCampaignExpiration() {
    try {
        const now = new Date();
        const in24h = new Date(now.getTime() + 24 * 60 * 60 * 1000);

        // 1. Find active campaigns expiring within 24h (not yet notified)
        const { data: expiringSoon } = await (supabase as any)
            .from('campaigns')
            .select('id, title, expires_at, advertiser_id, expiry_notified')
            .eq('status', 'active')
            .not('expires_at', 'is', null)
            .lte('expires_at', in24h.toISOString())
            .gt('expires_at', now.toISOString());

        for (const campaign of expiringSoon || []) {
            if (campaign.expiry_notified) continue;

            // Send notification to advertiser
            if (bot && campaign.advertiser_id) {
                const { data: advertiser } = await (supabase as any)
                    .from('users')
                    .select('telegram_id')
                    .eq('id', campaign.advertiser_id)
                    .single();

                if (advertiser?.telegram_id) {
                    const hoursLeft = Math.round(
                        (new Date(campaign.expires_at).getTime() - now.getTime()) / (1000 * 60 * 60)
                    );
                    try {
                        await bot.api.sendMessage(
                            advertiser.telegram_id,
                            `⏰ **Campaign Expiring Soon!**\n\nYour campaign **"${campaign.title}"** expires in ~${hoursLeft} hours.\n\nOpen the app to extend it if you'd like to keep receiving applications.`,
                            { parse_mode: 'Markdown' }
                        );
                    } catch (e) { /* ignore send errors */ }
                }
            }

            // Mark as notified
            await (supabase as any)
                .from('campaigns')
                .update({ expiry_notified: true })
                .eq('id', campaign.id);

            console.log(`[BackgroundJobs] Notified advertiser about expiring campaign ${campaign.id}`);
        }

        // 2. Auto-expire campaigns past their deadline
        const { data: expired } = await (supabase as any)
            .from('campaigns')
            .select('id')
            .eq('status', 'active')
            .not('expires_at', 'is', null)
            .lt('expires_at', now.toISOString());

        for (const campaign of expired || []) {
            await (supabase as any)
                .from('campaigns')
                .update({ status: 'expired' })
                .eq('id', campaign.id);
            console.log(`[BackgroundJobs] Expired campaign ${campaign.id}`);
        }

        // 3. Auto-end expired campaigns past 24h grace period
        // These campaigns had their chance to extend — now we end them and refund
        const grace24hAgo = new Date(now.getTime() - 24 * 60 * 60 * 1000);
        const { data: pastGrace } = await (supabase as any)
            .from('campaigns')
            .select('id, title, advertiser_id, total_budget, slots, slots_filled, per_channel_budget, currency, escrow_wallet_address, expires_at')
            .eq('status', 'expired')
            .not('expires_at', 'is', null)
            .lt('expires_at', grace24hAgo.toISOString());

        for (const campaign of pastGrace || []) {
            const slotsLeft = campaign.slots - (campaign.slots_filled || 0);
            const refundAmount = slotsLeft * parseFloat(campaign.per_channel_budget || 0);

            // Queue refund if there's money to return
            if (refundAmount > 0 && campaign.escrow_wallet_address) {
                try {
                    await (supabase as any)
                        .from('pending_payouts')
                        .insert({
                            recipient_address: campaign.escrow_wallet_address,
                            amount_ton: refundAmount,
                            currency: campaign.currency || 'TON',
                            type: 'refund',
                            status: 'pending',
                            reason: `Campaign auto-ended after 24h grace: refund for ${slotsLeft} unfilled slot${slotsLeft > 1 ? 's' : ''}`,
                            memo: `campaign_refund_${campaign.id.substring(0, 8)}`
                        });
                } catch (e: any) {
                    console.error(`[BackgroundJobs] Failed to queue refund for campaign ${campaign.id}:`, e.message);
                }
            }

            // End the campaign
            await (supabase as any)
                .from('campaigns')
                .update({
                    status: 'ended',
                    refund_amount: refundAmount,
                    ended_at: now.toISOString()
                })
                .eq('id', campaign.id);

            // Notify advertiser
            if (bot && campaign.advertiser_id) {
                const { data: advertiser } = await (supabase as any)
                    .from('users')
                    .select('telegram_id')
                    .eq('id', campaign.advertiser_id)
                    .single();

                if (advertiser?.telegram_id) {
                    const refundMsg = refundAmount > 0
                        ? `\n\n💰 **${refundAmount} ${campaign.currency || 'TON'}** will be refunded for ${slotsLeft} unfilled slot${slotsLeft > 1 ? 's' : ''}.`
                        : '\n\nAll slots were used — no refund needed.';
                    try {
                        await bot.api.sendMessage(
                            advertiser.telegram_id,
                            `🔴 **Campaign Ended**\n\nYour campaign **"${campaign.title}"** has been automatically ended after the 24-hour grace period expired.${refundMsg}\n\nYou can duplicate this campaign from the app to run it again.`,
                            { parse_mode: 'Markdown' }
                        );
                    } catch (e) { /* ignore send errors */ }
                }
            }

            console.log(`[BackgroundJobs] Auto-ended campaign ${campaign.id}. Refund: ${refundAmount} ${campaign.currency || 'TON'}`);
        }

    } catch (error) {
        console.error('[BackgroundJobs] Campaign expiration check failed:', error);
    }
}

/**
 * Start all background jobs
 * Call this from your main server startup
 */
export function startBackgroundJobs() {
    console.log('[BackgroundJobs] Starting background job scheduler...');

    // Auto-posting: every 60 seconds
    setInterval(runAutoPosting, 60 * 1000);

    // Monitoring: every hour
    setInterval(runMonitoring, 60 * 60 * 1000);

    // Timeouts: every hour
    setInterval(runTimeouts, 60 * 60 * 1000);

    // Campaign expiration: every hour
    setInterval(runCampaignExpiration, 60 * 60 * 1000);

    // Run immediately on startup
    runAutoPosting();
    runMonitoring();
    runTimeouts();
    runCampaignExpiration();

    console.log('[BackgroundJobs] ✅ Background jobs started');
}

export { runAutoPosting, runMonitoring, runTimeouts, runCampaignExpiration };
