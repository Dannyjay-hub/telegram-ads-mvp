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
            .select('channel_id')
            .eq('id', dealId)
            .single();

        const { error } = await (supabase as any)
            .from('deals')
            .update({
                proposed_post_time: proposedTime.toISOString(),
                time_proposed_by: proposedBy,
                status: 'scheduling',
                status_updated_at: new Date().toISOString()
            })
            .eq('id', dealId);

        if (error) {
            console.error('[SchedulingService] Error proposing time:', error);
            throw error;
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
                    hour12: true
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
                                            { text: '📱 View in App', url: 'https://t.me/DanielAdsMVP_bot/marketplace' }
                                        ]]
                                    }
                                }
                            );
                        }
                    }
                    console.log(`[SchedulingService] Notified channel admins of time proposal`);
                } else {
                    // Notify advertiser - need to get advertiser telegram_id
                    const { data: dealDetails } = await (supabase as any)
                        .from('deals')
                        .select('campaigns(advertiser_id)')
                        .eq('id', dealId)
                        .single();

                    const advertiserId = dealDetails?.campaigns?.advertiser_id;
                    if (advertiserId) {
                        const { data: user } = await supabase
                            .from('users')
                            .select('telegram_id')
                            .eq('id', advertiserId)
                            .single();

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
                                            { text: '📱 View in App', url: 'https://t.me/DanielAdsMVP_bot/marketplace' }
                                        ]]
                                    }
                                }
                            );
                        }
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
            .select('proposed_post_time, channel_id')
            .eq('id', dealId)
            .single();

        if (fetchError || !deal?.proposed_post_time) {
            throw new Error('No time proposal found');
        }

        const agreedTime = new Date(deal.proposed_post_time);
        const monitoringEnd = new Date(agreedTime.getTime() + 6 * 60 * 60 * 1000); // +6h (testing)

        // Lock the time
        const { error } = await (supabase as any)
            .from('deals')
            .update({
                agreed_post_time: agreedTime.toISOString(),
                monitoring_end_at: monitoringEnd.toISOString(),
                status: 'scheduled',
                status_updated_at: new Date().toISOString()
            })
            .eq('id', dealId);

        if (error) {
            console.error('[SchedulingService] Error accepting time:', error);
            throw error;
        }

        console.log(`[SchedulingService] Time accepted for deal ${dealId}: ${agreedTime}`);
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
