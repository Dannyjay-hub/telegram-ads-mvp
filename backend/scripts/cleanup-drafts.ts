/**
 * Cleanup stale draft deals and draft campaigns
 */
import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config();

const supabase = createClient(
    process.env.SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
);

async function cleanup() {
    console.log('=== CLEANUP STALE DRAFTS ===\n');

    // 1. Delete draft deals
    console.log('--- Draft Deals ---');
    const { data: draftDeals } = await supabase
        .from('deals')
        .select('id, status, created_at')
        .eq('status', 'draft');

    if (draftDeals && draftDeals.length > 0) {
        console.log(`Found ${draftDeals.length} draft deal(s) to remove`);

        // Delete related records first (foreign key constraints)
        const dealIds = draftDeals.map(d => d.id);

        // user_contexts referencing these deals
        const { error: ctxErr } = await supabase
            .from('user_contexts')
            .delete()
            .in('deal_id', dealIds);
        if (ctxErr) console.log(`  ⚠️ user_contexts cleanup: ${ctxErr.message}`);

        // deal_messages
        const { error: msgErr } = await supabase
            .from('deal_messages')
            .delete()
            .in('deal_id', dealIds);
        if (msgErr) console.log(`  ⚠️ deal_messages cleanup: ${msgErr.message}`);

        // pending_payouts
        const { error: payErr } = await supabase
            .from('pending_payouts')
            .delete()
            .in('deal_id', dealIds);
        if (payErr) console.log(`  ⚠️ pending_payouts cleanup: ${payErr.message}`);

        // Now delete the deals
        const { error: dealErr, count } = await supabase
            .from('deals')
            .delete()
            .eq('status', 'draft');

        if (dealErr) {
            console.log(`  ❌ Failed to delete draft deals: ${dealErr.message}`);
        } else {
            console.log(`  ✅ Deleted ${draftDeals.length} draft deal(s)`);
        }
    } else {
        console.log('  ✅ No draft deals to clean up');
    }

    // 2. Delete draft campaigns (unfunded only)
    console.log('\n--- Draft Campaigns ---');
    const { data: draftCampaigns } = await supabase
        .from('campaigns')
        .select('id, title, status, escrow_deposited')
        .eq('status', 'draft');

    if (draftCampaigns && draftCampaigns.length > 0) {
        const unfunded = draftCampaigns.filter((c: any) => !c.escrow_deposited || c.escrow_deposited === 0);
        console.log(`Found ${draftCampaigns.length} draft campaign(s), ${unfunded.length} unfunded`);

        for (const campaign of unfunded) {
            // Delete any deals linked to this campaign first
            await supabase.from('deals').delete().eq('campaign_id', campaign.id);

            const { error } = await supabase
                .from('campaigns')
                .delete()
                .eq('id', campaign.id);

            if (error) {
                console.log(`  ❌ Failed to delete ${campaign.id}: ${error.message}`);
            } else {
                console.log(`  ✅ Deleted campaign ${campaign.id} (${campaign.title || 'untitled'})`);
            }
        }
    } else {
        console.log('  ✅ No draft campaigns to clean up');
    }

    console.log('\n=== CLEANUP COMPLETE ===');
}

cleanup().catch(console.error);
