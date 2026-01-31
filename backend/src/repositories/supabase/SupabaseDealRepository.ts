import { IDealRepository } from '../interfaces';
import { Deal, DealStatus } from '../../domain/entities';
import { supabase } from '../../db';

export class SupabaseDealRepository implements IDealRepository {

    private mapToDomain(row: any): Deal {
        return {
            id: row.id,
            advertiserId: row.advertiser_id,
            channelId: row.channel_id,
            briefText: row.brief_text,
            creativeContent: row.creative_content,
            contentItems: row.content_items,
            priceAmount: row.price_amount,
            priceCurrency: row.price_currency,
            status: row.status as DealStatus,
            // Escrow payment fields
            paymentMemo: row.payment_memo,
            advertiserWalletAddress: row.advertiser_wallet_address,
            channelOwnerWallet: row.channel_owner_wallet,
            paymentTxHash: row.payment_tx_hash,
            paymentConfirmedAt: row.payment_confirmed_at ? new Date(row.payment_confirmed_at) : undefined,
            payoutTxHash: row.payout_tx_hash,
            payoutAt: row.payout_at ? new Date(row.payout_at) : undefined,
            refundTxHash: row.refund_tx_hash,
            refundAt: row.refund_at ? new Date(row.refund_at) : undefined,
            expiresAt: row.expires_at ? new Date(row.expires_at) : undefined,
            statusUpdatedAt: row.status_updated_at ? new Date(row.status_updated_at) : undefined,
            rejectionReason: row.rejection_reason,
            createdAt: new Date(row.created_at),
            updatedAt: new Date(row.updated_at)
        };
    }

    async create(deal: Partial<Deal>, briefId?: string): Promise<Deal> {
        const insertPayload: any = {
            advertiser_id: deal.advertiserId,
            channel_id: deal.channelId,
            brief_text: deal.briefText,
            creative_content: deal.creativeContent,
            content_items: deal.contentItems,
            price_amount: deal.priceAmount,
            price_currency: deal.priceCurrency,
            status: deal.status || 'draft',
            payment_memo: deal.paymentMemo,
            advertiser_wallet_address: deal.advertiserWalletAddress,
            expires_at: deal.expiresAt?.toISOString(),
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString(),
            status_updated_at: new Date().toISOString()
        };

        if (briefId) {
            insertPayload.brief_id = briefId;
        }

        const { data, error } = await supabase
            .from('deals')
            .insert(insertPayload)
            .select()
            .single();

        if (error) throw new Error(error.message);
        return this.mapToDomain(data);
    }

    async findById(id: string): Promise<Deal | null> {
        const { data, error } = await supabase
            .from('deals')
            .select('*')
            .eq('id', id)
            .single();

        if (error) return null;
        return this.mapToDomain(data);
    }

    async findByChannelId(channelId: string): Promise<Deal[]> {
        const { data, error } = await supabase
            .from('deals')
            .select('*')
            .eq('channel_id', channelId)
            .order('created_at', { ascending: false });

        if (error) throw new Error(error.message);
        return data.map(this.mapToDomain);
    }

    async findByAdvertiserId(advertiserId: string): Promise<Deal[]> {
        const { data, error } = await supabase
            .from('deals')
            .select('*')
            .eq('advertiser_id', advertiserId)
            .order('created_at', { ascending: false });

        if (error) throw new Error(error.message);
        return data.map(this.mapToDomain);
    }

    async findByPaymentMemo(memo: string): Promise<Deal | null> {
        const { data, error } = await supabase
            .from('deals')
            .select('*')
            .eq('payment_memo', memo)
            .single();

        if (error) return null;
        return this.mapToDomain(data);
    }

    async findAll(): Promise<Deal[]> {
        const { data, error } = await supabase
            .from('deals')
            .select('*')
            .limit(50)
            .order('created_at', { ascending: false });

        if (error) throw new Error(error.message);
        return data.map(this.mapToDomain);
    }

    async updateStatus(id: string, status: DealStatus, reason?: string): Promise<Deal> {
        const updatePayload: any = {
            status,
            status_updated_at: new Date().toISOString(),
            updated_at: new Date().toISOString()
        };
        if (reason) updatePayload.rejection_reason = reason;

        const { data, error } = await supabase
            .from('deals')
            // @ts-ignore
            .update(updatePayload as any)
            .eq('id', id)
            .select()
            .single();

        if (error) throw new Error(error.message);
        return this.mapToDomain(data);
    }

    async updatePaymentConfirmed(id: string, txHash: string): Promise<Deal> {
        const updatePayload: any = {
            status: 'funded',
            payment_tx_hash: txHash,
            payment_confirmed_at: new Date().toISOString(),
            status_updated_at: new Date().toISOString(),
            updated_at: new Date().toISOString(),
            // Set new expiration for channel owner to respond (48h)
            expires_at: new Date(Date.now() + 48 * 60 * 60 * 1000).toISOString()
        };

        const { data, error } = await supabase
            .from('deals')
            // @ts-ignore
            .update(updatePayload)
            .eq('id', id)
            .select()
            .single();

        if (error) throw new Error(error.message);
        return this.mapToDomain(data);
    }
}
