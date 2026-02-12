/**
 * Clean up orphaned applications (deal_id is null) and verify state
 */
import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config();

const supabase = createClient(
    process.env.SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
);

async function cleanup() {
    console.log('=== CLEANUP ORPHANED APPLICATIONS ===\n');

    // Find all pending applications with no deal
    const { data: orphaned } = await supabase
        .from('campaign_applications')
        .select('id, campaign_id, channel_id, status, deal_id, applied_at')
        .eq('status', 'pending')
        .is('deal_id', null);

    console.log(`Found ${orphaned?.length || 0} orphaned application(s):`);

    if (orphaned && orphaned.length > 0) {
        for (const app of orphaned) {
            console.log(`  - ${app.id} (campaign: ${app.campaign_id.substring(0, 8)}, channel: ${app.channel_id.substring(0, 8)}, applied: ${app.applied_at})`);
        }

        // Delete them
        const ids = orphaned.map(a => a.id);
        const { error } = await supabase
            .from('campaign_applications')
            .delete()
            .in('id', ids);

        if (error) {
            console.log(`\n❌ Failed to delete: ${error.message}`);
        } else {
            console.log(`\n✅ Deleted ${ids.length} orphaned application(s)`);
        }
    }

    // Verify
    const { data: remaining } = await supabase
        .from('campaign_applications')
        .select('id, status, deal_id')
        .eq('status', 'pending')
        .is('deal_id', null);

    console.log(`\nRemaining orphaned: ${remaining?.length || 0}`);

    console.log('\n=== DONE ===');
}

cleanup().catch(console.error);
