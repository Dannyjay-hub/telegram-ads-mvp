import { supabase } from '../db';
import { bot } from '../botInstance';

/**
 * SchedulingService - Handles time proposal and negotiation workflow
 * 
 * Flow: approved → scheduling → scheduled → posted
 */

interface TimeProposal {
    dealId: string;
    proposedTime: Date;
    proposedBy: 'advertiser' | 'channel_owner';
}

export class SchedulingService {
    /**
     * Propose a posting time (called by advertiser after approving draft)
     */
    async proposeTime(
        dealId: string,
        proposedTime: Date,
        proposedBy: 'advertiser' | 'channel_owner'
    ): Promise<void> {
        // Get deal + channel info first for notification
        const { data: deal } = await (supabase as any)
            .from('deals')
            .select('channel_id, agreed_post_time, status')
            .eq('id', dealId)
            .single();

        // Check if time is already agreed - no more proposals allowed
        if (deal?.agreed_post_time) {
            throw new Error('Posting time already agreed. No more changes allowed.');
        }

        // Check if deal is in a valid status for scheduling
        if (deal?.status === 'scheduled' || deal?.status === 'posted') {
            throw new Error(`Cannot propose time. Deal is already ${deal.status}.`);
        }

        // Use optimistic locking - only update if agreed_post_time is still null
        const { error, count } = await (supabase as any)
            .from('deals')
            .update({
                proposed_post_time: proposedTime.toISOString(),
                time_proposed_by: proposedBy,
                status: 'scheduling',
                status_updated_at: new Date().toISOString()
            })
            .eq('id', dealId)
            .is('agreed_post_time', null) // Only update if not already agreed
            .select();

        if (error) {
            console.error('[SchedulingService] Error proposing time:', error);
            throw error;
        }

        // If no rows updated, time was agreed by someone else
        if (count === 0) {
            throw new Error('Posting time was already agreed by another admin.');
        }

        console.log(`[SchedulingService] Time proposed for deal ${dealId}: ${proposedTime}`);

        // Notify the other party
        if (bot && deal?.channel_id) {
            try {
                const formattedTime = proposedTime.toLocaleString('en-US', {
                    weekday: 'short',
                    month: 'short',
                    day: 'numeric',
                    hour: 'numeric',
                    minute: '2-digit',
                    hour12: true,
                    timeZone: 'Africa/Lagos' // Use user's timezone (UTC+1) instead of server UTC
                });

                if (proposedBy === 'advertiser') {
                    // Notify channel admins
                    const { data: admins } = await supabase
                        .from('channel_admins')
                        .select('users(telegram_id)')
                        .eq('channel_id', deal.channel_id);

                    for (const admin of (admins || [])) {
                        const telegramId = (admin as any)?.users?.telegram_id;
                        if (telegramId) {
                            await bot.api.sendMessage(
                                telegramId,
                                `⏰ **Time Proposed**\n\n` +
                                `The advertiser wants to post at:\n` +
                                `**${formattedTime}**\n\n` +
                                `Open the app to Accept or Counter.`,
                                {
                                    parse_mode: 'Markdown',
                                    reply_markup: {
                                        inline_keyboard: [[
                                            { text: '📱 View Partnership', url: `https://t.me/DanielAdsMVP_bot/marketplace?startapp=owner_deal_${dealId}` }
                                        ]]
                                    }
                                }
                            );
                        }
                    }
                    console.log(`[SchedulingService] Notified channel admins of time proposal`);
                } else {
                    // Notify advertiser - get advertiser_id directly from deal
                    const { data: dealDetails } = await (supabase as any)
                        .from('deals')
                        .select('advertiser_id')
                        .eq('id', dealId)
                        .single();

                    const advertiserId = dealDetails?.advertiser_id;
                    console.log(`[SchedulingService] Counter proposal - looking up advertiser ${advertiserId}`);

                    if (advertiserId) {
                        const { data: user } = await supabase
                            .from('users')
                            .select('telegram_id')
                            .eq('id', advertiserId)
                            .single();

                        console.log(`[SchedulingService] Found advertiser user:`, user);

                        if (user?.telegram_id) {
                            await bot.api.sendMessage(
                                user.telegram_id,
                                `⏰ **Counter Proposal**\n\n` +
                                `The channel owner wants to post at:\n` +
                                `**${formattedTime}**\n\n` +
                                `Open the app to Accept or Counter.`,
                                {
                                    parse_mode: 'Markdown',
                                    reply_markup: {
                                        inline_keyboard: [[
                                            { text: '📱 View Partnership', url: `https://t.me/DanielAdsMVP_bot/marketplace?startapp=deal_${dealId}` }
                                        ]]
                                    }
                                }
                            );
                            console.log(`[SchedulingService] ✅ Sent counter notification to advertiser ${user.telegram_id}`);
                        } else {
                            console.warn(`[SchedulingService] Advertiser has no telegram_id`);
                        }
                    } else {
                        console.warn(`[SchedulingService] Deal has no advertiser_id`);
                    }
                    console.log(`[SchedulingService] Notified advertiser of counter proposal`);
                }
            } catch (notifyError) {
                console.error('[SchedulingService] Error sending notification:', notifyError);
                // Don't throw - notification failure shouldn't fail the proposal
            }
        }
    }

    /**
     * Accept proposed time (locks the deal to scheduled status)
     */
    async acceptTime(dealId: string): Promise<Date> {
        // Get current proposal
        const { data: deal, error: fetchError } = await (supabase as any)
            .from('deals')
            .select('proposed_post_time, channel_id, agreed_post_time, status')
            .eq('id', dealId)
            .single();

        if (fetchError || !deal?.proposed_post_time) {
            throw new Error('No time proposal found');
        }

        // Check if time is already agreed - no double accepts
        if (deal.agreed_post_time) {
            throw new Error('Posting time already accepted. Check the app for details.');
        }

        // Check if deal is in valid status
        if (deal.status === 'scheduled' || deal.status === 'posted') {
            throw new Error(`Deal is already ${deal.status}.`);
        }

        const agreedTime = new Date(deal.proposed_post_time);
        const monitoringEnd = new Date(agreedTime.getTime() + 6 * 60 * 60 * 1000); // +6h (testing)

        // Lock the time - use optimistic locking
        const { error, count } = await (supabase as any)
            .from('deals')
            .update({
                agreed_post_time: agreedTime.toISOString(),
                monitoring_end_at: monitoringEnd.toISOString(),
                status: 'scheduled',
                status_updated_at: new Date().toISOString()
            })
            .eq('id', dealId)
            .is('agreed_post_time', null) // Only update if not already agreed
            .select();

        if (error) {
            console.error('[SchedulingService] Error accepting time:', error);
            throw error;
        }

        // If no rows updated, someone else already accepted
        if (count === 0) {
            throw new Error('Posting time was already accepted by another admin.');
        }

        console.log(`[SchedulingService] Time accepted for deal ${dealId}: ${agreedTime}`);

        // Send notifications to all parties
        if (bot && deal.channel_id) {
            try {
                const formattedTime = agreedTime.toLocaleString('en-US', {
                    weekday: 'short',
                    month: 'short',
                    day: 'numeric',
                    hour: 'numeric',
                    minute: '2-digit',
                    hour12: true,
                    timeZone: 'Africa/Lagos'
                });

                // Get deal details for advertiser info
                const { data: dealDetails } = await (supabase as any)
                    .from('deals')
                    .select('advertiser_id')
                    .eq('id', dealId)
                    .single();

                // Get channel info
                const { data: channel } = await supabase
                    .from('channels')
                    .select('title')
                    .eq('id', deal.channel_id)
                    .single();

                const channelTitle = channel?.title || 'the channel';

                // Notify advertiser
                if (dealDetails?.advertiser_id) {
                    const { data: advertiser } = await supabase
                        .from('users')
                        .select('telegram_id')
                        .eq('id', dealDetails.advertiser_id)
                        .single();

                    if (advertiser?.telegram_id) {
                        await bot.api.sendMessage(
                            advertiser.telegram_id,
                            `✅ **Time Confirmed!**\n\n` +
                            `Your ad on **${channelTitle}** is scheduled for:\n` +
                            `**${formattedTime}**\n\n` +
                            `The post will go live automatically at this time.`,
                            {
                                parse_mode: 'Markdown',
                                reply_markup: {
                                    inline_keyboard: [[
                                        { text: '📱 View Partnership', url: `https://t.me/DanielAdsMVP_bot/marketplace?startapp=deal_${dealId}` }
                                    ]]
                                }
                            }
                        );
                        console.log(`[SchedulingService] ✅ Notified advertiser ${advertiser.telegram_id}`);
                    }
                }

                // Notify all channel admins
                const { data: admins } = await supabase
                    .from('channel_admins')
                    .select('users(telegram_id)')
                    .eq('channel_id', deal.channel_id);

                for (const admin of (admins || [])) {
                    const telegramId = (admin as any)?.users?.telegram_id;
                    if (telegramId) {
                        await bot.api.sendMessage(
                            telegramId,
                            `✅ **Posting Time Confirmed!**\n\n` +
                            `**${channelTitle}** is scheduled to post at:\n` +
                            `**${formattedTime}**\n\n` +
                            `The ad will be published automatically.`,
                            {
                                parse_mode: 'Markdown',
                                reply_markup: {
                                    inline_keyboard: [[
                                        { text: '📱 View Partnership', url: `https://t.me/DanielAdsMVP_bot/marketplace?startapp=owner_deal_${dealId}` }
                                    ]]
                                }
                            }
                        );
                        console.log(`[SchedulingService] ✅ Notified admin ${telegramId}`);
                    }
                }
            } catch (notifyError) {
                console.error('[SchedulingService] Error sending accept notifications:', notifyError);
                // Don't fail the accept - notifications are not critical
            }
        }

        return agreedTime;
    }

    /**
     * Get current proposal for a deal
     */
    async getProposal(dealId: string): Promise<TimeProposal | null> {
        const { data, error } = await (supabase as any)
            .from('deals')
            .select('proposed_post_time, time_proposed_by')
            .eq('id', dealId)
            .single();

        if (error || !data?.proposed_post_time) return null;

        return {
            dealId,
            proposedTime: new Date(data.proposed_post_time),
            proposedBy: data.time_proposed_by
        };
    }

    /**
     * Get all deals that need to be posted now
     */
    async getDealsReadyToPost(): Promise<string[]> {
        const now = new Date().toISOString();

        const { data, error } = await (supabase as any)
            .from('deals')
            .select('id')
            .eq('status', 'scheduled')
            .lte('agreed_post_time', now);

        if (error) {
            console.error('[SchedulingService] Error fetching ready deals:', error);
            return [];
        }

        return data?.map((d: any) => d.id) || [];
    }
}
