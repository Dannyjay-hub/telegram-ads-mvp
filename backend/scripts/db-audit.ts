/**
 * Database Cleanup Audit Script
 * Checks for orphaned records, stuck payouts, and data integrity issues
 */
import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config();

const supabase = createClient(
    process.env.SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
);

async function audit() {
    console.log('=== DATABASE AUDIT ===\n');
    let issues = 0;

    // 1. Orphaned deals — deals referencing channels that don't exist
    console.log('--- 1. Orphaned Deals (channel deleted) ---');
    const { data: allDeals } = await supabase
        .from('deals')
        .select('id, status, channel_id, campaign_id, price_amount, price_currency, advertiser_wallet_address, created_at');
    const { data: allChannels } = await supabase
        .from('channels')
        .select('id');

    const channelIds = new Set((allChannels || []).map(c => c.id));
    const orphanedDeals = (allDeals || []).filter(d => d.channel_id && !channelIds.has(d.channel_id));
    if (orphanedDeals.length > 0) {
        console.log(`  ⚠️ ${orphanedDeals.length} deal(s) reference deleted channels:`);
        orphanedDeals.forEach(d => console.log(`     - ${d.id} (status: ${d.status}, channel: ${d.channel_id})`));
        issues += orphanedDeals.length;
    } else {
        console.log('  ✅ No orphaned deals');
    }

    // 2. Stuck pending payouts
    console.log('\n--- 2. Pending Payouts ---');
    const { data: payouts } = await supabase
        .from('pending_payouts')
        .select('id, deal_id, amount_ton, currency, type, status, reason, error_message, created_at, retry_count')
        .order('created_at', { ascending: false });

    if (payouts && payouts.length > 0) {
        const stuck = payouts.filter((p: any) => ['pending', 'pending_approval', 'processing'].includes(p.status));
        const failed = payouts.filter((p: any) => p.status === 'failed');
        const completed = payouts.filter((p: any) => p.status === 'completed');

        console.log(`  Total: ${payouts.length} (✅ ${completed.length} completed, ⏳ ${stuck.length} stuck, ❌ ${failed.length} failed)`);

        if (stuck.length > 0) {
            console.log('  ⚠️ Stuck payouts:');
            stuck.forEach((p: any) => console.log(`     - ${p.id} | ${p.amount_ton} ${p.currency} | ${p.type} | status: ${p.status} | ${p.reason}`));
            issues += stuck.length;
        }
        if (failed.length > 0) {
            console.log('  ❌ Failed payouts:');
            failed.forEach((p: any) => console.log(`     - ${p.id} | ${p.amount_ton} ${p.currency} | ${p.type} | error: ${p.error_message} | retries: ${p.retry_count}`));
            issues += failed.length;
        }
    } else {
        console.log('  ✅ No pending payouts');
    }

    // 3. Campaigns in bad states
    console.log('\n--- 3. Campaigns ---');
    const { data: campaigns } = await supabase
        .from('campaigns')
        .select('id, title, status, escrow_wallet_address, escrow_deposited, escrow_tx_hash, total_budget, slots, slots_filled, currency, refund_amount')
        .order('created_at', { ascending: false });

    if (campaigns && campaigns.length > 0) {
        // Ended campaigns without wallet address (can't refund)
        const endedNoWallet = campaigns.filter((c: any) => c.status === 'ended' && !c.escrow_wallet_address && c.refund_amount > 0);
        // Active campaigns without escrow deposit
        const activeNoDeposit = campaigns.filter((c: any) => c.status === 'active' && (!c.escrow_deposited || c.escrow_deposited === 0));
        // Draft campaigns (stale)
        const drafts = campaigns.filter((c: any) => c.status === 'draft');

        console.log(`  Total: ${campaigns.length}`);
        campaigns.forEach((c: any) => {
            const walletFlag = c.escrow_wallet_address ? '✅' : '⚠️ no wallet';
            console.log(`     - ${c.id.substring(0, 8)}... | ${c.status.padEnd(10)} | ${c.escrow_deposited || 0} ${c.currency} deposited | ${c.slots_filled || 0}/${c.slots} slots | ${walletFlag}`);
        });

        if (endedNoWallet.length > 0) {
            console.log(`  ⚠️ ${endedNoWallet.length} ended campaign(s) with refund due but no wallet address!`);
            issues += endedNoWallet.length;
        }
        if (activeNoDeposit.length > 0) {
            console.log(`  ⚠️ ${activeNoDeposit.length} active campaign(s) with no escrow deposit`);
            issues += activeNoDeposit.length;
        }
        if (drafts.length > 0) {
            console.log(`  ℹ️ ${drafts.length} draft campaign(s) — consider cleanup if stale`);
        }
    }

    // 4. Deals in active states with no channel
    console.log('\n--- 4. Active Deals Integrity ---');
    const activeStates = ['funded', 'draft_pending', 'draft_submitted', 'changes_requested', 'approved', 'scheduling', 'scheduled', 'posted', 'monitoring'];
    const activeDeals = (allDeals || []).filter(d => activeStates.includes(d.status));
    if (activeDeals.length > 0) {
        console.log(`  ${activeDeals.length} active deal(s):`);
        activeDeals.forEach(d => {
            const hasChannel = channelIds.has(d.channel_id);
            const flag = hasChannel ? '✅' : '❌ ORPHANED';
            console.log(`     - ${d.id.substring(0, 8)}... | ${d.status.padEnd(16)} | ${d.price_amount} ${d.price_currency} | ${flag}`);
        });
    } else {
        console.log('  ✅ No active deals');
    }

    // 5. Deals in terminal states (for reference)
    console.log('\n--- 5. Terminal Deals Summary ---');
    const terminalStates = ['released', 'cancelled', 'rejected', 'refunded', 'failed_to_post'];
    const terminalDeals = (allDeals || []).filter(d => terminalStates.includes(d.status));
    const statusCounts: Record<string, number> = {};
    terminalDeals.forEach(d => { statusCounts[d.status] = (statusCounts[d.status] || 0) + 1; });
    Object.entries(statusCounts).forEach(([status, count]) => {
        console.log(`     ${status}: ${count}`);
    });

    // 6. All deals summary by status
    console.log('\n--- 6. All Deals by Status ---');
    const allStatusCounts: Record<string, number> = {};
    (allDeals || []).forEach(d => { allStatusCounts[d.status] = (allStatusCounts[d.status] || 0) + 1; });
    Object.entries(allStatusCounts).sort().forEach(([status, count]) => {
        console.log(`     ${status}: ${count}`);
    });

    console.log(`\n=== AUDIT COMPLETE: ${issues} issue(s) found ===`);
}

audit().catch(console.error);
