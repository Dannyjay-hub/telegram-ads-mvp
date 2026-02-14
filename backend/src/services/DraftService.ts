import { supabase } from '../db';
import { getMiniAppUrl } from '../botInstance';
import { bot } from '../botInstance';
import { SupabaseDealRepository } from '../repositories/supabase/SupabaseDealRepository';
import { SupabaseChannelRepository } from '../repositories/supabase/SupabaseChannelRepository';

/**
 * DraftService - Handles draft creation, submission, and review workflow
 * 
 * Flow: funded → draft_pending → draft_submitted → approved/changes_requested
 */

type DealStatus = 'draft_pending' | 'draft_submitted' | 'changes_requested' | 'approved';

interface DraftData {
    draftText: string;
    draftMediaFileId?: string;
    draftMediaType?: 'photo' | 'video' | 'document';
}

interface UserContext {
    userId: string;
    contextType: 'draft' | 'chat' | 'schedule' | 'feedback';
    dealId: string;
    extraData?: Record<string, any>;
}

export class DraftService {
    private dealRepo: SupabaseDealRepository;
    private channelRepo: SupabaseChannelRepository;

    constructor() {
        this.dealRepo = new SupabaseDealRepository();
        this.channelRepo = new SupabaseChannelRepository();
    }

    /**
     * Set user context for bot conversation tracking
     */
    async setUserContext(userId: string, context: Omit<UserContext, 'userId'>): Promise<void> {
        const { error } = await supabase
            .from('user_contexts')
            .upsert({
                user_id: userId,
                context_type: context.contextType,
                deal_id: context.dealId,
                extra_data: context.extraData || {},
                updated_at: new Date().toISOString()
            }, { onConflict: 'user_id' });

        if (error) {
            console.error('[DraftService] Error setting user context:', error);
            throw error;
        }
    }

    /**
     * Get user's current conversation context
     */
    async getUserContext(userId: string): Promise<UserContext | null> {
        const { data, error } = await supabase
            .from('user_contexts')
            .select('*')
            .eq('user_id', userId)
            .single();

        if (error || !data) return null;

        return {
            userId: data.user_id,
            contextType: data.context_type,
            dealId: data.deal_id,
            extraData: data.extra_data
        };
    }

    /**
     * Clear user's current context
     */
    async clearUserContext(userId: string): Promise<void> {
        await supabase
            .from('user_contexts')
            .delete()
            .eq('user_id', userId);
    }

    /**
     * Save draft to database (doesn't submit yet)
     * Only allows saving if deal is in draft_pending or changes_requested status
     */
    async saveDraft(dealId: string, draft: DraftData): Promise<void> {
        // First check if draft is still editable (hasn't been submitted by someone else)
        const { data: currentDeal } = await supabase
            .from('deals')
            .select('status')
            .eq('id', dealId)
            .single();

        if (!currentDeal) {
            throw new Error('Deal not found');
        }

        // Only allow drafting if status allows it
        const editableStatuses = ['draft_pending', 'changes_requested'];
        if (!editableStatuses.includes(currentDeal.status)) {
            throw new Error(`Draft already submitted for review. Current status: ${currentDeal.status}`);
        }

        const { error } = await supabase
            .from('deals')
            .update({
                draft_text: draft.draftText,
                draft_media_file_id: draft.draftMediaFileId || null,
                draft_media_type: draft.draftMediaType || null,
                draft_version: supabase.rpc ? undefined : 1, // Will increment in submit
                updated_at: new Date().toISOString()
            })
            .eq('id', dealId)
            .in('status', editableStatuses); // Only update if still in editable status

        if (error) {
            console.error('[DraftService] Error saving draft:', error);
            throw error;
        }

        console.log(`[DraftService] Draft saved for deal ${dealId}`);
    }

    /**
     * Submit draft for advertiser review
     * Only allows submitting if deal is in draft_pending or changes_requested status
     */
    async submitDraft(dealId: string): Promise<void> {
        // First check if draft can still be submitted (hasn't been submitted by someone else)
        const { data: currentDeal } = await supabase
            .from('deals')
            .select('status')
            .eq('id', dealId)
            .single();

        if (!currentDeal) {
            throw new Error('Deal not found');
        }

        // Only allow submitting if status allows it
        const submittableStatuses = ['draft_pending', 'changes_requested'];
        if (!submittableStatuses.includes(currentDeal.status)) {
            throw new Error(`Draft already submitted for review by another admin. Current status: ${currentDeal.status}`);
        }

        // Update status with condition to prevent race
        const { error, count } = await supabase
            .from('deals')
            .update({
                status: 'draft_submitted',
                draft_submitted_at: new Date().toISOString(),
                draft_feedback: null, // Clear previous feedback
                status_updated_at: new Date().toISOString()
            })
            .eq('id', dealId)
            .in('status', submittableStatuses as any) // Only update if still submittable
            .select();

        if (error) {
            console.error('[DraftService] Error submitting draft:', error);
            throw error;
        }

        // If no rows were updated, someone else beat us to it
        if (count === 0) {
            throw new Error('Draft already submitted by another admin');
        }

        // Update status history
        await this.appendStatusHistory(dealId, 'draft_submitted');

        console.log(`[DraftService] Draft submitted for deal ${dealId}`);
        // Note: Notifications are sent by PostEscrowBotHandlers.handleSubmitDraft()
        // which calls this method. Do NOT send duplicate notifications here.
    }

    /**
     * Advertiser approves the draft
     * Only allows if status is draft_submitted
     */
    async approveDraft(dealId: string): Promise<void> {
        // First check if we can approve (only if draft is submitted)
        const { data: currentDeal } = await supabase
            .from('deals')
            .select('status')
            .eq('id', dealId)
            .single();

        if (!currentDeal) {
            throw new Error('Deal not found');
        }

        // Only allow approving if draft was submitted
        if (currentDeal.status !== 'draft_submitted') {
            throw new Error(`Cannot approve draft. Current status: ${currentDeal.status}`);
        }

        const { error, count } = await supabase
            .from('deals')
            .update({
                status: 'scheduling',
                status_updated_at: new Date().toISOString()
            })
            .eq('id', dealId)
            .eq('status', 'draft_submitted') // Only update if still draft_submitted
            .select();

        if (error) {
            console.error('[DraftService] Error approving draft:', error);
            throw error;
        }

        // If no rows were updated, status already changed
        if (count === 0) {
            throw new Error('Draft already approved or status changed');
        }

        await this.appendStatusHistory(dealId, 'approved');
        await this.appendStatusHistory(dealId, 'scheduling');

        console.log(`[DraftService] Draft approved for deal ${dealId}, now in scheduling`);
    }

    /**
     * Advertiser requests changes to the draft
     * Only allows if status is draft_submitted
     */
    async requestChanges(dealId: string, feedback: string): Promise<void> {
        // First check if we can request changes (only if draft is submitted)
        const { data: currentDeal } = await supabase
            .from('deals')
            .select('status')
            .eq('id', dealId)
            .single();

        if (!currentDeal) {
            throw new Error('Deal not found');
        }

        // Only allow requesting changes if draft was submitted
        if (currentDeal.status !== 'draft_submitted') {
            throw new Error(`Cannot request changes. Current status: ${currentDeal.status}`);
        }

        const { error, count } = await supabase
            .from('deals')
            .update({
                status: 'changes_requested',
                draft_feedback: feedback,
                status_updated_at: new Date().toISOString()
            })
            .eq('id', dealId)
            .eq('status', 'draft_submitted') // Only update if still draft_submitted
            .select();

        if (error) {
            console.error('[DraftService] Error requesting changes:', error);
            throw error;
        }

        // If no rows were updated, status already changed
        if (count === 0) {
            throw new Error('Changes already requested or draft status changed');
        }

        await this.appendStatusHistory(dealId, 'changes_requested');

        console.log(`[DraftService] Changes requested for deal ${dealId}`);
    }

    /**
     * Get deal with draft info
     */
    async getDealWithDraft(dealId: string): Promise<any> {
        const { data, error } = await supabase
            .from('deals')
            .select(`
                *,
                channel:channels(*),
                advertiser:users!deals_advertiser_id_fkey(*)
            `)
            .eq('id', dealId)
            .single();

        if (error) {
            console.error('[DraftService] Error fetching deal:', error);
            return null;
        }

        return data;
    }

    /**
     * Verify user has permission to act on this deal (admin check)
     */
    async verifyDealPermission(
        dealId: string,
        userTelegramId: number,
        role: 'channel_owner' | 'advertiser'
    ): Promise<{ valid: boolean; reason?: string }> {
        const deal = await this.getDealWithDraft(dealId);
        if (!deal) {
            return { valid: false, reason: 'Deal not found' };
        }

        if (role === 'advertiser') {
            // Check if user is the advertiser
            const { data: user } = await supabase
                .from('users')
                .select('id')
                .eq('telegram_id', userTelegramId)
                .single();

            if (!user || user.id !== deal.advertiser_id) {
                return { valid: false, reason: 'You are not the advertiser for this deal' };
            }
            return { valid: true };
        }

        // For channel owner, verify they're still admin on Telegram
        if (!bot) {
            return { valid: false, reason: 'Bot not configured' };
        }

        try {
            const member = await bot.api.getChatMember(
                deal.channel.telegram_channel_id,
                userTelegramId
            );

            if (!['administrator', 'creator'].includes(member.status)) {
                return { valid: false, reason: 'You are no longer an admin of this channel' };
            }

            // Check posting permission
            if (member.status === 'administrator' && !member.can_post_messages) {
                return { valid: false, reason: 'You do not have posting permissions' };
            }

            return { valid: true };
        } catch (error: any) {
            console.error('[DraftService] Error checking permissions:', error);
            return { valid: false, reason: 'Failed to verify admin status' };
        }
    }

    /**
     * Verify bot is still admin with posting rights
     */
    async verifyBotPermission(channelTelegramId: number): Promise<{ valid: boolean; reason?: string }> {
        if (!bot) {
            return { valid: false, reason: 'Bot not configured' };
        }

        try {
            const botInfo = await bot.api.getMe();
            const member = await bot.api.getChatMember(channelTelegramId, botInfo.id);

            if (member.status !== 'administrator') {
                return { valid: false, reason: 'Bot is no longer an admin of this channel' };
            }

            if (!member.can_post_messages) {
                return { valid: false, reason: 'Bot does not have posting permissions' };
            }

            return { valid: true };
        } catch (error: any) {
            console.error('[DraftService] Error checking bot permissions:', error);
            return { valid: false, reason: 'Failed to verify bot permissions' };
        }
    }

    /**
     * Update deal to draft_pending after funding (called when deal is funded)
     */
    async initializeDraftWorkflow(dealId: string): Promise<void> {
        const { error } = await supabase
            .from('deals')
            .update({
                status: 'draft_pending',
                funded_at: new Date().toISOString(),
                status_updated_at: new Date().toISOString()
            })
            .eq('id', dealId)
            .eq('status', 'funded');

        if (error) {
            console.error('[DraftService] Error initializing draft workflow:', error);
            throw error;
        }

        await this.appendStatusHistory(dealId, 'draft_pending');

        console.log(`[DraftService] Draft workflow initialized for deal ${dealId}`);
    }

    /**
     * Append to status history JSONB array
     */
    private async appendStatusHistory(dealId: string, status: string): Promise<void> {
        try {
            // Try using the stored function first
            const { error: rpcError } = await supabase.rpc('update_deal_status', {
                p_deal_id: dealId,
                p_new_status: status
            });

            if (!rpcError) {
                return; // Success
            }

            console.log(`[DraftService] RPC not available, using fallback: ${rpcError.message}`);
        } catch (e) {
            console.log(`[DraftService] RPC call failed, using fallback`);
        }

        // Fallback: manually update the status_history
        try {
            const { data } = await supabase
                .from('deals')
                .select('status_history')
                .eq('id', dealId)
                .single();

            const history = (data?.status_history as any[]) || [];
            history.push({ status, at: new Date().toISOString() });

            await supabase
                .from('deals')
                .update({ status_history: history })
                .eq('id', dealId);
        } catch (fallbackError) {
            // Status history is non-critical, don't block on failure
            console.warn(`[DraftService] Failed to update status history: ${fallbackError}`);
        }
    }
}
