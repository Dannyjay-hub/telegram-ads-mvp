import { IBriefRepository } from '../interfaces';
import { PublicBrief } from '../../domain/entities';
import { supabase } from '../../db';

export class SupabaseBriefRepository implements IBriefRepository {
    private mapToDomain(row: any): PublicBrief {
        return {
            id: row.id,
            advertiserId: row.advertiser_id,
            title: row.title,
            content: row.content,
            budgetRangeMin: row.budget_range_min,
            budgetRangeMax: row.budget_range_max,
            currency: row.currency,
            tags: row.tags || [],
            isActive: row.is_active,
            createdAt: new Date(row.created_at)
        };
    }

    async create(brief: Partial<PublicBrief>): Promise<PublicBrief> {
        const { data, error } = await supabase
            .from('public_briefs')
            .insert({
                advertiser_id: brief.advertiserId,
                title: brief.title,
                content: brief.content,
                budget_range_min: brief.budgetRangeMin,
                budget_range_max: brief.budgetRangeMax,
                currency: brief.currency || 'USD',
                tags: brief.tags,
                is_active: true
            } as any)
            .select()
            .single();

        if (error) throw new Error(error.message);
        return this.mapToDomain(data);
    }

    async findAll(activeOnly: boolean = true): Promise<PublicBrief[]> {
        let query = supabase
            .from('public_briefs')
            .select('*')
            .order('created_at', { ascending: false });

        if (activeOnly) {
            query = query.eq('is_active', true);
        }

        const { data, error } = await query;
        if (error) throw new Error(error.message);
        return data.map(this.mapToDomain);
    }

    async findById(id: string): Promise<PublicBrief | null> {
        const { data, error } = await supabase
            .from('public_briefs')
            .select('*')
            .eq('id', id)
            .single();

        if (error) return null;
        return this.mapToDomain(data);
    }
}
