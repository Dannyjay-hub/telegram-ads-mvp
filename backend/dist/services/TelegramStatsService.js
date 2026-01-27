"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.TelegramStatsService = void 0;
const telegram_1 = require("telegram");
const sessions_1 = require("telegram/sessions");
const tl_1 = require("telegram/tl");
const dotenv_1 = __importDefault(require("dotenv"));
dotenv_1.default.config();
const apiId = parseInt(process.env.TELEGRAM_API_ID || '');
const apiHash = process.env.TELEGRAM_API_HASH || '';
const botToken = process.env.BOT_TOKEN || '';
// Global client instance
let client = null;
// JSON BigInt handling helper
function bigIntReplacer(_key, value) {
    if (typeof value === 'bigint') {
        return value.toString();
    }
    return value;
}
class TelegramStatsService {
    async initialize() {
        if (client)
            return; // Already initialized
        if (!apiId || !apiHash) {
            console.warn('Missing TELEGRAM_API_ID or TELEGRAM_API_HASH. Analytics disabled.');
            return;
        }
        console.log('Initializing MTProto Client...');
        client = new telegram_1.TelegramClient(new sessions_1.StringSession(''), apiId, apiHash, {
            connectionRetries: 5,
        });
        await client.start({
            botAuthToken: botToken,
        });
        console.log('MTProto Client connected as Bot!');
    }
    async getChannelStats(telegramChannelId) {
        if (!client)
            await this.initialize();
        if (!client)
            throw new Error('MTProto client not initialized');
        try {
            // Need to resolve the peer first. 
            // Bot API uses ID like -100..., GramJS usually wants the entity or just ID (might accept string/bigint)
            // It's safer to getInputEntity.
            // Note: Bot sees channel ID. For GramJS, we might need to remove -100 prefix if passing as integer 
            // OR find by username if available.
            // Since we stored `telegram_channel_id` (e.g. -10012345), let's try resolving it.
            // Note: GramJS expects BigInt for IDs often.
            // We can try fetching the entity.
            let entity;
            try {
                entity = await client.getEntity(telegramChannelId.toString());
            }
            catch (e) {
                // Try parsing ID logic (-100 prefix removal common in library bridges)
                // But getEntity usually handles it if properly formatted string.
                throw e;
            }
            // Fetch Stats (Only works for Channels, and Bot must be admin)
            const stats = await client.invoke(new tl_1.Api.stats.GetBroadcastStats({
                channel: entity,
                dark: true // requested theme, doesn't matter much for raw data
            }));
            // Extract useful metrics
            // stats.followers is a Checkpoint with abs value
            // stats.viewsPerPost is a Checkpoint
            // Serialize safely handling BigInt
            const statsJson = JSON.parse(JSON.stringify(stats, bigIntReplacer));
            // Extract core numbers for columns
            const currentFollowers = stats.followers?.current || 0;
            const avgViews = stats.viewsPerPost?.current || 0;
            return {
                statsJson,
                subscribers: Number(currentFollowers), // Fallback or current
                avgViews: Number(avgViews)
            };
        }
        catch (e) {
            console.error('MTProto Stats Fetch Error:', e);
            // Fallback: Use simple Bot API via 'grammy' bot instance if available
            // We already imported 'bot' from '../bot'? No wait, we can just throw or return partial
            if (e.errorMessage === 'CHAT_ADMIN_REQUIRED') {
                throw new Error('Bot must be an admin to fetch stats.');
            }
            if (e.errorMessage === 'STATS_TOO_SMALL') {
                // Fallback to basic count
                // We can use the 'telegram' helper we wrote earlier for getChatMemberCount
                // But let's just return nulls and let the service handle it?
                // Ideally we return at least subscriber count from basic API
                console.warn('Channel too small for deep stats. Returning basic info.');
            }
            // Rethrow or return null to signal "No Deep Stats"
            throw e;
        }
    }
}
exports.TelegramStatsService = TelegramStatsService;
