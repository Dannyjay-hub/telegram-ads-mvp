import { Bot } from 'grammy';
import dotenv from 'dotenv';
import { SupabaseUserRepository } from './repositories/supabase/SupabaseUserRepository';
import { SupabaseDealRepository } from './repositories/supabase/SupabaseDealRepository';
import { SupabaseChannelRepository } from './repositories/supabase/SupabaseChannelRepository';
import { BotConversationService } from './services/BotConversationService';
import { getChatMember } from './services/telegram';
import { registerPostEscrowHandlers } from './services/PostEscrowBotHandlers';

dotenv.config();

import { bot } from './botInstance';

// ... other imports will be below
// No need to create bot here anymore


// Services
const userRepo = new SupabaseUserRepository();
const dealRepo = new SupabaseDealRepository();
const channelRepo = new SupabaseChannelRepository();
const convoService = new BotConversationService(userRepo);

// Register post-escrow handlers FIRST (they handle deep links)
if (bot) {
    registerPostEscrowHandlers(bot);

    // Handle bot being added/removed from channels
    // This fires when a user adds our bot as admin to their channel
    bot.on('my_chat_member', async (ctx) => {
        const update = ctx.myChatMember;
        // Only track channel events (not groups/supergroups)
        if (update.chat.type !== 'channel') return;

        try {
            const { supabase } = await import('./db');
            await (supabase as any).from('bot_channel_events').insert({
                chat_id: update.chat.id,
                chat_title: update.chat.title || null,
                chat_username: (update.chat as any).username || null,
                chat_type: update.chat.type,
                added_by_user_id: update.from.id,
                bot_status: update.new_chat_member.status,
            });
            console.log(`[bot] my_chat_member: ${update.new_chat_member.status} in channel ${update.chat.title} (${update.chat.id}) by user ${update.from.id}`);
        } catch (e) {
            console.error('[bot] Failed to store my_chat_member event:', e);
        }
    });

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

    // 7. Deal Rating Callback Handler
    bot.on('callback_query:data', async (ctx) => {
        const data = ctx.callbackQuery.data;
        if (!data.startsWith('rate_deal:')) return;

        const parts = data.split(':');
        if (parts.length !== 3) return;

        const dealId = parts[1];
        const rating = parseInt(parts[2], 10);

        if (isNaN(rating) || rating < 1 || rating > 5) {
            await ctx.answerCallbackQuery({ text: 'Invalid rating' });
            return;
        }

        try {
            const { supabase } = await import('./db');

            // Check if already rated
            const { data: deal } = await (supabase as any)
                .from('deals')
                .select('id, rating, channel_id')
                .eq('id', dealId)
                .single();

            if (!deal) {
                await ctx.answerCallbackQuery({ text: 'Deal not found' });
                return;
            }

            if (deal.rating) {
                await ctx.answerCallbackQuery({ text: `Already rated ${deal.rating} ⭐` });
                return;
            }

            // Save rating to deal
            await (supabase as any)
                .from('deals')
                .update({ rating })
                .eq('id', dealId);

            // Update channel avg_rating and total_ratings
            const { data: channelRatings } = await (supabase as any)
                .from('deals')
                .select('rating')
                .eq('channel_id', deal.channel_id)
                .not('rating', 'is', null);

            if (channelRatings && channelRatings.length > 0) {
                const avg = channelRatings.reduce((sum: number, d: any) => sum + d.rating, 0) / channelRatings.length;
                await (supabase as any)
                    .from('channels')
                    .update({
                        avg_rating: Math.round(avg * 100) / 100,
                        total_ratings: channelRatings.length
                    })
                    .eq('id', deal.channel_id);
            }

            // Edit the message to show the selected rating and remove buttons
            // Get channel info for context
            const { data: channel } = await (supabase as any)
                .from('channels')
                .select('title, username')
                .eq('id', deal.channel_id)
                .single();
            const channelLink = channel?.username
                ? `[${channel.title}](https://t.me/${channel.username})`
                : `**${channel?.title || 'the channel'}**`;
            const stars = '⭐'.repeat(rating);
            await ctx.editMessageText(
                `✅ **Deal Completed!**\n\nYour post on ${channelLink} stayed live for 24 hours and funds have been released.\n\nYour rating: ${stars} (${rating}/5)\n\nThank you for using our platform!`,
                { parse_mode: 'Markdown' }
            );

            await ctx.answerCallbackQuery({ text: `Rated ${rating} ⭐ — Thank you!` });
        } catch (e) {
            console.error('Rating error:', e);
            await ctx.answerCallbackQuery({ text: 'Failed to save rating' });
        }
    });

    // 8. Edit Detection — instant cancellation when a monitored ad is edited
    bot.on('edited_channel_post', async (ctx) => {
        const editedPost = ctx.editedChannelPost;
        const channelId = editedPost.chat.id;
        const messageId = editedPost.message_id;

        console.log(`[EditDetection] 📝 Edit event received — channel ${channelId}, message ${messageId}`);

        try {
            const { supabase } = await import('./db');

            // Step 1: Find the channel by telegram_channel_id
            const { data: channel } = await (supabase as any)
                .from('channels')
                .select('id, title, username')
                .eq('telegram_channel_id', channelId)
                .single();

            if (!channel) {
                console.log(`[EditDetection] Channel ${channelId} not found in DB — ignoring`);
                return;
            }

            // Step 2: Find active monitored deal for this message
            const { data: deals, error } = await (supabase as any)
                .from('deals')
                .select(`
                    id, posted_message_id, status, price_amount, price_currency,
                    advertiser_wallet_address, campaign_id, channel_id,
                    advertiser:users!deals_advertiser_id_fkey(telegram_id)
                `)
                .in('status', ['posted', 'monitoring'])
                .eq('posted_message_id', messageId)
                .eq('channel_id', channel.id);

            if (error) {
                console.error(`[EditDetection] Query error:`, error);
                return;
            }

            if (!deals || deals.length === 0) {
                console.log(`[EditDetection] No active deal for message ${messageId} in channel ${channel.title} — ignoring`);
                return;
            }

            const deal = deals[0];
            // Attach channel info for notifications
            deal.channel = channel;
            console.log(`[EditDetection] ⚠️ EDIT DETECTED on deal ${deal.id} — message ${messageId} in channel ${channel.title} (${channelId})`);

            // 1. Cancel the deal
            await (supabase as any)
                .from('deals')
                .update({
                    status: 'cancelled',
                    status_updated_at: new Date().toISOString()
                })
                .eq('id', deal.id);

            console.log(`[EditDetection] Deal ${deal.id} cancelled due to post edit`);

            const channelLink = deal.channel.username
                ? `[${deal.channel.title}](https://t.me/${deal.channel.username})`
                : `**${deal.channel.title}**`;

            // 2. Refund advertiser if they paid
            if (deal.advertiser_wallet_address && deal.price_amount) {
                try {
                    const { tonPayoutService } = await import('./services/TonPayoutService');
                    await tonPayoutService.queueRefund(
                        deal.id,
                        deal.advertiser_wallet_address,
                        deal.price_amount,
                        (deal.price_currency as 'TON' | 'USDT') || 'TON',
                        'Post edited during monitoring period'
                    );
                    console.log(`[EditDetection] Refund queued for deal ${deal.id}`);
                } catch (refundErr) {
                    console.error(`[EditDetection] Refund queue failed for deal ${deal.id}:`, refundErr);
                }
            }

            // 3. Release campaign slot if this was a campaign deal
            if (deal.campaign_id) {
                try {
                    const { SupabaseCampaignRepository } = await import('./repositories/supabase/SupabaseCampaignRepository');
                    const campaignRepo = new SupabaseCampaignRepository();
                    await campaignRepo.releaseSlot(deal.campaign_id, deal.price_amount || 0);
                    console.log(`[EditDetection] Campaign slot released for deal ${deal.id}`);
                } catch (slotErr) {
                    console.error(`[EditDetection] Slot release failed for deal ${deal.id}:`, slotErr);
                }
            }

            // 4. Notify advertiser
            if (deal.advertiser?.telegram_id) {
                const refundNote = deal.advertiser_wallet_address
                    ? 'Your funds will be refunded to your wallet.'
                    : 'Please contact support regarding your refund.';
                try {
                    await bot!.api.sendMessage(
                        deal.advertiser.telegram_id,
                        `⚠️ **Ad Post Edited**\n\n` +
                        `The post in ${channelLink} was edited during the monitoring period.\n\n` +
                        `This is a violation of the advertising agreement. The deal has been cancelled.\n\n` +
                        `${refundNote}`,
                        { parse_mode: 'Markdown' }
                    );
                } catch (e) {
                    console.warn('[EditDetection] Failed to notify advertiser:', e);
                }
            }

            // 5. Notify channel admins
            if (deal.channel_id) {
                try {
                    const { data: channelAdmins } = await (supabase as any)
                        .from('channel_admins')
                        .select('user:users(telegram_id)')
                        .eq('channel_id', deal.channel_id);

                    if (channelAdmins) {
                        for (const admin of channelAdmins) {
                            const tid = (admin as any)?.user?.telegram_id;
                            if (!tid) continue;
                            try {
                                await bot!.api.sendMessage(tid,
                                    `⚠️ **Ad Post Edited**\n\n` +
                                    `The ad post in ${channelLink} was edited during the monitoring period.\n\n` +
                                    `The deal has been cancelled and the advertiser will be refunded.`,
                                    { parse_mode: 'Markdown' }
                                );
                            } catch (e) { /* skip */ }
                        }
                    }
                } catch (e) {
                    console.warn('[EditDetection] Failed to notify channel admins:', e);
                }
            }
        } catch (e) {
            console.error('[EditDetection] Error processing edit:', e);
        }
    });

    // Error handling
    bot.catch((err) => {
        console.error('Bot error:', err);
    });
}

export async function startBot() {
    if (bot) {
        console.log('Starting Telegram Bot...');
        try {
            // Drop pending updates to prevent 409 conflict with previous instance
            await bot.api.deleteWebhook({ drop_pending_updates: false });
            console.log('Cleared pending updates');

            // Start polling — include edited_channel_post for edit detection
            bot.start({
                onStart: () => console.log('Bot started successfully'),
                allowed_updates: [
                    'message',
                    'edited_channel_post',
                    'my_chat_member',
                    'callback_query',
                ],
            });
        } catch (error) {
            console.error('Failed to start bot:', error);
        }
    } else {
        console.log('Bot token missing, skipping bot start.');
    }
}
