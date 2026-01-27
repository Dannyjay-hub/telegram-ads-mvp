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
            priceAmount: row.price_amount,
            priceCurrency: row.price_currency,
            status: row.status as DealStatus,
            createdAt: new Date(row.created_at),
            updatedAt: new Date(row.updated_at),
            packageTitle: row.package_title,
            packageDescription: row.package_description,
            rejectionReason: row.rejection_reason
        };
    }

    async create(deal: Partial<Deal>, briefId?: string): Promise<Deal> {
        const insertPayload: any = {
            advertiser_id: deal.advertiserId,
            channel_id: deal.channelId,
            brief_text: deal.briefText,
            creative_content: deal.creativeContent,
            price_amount: deal.priceAmount,
            price_currency: deal.priceCurrency,
            status: deal.status || 'draft',
            package_title: deal.packageTitle,
            package_description: deal.packageDescription,
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString()
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
}
