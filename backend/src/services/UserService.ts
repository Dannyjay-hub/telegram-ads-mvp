import { sign } from 'hono/jwt';
import { IUserRepository } from '../repositories/interfaces';
import { User } from '../domain/entities';
import { validateTelegramData } from '../utils/telegramAuth';

export class UserService {
    constructor(private userRepo: IUserRepository) { }

    async authenticateTelegramUser(initData: string): Promise<{ token: string; user: User }> {
        // 1. Validate with Telegram
        const botToken = process.env.BOT_TOKEN;
        if (!botToken) throw new Error('Server configuration error: BOT_TOKEN missing');

        const parsedData = validateTelegramData(initData, botToken);
        const tgUser = parsedData.user;
        if (!tgUser) throw new Error('No user data in initData');

        // 2. Find or Create User
        let user = await this.userRepo.findByTelegramId(tgUser.id);

        if (user) {
            // Update profile if changed
            // Note: In real world, check if changed first to save writes
            user = await this.userRepo.update(user.id, {
                firstName: tgUser.first_name,
                username: tgUser.username
            });
        } else {
            // Create new user
            user = await this.userRepo.create({
                telegramId: tgUser.id,
                firstName: tgUser.first_name,
                username: tgUser.username
            });
        }

        // 3. Generate JWT
        const jwtSecret = process.env.JWT_SECRET || 'fallback_secret_do_not_use_in_prod';
        const token = await sign({
            sub: user.id,
            tg_id: user.telegramId,
            exp: Math.floor(Date.now() / 1000) + (60 * 60 * 24 * 7) // 7 days
        }, jwtSecret);

        return { token, user };
    }
}
