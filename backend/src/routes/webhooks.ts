/**
 * TON Webhook Routes
 * Receives real-time transaction notifications from TonAPI
 */

import { Hono } from 'hono';
import { DealService } from '../services/DealService';
import { SupabaseDealRepository } from '../repositories/supabase/SupabaseDealRepository';

const app = new Hono();
const dealService = new DealService(new SupabaseDealRepository());

// Platform wallet address
const PLATFORM_WALLET = process.env.MASTER_WALLET_ADDRESS || '';

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

    // Only process incoming transfers to platform wallet
    if (inMsg.destination?.address !== PLATFORM_WALLET) {
        console.log('[Webhook] Not to platform wallet, ignoring');
        return;
    }

    const tonAmount = Number(inMsg.value || 0) / 1e9;
    const comment = inMsg.decoded_body?.text || '';

    console.log('[Webhook] TON transfer:', { amount: tonAmount, comment });

    if (!comment || !comment.startsWith('deal_')) {
        console.log('[Webhook] No deal memo');
        return;
    }

    try {
        await dealService.confirmPayment(comment, tx.hash);
        console.log(`[Webhook] ✅ TON payment confirmed: ${tonAmount} TON for ${comment}`);
    } catch (error: any) {
        if (!error.message.includes('not in pending status')) {
            console.error('[Webhook] Error confirming:', error.message);
        }
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

    if (!comment || !comment.startsWith('deal_')) {
        console.log('[Webhook] No deal memo');
        return;
    }

    try {
        await dealService.confirmPayment(comment, tx.hash);
        console.log(`[Webhook] ✅ USDT payment confirmed: ${amount} USDT for ${comment}`);
    } catch (error: any) {
        if (!error.message.includes('not in pending status')) {
            console.error('[Webhook] Error confirming:', error.message);
        }
    }
}

export default app;
