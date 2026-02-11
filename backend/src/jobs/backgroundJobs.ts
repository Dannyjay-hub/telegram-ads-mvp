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

        // Find drafts waiting for review too long
        const { data: pendingReviews } = await (supabase as any)
            .from('deals')
            .select('id')
            .eq('status', 'draft_submitted')
            .lt('draft_submitted_at', TWELVE_HOURS_AGO);

        for (const deal of pendingReviews || []) {
            console.log(`[BackgroundJobs] Auto-approving deal ${deal.id} - no review after 12h`);
            await (supabase as any)
                .from('deals')
                .update({
                    status: 'scheduling',
                    status_updated_at: new Date().toISOString()
                })
                .eq('id', deal.id);
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
