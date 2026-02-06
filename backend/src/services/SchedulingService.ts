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
