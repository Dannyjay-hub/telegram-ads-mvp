import { IBriefRepository } from '../repositories/interfaces';
import { PublicBrief } from '../domain/entities';

export class BriefService {
    constructor(private briefRepo: IBriefRepository) { }

    async createBrief(
        advertiserId: string,
        title: string,
        content: string,
        budgetMin: number,
        budgetMax: number,
        tags: string[]
    ): Promise<PublicBrief> {
        return this.briefRepo.create({
            advertiserId,
            title,
            content,
            budgetRangeMin: budgetMin,
            budgetRangeMax: budgetMax,
            tags
        });
    }

    async listOpenBriefs(filters?: { minBudget?: number, tag?: string }): Promise<PublicBrief[]> {
        return this.briefRepo.findAll(true, filters);
    }

    async getBrief(id: string): Promise<PublicBrief | null> {
        return this.briefRepo.findById(id);
    }
}
