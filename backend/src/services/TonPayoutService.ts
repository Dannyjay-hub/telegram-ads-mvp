import { mnemonicToPrivateKey } from '@ton/crypto';
import { WalletContractV4, internal, TonClient, Address, toNano, fromNano } from '@ton/ton';
import { supabase } from '../db';

// Environment variables
const HOT_WALLET_MNEMONIC = process.env.HOT_WALLET_MNEMONIC || '';
const TON_API_URL = 'https://toncenter.com/api/v2';
const TON_API_KEY = process.env.TON_API_KEY || '';

// Auto-approve threshold (in TON)
const AUTO_APPROVE_THRESHOLD = 5;

interface PayoutRequest {
    dealId: string;
    recipientAddress: string;
    amount: number; // in TON
    currency: 'TON' | 'USDT';
    type: 'refund' | 'payout';
    reason?: string;
}

interface PendingPayout {
    id: string;
    deal_id: string;
    recipient_address: string;
    amount_ton: number;
    currency: string;
    type: string;
    status: string;
    reason?: string;
    tx_hash?: string;
    created_at: string;
    completed_at?: string;
    error_message?: string;
    retry_count: number;
    approved_by?: string;
}

export class TonPayoutService {
    private client: TonClient;
    private wallet: WalletContractV4 | null = null;
    private keyPair: { publicKey: Buffer; secretKey: Buffer } | null = null;
    private initialized = false;

    constructor() {
        this.client = new TonClient({
            endpoint: 'https://toncenter.com/api/v2/jsonRPC',
            apiKey: TON_API_KEY
        });
    }

    /**
     * Initialize the wallet from mnemonic
     */
    async initialize(): Promise<boolean> {
        if (this.initialized) return true;

        if (!HOT_WALLET_MNEMONIC) {
            console.error('TonPayoutService: HOT_WALLET_MNEMONIC not configured');
            return false;
        }

        try {
            const mnemonicWords = HOT_WALLET_MNEMONIC.split(' ').map(w => w.trim()).filter(w => w);

            if (mnemonicWords.length !== 24) {
                console.error(`TonPayoutService: Invalid mnemonic - expected 24 words, got ${mnemonicWords.length}`);
                return false;
            }

            this.keyPair = await mnemonicToPrivateKey(mnemonicWords);
            this.wallet = WalletContractV4.create({
                publicKey: this.keyPair.publicKey,
                workchain: 0
            });

            const walletAddress = this.wallet.address.toString();
            console.log(`✅ TonPayoutService: Hot wallet initialized: ${walletAddress}`);

            this.initialized = true;
            return true;
        } catch (error) {
            console.error('TonPayoutService: Failed to initialize wallet:', error);
            return false;
        }
    }

    /**
     * Queue a refund for a deal
     */
    async queueRefund(
        dealId: string,
        recipientAddress: string,
        amount: number,
        currency: 'TON' | 'USDT',
        reason: string
    ): Promise<PendingPayout | null> {
        console.log(`TonPayoutService: Queueing refund for deal ${dealId}`);
        console.log(`  Amount: ${amount} ${currency}`);
        console.log(`  Recipient: ${recipientAddress}`);
        console.log(`  Reason: ${reason}`);

        const { data, error } = await supabase
            .from('pending_payouts')
            .insert({
                deal_id: dealId,
                recipient_address: recipientAddress,
                amount_ton: amount,
                currency: currency,
                type: 'refund',
                status: amount <= AUTO_APPROVE_THRESHOLD ? 'pending' : 'pending_approval',
                reason: reason,
                memo: `refund_${dealId.substring(0, 8)}`
            })
            .select()
            .single();

        if (error) {
            console.error('TonPayoutService: Failed to queue refund:', error);
            return null;
        }

        console.log(`TonPayoutService: Refund queued with ID ${data.id}`);

        // Auto-execute if under threshold
        if (amount <= AUTO_APPROVE_THRESHOLD) {
            console.log(`TonPayoutService: Auto-executing refund (under ${AUTO_APPROVE_THRESHOLD} TON threshold)`);
            await this.executePayout(data.id);
        }

        return data as PendingPayout;
    }

    /**
     * Queue a payout to channel owner after deal completion
     */
    async queuePayout(
        dealId: string,
        recipientAddress: string,
        amount: number,
        currency: 'TON' | 'USDT'
    ): Promise<PendingPayout | null> {
        console.log(`TonPayoutService: Queueing payout for deal ${dealId}`);
        console.log(`  Amount: ${amount} ${currency}`);
        console.log(`  Recipient: ${recipientAddress}`);

        const { data, error } = await supabase
            .from('pending_payouts')
            .insert({
                deal_id: dealId,
                recipient_address: recipientAddress,
                amount_ton: amount,
                currency: currency,
                type: 'payout',
                status: amount <= AUTO_APPROVE_THRESHOLD ? 'pending' : 'pending_approval',
                memo: `payout_${dealId.substring(0, 8)}`
            })
            .select()
            .single();

        if (error) {
            console.error('TonPayoutService: Failed to queue payout:', error);
            return null;
        }

        console.log(`TonPayoutService: Payout queued with ID ${data.id}`);

        // Auto-execute if under threshold
        if (amount <= AUTO_APPROVE_THRESHOLD) {
            console.log(`TonPayoutService: Auto-executing payout (under ${AUTO_APPROVE_THRESHOLD} TON threshold)`);
            await this.executePayout(data.id);
        }

        return data as PendingPayout;
    }

    /**
     * Execute a pending payout (send TON/USDT)
     */
    async executePayout(payoutId: string): Promise<boolean> {
        // Initialize wallet if needed
        if (!await this.initialize()) {
            await this.markPayoutFailed(payoutId, 'Wallet not initialized');
            return false;
        }

        // Get payout details
        const { data: payout, error } = await supabase
            .from('pending_payouts')
            .select('*')
            .eq('id', payoutId)
            .single();

        if (error || !payout) {
            console.error('TonPayoutService: Payout not found:', payoutId);
            return false;
        }

        if (payout.status === 'completed') {
            console.log('TonPayoutService: Payout already completed');
            return true;
        }

        // Mark as processing
        await supabase
            .from('pending_payouts')
            .update({ status: 'processing' })
            .eq('id', payoutId);

        try {
            const recipientAddress = Address.parse(payout.recipient_address);
            const amount = toNano(payout.amount_ton.toString());

            console.log(`TonPayoutService: Executing ${payout.type} of ${payout.amount_ton} TON to ${payout.recipient_address}`);

            // Get wallet contract
            const contract = this.client.open(this.wallet!);
            const seqno = await contract.getSeqno();

            // Create and send transfer
            await contract.sendTransfer({
                seqno,
                secretKey: this.keyPair!.secretKey,
                messages: [
                    internal({
                        to: recipientAddress,
                        value: amount,
                        body: payout.memo || `${payout.type}_${payout.deal_id?.substring(0, 8) || 'unknown'}`,
                        bounce: false
                    })
                ]
            });

            // Wait a bit for transaction to be processed
            await new Promise(resolve => setTimeout(resolve, 10000));

            // Mark as completed
            await supabase
                .from('pending_payouts')
                .update({
                    status: 'completed',
                    completed_at: new Date().toISOString(),
                    tx_hash: `seqno_${seqno}` // We'll get the real hash later
                })
                .eq('id', payoutId);

            console.log(`✅ TonPayoutService: ${payout.type} completed for deal ${payout.deal_id}`);
            return true;

        } catch (error: any) {
            console.error(`TonPayoutService: Failed to execute payout:`, error);
            await this.markPayoutFailed(payoutId, error.message || 'Unknown error');
            return false;
        }
    }

    /**
     * Mark a payout as failed
     */
    private async markPayoutFailed(payoutId: string, errorMessage: string): Promise<void> {
        const { data: payout } = await supabase
            .from('pending_payouts')
            .select('retry_count')
            .eq('id', payoutId)
            .single();

        await supabase
            .from('pending_payouts')
            .update({
                status: 'failed',
                error_message: errorMessage,
                retry_count: (payout?.retry_count || 0) + 1
            })
            .eq('id', payoutId);
    }

    /**
     * Get all pending payouts (for admin dashboard)
     */
    async getPendingPayouts(): Promise<PendingPayout[]> {
        const { data, error } = await supabase
            .from('pending_payouts')
            .select('*')
            .in('status', ['pending', 'pending_approval', 'failed'])
            .order('created_at', { ascending: false });

        if (error) {
            console.error('TonPayoutService: Failed to get pending payouts:', error);
            return [];
        }

        return data as PendingPayout[];
    }

    /**
     * Approve a pending payout (admin action)
     */
    async approvePayout(payoutId: string, adminId: string): Promise<boolean> {
        await supabase
            .from('pending_payouts')
            .update({
                status: 'pending',
                approved_by: adminId
            })
            .eq('id', payoutId);

        return this.executePayout(payoutId);
    }

    /**
     * Retry failed payouts
     */
    async retryFailedPayouts(): Promise<void> {
        const { data: failed } = await supabase
            .from('pending_payouts')
            .select('*')
            .eq('status', 'failed')
            .lt('retry_count', 3);

        if (!failed || failed.length === 0) return;

        console.log(`TonPayoutService: Retrying ${failed.length} failed payouts`);

        for (const payout of failed) {
            await this.executePayout(payout.id);
        }
    }

    /**
     * Get hot wallet balance
     */
    async getBalance(): Promise<number> {
        if (!await this.initialize()) return 0;

        try {
            const balance = await this.client.getBalance(this.wallet!.address);
            return parseFloat(fromNano(balance));
        } catch (error) {
            console.error('TonPayoutService: Failed to get balance:', error);
            return 0;
        }
    }
}

// Export singleton instance
export const tonPayoutService = new TonPayoutService();
