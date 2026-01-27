"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.BotConversationService = void 0;
class BotConversationService {
    constructor(userRepo) {
        this.userRepo = userRepo;
    }
    async getUser(telegramId) {
        return this.userRepo.findByTelegramId(telegramId);
    }
    async setChatState(telegramId, dealId) {
        const user = await this.userRepo.findByTelegramId(telegramId);
        if (!user)
            throw new Error('User not registered');
        await this.userRepo.update(user.id, {
            currentNegotiatingDealId: dealId
        });
    }
    async clearChatState(telegramId) {
        const user = await this.userRepo.findByTelegramId(telegramId);
        if (!user)
            return;
        // Pass null to clear
        await this.userRepo.update(user.id, {
            currentNegotiatingDealId: null
        });
    }
    async getChatState(telegramId) {
        const user = await this.userRepo.findByTelegramId(telegramId);
        if (!user)
            return null;
        return user.currentNegotiatingDealId || null;
    }
}
exports.BotConversationService = BotConversationService;
