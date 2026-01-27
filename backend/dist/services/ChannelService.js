"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
exports.ChannelService = void 0;
const telegram_1 = require("./telegram");
class ChannelService {
    constructor(channelRepo) {
        this.channelRepo = channelRepo;
    }
    async listChannels(filters) {
        return this.channelRepo.findAll(filters);
    }
    async listChannelsByAdmin(telegramId) {
        return this.channelRepo.findByAdminTelegramId(telegramId);
    }
    async verifyChannel(telegramChannelId) {
        try {
            const channelInfo = await (0, telegram_1.getChannelStats)(telegramChannelId);
            return {
                is_admin: true,
                title: channelInfo.title,
                username: channelInfo.username,
                stats: {
                    subscribers: channelInfo.memberCount
                }
            };
        }
        catch (e) {
            throw new Error('Failed to fetch channel stats. Is the bot added?');
        }
    }
    async verifyAndAddChannel(telegramChannelId, userId) {
        // 1. Check if channel already exists
        const existing = await this.channelRepo.findByTelegramId(telegramChannelId);
        if (existing) {
            throw new Error('Channel already registered');
        }
        // 2. Fetch Stats & Info
        const verification = await this.verifyChannel(telegramChannelId);
        // 3. Create Channel
        return this.channelRepo.create({
            telegramChannelId,
            title: verification.title,
            username: verification.username,
            verifiedStats: verification.stats,
            isActive: true,
            basePriceAmount: 100, // Default start price
            basePriceCurrency: 'USD'
        });
    }
    async syncChannelAdmins(id) {
        // 1. Get Channel logic
        const channel = await this.channelRepo.findById(id);
        if (!channel)
            throw new Error('Channel not found');
        // 2. Fetch admins from Telegram
        const admins = await (0, telegram_1.getChatAdministrators)(channel.telegramChannelId);
        // 3. Store in DB
        // Using "any" cast to bypass strict check for now if last_name missing from types
        await this.channelRepo.saveAdmins(id, admins.map(a => {
            const u = a.user;
            return {
                telegramId: u.id,
                username: u.username,
                fullName: u.first_name + (u.last_name ? ' ' + u.last_name : ''),
                role: a.status
            };
        }));
        return admins;
    }
    async syncChannelStats(id) {
        const { TelegramStatsService } = await Promise.resolve().then(() => __importStar(require('./TelegramStatsService'))); // Lazy import to avoid init issues
        const statsService = new TelegramStatsService();
        const channel = await this.channelRepo.findById(id);
        if (!channel)
            throw new Error('Channel not found');
        let updates = {};
        try {
            console.log(`Syncing stats for channel ${channel.telegramChannelId}...`);
            const stats = await statsService.getChannelStats(channel.telegramChannelId);
            updates = {
                stats_json: stats.statsJson,
                avg_views: stats.avgViews,
                // Update verified stats follower count if we got it
                verified_stats: {
                    ...channel.verifiedStats,
                    subscribers: stats.subscribers
                }
            };
        }
        catch (e) {
            console.warn(`Deep stats failed (${e.message}). updating basic stats only.`);
            // Fallback: Update just subscriber count via basic API
            const basic = await (0, telegram_1.getChannelStats)(channel.telegramChannelId);
            updates = {
                verified_stats: {
                    ...channel.verifiedStats,
                    subscribers: basic.memberCount
                }
            };
        }
        // We need to update the channel. 
        // Our Repo 'update' method? We don't have one in IChannelRepository yet?
        // Let's check IChannelRepository.
        // Assuming we need to add 'update' method or just use raw supabase in Repo.
        // For now, I'll add 'update' to Repo interface and implementation.
        await this.channelRepo.update(id, updates);
        return updates;
    }
}
exports.ChannelService = ChannelService;
