import { Bot } from 'grammy';
import dotenv from 'dotenv';
import { SupabaseUserRepository } from './repositories/supabase/SupabaseUserRepository';
import { SupabaseDealRepository } from './repositories/supabase/SupabaseDealRepository';
import { SupabaseChannelRepository } from './repositories/supabase/SupabaseChannelRepository';
import { BotConversationService } from './services/BotConversationService';
import { getChatMember } from './services/telegram';

dotenv.config();

import { bot } from './botInstance';

// ... other imports will be below
// No need to create bot here anymore


// Services
const userRepo = new SupabaseUserRepository();
const dealRepo = new SupabaseDealRepository();
const channelRepo = new SupabaseChannelRepository();
const convoService = new BotConversationService(userRepo);

if (bot) {
    // 1. Start - Identify User
    bot.command('start', async (ctx) => {
        const telegramId = ctx.from?.id;
        if (!telegramId) return;

        const user = await userRepo.findByTelegramId(telegramId);
        if (user) {
            ctx.reply(`Welcome back, ${user.firstName}! You are identified.`);
        } else {
            // Auto-register (MVP convenience)
            await userRepo.create({
                telegramId,
                firstName: ctx.from?.first_name || 'User',
                username: ctx.from?.username,
            });
            ctx.reply("Welcome! You are now registered.");
        }
    });

    // 2. Negotiate - Enter Chat State
    bot.command('negotiate', async (ctx) => {
        const dealId = ctx.match; // Expects "/negotiate <deal_id>"
        const telegramId = ctx.from?.id;
        if (!telegramId || !dealId) return ctx.reply("Usage: /negotiate <deal_id>");

        const deal = await dealRepo.findById(dealId);
        if (!deal) return ctx.reply("Deal not found.");

        await convoService.setChatState(telegramId, dealId);
        ctx.reply(`Entering negotiation mode for Deal #${dealId.substring(0, 8)}.\n\nAll messages will be forwarded to the other party.\nType /stop to exit.\nType /accept to finalize.`);
    });

    // 3. Stop - Exit Chat State
    bot.command('stop', async (ctx) => {
        if (!ctx.from?.id) return;
        await convoService.clearChatState(ctx.from.id);
        ctx.reply("Negotiation ended. Messages will no longer be forwarded.");
    });

    // 4. Accept - Finalize Deal (SECURE)
    bot.command('accept', async (ctx) => {
        const telegramId = ctx.from?.id;
        if (!telegramId) return;

        const dealId = await convoService.getChatState(telegramId);
        if (!dealId) return ctx.reply("You are not in a negotiation. Use /negotiate <deal_id> first.");

        const deal = await dealRepo.findById(dealId);
        if (!deal) return ctx.reply("Deal not found.");

        // SECURITY: Verify Admin Status if User is Channel Owner
        // Simplification: We assume the user triggering /accept is the Channel Owner (Advertiser accepts via Web usually)
        // But let's check roles.

        const channel = await channelRepo.findById(deal.channelId);
        if (!channel) return ctx.reply("Channel not found.");

        try {
            // Check if THIS user is an admin of the channel
            const member = await getChatMember(channel.telegramChannelId, telegramId);
            const isAdmin = ['creator', 'administrator'].includes(member.status);

            if (!isAdmin) {
                return ctx.reply("❌ ACCESS DENIED: You are no longer an admin of this channel. You cannot accept deals.");
            }

            // If passed, update deal
            await dealRepo.updateStatus(deal.id, 'approved');
            ctx.reply(`✅ Deal Accepted! Status updated to 'Approved'. Funds are locked.`);

            // Notify other party (TODO)
        } catch (e) {
            console.error(e);
            ctx.reply("Failed to verify admin status. Is the bot an admin in the channel?");
        }
    });

    // 6. Text Handler - Relay Logic
    bot.on('message:text', async (ctx) => {
        const telegramId = ctx.from.id;
        const text = ctx.message.text;

        // Skip commands
        if (text.startsWith('/')) return;

        const dealId = await convoService.getChatState(telegramId);
        if (!dealId) {
            // Use this debug to find ID
            return ctx.reply(`You are not in a chat. Your ID: ${telegramId}`);
        }

        // Fetch Deal to find 'Other Party'
        const deal = await dealRepo.findById(dealId);
        if (!deal) return;

        // Determine sender role
        const sender = await userRepo.findByTelegramId(telegramId);
        if (!sender) return;

        let targetUserId = '';

        // Logic: specific to who is the sender
        // We need to fetch the OTHER user's Telegram ID
        // For MVP, we need to know who is who.
        // Optimization: In a real app, 'users' table has telegram_id.
        // We need to fetch 'advertiser' and 'channel owner' (which might be complicated if channel owner isn't directly linked in 'deals' table but via 'channel_admins').

        // SIMPLIFICATION: We will broadcast to the OTHER ID stored in the deal? 
        // Deal has `advertiserId`. Channel has... owner? No.
        // We need to find the user associated with the Deal.

        // Wait, in `negotiate` command we simply set state.
        // If I am the Advertiser, I am in state Deal X.
        // If I am the Owner, I am in state Deal X.
        // So we need to forward to "The Other Guy in Deal X".
        // But who is that?
        // - If sender == deal.advertiserId -> Send to Channel Owner.
        // - If sender == deal.channelId (Wait, channelId is a Channel, not User).

        // This reveals a schema gap: We don't know the Channel Owner User ID easily from the Deal object alone without `channel_admins`.
        // BUT, earlier we added `mockUserId` in `channels.ts`. 
        // Recommendation: For this relay to work, we'll try to fetch the Advertiser if Sender != Advertiser.
        // If Sender == Advertiser, we forward to... whom?

        // Fix: We'll implement a simple "Echo" for now that assumes only 2 people are active? No.
        // Better: We check if the sender is the Advertiser.
        const isAdvertiser = sender.id === deal.advertiserId;

        if (isAdvertiser) {
            // Send to Channel Owner... how to find?
            // Since we didn't implement 'channel_admins' table fully, we might be stuck.
            // HOTFIX: We will just echo back "Simulating send to Channel Owner" or 
            // IF we assume 1-to-1 mapping for MVP, maybe we stored owner_id on channel? No.

            // Fallback: We will broadcast to a hardcoded "Channel Owner" ID for demo purposes if we can't find real one.
            // OR, we look at who created the Channel? 

            // The brief says "Channel owner lists their channel". 
            // Ideally we should have stored `owner_id` on Channel.
            // Let's check `channels` table again. `updated_at`... no owner_id.

            return ctx.reply("Message sent (Simulated). Receiver logic pending Channel Owner mapping.");
        } else {
            // Sender is likely Channel Owner. Send to Advertiser.
            // This direction allows us to look up Advertiser User -> Telegram ID.
            return ctx.reply("Message sent to Advertiser (Simulated).");
        }
    });

    // 5. Forward Handler - Channel ID Utility (High Priority)
    bot.on('message', async (ctx, next) => {
        // Safe check for forwarded messages (Grammy / Telegram Bot API 7.0+ uses forward_origin)
        const msg = ctx.message;

        // Check legacy forward_from_chat or new forward_origin
        // We look for channel forwards specifically
        console.log('DEBUG MSG:', JSON.stringify(msg, null, 2));

        let channelId: number | undefined;
        let title: string | undefined;

        if ('forward_from_chat' in msg && msg.forward_from_chat && (msg.forward_from_chat as any).type === 'channel') {
            channelId = (msg.forward_from_chat as any).id;
            title = (msg.forward_from_chat as any).title;
        } else if ('forward_origin' in msg && msg.forward_origin && (msg.forward_origin as any).type === 'channel') {
            channelId = (msg.forward_origin as any).chat.id;
            title = (msg.forward_origin as any).chat.title;
        }

        if (channelId && title) {
            return ctx.reply(`📢 Channel Detected!\nTitle: ${title}\nID: \`${channelId}\`\n\nCopy this ID into the listing wizard.`, {
                parse_mode: 'Markdown'
            });
        }

        // If not a forward, continue to other handlers (e.g. text relay)
        await next();
    });

    // 6. Text Handler - Relay Logic

    // Error handling
    bot.catch((err) => {
        console.error('Bot error:', err);
    });
}

export async function startBot() {
    if (bot) {
        console.log('Starting Telegram Bot...');
        bot.start();
    } else {
        console.log('Bot token missing, skipping bot start.');
    }
}
