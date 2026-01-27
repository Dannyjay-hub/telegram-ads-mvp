"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.DealService = void 0;
class DealService {
    constructor(dealRepo) {
        this.dealRepo = dealRepo;
    }
    async listDeals() {
        return this.dealRepo.findAll();
    }
    async createCampaign(advertiserId, channelId, briefText, priceAmount, creativeContent) {
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
    async getDealsForChannel(channelId) {
        return this.dealRepo.findByChannelId(channelId);
    }
    async approveCampaign(dealId, approverId, isAdvertiser, reject) {
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
exports.DealService = DealService;
