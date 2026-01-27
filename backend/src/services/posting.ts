import { bot } from '../bot';
import { supabase } from '../db';

/**
 * Mocks the scheduling/posting process.
 * In a real app, this would add a job to a queue (BullMQ/Redis).
 * For MVP, we just post immediately or log it.
 */
export async function schedulePost(dealId: string, channelId: string, content: any, scheduledTime?: string) {
    console.log(`[SCHEDULER] Scheduling post for Deal ${dealId} on Channel ${channelId} at ${scheduledTime || 'NOW'}`);

    // Fetch channel's telegram ID
    const { data: channel } = await (supabase
        .from('channels') as any)
        .select('telegram_channel_id')
        .eq('id', channelId)
        .single();

    if (!channel || !channel.telegram_channel_id) {
        console.error(`[SCHEDULER] Channel ${channelId} has no telegram_channel_id`);
        return;
    }

    // Determine what to post. simpler for MVP: just the "brief_text" or "creative_content"
    const messageText = typeof content === 'string' ? content : JSON.stringify(content);

    // Simulate "Posting"
    let success = false;
    if (bot) {
        try {
            await bot.api.sendMessage(channel.telegram_channel_id, `[AD] ${messageText}`);
            console.log(`[POSTING] Successfully posted to ${channel.telegram_channel_id}`);
            success = true;
        } catch (e) {
            console.error(`[POSTING] Failed to post to Telegram:`, e);
        }
    } else {
        console.log(`[MOCK POST] To Channel ${channel.telegram_channel_id}: "[AD] ${messageText}"`);
        success = true;
    }

    if (success) {
        // Update Deal Status to 'posted' (or 'active') and set actual_post_time
        const { error } = await (supabase
            .from('deals') as any)
            .update({
                status: 'posted',
                actual_post_time: new Date().toISOString()
            })
            .eq('id', dealId);

        if (error) console.error(`[POSTING] Failed to update deal status: ${error.message}`);
        else console.log(`[POSTING] Deal ${dealId} marked as POSTED.`);
    }

    return success;
}
