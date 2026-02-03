import { IDealRepository } from '../repositories/interfaces';
import { Deal, ContentItem } from '../domain/entities';
import { v4 as uuidv4 } from 'uuid';
import { tonPayoutService } from './TonPayoutService';
import { notifyDealStatusChange } from './NotificationService';
import { supabase } from '../db';

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
        advertiserWalletAddress: string,
        brief?: string, // Advertiser's brief describing what they want to advertise
        currency: 'TON' | 'USDT' = 'TON' // Payment currency
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

        // Set expiration (15 min payment window)
        const PAYMENT_WINDOW_MINUTES = 15;
        const expiresAt = new Date(Date.now() + PAYMENT_WINDOW_MINUTES * 60 * 1000);

        // Use provided brief or fallback to package summary
        const briefText = brief || contentItems.map(i => `${i.quantity}x ${i.title}`).join(', ');

        const deal = await this.dealRepo.create({
            advertiserId,
            channelId,
            contentItems,
            priceAmount: totalAmount,
            priceCurrency: currency, // Use actual payment currency
            paymentMemo,
            advertiserWalletAddress,
            status: 'draft',
            expiresAt,
            briefText
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

        if (deal.status !== 'draft') {
            throw new Error(`Deal ${deal.id} is not in draft status`);
        }

        // Check if payment window expired
        if (deal.expiresAt && new Date(deal.expiresAt) < new Date()) {
            throw new Error(`Deal ${deal.id} payment window has expired`);
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

    /**
     * Get deals with channel data for partnerships display
     */
    async getDealsForAdvertiserWithChannel(advertiserId: string): Promise<any[]> {
        return (this.dealRepo as any).findByAdvertiserIdWithChannel(advertiserId);
    }

    /**
     * Get deals for channels owned by a user (for channel owner partnerships)
     */
    async getDealsForChannelOwner(ownerTelegramId: number): Promise<any[]> {
        return (this.dealRepo as any).findByChannelOwnerWithDetails(ownerTelegramId);
    }

    async approveCampaign(dealId: string, approverId: string, isAdvertiser: boolean, reject: boolean): Promise<Deal> {
        const deal = await this.dealRepo.findById(dealId);
        if (!deal) {
            throw new Error('Deal not found');
        }

        // Fetch advertiser telegram_id and channel title for notifications
        let advertiserTelegramId: number | null = null;
        let channelTitle = 'Channel';

        try {
            const { data: advertiser } = await (supabase as any)
                .from('users')
                .select('telegram_id')
                .eq('id', deal.advertiserId)
                .single();
            advertiserTelegramId = advertiser?.telegram_id;

            const { data: channel } = await (supabase as any)
                .from('channels')
                .select('title')
                .eq('id', deal.channelId)
                .single();
            channelTitle = channel?.title || 'Channel';
        } catch (e) {
            console.warn('DealService: Could not fetch user/channel for notification:', e);
        }

        if (reject) {
            if (deal.status === 'submitted' || deal.status === 'negotiating' || deal.status === 'funded') {
                // If rejecting a funded deal, trigger refund to advertiser
                if (deal.status === 'funded') {
                    // Queue refund to advertiser's wallet
                    if (deal.advertiserWalletAddress) {
                        console.log(`DealService: Triggering refund for rejected deal ${dealId}`);
                        await tonPayoutService.queueRefund(
                            dealId,
                            deal.advertiserWalletAddress,
                            deal.priceAmount,
                            'TON',
                            'Rejected by channel owner'
                        );
                    } else {
                        console.warn(`DealService: Cannot refund deal ${dealId} - no advertiser wallet address`);
                    }

                    // Notify advertiser about rejection
                    if (advertiserTelegramId) {
                        await notifyDealStatusChange(advertiserTelegramId, dealId, channelTitle, 'rejected');
                    }

                    return this.dealRepo.updateStatus(dealId, 'refunded', 'Rejected by channel owner');
                }
                return this.dealRepo.updateStatus(dealId, 'cancelled', 'Rejected by user');
            }
            throw new Error('Cannot reject deal in current status');
        }

        // Channel owner approves a funded deal
        if (deal.status === 'funded') {
            // Notify advertiser about approval
            if (advertiserTelegramId) {
                await notifyDealStatusChange(advertiserTelegramId, dealId, channelTitle, 'approved');
            }
            return this.dealRepo.updateStatus(dealId, 'approved');
        }

        // Legacy flow
        if (deal.status === 'submitted') {
            return this.dealRepo.updateStatus(dealId, 'approved');
        }

        return deal;
    }

    /**
     * Release funds to channel owner after successful deal completion
     */
    async releaseFunds(dealId: string, channelOwnerWalletAddress: string): Promise<Deal> {
        const deal = await this.dealRepo.findById(dealId);
        if (!deal) {
            throw new Error('Deal not found');
        }

        if (deal.status !== 'monitoring' && deal.status !== 'posted') {
            throw new Error(`Cannot release funds for deal in ${deal.status} status`);
        }

        // Queue payout to channel owner
        console.log(`DealService: Releasing funds for deal ${dealId} to ${channelOwnerWalletAddress}`);
        await tonPayoutService.queuePayout(
            dealId,
            channelOwnerWalletAddress,
            deal.priceAmount,
            'TON'
        );

        return this.dealRepo.updateStatus(dealId, 'released', 'Funds released to channel owner');
    }
}

