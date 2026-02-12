/**
 * Backfill escrow_wallet_address for campaigns that have escrow_tx_hash but no wallet
 * Uses TonAPI to look up the sender from each transaction
 */
import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config();

const supabase = createClient(
    process.env.SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
);

async function backfill() {
    console.log('=== BACKFILL WALLET ADDRESSES ===\n');

    // Get all campaigns with tx hash but no wallet address
    const { data: campaigns } = await supabase
        .from('campaigns')
        .select('id, status, escrow_tx_hash, escrow_wallet_address, escrow_deposited, currency')
        .not('escrow_tx_hash', 'is', null)
        .is('escrow_wallet_address', null);

    if (!campaigns || campaigns.length === 0) {
        console.log('✅ No campaigns need backfill');
        return;
    }

    console.log(`Found ${campaigns.length} campaign(s) to backfill:\n`);

    for (const campaign of campaigns) {
        console.log(`Campaign ${campaign.id} (${campaign.status}):`);
        console.log(`  TX: ${campaign.escrow_tx_hash}`);

        try {
            const resp = await fetch(`https://tonapi.io/v2/events/${campaign.escrow_tx_hash}`, {
                headers: {
                    'Accept': 'application/json',
                    ...(process.env.TONAPI_KEY ? { 'Authorization': `Bearer ${process.env.TONAPI_KEY}` } : {})
                }
            });

            if (!resp.ok) {
                console.log(`  ❌ TonAPI returned ${resp.status}`);
                continue;
            }

            const data = await resp.json() as any;
            const action = data.actions?.[0];
            let senderAddress: string | null = null;

            if (action?.TonTransfer?.sender?.address) {
                senderAddress = action.TonTransfer.sender.address;
            } else if (action?.JettonTransfer?.sender?.address) {
                senderAddress = action.JettonTransfer.sender.address;
            }

            if (senderAddress) {
                console.log(`  ✅ Resolved sender: ${senderAddress}`);

                const { error } = await supabase
                    .from('campaigns')
                    .update({ escrow_wallet_address: senderAddress })
                    .eq('id', campaign.id);

                if (error) {
                    console.log(`  ❌ Failed to update: ${error.message}`);
                } else {
                    console.log(`  ✅ Updated!`);
                }
            } else {
                console.log(`  ⚠️ Could not extract sender from TX actions`);
                console.log(`  Actions: ${JSON.stringify(data.actions?.map((a: any) => a.type))}`);
            }
        } catch (e: any) {
            console.log(`  ❌ Error: ${e.message}`);
        }

        // Rate limit TonAPI
        await new Promise(r => setTimeout(r, 500));
    }

    console.log('\n=== BACKFILL COMPLETE ===');
}

backfill().catch(console.error);
