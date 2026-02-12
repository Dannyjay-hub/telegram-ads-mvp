/**
 * TonPaymentService - Monitors TON blockchain for incoming payments
 * Supports both native TON and Jetton (USDT/USDC) transfers
 * Uses TON API for transaction monitoring with proper address handling
 */

import { DealService } from './DealService';
import { SupabaseDealRepository } from '../repositories/supabase/SupabaseDealRepository';
import { SupabaseCampaignRepository } from '../repositories/supabase/SupabaseCampaignRepository';
import { Address } from '@ton/core';

// TON Center API (legacy, kept for reference)
const TON_CENTER_API = process.env.TON_CENTER_API || 'https://toncenter.com/api/v2';
const TON_API_KEY = process.env.TONAPI_KEY || process.env.TON_API_KEY || '';
const MASTER_WALLET_ADDRESS = process.env.MASTER_WALLET_ADDRESS || '';

// TON API for transaction events
const TON_API_URL = 'https://tonapi.io/v2';

// Supported Jetton Master Addresses (mainnet)
const USDT_MASTER_ADDRESS = 'EQCxE6mUtQJKFnGfaROTKOt1lZbDiiX1kCixRv7Nw2Id_sDs';

// Parse master wallet address once at startup
let MASTER_ADDRESS: Address | null = null;
try {
    if (MASTER_WALLET_ADDRESS) {
        MASTER_ADDRESS = Address.parse(MASTER_WALLET_ADDRESS);
        console.log('✅ TonPaymentService: Master wallet address validated:', MASTER_WALLET_ADDRESS);
    }
} catch (error) {
    console.error('❌ TonPaymentService: Invalid MASTER_WALLET_ADDRESS format!');
}

/**
 * Check if two TON addresses are equal using @ton/core
 * Properly handles all address formats (raw, bounceable, non-bounceable)
 */
function addressesEqual(addr1: string, addr2: string | Address): boolean {
    try {
        const address1 = Address.parse(addr1);
        const address2 = typeof addr2 === 'string' ? Address.parse(addr2) : addr2;
        return address1.equals(address2);
    } catch (error) {
        console.error('Error comparing addresses:', error);
        return false;
    }
}


interface TonTransaction {
    hash: string;
    utime: number;
    in_msg?: {
        source: string;
        destination: string;
        value: string; // in nanoton
        message?: string; // The comment/memo
    };
}

interface JettonEvent {
    event_id: string;
    timestamp: number;
    action: {
        type: string;
        jetton_transfer?: {
            sender: {
                address: string;
            };
            recipient: {
                address: string;
            };
            amount: string;
            comment?: string; // The forward_payload comment
            jetton: {
                address: string;
                symbol: string;
            };
        };
    };
}

export class TonPaymentService {
    private dealService: DealService;
    private campaignRepo: SupabaseCampaignRepository;
    private lastProcessedLt: string = '0';
    private lastJettonEventId: string = '';
    private isPolling: boolean = false;
    // Track processed jetton transactions to prevent duplicates (in-memory cache)
    private processedJettonTxHashes: Set<string> = new Set();
    // Max size to prevent memory leak
    private readonly MAX_PROCESSED_CACHE = 1000;

    constructor() {
        const dealRepo = new SupabaseDealRepository();
        this.dealService = new DealService(dealRepo);
        this.campaignRepo = new SupabaseCampaignRepository();
    }

    /**
     * Mark a transaction as processed (add to in-memory cache with size limit)
     */
    private markAsProcessed(txHash: string): void {
        this.processedJettonTxHashes.add(txHash);
        // Prune cache if too large
        if (this.processedJettonTxHashes.size > this.MAX_PROCESSED_CACHE) {
            const firstKey = this.processedJettonTxHashes.values().next().value;
            if (firstKey) this.processedJettonTxHashes.delete(firstKey);
        }
    }

    /**
     * Start polling for transactions (call once on server start)
     */
    startPolling(intervalMs: number = 30000) {
        if (this.isPolling) {
            console.log('TonPaymentService: Already polling');
            return;
        }

        console.log(`TonPaymentService: Starting to poll every ${intervalMs / 1000}s`);
        console.log(`TonPaymentService: Watching wallet ${MASTER_WALLET_ADDRESS}`);
        console.log(`TonPaymentService: Also watching for USDT Jetton transfers (staggered by 15s)`);

        this.isPolling = true;

        // Initial polls
        this.pollTransactions();
        setTimeout(() => this.pollJettonTransfers(), 15000); // Stagger by 15s to avoid 429

        // Recurring polls - staggered to prevent race conditions
        setInterval(() => {
            this.pollTransactions();
            setTimeout(() => this.pollJettonTransfers(), 15000); // 15s stagger
        }, intervalMs);
    }

    /**
     * Poll TON API for new native TON transactions
     * Using TON API instead of TON Center for better address format handling
     */
    async pollTransactions() {
        if (!MASTER_WALLET_ADDRESS) {
            console.error('TonPaymentService: MASTER_WALLET_ADDRESS not set');
            return;
        }

        try {
            // Use TON API which returns user-friendly addresses
            const url = `${TON_API_URL}/accounts/${MASTER_WALLET_ADDRESS}/events?limit=20`;
            const headers: Record<string, string> = {};
            if (TON_API_KEY) {
                headers['Authorization'] = `Bearer ${TON_API_KEY}`;
            }

            const response = await fetch(url, { headers });
            if (!response.ok) {
                throw new Error(`TON API error: ${response.status}`);
            }

            const data = await response.json();
            const events = data.events || [];

            for (const event of events) {
                // Process transaction events
                if (event.actions) {
                    for (const action of event.actions) {
                        if (action.type === 'TonTransfer' && action.TonTransfer) {
                            await this.processTonTransferEvent(action.TonTransfer, event.event_id);
                        }
                    }
                }
            }

        } catch (error) {
            console.error('TonPaymentService: Error polling TON transactions', error);
        }
    }

    /**
     * Process a TON transfer event from TON API
     */
    private async processTonTransferEvent(transfer: any, eventId: string) {
        // Only process incoming transfers to our wallet
        const recipient = transfer.recipient?.address;
        if (!recipient || !MASTER_ADDRESS) return;

        // Use @ton/core Address.equals for proper comparison across all formats
        if (!addressesEqual(recipient, MASTER_ADDRESS)) {
            return;
        }

        // Extract and clean comment (trim whitespace)
        const comment = (transfer.comment || '').trim();
        if (!comment) return;

        // Only process deal_ and campaign_ memos
        if (!comment.startsWith('deal_') && !comment.startsWith('campaign_')) {
            return;
        }

        // ✅ IDEMPOTENCY: Skip if already processed (in-memory check)
        if (this.processedJettonTxHashes.has(eventId)) {
            return; // Silent skip
        }

        const tonAmount = Number(transfer.amount || 0) / 1e9;
        console.log(`TonPaymentService: Found TON transfer with memo: ${comment}`);
        console.log(`  Event ID: ${eventId}`);
        console.log(`  Amount: ${tonAmount} TON`);
        console.log(`  From: ${transfer.sender?.address}`);

        try {
            if (comment.startsWith('campaign_')) {
                const campaign = await this.campaignRepo.findByPaymentMemo(comment);
                if (!campaign) {
                    console.error(`TonPaymentService: Campaign not found for memo: ${comment}`);
                    return;
                }
                if (campaign.escrowDeposited && campaign.escrowDeposited > 0) {
                    this.markAsProcessed(eventId);
                    return;
                }
                await this.campaignRepo.confirmEscrowDeposit(campaign.id, tonAmount, eventId);
                this.markAsProcessed(eventId);
                console.log(`✅ TonPaymentService: TON campaign payment confirmed for ${comment}`);
            } else {
                await this.dealService.confirmPayment(comment, eventId);
                this.markAsProcessed(eventId);
                console.log(`✅ TonPaymentService: Payment confirmed for ${comment}`);
            }
        } catch (error: any) {
            // Silently ignore deals that are already processed
            if (error.message.includes('not in') && error.message.includes('status')) {
                this.markAsProcessed(eventId); // Stop re-logging
            } else if (error.message.includes('No deal found')) {
                // Deal doesn't exist (deleted/orphaned) - mark processed to stop infinite retries
                this.markAsProcessed(eventId);
                console.warn(`TonPaymentService: Deal not found for ${comment} - skipping permanently`);
            } else {
                console.error(`❌ TonPaymentService: Error confirming ${comment}:`, error.message);
            }
        }
    }

    /**
     * Poll TON API for Jetton (USDT) transfers to our wallet
     * Uses /jettons/history endpoint which specifically returns Jetton transfers
     */
    async pollJettonTransfers() {
        if (!MASTER_WALLET_ADDRESS) {
            return;
        }

        try {
            // Use /jettons/history endpoint for Jetton transfers
            const url = `${TON_API_URL}/accounts/${MASTER_WALLET_ADDRESS}/jettons/history?limit=20`;

            const headers: Record<string, string> = {};
            if (TON_API_KEY) {
                headers['Authorization'] = `Bearer ${TON_API_KEY}`;
            }

            const response = await fetch(url, { headers });

            if (!response.ok) {
                console.error(`[JettonPoll] TON API error: ${response.status}`);
                return;
            }

            const data = await response.json();
            // API returns 'operations' not 'events'
            const operations = data.operations || [];

            // Only log if there are new operations to process
            // (Most operations will be skipped by idempotency check)

            for (const op of operations) {
                await this.processJettonOperation(op);
            }

        } catch (error) {
            console.error('TonPaymentService: Error polling Jetton transfers', error);
        }
    }

    /**
     * Process a Jetton operation from /jettons/history API
     */
    private async processJettonOperation(op: any) {
        // Only process incoming transfers
        if (op.operation !== 'transfer') {
            return;
        }

        const txHash = op.transaction_hash;

        // Skip operations without transaction hash - can't dedupe them
        if (!txHash) {
            return;
        }

        // ✅ IDEMPOTENCY: Skip if already processed (in-memory check)
        if (this.processedJettonTxHashes.has(txHash)) {
            return; // Silent skip - already processed this session
        }

        // Check if this is a transfer TO our wallet
        const destAddress = op.destination?.address;
        if (!destAddress || !MASTER_ADDRESS) {
            return;
        }

        // Use proper address comparison
        if (!addressesEqual(destAddress, MASTER_ADDRESS)) {
            return;
        }

        // Check if it's USDT
        const jettonAddress = op.jetton?.address;
        if (!jettonAddress || !addressesEqual(jettonAddress, USDT_MASTER_ADDRESS)) {
            return;
        }

        // Extract memo from payload - TON API puts it in payload.Value.Text
        const memo = op.payload?.Value?.Text || '';

        // Only process transfers with valid memo prefix (reduce log noise)
        if (!memo.startsWith('campaign_') && !memo.startsWith('deal_')) {
            return; // Ignore transfers without our memo format
        }

        // Early skip if already in cache (before logging)
        if (this.processedJettonTxHashes.has(txHash)) {
            return;
        }

        const amount = Number(op.amount || 0) / 1e6; // USDT has 6 decimals
        console.log(`TonPaymentService: Found USDT transfer with memo: ${memo}`);
        console.log(`  Transaction: ${txHash}`);
        console.log(`  Amount: ${amount} USDT`);
        console.log(`  From: ${op.source?.address}`);

        // Handle campaign escrow payments
        if (memo.startsWith('campaign_')) {
            try {
                const campaign = await this.campaignRepo.findByPaymentMemo(memo);
                if (!campaign) {
                    console.error(`TonPaymentService: Campaign not found for memo: ${memo}`);
                    return;
                }
                // DB-backed idempotency: check if already funded
                if (campaign.escrowTxHash === txHash || (campaign.escrowDeposited && campaign.escrowDeposited > 0)) {
                    this.markAsProcessed(txHash); // Stop log spam
                    return;
                }
                await this.campaignRepo.confirmEscrowDeposit(campaign.id, amount, txHash);
                this.markAsProcessed(txHash); // ✅ Mark AFTER success
                console.log(`✅ TonPaymentService: USDT campaign payment confirmed for ${memo}`);
            } catch (error: any) {
                // Don't mark as processed - allow retry
                console.error(`TonPaymentService: Error confirming USDT campaign ${memo}:`, error.message);
            }
            return;
        }

        // Handle deal payments
        if (memo.startsWith('deal_')) {
            try {
                await this.dealService.confirmPayment(memo, txHash);
                this.markAsProcessed(txHash); // ✅ Mark AFTER success
                console.log(`✅ TonPaymentService: USDT payment confirmed for ${memo}`);
            } catch (error: any) {
                if (error.message.includes('not in') && error.message.includes('status')) {
                    // Already processed via DB check
                    this.markAsProcessed(txHash);
                } else if (error.message.includes('No deal found')) {
                    // Deal doesn't exist - mark processed to avoid log spam
                    this.markAsProcessed(txHash);
                    console.warn(`TonPaymentService: Deal not found for ${memo} - skipping`);
                } else {
                    // Other error - don't mark, allow retry
                    console.error(`TonPaymentService: Error confirming USDT ${memo}:`, error.message);
                }
            }
            return;
        }
    }

    /**
     * Process a Jetton event - check if it's a USDT transfer with deal memo
     */
    private async processJettonEvent(event: JettonEvent) {
        // Only process jetton_transfer actions
        if (event.action?.type !== 'JettonTransfer') {
            // TON API uses capitalized action types - check for lowercase too
            if (event.action?.type !== 'jetton_transfer') {
                return;
            }
        }

        const transfer = event.action.jetton_transfer;
        if (!transfer) {
            console.log(`[JettonEvent] No transfer data in event ${event.event_id}`);
            return;
        }

        console.log(`[JettonEvent] Processing: recipient=${transfer.recipient.address}, jetton=${transfer.jetton.address}`);

        // Only process transfers TO our wallet (use proper address comparison)
        if (!MASTER_WALLET_ADDRESS || !addressesEqual(transfer.recipient.address, MASTER_WALLET_ADDRESS)) {
            console.log(`[JettonEvent] Recipient mismatch - expected: ${MASTER_WALLET_ADDRESS}`);
            return;
        }

        // Only process USDT transfers (use proper address comparison for Jetton master)
        if (!addressesEqual(transfer.jetton.address, USDT_MASTER_ADDRESS)) {
            console.log(`[JettonEvent] Jetton mismatch - expected USDT: ${USDT_MASTER_ADDRESS}`);
            return;
        }

        const memo = transfer.comment;
        if (!memo || !memo.startsWith('deal_')) {
            console.log(`[JettonEvent] No deal memo - comment: "${memo}"`);
            return;
        }

        console.log(`TonPaymentService: Found USDT Jetton transfer with memo: ${memo}`);
        console.log(`  Event ID: ${event.event_id}`);
        console.log(`  Amount: ${parseInt(transfer.amount) / 1e6} USDT`);
        console.log(`  From: ${transfer.sender.address}`);

        try {
            // Confirm the payment in our system
            await this.dealService.confirmPayment(memo, event.event_id);
            console.log(`TonPaymentService: USDT Deal confirmed for memo ${memo}`);
        } catch (error: any) {
            if (error.message.includes('not in pending status')) {
                // Already processed, ignore
            } else {
                console.error(`TonPaymentService: Error confirming USDT payment for ${memo}:`, error.message);
            }
        }
    }

    /**
     * Process a single native TON transaction - check memo and match to deal
     */
    private async processTransaction(tx: TonTransaction) {
        // Only process incoming messages to our wallet
        if (!tx.in_msg || tx.in_msg.destination !== MASTER_WALLET_ADDRESS) {
            return;
        }

        const memo = tx.in_msg.message;
        if (!memo) {
            return; // No memo, ignore
        }

        // Check if memo matches our deal pattern
        if (!memo.startsWith('deal_')) {
            return;
        }

        console.log(`TonPaymentService: Found TON transaction with memo: ${memo}`);
        console.log(`  Hash: ${tx.hash}`);
        console.log(`  Amount: ${parseInt(tx.in_msg.value) / 1e9} TON`);
        console.log(`  From: ${tx.in_msg.source}`);

        try {
            // Confirm the payment in our system
            await this.dealService.confirmPayment(memo, tx.hash);
            console.log(`TonPaymentService: Deal confirmed for memo ${memo}`);
        } catch (error: any) {
            // Might already be processed or deal not found
            if (error.message.includes('not in pending status')) {
                // Already processed, ignore
            } else {
                console.error(`TonPaymentService: Error confirming payment for ${memo}:`, error.message);
            }
        }
    }

    /**
     * Get recent transactions (for debugging/admin)
     */
    async getRecentTransactions(limit: number = 10): Promise<TonTransaction[]> {
        if (!MASTER_WALLET_ADDRESS) {
            throw new Error('MASTER_WALLET_ADDRESS not set');
        }

        const url = `${TON_CENTER_API}/getTransactions?address=${MASTER_WALLET_ADDRESS}&limit=${limit}`;
        const headers: Record<string, string> = {};
        if (TON_API_KEY) {
            headers['X-API-Key'] = TON_API_KEY;
        }

        const response = await fetch(url, { headers });
        if (!response.ok) {
            throw new Error(`TON API error: ${response.status}`);
        }

        const data = await response.json();
        return data.result || [];
    }

    /**
     * Manually check a specific transaction by hash
     */
    async checkTransactionByMemo(memo: string): Promise<{ found: boolean; txHash?: string }> {
        const transactions = await this.getRecentTransactions(50);

        for (const tx of transactions) {
            if (tx.in_msg?.message === memo) {
                return { found: true, txHash: tx.hash };
            }
        }

        return { found: false };
    }

    /**
     * Queue a payout to channel owner
     * Note: Actual sending requires private key access - this records the intent
     * In production, use a signing service or secure key management
     */
    async queuePayout(
        dealId: string,
        recipientAddress: string,
        amountTon: number,
        memo: string
    ): Promise<{ queued: boolean; payoutId: string }> {
        const { supabase } = await import('../db');

        // Record pending payout in database
        const { data, error } = await supabase
            .from('pending_payouts' as any)
            .insert({
                deal_id: dealId,
                recipient_address: recipientAddress,
                amount_ton: amountTon,
                memo: memo,
                status: 'pending',
                created_at: new Date().toISOString()
            } as any)
            .select()
            .single();

        if (error) {
            // Log the error but throw so caller knows it failed
            console.error(`TonPaymentService: Failed to queue payout for deal ${dealId}:`, error.message);
            throw new Error(`Failed to queue payout: ${error.message}`);
        }

        console.log(`TonPaymentService: Payout queued with ID ${(data as any).id}`);
        return { queued: true, payoutId: (data as any).id };
    }

    /**
     * Queue a refund to advertiser
     */
    async queueRefund(
        dealId: string,
        advertiserAddress: string,
        amountTon: number,
        reason: string
    ): Promise<{ queued: boolean; refundId: string }> {
        const { supabase } = await import('../db');

        // Record pending refund in database
        const { data, error } = await supabase
            .from('pending_payouts' as any)
            .insert({
                deal_id: dealId,
                recipient_address: advertiserAddress,
                amount_ton: amountTon,
                memo: `refund_${dealId}`,
                status: 'pending',
                type: 'refund',
                reason: reason,
                created_at: new Date().toISOString()
            } as any)
            .select()
            .single();

        if (error) {
            // Log the error but throw so caller knows it failed
            console.error(`TonPaymentService: Failed to queue refund for deal ${dealId}:`, error.message);
            throw new Error(`Failed to queue refund: ${error.message}`);
        }

        console.log(`TonPaymentService: Refund queued with ID ${(data as any).id}`);
        return { queued: true, refundId: (data as any).id };
    }

    /**
     * Get all pending payouts/refunds (for admin dashboard)
     */
    async getPendingPayouts(): Promise<any[]> {
        const { supabase } = await import('../db');

        const { data, error } = await supabase
            .from('pending_payouts')
            .select('*')
            .eq('status', 'pending')
            .order('created_at', { ascending: true });

        if (error) {
            console.error('TonPaymentService: Error fetching pending payouts', error);
            return [];
        }

        return data || [];
    }

    /**
     * Mark a payout as completed (after manual execution)
     */
    async markPayoutComplete(payoutId: string, txHash: string): Promise<void> {
        const { supabase } = await import('../db');

        await supabase
            .from('pending_payouts' as any)
            .update({
                status: 'completed',
                tx_hash: txHash,
                completed_at: new Date().toISOString()
            } as any)
            .eq('id', payoutId);

        console.log(`TonPaymentService: Payout ${payoutId} marked complete with tx ${txHash}`);
    }
}

// Singleton instance
export const tonPaymentService = new TonPaymentService();

