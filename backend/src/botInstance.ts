import { Bot } from 'grammy';
import dotenv from 'dotenv';
import { TON_CONFIG } from './config/tonConfig';

dotenv.config();

const token = TON_CONFIG.botToken;

if (!token) {
    console.warn('BOT_TOKEN is not defined in .env');
}

export const bot = token ? new Bot(token) : null;

// Bot username for deep links and mini app URLs
export const BOT_USERNAME = process.env.BOT_USERNAME || 'DanielAdsMVP_bot';

/** Generate a mini app deep link URL, e.g. https://t.me/BotName/marketplace?startapp=deal_123 */
export function getMiniAppUrl(startapp?: string): string {
    const base = `https://t.me/${BOT_USERNAME}/marketplace`;
    return startapp ? `${base}?startapp=${startapp}` : base;
}

/** Generate a bot deep link URL, e.g. https://t.me/BotName?start=draft_123 */
export function getBotDeepLink(startParam?: string): string {
    const base = `https://t.me/${BOT_USERNAME}`;
    return startParam ? `${base}?start=${startParam}` : base;
}
