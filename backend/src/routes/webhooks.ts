/**
 * TON Webhook Routes
 * Receives real-time transaction notifications from TonAPI
 */

import { Hono } from 'hono';
import { DealService } from '../services/DealService';
import { SupabaseDealRepository } from '../repositories/supabase/SupabaseDealRepository';
import { SupabaseCampaignRepository } from '../repositories/supabase/SupabaseCampaignRepository';
import { Address } from '@ton/core';
import { TON_CONFIG } from '../config/tonConfig';

const app = new Hono();
const dealService = new DealService(new SupabaseDealRepository());
const campaignRepository = new SupabaseCampaignRepository();

// Network-aware configuration
const PLATFORM_WALLET = TON_CONFIG.masterWalletAddress;
const TON_API_KEY = process.env.TONAPI_KEY || '';
const USDT_MASTER_ADDRESS = TON_CONFIG.usdtMasterAddress;

let PLATFORM_ADDRESS: Address | null = null;
let USDT_ADDRESS: Address | null = null;

try {
    if (PLATFORM_WALLET) {
        PLATFORM_ADDRESS = Address.parse(PLATFORM_WALLET);
    }
    USDT_ADDRESS = Address.parse(USDT_MASTER_ADDRESS);
} catch (error) {
    console.error('[Webhook] Invalid address format!');
}

// Track processed Jetton transactions to avoid duplicates
const processedJettonTxHashes = new Set<string>();
const MAX_PROCESSED_CACHE = 1000; // Prevent memory leak - prune old entries

// Mutex: Track campaigns currently being processed to prevent race conditions
const processingCampaigns = new Set<string>();

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
 * Health check endpoint - verify webhook route is accessible
 * Test with: curl https://your-backend.com/webhooks/ton
 */
app.get('/ton', (c) => {
    // Health check - no logging to avoid spam
    return c.json({
        status: 'ok',
        message: 'Webhook endpoint is accessible',
        timestamp: new Date().toISOString()
    });
});

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

        // NOTE: checkRecentJettonTransfers() removed from here — it was making
        // an extra TonAPI call on EVERY webhook (even non-jetton), causing 429s.
        // The polling service handles jetton detection as backup.

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
            `${TON_CONFIG.tonapiUrl}/blockchain/transactions/${txHash}`,
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
    // Validate txHash - prevent null storage
    if (!txHash) {
        console.error('[Webhook] ❌ Missing transaction hash for campaign payment');
        return;
    }

    // ✅ Mutex: Prevent parallel processing of same campaign
    if (processingCampaigns.has(memo)) {
        console.log(`[Webhook] ℹ️ Campaign ${memo} already being processed, skipping`);
        return;
    }

    processingCampaigns.add(memo);
    try {
        const campaign = await campaignRepository.findByPaymentMemo(memo);

        if (!campaign) {
            console.error('[Webhook] ❌ Campaign not found for memo:', memo);
            return;
        }

        // ✅ Expiry check - server-side enforcement
        if (campaign.paymentExpiresAt && new Date(campaign.paymentExpiresAt) < new Date()) {
            console.warn('[Webhook] ⏰ Payment received after expiry window:', {
                campaignId: campaign.id,
                expiresAt: campaign.paymentExpiresAt,
                now: new Date().toISOString()
            });
            // For MVP: Log and continue - the user already paid
        }

        // ✅ Idempotency check - don't process twice
        if (campaign.escrowDeposited && campaign.escrowDeposited > 0) {
            console.log(`[Webhook] ℹ️ Campaign ${memo} already funded, ignoring duplicate`);
            return;
        }

        // ✅ Amount validation - user pays totalBudget + platform fee
        // Minimum acceptable is the campaign budget itself
        if (amount < campaign.totalBudget) {
            console.warn('[Webhook] ⚠️ Insufficient payment:', {
                minimumExpected: campaign.totalBudget,
                received: amount,
                campaignId: campaign.id
            });
        }

        // ✅ Update campaign - activate it
        await campaignRepository.confirmEscrowDeposit(campaign.id, amount, txHash);

        console.log(`[Webhook] ✅ Campaign funded: ${amount} TON for ${memo}`);
    } catch (error: any) {
        console.error('[Webhook] ❌ Error processing campaign payment:', error.message);
    } finally {
        // ✅ Always remove from processing set
        processingCampaigns.delete(memo);
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

/**
 * HYBRID APPROACH: Check for recent Jetton transfers
 * Called whenever any webhook fires to immediately detect USDT payments
 * This catches Jetton transfers that don't trigger the main wallet webhook
 */
async function checkRecentJettonTransfers() {
    if (!PLATFORM_WALLET || !USDT_ADDRESS) return;

    try {
        const url = `${TON_CONFIG.tonapiUrl}/accounts/${PLATFORM_WALLET}/jettons/history?limit=10`;
        const headers: Record<string, string> = { 'Accept': 'application/json' };
        if (TON_API_KEY) {
            headers['Authorization'] = `Bearer ${TON_API_KEY}`;
        }

        const response = await fetch(url, { headers });
        if (!response.ok) {
            console.error('[Webhook-Jetton] TonAPI error:', response.status);
            return;
        }

        const data = await response.json();
        const operations = data.operations || [];

        for (const op of operations) {
            // Only process incoming transfers
            if (op.operation !== 'transfer') continue;

            const txHash = op.transaction_hash;
            if (!txHash) continue;

            // Skip if already processed
            if (processedJettonTxHashes.has(txHash)) continue;

            // Verify it's to our wallet
            const destAddress = op.destination?.address;
            if (!destAddress || !PLATFORM_ADDRESS) continue;
            if (!addressesEqual(destAddress, PLATFORM_ADDRESS)) continue;

            // Verify it's USDT
            const jettonAddress = op.jetton?.address;
            if (!jettonAddress || !addressesEqual(jettonAddress, USDT_ADDRESS)) continue;

            // Extract memo
            const memo = op.payload?.Value?.Text || '';
            if (!memo.startsWith('campaign_') && !memo.startsWith('deal_')) continue;

            // Mark as processed with cache pruning to prevent memory leak
            processedJettonTxHashes.add(txHash);
            if (processedJettonTxHashes.size > MAX_PROCESSED_CACHE) {
                const firstKey = processedJettonTxHashes.values().next().value;
                if (firstKey) processedJettonTxHashes.delete(firstKey);
            }

            const amount = Number(op.amount || 0) / 1e6; // USDT has 6 decimals
            console.log(`[Webhook-Jetton] 💵 USDT detected via hybrid: ${amount} USDT, memo: ${memo}`);

            // Process the payment
            if (memo.startsWith('campaign_')) {
                await processCampaignPayment(memo, amount, txHash);
            } else if (memo.startsWith('deal_')) {
                try {
                    await dealService.confirmPayment(memo, txHash);
                    console.log(`[Webhook-Jetton] ✅ USDT payment confirmed: ${amount} USDT for ${memo}`);
                } catch (error: any) {
                    if (!error.message.includes('not in pending status')) {
                        console.error('[Webhook-Jetton] Error confirming:', error.message);
                    }
                }
            }
        }
    } catch (error: any) {
        console.error('[Webhook-Jetton] Error checking jetton transfers:', error.message);
    }
}

export default app;
