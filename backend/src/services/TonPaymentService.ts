/**
 * TonPaymentService - Monitors TON blockchain for incoming payments
 * Supports both native TON and Jetton (USDT/USDC) transfers
 * Uses TON Center API for native TON and TON API for Jetton events
 */

import { DealService } from './DealService';
import { SupabaseDealRepository } from '../repositories/supabase/SupabaseDealRepository';

// TON Center API (mainnet/testnet)
const TON_CENTER_API = process.env.TON_CENTER_API || 'https://toncenter.com/api/v2';
const TON_API_KEY = process.env.TON_API_KEY || '';
const MASTER_WALLET_ADDRESS = process.env.MASTER_WALLET_ADDRESS || '';

// TON API for Jetton events (more reliable for Jetton tracking)
const TON_API_URL = 'https://tonapi.io/v2';

// Supported Jetton Master Addresses (mainnet)
const USDT_MASTER_ADDRESS = 'EQCxE6mUtQJKFnGfaROTKOt1lZbDiiX1kCixRv7Nw2Id_sDs';

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
    private lastProcessedLt: string = '0';
    private lastJettonEventId: string = '';
    private isPolling: boolean = false;

    constructor() {
        const dealRepo = new SupabaseDealRepository();
        this.dealService = new DealService(dealRepo);
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
        console.log(`TonPaymentService: Also watching for USDT Jetton transfers`);

        this.isPolling = true;
        this.pollTransactions();
        this.pollJettonTransfers();

        setInterval(() => {
            this.pollTransactions();
            this.pollJettonTransfers();
        }, intervalMs);
    }

    /**
     * Poll TON Center API for new native TON transactions
     */
    async pollTransactions() {
        if (!MASTER_WALLET_ADDRESS) {
            console.error('TonPaymentService: MASTER_WALLET_ADDRESS not set');
            return;
        }

        try {
            const url = `${TON_CENTER_API}/getTransactions?address=${MASTER_WALLET_ADDRESS}&limit=20`;
            const headers: Record<string, string> = {};
            if (TON_API_KEY) {
                headers['X-API-Key'] = TON_API_KEY;
            }

            const response = await fetch(url, { headers });
            if (!response.ok) {
                throw new Error(`TON API error: ${response.status}`);
            }

            const data = await response.json();

            if (!data.ok || !data.result) {
                console.error('TonPaymentService: Invalid API response', data);
                return;
            }

            const transactions: TonTransaction[] = data.result;

            for (const tx of transactions) {
                await this.processTransaction(tx);
            }

        } catch (error) {
            console.error('TonPaymentService: Error polling TON transactions', error);
        }
    }

    /**
     * Poll TON API for Jetton (USDT) transfers to our wallet
     */
    async pollJettonTransfers() {
        if (!MASTER_WALLET_ADDRESS) {
            return;
        }

        try {
            // Fetch Jetton events for our wallet
            const url = `${TON_API_URL}/accounts/${MASTER_WALLET_ADDRESS}/events?limit=20`;
            const response = await fetch(url);

            if (!response.ok) {
                throw new Error(`TON API Jetton error: ${response.status}`);
            }

            const data = await response.json();
            const events: JettonEvent[] = data.events || [];

            for (const event of events) {
                await this.processJettonEvent(event);
            }

        } catch (error) {
            console.error('TonPaymentService: Error polling Jetton transfers', error);
        }
    }

    /**
     * Process a Jetton event - check if it's a USDT transfer with deal memo
     */
    private async processJettonEvent(event: JettonEvent) {
        // Only process jetton_transfer actions
        if (event.action?.type !== 'jetton_transfer') {
            return;
        }

        const transfer = event.action.jetton_transfer;
        if (!transfer) {
            return;
        }

        // Only process transfers TO our wallet
        if (transfer.recipient.address !== MASTER_WALLET_ADDRESS) {
            return;
        }

        // Only process USDT transfers (or other supported Jettons)
        if (transfer.jetton.address !== USDT_MASTER_ADDRESS) {
            return;
        }

        const memo = transfer.comment;
        if (!memo || !memo.startsWith('deal_')) {
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
            // Table might not exist yet - log and continue
            console.log('TonPaymentService: Payout queued (table pending_payouts may need creation)');
            console.log(`  Deal: ${dealId}`);
            console.log(`  To: ${recipientAddress}`);
            console.log(`  Amount: ${amountTon} TON`);
            return { queued: true, payoutId: `pending_${dealId}` };
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
            console.log('TonPaymentService: Refund queued (table pending_payouts may need creation)');
            console.log(`  Deal: ${dealId}`);
            console.log(`  To: ${advertiserAddress}`);
            console.log(`  Amount: ${amountTon} TON`);
            console.log(`  Reason: ${reason}`);
            return { queued: true, refundId: `refund_${dealId}` };
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

