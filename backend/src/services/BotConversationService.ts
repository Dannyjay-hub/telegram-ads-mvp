import { IUserRepository } from '../repositories/interfaces';

export class BotConversationService {
    constructor(private userRepo: IUserRepository) { }

    async getUser(telegramId: number) {
        return this.userRepo.findByTelegramId(telegramId);
    }

    async setChatState(telegramId: number, dealId: string) {
        const user = await this.userRepo.findByTelegramId(telegramId);
        if (!user) throw new Error('User not registered');

        await this.userRepo.update(user.id, {
            currentNegotiatingDealId: dealId
        });
    }

    async clearChatState(telegramId: number) {
        const user = await this.userRepo.findByTelegramId(telegramId);
        if (!user) return;

        // Pass null to clear
        await this.userRepo.update(user.id, {
            currentNegotiatingDealId: null
        });
    }

    async getChatState(telegramId: number): Promise<string | null> {
        const user = await this.userRepo.findByTelegramId(telegramId);
        if (!user) return null;
        return user.currentNegotiatingDealId || null;
    }
}
