/**
 * TON Webhook Routes
 * Receives real-time transaction notifications from TonAPI
 */

import { Hono } from 'hono';
import { DealService } from '../services/DealService';
import { SupabaseDealRepository } from '../repositories/supabase/SupabaseDealRepository';
import { SupabaseCampaignRepository } from '../repositories/supabase/SupabaseCampaignRepository';
import { Address } from '@ton/core';

const app = new Hono();
const dealService = new DealService(new SupabaseDealRepository());
const campaignRepository = new SupabaseCampaignRepository();

// Platform wallet address - parsed once at startup
const PLATFORM_WALLET = process.env.MASTER_WALLET_ADDRESS || '';
let PLATFORM_ADDRESS: Address | null = null;
try {
    if (PLATFORM_WALLET) {
        PLATFORM_ADDRESS = Address.parse(PLATFORM_WALLET);
    }
} catch (error) {
    console.error('[Webhook] Invalid MASTER_WALLET_ADDRESS format!');
}

/**
 * Check if two TON addresses are equal using @ton/core
 */
function addressesEqual(addr1: string, addr2: string | Address): boolean {
    try {
        const address1 = Address.parse(addr1);
        const address2 = typeof addr2 === 'string' ? Address.parse(addr2) : addr2;
        return address1.equals(address2);
    } catch (error) {
        return false;
    }
}

interface AccountTxNotification {
    account_id: string;
    lt: string;
    tx_hash: string;
}

/**
 * Webhook endpoint for TonAPI account-tx notifications
 * TonAPI sends: { account_id, lt, tx_hash }
 * We need to fetch full transaction details to get memo/comment
 */
app.post('/ton', async (c) => {
    try {
        const payload: AccountTxNotification = await c.req.json();

        console.log('[Webhook] Received notification:', payload);

        // Validate payload
        if (!payload.tx_hash || !payload.account_id) {
            console.error('[Webhook] Invalid payload');
            return c.json({ error: 'Invalid payload' }, 400);
        }

        // Fetch full transaction details from TonAPI
        const txDetails = await fetchTransactionDetails(payload.tx_hash);

        if (!txDetails) {
            console.error('[Webhook] Failed to fetch transaction details');
            return c.json({ error: 'Failed to fetch tx' }, 500);
        }

        // Process based on transaction type
        if (txDetails.in_msg?.decoded_op_name === 'jetton_transfer') {
            await processJettonTransfer(txDetails);
        } else {
            await processTonTransfer(txDetails);
        }

        return c.json({ ok: true });

    } catch (error: any) {
        console.error('[Webhook] Error:', error.message);
        return c.json({ error: 'Processing failed' }, 500);
    }
});

/**
 * Fetch full transaction details from TonAPI
 */
async function fetchTransactionDetails(txHash: string) {
    const apiKey = process.env.TONAPI_KEY || '';

    try {
        const response = await fetch(
            `https://tonapi.io/v2/blockchain/transactions/${txHash}`,
            {
                headers: apiKey ? { 'Authorization': `Bearer ${apiKey}` } : {}
            }
        );

        if (!response.ok) {
            console.error('[Webhook] TonAPI error:', response.status);
            return null;
        }

        return await response.json();
    } catch (error) {
        console.error('[Webhook] Fetch error:', error);
        return null;
    }
}

/**
 * Process native TON transfer
 */
async function processTonTransfer(tx: any) {
    const inMsg = tx.in_msg;

    if (!inMsg) {
        console.log('[Webhook] No incoming message');
        return;
    }

    // Get destination address and compare with @ton/core
    const destination = inMsg.destination?.address;
    if (!destination || !PLATFORM_ADDRESS || !addressesEqual(destination, PLATFORM_ADDRESS)) {
        console.log('[Webhook] Not to platform wallet, ignoring');
        return;
    }

    const tonAmount = Number(inMsg.value || 0) / 1e9;
    const comment = (inMsg.decoded_body?.text || '').trim();

    console.log('[Webhook] 💎 TON transfer:', { amount: tonAmount, comment });

    // Handle campaign escrow deposits
    if (comment.startsWith('campaign_')) {
        await processCampaignPayment(comment, tonAmount, tx.hash);
        return;
    }

    // Handle deal payments
    if (comment.startsWith('deal_')) {
        try {
            await dealService.confirmPayment(comment, tx.hash);
            console.log(`[Webhook] ✅ Deal payment confirmed: ${tonAmount} TON for ${comment}`);
        } catch (error: any) {
            if (error.message.includes('not in pending status')) {
                console.log(`[Webhook] ℹ️ Deal ${comment} already processed`);
            } else {
                console.error('[Webhook] ❌ Error confirming deal:', error.message);
            }
        }
        return;
    }

    console.log('[Webhook] No recognized memo prefix');
}

/**
 * Process campaign escrow payment
 */
async function processCampaignPayment(memo: string, amount: number, txHash: string) {
    try {
        const campaign = await campaignRepository.findByPaymentMemo(memo);

        if (!campaign) {
            console.error('[Webhook] ❌ Campaign not found for memo:', memo);
            return;
        }

        // ✅ Idempotency check - don't process twice
        if (campaign.escrowDeposited && campaign.escrowDeposited > 0) {
            console.log(`[Webhook] ℹ️ Campaign ${memo} already funded, ignoring duplicate`);
            return;
        }

        // ✅ Amount validation
        if (amount < campaign.totalBudget) {
            console.warn('[Webhook] ⚠️ Partial payment:', {
                expected: campaign.totalBudget,
                received: amount,
                campaignId: campaign.id
            });
            // For MVP: Log and continue - manual review may be needed
            // In production: could set status to 'partially_funded'
        }

        // ✅ Update campaign - activate it
        await campaignRepository.confirmEscrowDeposit(campaign.id, amount, txHash);

        console.log(`[Webhook] ✅ Campaign funded: ${amount} TON for ${memo}`);
    } catch (error: any) {
        console.error('[Webhook] ❌ Error processing campaign payment:', error.message);
    }
}

/**
 * Process Jetton (USDT) transfer
 */
async function processJettonTransfer(tx: any) {
    const inMsg = tx.in_msg;

    if (!inMsg) {
        console.log('[Webhook] No incoming message');
        return;
    }

    // Parse Jetton transfer details
    const decoded = inMsg.decoded_body;
    if (!decoded) {
        console.log('[Webhook] No decoded body');
        return;
    }

    // Extract amount and forward_payload comment
    const amount = Number(decoded.amount || 0) / 1e6; // USDT has 6 decimals
    const comment = decoded.forward_payload?.text || decoded.comment || '';

    console.log('[Webhook] USDT transfer:', { amount, comment });

    // Handle campaign escrow payments with USDT
    if (comment.startsWith('campaign_')) {
        await processCampaignPayment(comment, amount, tx.hash);
        return;
    }

    // Handle deal payments with USDT
    if (comment.startsWith('deal_')) {
        try {
            await dealService.confirmPayment(comment, tx.hash);
            console.log(`[Webhook] ✅ USDT payment confirmed: ${amount} USDT for ${comment}`);
        } catch (error: any) {
            if (!error.message.includes('not in pending status')) {
                console.error('[Webhook] Error confirming:', error.message);
            }
        }
        return;
    }

    console.log('[Webhook] No recognized memo prefix for USDT');
}

export default app;
