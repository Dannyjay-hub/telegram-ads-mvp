"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.UserService = void 0;
const jwt_1 = require("hono/jwt");
const telegramAuth_1 = require("../utils/telegramAuth");
class UserService {
    constructor(userRepo) {
        this.userRepo = userRepo;
    }
    async authenticateTelegramUser(initData) {
        // 1. Validate with Telegram
        const botToken = process.env.BOT_TOKEN;
        if (!botToken)
            throw new Error('Server configuration error: BOT_TOKEN missing');
        const parsedData = (0, telegramAuth_1.validateTelegramData)(initData, botToken);
        const tgUser = parsedData.user;
        if (!tgUser)
            throw new Error('No user data in initData');
        // 2. Find or Create User
        let user = await this.userRepo.findByTelegramId(tgUser.id);
        if (user) {
            // Update profile if changed
            // Note: In real world, check if changed first to save writes
            user = await this.userRepo.update(user.id, {
                firstName: tgUser.first_name,
                username: tgUser.username
            });
        }
        else {
            // Create new user
            user = await this.userRepo.create({
                telegramId: tgUser.id,
                firstName: tgUser.first_name,
                username: tgUser.username
            });
        }
        // 3. Generate JWT
        const jwtSecret = process.env.JWT_SECRET || 'fallback_secret_do_not_use_in_prod';
        const token = await (0, jwt_1.sign)({
            sub: user.id,
            tg_id: user.telegramId,
            exp: Math.floor(Date.now() / 1000) + (60 * 60 * 24 * 7) // 7 days
        }, jwtSecret);
        return { token, user };
    }
}
exports.UserService = UserService;
