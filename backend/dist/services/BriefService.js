"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.BriefService = void 0;
class BriefService {
    constructor(briefRepo) {
        this.briefRepo = briefRepo;
    }
    async createBrief(advertiserId, title, content, budgetMin, budgetMax, tags) {
        return this.briefRepo.create({
            advertiserId,
            title,
            content,
            budgetRangeMin: budgetMin,
            budgetRangeMax: budgetMax,
            tags
        });
    }
    async listOpenBriefs(filters) {
        return this.briefRepo.findAll(true, filters);
    }
    async getBrief(id) {
        return this.briefRepo.findById(id);
    }
}
exports.BriefService = BriefService;
