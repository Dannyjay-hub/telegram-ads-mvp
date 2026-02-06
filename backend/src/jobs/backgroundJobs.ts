import { AutoPostService } from '../services/AutoPostService';
import { MonitoringService } from '../services/MonitoringService';
import { supabase } from '../db';

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

    // Run immediately on startup
    runAutoPosting();
    runMonitoring();
    runTimeouts();

    console.log('[BackgroundJobs] ✅ Background jobs started');
}

export { runAutoPosting, runMonitoring, runTimeouts };
