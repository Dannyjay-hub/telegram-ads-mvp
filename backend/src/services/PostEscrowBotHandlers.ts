import { Bot, Context, InlineKeyboard } from 'grammy';
import { supabase } from '../db';
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

const MINI_APP_URL = 'https://t.me/DanielAdsMVP_bot/marketplace';

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
    message += `📢 Channel: **${deal.channel?.title || 'Unknown'}**\n`;
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
        `You are now chatting about deal with **${deal.channel?.title}**.\n\n` +
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

    // Show preview with submit button
    const keyboard = new InlineKeyboard()
        .text('✅ Submit for Review', `submit_draft_${dealId}`)
        .row()
        .text('✏️ Edit (send new text)', `revise_draft_${dealId}`);

    await ctx.reply(
        `📋 **Draft Preview**\n\n${text}\n\n---\n_This is how it will appear in the channel._`,
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

    // Show preview
    const keyboard = new InlineKeyboard()
        .text('✅ Submit for Review', `submit_draft_${dealId}`)
        .row()
        .text('✏️ Edit (send new)', `revise_draft_${dealId}`);

    await ctx.replyWithPhoto(fileId, {
        caption: `📋 **Draft Preview**\n\n${caption || '(No caption)'}\n\n---\n_This is how it will appear in the channel._`,
        parse_mode: 'Markdown',
        reply_markup: keyboard
    });
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
                    `Channel **${deal.channel?.title}** has submitted a draft for your review.`,
                    {
                        parse_mode: 'Markdown',
                        reply_markup: {
                            inline_keyboard: [[
                                { text: '👁 Review Draft', url: `https://t.me/DanielAdsMVP_bot?start=review_${dealId}` }
                            ]]
                        }
                    }
                );
            }
        }
    } catch (error: any) {
        console.error('[PostEscrowBotHandlers] Error submitting draft:', error);
        await ctx.editMessageText(`❌ Failed to submit draft. Please try again.`);
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

        await ctx.editMessageText(
            `✅ **Draft Approved!**\n\n` +
            `Now set the posting time in the mini app.`,
            {
                parse_mode: 'Markdown',
                reply_markup: {
                    inline_keyboard: [[
                        { text: '⏰ Set Posting Time', url: `${MINI_APP_URL}?startapp=schedule_${dealId}` }
                    ]]
                }
            }
        );

        // Notify channel owner
        const deal = await draftService.getDealWithDraft(dealId);
        // We need to get channel owner's telegram ID - this requires joining through channel_admins
        // For now, we'll add this notification logic later

    } catch (error: any) {
        console.error('[PostEscrowBotHandlers] Error approving draft:', error);
        await ctx.editMessageText(`❌ Failed to approve draft. Please try again.`);
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

        // Notify channel owner
        const deal = await draftService.getDealWithDraft(dealId);
        // TODO: Notify channel owner with feedback

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
                            { text: '💬 Reply', url: `https://t.me/DanielAdsMVP_bot?start=chat_${dealId}` }
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
