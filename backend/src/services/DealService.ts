import { IDealRepository } from '../repositories/interfaces';
import { Deal } from '../domain/entities';

export class DealService {
    constructor(private dealRepo: IDealRepository) { }

    async listDeals(): Promise<Deal[]> {
        return this.dealRepo.findAll();
    }

    async createCampaign(
        advertiserId: string,
        channelId: string,
        briefText: string,
        priceAmount: number,
        creativeContent: any
    ): Promise<Deal> {
        // Validate inputs
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

    async approveCampaign(dealId: string, approverId: string, isAdvertiser: boolean, reject: boolean): Promise<Deal> {
        const deal = await this.dealRepo.findById(dealId);
        if (!deal) {
            throw new Error('Deal not found');
        }

        if (reject) {
            if (deal.status === 'submitted' || deal.status === 'negotiating') {
                return this.dealRepo.updateStatus(dealId, 'cancelled', 'Rejected by user');
            }
            throw new Error('Cannot reject deal in current status');
        }

        if (deal.status === 'submitted') {
            return this.dealRepo.updateStatus(dealId, 'approved');
        }

        return deal;
    }
}
