import { Bot, Context, InlineKeyboard } from 'grammy';
import { supabase } from '../db';
import { bot } from '../botInstance';
import { DraftService } from './DraftService';
import { SupabaseUserRepository } from '../repositories/supabase/SupabaseUserRepository';

/**
 * PostEscrowBotHandlers - Registers all bot handlers for post-escrow workflow
 * 
 * Deep links:
 *  - /start draft_{dealId} - Enter draft creation mode
 *  - /start chat_{dealId} - Enter chat mode
 *  - /start review_{dealId} - View draft for review (advertiser)
 * 
 * Callbacks:
 *  - submit_draft_{dealId} - Submit draft for review
 *  - approve_draft_{dealId} - Approve the draft
 *  - changes_draft_{dealId} - Request changes
 */
import { getMiniAppUrl, getBotDeepLink } from '../botInstance';

const MINI_APP_URL = getMiniAppUrl();

export function registerPostEscrowHandlers(bot: Bot<Context>) {
    const draftService = new DraftService();
    const userRepo = new SupabaseUserRepository();

    // ============================================
    // DEEP LINK HANDLERS
    // ============================================

    bot.command('start', async (ctx, next) => {
        const payload = ctx.match?.toString() || '';

        // Handle draft mode
        if (payload.startsWith('draft_')) {
            const dealId = payload.replace('draft_', '');
            await handleEnterDraftMode(ctx, dealId, draftService, userRepo);
            return;
        }

        // Handle chat mode
        if (payload.startsWith('chat_')) {
            const dealId = payload.replace('chat_', '');
            await handleEnterChatMode(ctx, dealId, draftService, userRepo);
            return;
        }

        // Handle review mode (for advertiser)
        if (payload.startsWith('review_')) {
            const dealId = payload.replace('review_', '');
            await handleShowDraftForReview(ctx, dealId, draftService);
            return;
        }

        // Not our deep link, pass to next handler
        await next();
    });

    // ============================================
    // CONTENT RECEIVERS
    // ============================================

    // Receive draft content (text or photo)
    bot.on('message:text', async (ctx, next) => {
        const telegramId = ctx.from.id;
        const text = ctx.message.text;

        // Skip commands
        if (text.startsWith('/')) return next();

        // Check user context
        const { data: user } = await supabase
            .from('users')
            .select('id')
            .eq('telegram_id', telegramId)
            .single();

        if (!user) return next();

        const context = await draftService.getUserContext(user.id);
        if (!context) return next();

        if (context.contextType === 'draft') {
            await handleDraftTextReceived(ctx, context.dealId, text, draftService);
            return;
        }

        if (context.contextType === 'chat') {
            await handleChatMessage(ctx, context.dealId, text, draftService);
            return;
        }

        if (context.contextType === 'feedback') {
            await handleFeedbackReceived(ctx, context.dealId, text, draftService, user.id);
            return;
        }

        await next();
    });

    // Receive photo drafts
    bot.on('message:photo', async (ctx, next) => {
        const telegramId = ctx.from.id;

        const { data: user } = await supabase
            .from('users')
            .select('id')
            .eq('telegram_id', telegramId)
            .single();

        if (!user) return next();

        const context = await draftService.getUserContext(user.id);
        if (!context || context.contextType !== 'draft') return next();

        await handleDraftPhotoReceived(ctx, context.dealId, draftService);
    });

    // ============================================
    // CALLBACK QUERY HANDLERS
    // ============================================

    // Submit draft for review
    bot.callbackQuery(/^submit_draft_(.+)$/, async (ctx) => {
        const dealId = ctx.match![1];
        await handleSubmitDraft(ctx, dealId, draftService);
    });

    // Approve draft
    bot.callbackQuery(/^approve_draft_(.+)$/, async (ctx) => {
        const dealId = ctx.match![1];
        await handleApproveDraft(ctx, dealId, draftService);
    });

    // Request changes
    bot.callbackQuery(/^changes_draft_(.+)$/, async (ctx) => {
        const dealId = ctx.match![1];
        await handleRequestChanges(ctx, dealId, draftService);
    });

    // Revise draft (channel owner wants to edit again)
    bot.callbackQuery(/^revise_draft_(.+)$/, async (ctx) => {
        const dealId = ctx.match![1];
        await handleReviseDraft(ctx, dealId, draftService);
    });

    console.log('[PostEscrowBotHandlers] ✅ Registered all post-escrow handlers');
}

// ============================================
// HANDLER IMPLEMENTATIONS
// ============================================

async function handleEnterDraftMode(
    ctx: Context,
    dealId: string,
    draftService: DraftService,
    userRepo: SupabaseUserRepository
) {
    const telegramId = ctx.from?.id;
    if (!telegramId) return;

    // Get user
    const user = await userRepo.findByTelegramId(telegramId);
    if (!user) {
        await ctx.reply('❌ You need to register first. Please open the mini app.');
        return;
    }

    // Verify permission
    const permission = await draftService.verifyDealPermission(dealId, telegramId, 'channel_owner');
    if (!permission.valid) {
        await ctx.reply(`❌ ${permission.reason}`);
        return;
    }

    // Get deal info
    const deal = await draftService.getDealWithDraft(dealId);
    if (!deal) {
        await ctx.reply('❌ Deal not found.');
        return;
    }

    // Check deal is in correct state
    const validStates = ['funded', 'draft_pending', 'changes_requested'];
    if (!validStates.includes(deal.status)) {
        await ctx.reply(`❌ Cannot create draft. Deal is in status: ${deal.status}`);
        return;
    }

    // Set user context
    await draftService.setUserContext(user.id, {
        contextType: 'draft',
        dealId: dealId
    });

    // Show briefing
    let message = `📝 **Create Draft Post**\n\n`;
    message += `📢 Channel: ${deal.channel?.username ? `[${deal.channel.title}](https://t.me/${deal.channel.username})` : `**${deal.channel?.title || 'Unknown'}**`}\n`;
    message += `💰 Amount: **$${deal.price_amount}**\n\n`;

    if (deal.brief_text) {
        message += `📋 **Advertiser's Brief:**\n${deal.brief_text}\n\n`;
    }

    if (deal.draft_feedback) {
        message += `⚠️ **Previous Feedback:**\n_${deal.draft_feedback}_\n\n`;
    }

    message += `---\n\n`;
    message += `Send me the content you want to post.\n`;
    message += `You can send:\n`;
    message += `• Text message\n`;
    message += `• Photo with caption\n\n`;
    message += `Type /cancel to exit draft mode.`;

    await ctx.reply(message, { parse_mode: 'Markdown' });
}

async function handleEnterChatMode(
    ctx: Context,
    dealId: string,
    draftService: DraftService,
    userRepo: SupabaseUserRepository
) {
    const telegramId = ctx.from?.id;
    if (!telegramId) return;

    const user = await userRepo.findByTelegramId(telegramId);
    if (!user) {
        await ctx.reply('❌ You need to register first.');
        return;
    }

    // Get deal info
    const deal = await draftService.getDealWithDraft(dealId);
    if (!deal) {
        await ctx.reply('❌ Deal not found.');
        return;
    }

    // Set chat context
    await draftService.setUserContext(user.id, {
        contextType: 'chat',
        dealId: dealId
    });

    const otherParty = user.id === deal.advertiser_id
        ? `@${deal.channel?.username || deal.channel?.title || 'Channel'}`
        : 'the advertiser';

    await ctx.reply(
        `💬 **Chat Mode**\n\n` +
        `You are now chatting about deal with ${deal.channel?.username ? `[${deal.channel.title}](https://t.me/${deal.channel.username})` : `**${deal.channel?.title}**`}.\n\n` +
        `Messages you send will be forwarded to ${otherParty}.\n\n` +
        `Type /stop to exit chat mode.`,
        { parse_mode: 'Markdown' }
    );
}

async function handleShowDraftForReview(
    ctx: Context,
    dealId: string,
    draftService: DraftService
) {
    const deal = await draftService.getDealWithDraft(dealId);
    if (!deal) {
        await ctx.reply('❌ Deal not found.');
        return;
    }

    if (!deal.draft_text && !deal.draft_media_file_id) {
        await ctx.reply('❌ No draft has been submitted yet.');
        return;
    }

    // Show draft preview
    const keyboard = new InlineKeyboard()
        .text('✅ Approve', `approve_draft_${dealId}`)
        .text('✏️ Request Changes', `changes_draft_${dealId}`);

    if (deal.draft_media_file_id && deal.draft_media_type === 'photo') {
        await ctx.replyWithPhoto(deal.draft_media_file_id, {
            caption: `📋 **Draft Preview**\n\n${deal.draft_text || '(No caption)'}`,
            parse_mode: 'Markdown',
            reply_markup: keyboard
        });
    } else {
        await ctx.reply(
            `📋 **Draft Preview**\n\n${deal.draft_text}`,
            { parse_mode: 'Markdown', reply_markup: keyboard }
        );
    }
}

async function handleDraftTextReceived(
    ctx: Context,
    dealId: string,
    text: string,
    draftService: DraftService
) {
    // Save draft
    await draftService.saveDraft(dealId, { draftText: text });

    // Send raw content first (easy to copy)
    await ctx.reply(text);

    // Show preview info with submit button
    const keyboard = new InlineKeyboard()
        .text('✅ Submit for Review', `submit_draft_${dealId}`)
        .row()
        .text('✏️ Edit (send new text)', `revise_draft_${dealId}`);

    await ctx.reply(
        `📋 **Draft saved!** Copy the message above if you need to edit.\n\nReady to submit?`,
        { parse_mode: 'Markdown', reply_markup: keyboard }
    );
}

async function handleDraftPhotoReceived(
    ctx: Context,
    dealId: string,
    draftService: DraftService
) {
    const photo = ctx.message?.photo;
    if (!photo || photo.length === 0) return;

    // Get highest quality photo
    const fileId = photo[photo.length - 1].file_id;
    const caption = ctx.message?.caption || '';

    // Save draft
    await draftService.saveDraft(dealId, {
        draftText: caption,
        draftMediaFileId: fileId,
        draftMediaType: 'photo'
    });

    // Send photo with caption (easy to forward/copy)
    await ctx.replyWithPhoto(fileId, {
        caption: caption || undefined
    });

    // Show prompt with submit button
    const keyboard = new InlineKeyboard()
        .text('✅ Submit for Review', `submit_draft_${dealId}`)
        .row()
        .text('✏️ Edit (send new)', `revise_draft_${dealId}`);

    await ctx.reply(
        `📋 **Draft saved!** The photo above is your draft.\n\nReady to submit?`,
        { parse_mode: 'Markdown', reply_markup: keyboard }
    );
}

async function handleSubmitDraft(
    ctx: Context,
    dealId: string,
    draftService: DraftService
) {
    await ctx.answerCallbackQuery({ text: 'Submitting...' });

    const telegramId = ctx.from?.id;
    if (!telegramId) return;

    // Verify permission
    const permission = await draftService.verifyDealPermission(dealId, telegramId, 'channel_owner');
    if (!permission.valid) {
        await ctx.editMessageText(`❌ ${permission.reason}`);
        return;
    }

    try {
        await draftService.submitDraft(dealId);

        await ctx.editMessageText(
            `✅ **Draft Submitted!**\n\n` +
            `The advertiser will be notified to review your draft.\n` +
            `You'll receive a notification when they respond.`,
            { parse_mode: 'Markdown' }
        );

        // Clear user context
        const { data: user } = await supabase
            .from('users')
            .select('id')
            .eq('telegram_id', telegramId)
            .single();
        if (user) {
            await draftService.clearUserContext(user.id);
        }

        // Notify advertiser
        const deal = await draftService.getDealWithDraft(dealId);
        if (deal?.advertiser?.telegram_id) {
            const { bot } = await import('../botInstance');
            if (bot) {
                await bot.api.sendMessage(
                    deal.advertiser.telegram_id,
                    `📝 **New Draft Submitted!**\n\n` +
                    `${deal.channel?.username ? `[${deal.channel.title}](https://t.me/${deal.channel.username})` : `**${deal.channel?.title}**`} has submitted a draft for your review.`,
                    {
                        parse_mode: 'Markdown',
                        reply_markup: {
                            inline_keyboard: [[
                                { text: '👁 Review Draft', url: getBotDeepLink(`review_${dealId}`) }
                            ]]
                        }
                    }
                );
            }
        }
    } catch (error: any) {
        console.error('[PostEscrowBotHandlers] Error submitting draft:', error);
        // Use sendMessage as fallback - editMessageText fails on photo messages
        try {
            await ctx.editMessageText(`❌ Failed to submit draft. Please try again.`);
        } catch {
            await ctx.reply(`❌ Failed to submit draft. Please try again.`);
        }
    }
}

async function handleApproveDraft(
    ctx: Context,
    dealId: string,
    draftService: DraftService
) {
    await ctx.answerCallbackQuery({ text: 'Approving...' });

    const telegramId = ctx.from?.id;
    if (!telegramId) return;

    // Verify permission
    const permission = await draftService.verifyDealPermission(dealId, telegramId, 'advertiser');
    if (!permission.valid) {
        await ctx.editMessageText(`❌ ${permission.reason}`);
        return;
    }

    try {
        await draftService.approveDraft(dealId);

        const approvedText = `✅ **Draft Approved!**\n\nNow set the posting time in the mini app.`;
        const replyMarkup = {
            inline_keyboard: [[
                { text: '⏰ Set Posting Time', url: `${MINI_APP_URL}?startapp=schedule_${dealId}` }
            ]]
        };

        // Check message type to use correct edit method
        const msg = ctx.callbackQuery?.message;
        try {
            if (msg && ('photo' in msg || 'video' in msg || 'animation' in msg)) {
                // Photo/video message → edit caption
                await ctx.editMessageCaption({
                    caption: approvedText,
                    parse_mode: 'Markdown',
                    reply_markup: replyMarkup
                });
            } else {
                // Text message → edit text
                await ctx.editMessageText(approvedText, {
                    parse_mode: 'Markdown',
                    reply_markup: replyMarkup
                });
            }
        } catch {
            // Fallback: send new message if edit fails for any reason
            await ctx.reply(approvedText, {
                parse_mode: 'Markdown',
                reply_markup: replyMarkup
            });
        }

        // Notify channel owner that draft was approved
        const deal = await draftService.getDealWithDraft(dealId);
        if (deal?.channel_id) {
            const { data: ownerAdmin } = await supabase
                .from('channel_admins')
                .select('users(telegram_id)')
                .eq('channel_id', deal.channel_id)
                .eq('is_owner', true)
                .single();

            const ownerTelegramId = (ownerAdmin as any)?.users?.telegram_id;
            if (ownerTelegramId) {
                try {
                    await bot.api.sendMessage(
                        ownerTelegramId,
                        `✅ **Draft Approved!**\n\n` +
                        `The advertiser approved your draft for ${deal.channel?.username ? `[${deal.channel.title}](https://t.me/${deal.channel.username})` : `**${deal.channel?.title || 'your channel'}**`}.` +
                        `\n\nPlease go to the app to **schedule the post**.`,
                        {
                            parse_mode: 'Markdown',
                            reply_markup: {
                                inline_keyboard: [[
                                    { text: '⏰ Set Posting Time', url: `${MINI_APP_URL}?startapp=schedule_${dealId}` }
                                ]]
                            }
                        }
                    );
                } catch (notifErr) {
                    console.warn('[PostEscrowBotHandlers] Failed to notify channel owner of approval:', notifErr);
                }
            }
        }

    } catch (error: any) {
        console.error('[PostEscrowBotHandlers] Error approving draft:', error);
        try {
            await ctx.editMessageText(`❌ Failed to approve draft. Please try again.`);
        } catch {
            await ctx.reply(`❌ Failed to approve draft. Please try again.`);
        }
    }
}

async function handleRequestChanges(
    ctx: Context,
    dealId: string,
    draftService: DraftService
) {
    await ctx.answerCallbackQuery({ text: 'Please type your feedback...' });

    const telegramId = ctx.from?.id;
    if (!telegramId) return;

    // Verify permission
    const permission = await draftService.verifyDealPermission(dealId, telegramId, 'advertiser');
    if (!permission.valid) {
        await ctx.reply(`❌ ${permission.reason}`);
        return;
    }

    // Set context to receive feedback
    const { data: user } = await supabase
        .from('users')
        .select('id')
        .eq('telegram_id', telegramId)
        .single();

    if (user) {
        await draftService.setUserContext(user.id, {
            contextType: 'feedback',
            dealId: dealId
        });
    }

    await ctx.reply(
        `✏️ **Request Changes**\n\n` +
        `Type your feedback for the channel owner.\n` +
        `What would you like them to change?`,
        { parse_mode: 'Markdown' }
    );
}

async function handleFeedbackReceived(
    ctx: Context,
    dealId: string,
    feedback: string,
    draftService: DraftService,
    userId: string
) {
    try {
        await draftService.requestChanges(dealId, feedback);
        await draftService.clearUserContext(userId);

        await ctx.reply(
            `✅ **Feedback Sent!**\n\n` +
            `The channel owner will be notified to revise the draft.`,
            { parse_mode: 'Markdown' }
        );

        // Notify ALL channel admins with the feedback
        const deal = await draftService.getDealWithDraft(dealId);
        if (deal?.channel_id) {
            const { data: admins } = await supabase
                .from('channel_admins')
                .select('users(telegram_id)')
                .eq('channel_id', deal.channel_id);

            if (admins?.length) {
                for (const admin of admins) {
                    const telegramId = (admin as any)?.users?.telegram_id;
                    if (telegramId) {
                        await bot.api.sendMessage(
                            telegramId,
                            `✏️ **Changes Requested**\n\n` +
                            `The advertiser has requested changes to your draft.\n\n` +
                            `**Feedback:**\n"${feedback}"\n\n` +
                            `Please revise and resubmit.`,
                            {
                                parse_mode: 'Markdown',
                                reply_markup: {
                                    inline_keyboard: [[
                                        { text: '📝 Revise Draft', url: getBotDeepLink(`draft_${dealId}`) }
                                    ]]
                                }
                            }
                        );
                    }
                }
                console.log(`[PostEscrowBotHandlers] Sent feedback to ${admins.length} channel admin(s)`);
            }
        }

    } catch (error: any) {
        console.error('[PostEscrowBotHandlers] Error sending feedback:', error);
        await ctx.reply(`❌ Failed to send feedback. Please try again.`);
    }
}

async function handleReviseDraft(
    ctx: Context,
    dealId: string,
    draftService: DraftService
) {
    await ctx.answerCallbackQuery({ text: 'Send your new content...' });

    const telegramId = ctx.from?.id;
    if (!telegramId) return;

    const { data: user } = await supabase
        .from('users')
        .select('id')
        .eq('telegram_id', telegramId)
        .single();

    if (user) {
        await draftService.setUserContext(user.id, {
            contextType: 'draft',
            dealId: dealId
        });
    }

    await ctx.reply(
        `✏️ Send your revised content.\n` +
        `You can send text or a photo with caption.`,
        { parse_mode: 'Markdown' }
    );
}

async function handleChatMessage(
    ctx: Context,
    dealId: string,
    text: string,
    draftService: DraftService
) {
    const deal = await draftService.getDealWithDraft(dealId);
    if (!deal) {
        await ctx.reply('❌ Deal not found.');
        return;
    }

    const telegramId = ctx.from?.id;

    // Determine who sent this and who should receive
    const { data: sender } = await supabase
        .from('users')
        .select('id, username, first_name')
        .eq('telegram_id', telegramId)
        .single();

    if (!sender) return;

    const isAdvertiser = sender.id === deal.advertiser_id;
    const senderLabel = isAdvertiser ? 'Advertiser' : deal.channel?.title || 'Channel';

    // Store message
    await supabase.from('deal_messages').insert({
        deal_id: dealId,
        sender_id: sender.id,
        sender_role: isAdvertiser ? 'advertiser' : 'channel_owner',
        message_text: text,
        message_type: 'text'
    });

    // Forward to other party
    const { bot } = await import('../botInstance');
    if (!bot) return;

    let recipientTelegramId: number | null = null;

    if (isAdvertiser) {
        // Find channel owner's telegram ID
        const { data: channelAdmin } = await supabase
            .from('channel_admins')
            .select('user:users(telegram_id)')
            .eq('channel_id', deal.channel_id)
            .eq('is_owner', true)
            .single();
        recipientTelegramId = (channelAdmin?.user as any)?.telegram_id;
    } else {
        // Send to advertiser
        recipientTelegramId = deal.advertiser?.telegram_id;
    }

    if (recipientTelegramId) {
        try {
            await bot.api.sendMessage(
                recipientTelegramId,
                `💬 **Message from ${senderLabel}**\n\n${text}`,
                {
                    parse_mode: 'Markdown',
                    reply_markup: {
                        inline_keyboard: [[
                            { text: '💬 Reply', url: getBotDeepLink(`chat_${dealId}`) }
                        ]]
                    }
                }
            );
            await ctx.reply(`✅ Message sent!`);
        } catch (error) {
            console.error('[PostEscrowBotHandlers] Error forwarding message:', error);
            await ctx.reply(`⚠️ Message saved but failed to notify recipient.`);
        }
    } else {
        await ctx.reply(`✅ Message saved.`);
    }
}
