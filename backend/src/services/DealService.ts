import { IDealRepository } from '../repositories/interfaces';
import { Deal, ContentItem } from '../domain/entities';
import { v4 as uuidv4 } from 'uuid';

// Master hot wallet address for escrow payments
const MASTER_WALLET_ADDRESS = process.env.MASTER_WALLET_ADDRESS || 'EQA...your-wallet...';

export class DealService {
    constructor(private dealRepo: IDealRepository) { }

    async listDeals(): Promise<Deal[]> {
        return this.dealRepo.findAll();
    }

    /**
     * Create a deal with content items and generate unique payment memo
     */
    async createDealWithItems(
        advertiserId: string,
        channelId: string,
        contentItems: ContentItem[],
        advertiserWalletAddress: string
    ): Promise<Deal & { paymentInstructions: { address: string; memo: string; amount: number } }> {
        // Calculate total amount
        const totalAmount = contentItems.reduce(
            (sum, item) => sum + (item.quantity * item.unitPrice),
            0
        );

        if (totalAmount <= 0) {
            throw new Error('Total amount must be greater than zero');
        }

        // Generate unique payment memo
        const paymentMemo = `deal_${uuidv4().replace(/-/g, '').slice(0, 16)}`;

        // Set expiration (24h from now for payment)
        const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000);

        const deal = await this.dealRepo.create({
            advertiserId,
            channelId,
            contentItems,
            priceAmount: totalAmount,
            priceCurrency: 'USD',
            paymentMemo,
            advertiserWalletAddress,
            status: 'pending',
            expiresAt,
            briefText: contentItems.map(i => `${i.quantity}x ${i.title}`).join(', ')
        });

        return {
            ...deal,
            paymentInstructions: {
                address: MASTER_WALLET_ADDRESS,
                memo: paymentMemo,
                amount: totalAmount
            }
        };
    }

    /**
     * Confirm payment received (called by payment monitor)
     */
    async confirmPayment(paymentMemo: string, txHash: string): Promise<Deal> {
        const deal = await this.dealRepo.findByPaymentMemo(paymentMemo);
        if (!deal) {
            throw new Error(`No deal found for memo: ${paymentMemo}`);
        }

        if (deal.status !== 'pending') {
            throw new Error(`Deal ${deal.id} is not in pending status`);
        }

        return this.dealRepo.updatePaymentConfirmed(deal.id, txHash);
    }

    /**
     * Get payment instructions for an existing deal
     */
    async getPaymentInstructions(dealId: string): Promise<{ address: string; memo: string; amount: number }> {
        const deal = await this.dealRepo.findById(dealId);
        if (!deal) {
            throw new Error('Deal not found');
        }

        return {
            address: MASTER_WALLET_ADDRESS,
            memo: deal.paymentMemo || '',
            amount: deal.priceAmount
        };
    }

    // Legacy method for backward compatibility
    async createCampaign(
        advertiserId: string,
        channelId: string,
        briefText: string,
        priceAmount: number,
        creativeContent: any
    ): Promise<Deal> {
        if (priceAmount <= 0) {
            throw new Error('Price must be greater than zero');
        }

        const deal = await this.dealRepo.create({
            advertiserId,
            channelId,
            briefText,
            priceAmount,
            creativeContent,
            priceCurrency: 'USD',
            status: 'submitted'
        });

        return deal;
    }

    async getDealsForChannel(channelId: string): Promise<Deal[]> {
        return this.dealRepo.findByChannelId(channelId);
    }

    async getDealsForAdvertiser(advertiserId: string): Promise<Deal[]> {
        return this.dealRepo.findByAdvertiserId(advertiserId);
    }

    async approveCampaign(dealId: string, approverId: string, isAdvertiser: boolean, reject: boolean): Promise<Deal> {
        const deal = await this.dealRepo.findById(dealId);
        if (!deal) {
            throw new Error('Deal not found');
        }

        if (reject) {
            if (deal.status === 'submitted' || deal.status === 'negotiating' || deal.status === 'funded') {
                // If rejecting a funded deal, trigger refund
                if (deal.status === 'funded') {
                    return this.dealRepo.updateStatus(dealId, 'refunded', 'Rejected by channel owner');
                }
                return this.dealRepo.updateStatus(dealId, 'cancelled', 'Rejected by user');
            }
            throw new Error('Cannot reject deal in current status');
        }

        // Channel owner approves a funded deal
        if (deal.status === 'funded') {
            return this.dealRepo.updateStatus(dealId, 'approved');
        }

        // Legacy flow
        if (deal.status === 'submitted') {
            return this.dealRepo.updateStatus(dealId, 'approved');
        }

        return deal;
    }
}
