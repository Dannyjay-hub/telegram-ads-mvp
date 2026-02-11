import { useState, useMemo } from 'react';

// ============ TYPES ============

type CampaignSortOption = 'newest' | 'budget' | 'ending_soon';

interface CampaignFilterState {
    search: string;
    budgetRange: [number, number] | null;
    categories: string[];
    sortBy: CampaignSortOption;
}

interface MarketplaceCampaign {
    id: string;
    title: string;
    brief: string;
    totalBudget: number;
    perChannelBudget: number;
    currency: string;
    slots: number;
    slotsFilled: number;
    campaignType: 'open' | 'closed';
    minSubscribers?: number;
    requiredCategories?: string[];
    requiredLanguages?: string[];
    expiresAt?: string;
    advertiser?: { firstName?: string };
    hasApplied?: boolean;
    created_at?: string;
}

// ============ CONSTANTS ============

const DEFAULT_FILTERS: CampaignFilterState = {
    search: '',
    budgetRange: null,
    categories: [],
    sortBy: 'newest',
};

export const CAMPAIGN_BUDGET_PRESETS: { label: string; value: [number, number] | null }[] = [
    { label: 'Any', value: null },
    { label: '0-5 TON', value: [0, 5] },
    { label: '5-20 TON', value: [5, 20] },
    { label: '20-50 TON', value: [20, 50] },
    { label: '50+ TON', value: [50, Infinity] },
];

export const CAMPAIGN_SORT_OPTIONS: { label: string; value: CampaignSortOption }[] = [
    { label: 'Newest', value: 'newest' },
    { label: 'Highest Budget', value: 'budget' },
    { label: 'Ending Soon', value: 'ending_soon' },
];

// ============ MAIN HOOK ============

export function useCampaignFilters(campaigns: MarketplaceCampaign[]) {
    const [filters, setFilters] = useState<CampaignFilterState>(DEFAULT_FILTERS);

    // Count active filters (for badge)
    const activeFilterCount = useMemo(() => {
        let count = 0;
        if (filters.budgetRange !== null) count++;
        if (filters.categories.length > 0) count++;
        return count;
    }, [filters]);

    // Master filter + sort logic
    const filteredCampaigns = useMemo(() => {
        return campaigns
            .filter(campaign => {
                // 1. Search (Title or Brief)
                if (filters.search) {
                    const query = filters.search.toLowerCase();
                    const matchesTitle = campaign.title?.toLowerCase().includes(query);
                    const matchesBrief = campaign.brief?.toLowerCase().includes(query);
                    if (!matchesTitle && !matchesBrief) return false;
                }

                // 2. Budget Range (per-channel budget)
                if (filters.budgetRange) {
                    const [min, max] = filters.budgetRange;
                    if (campaign.perChannelBudget < min || campaign.perChannelBudget > max) return false;
                }

                // 3. Categories (OR logic)
                if (filters.categories.length > 0) {
                    const campaignCategories = campaign.requiredCategories || [];
                    if (campaignCategories.length === 0) return true; // No category restriction matches all
                    const hasMatch = campaignCategories.some(cat =>
                        filters.categories.some(f => f.toLowerCase() === cat.toLowerCase())
                    );
                    if (!hasMatch) return false;
                }

                return true;
            })
            .sort((a, b) => {
                switch (filters.sortBy) {
                    case 'budget':
                        return b.perChannelBudget - a.perChannelBudget;
                    case 'ending_soon': {
                        const aTime = a.expiresAt ? new Date(a.expiresAt).getTime() : Infinity;
                        const bTime = b.expiresAt ? new Date(b.expiresAt).getTime() : Infinity;
                        return aTime - bTime; // Soonest first
                    }
                    case 'newest':
                    default: {
                        const aDate = a.created_at ? new Date(a.created_at).getTime() : 0;
                        const bDate = b.created_at ? new Date(b.created_at).getTime() : 0;
                        return bDate - aDate; // Newest first
                    }
                }
            });
    }, [campaigns, filters]);

    // Helper functions
    const updateSearch = (search: string) => setFilters(f => ({ ...f, search }));
    const setBudgetRange = (budgetRange: [number, number] | null) => setFilters(f => ({ ...f, budgetRange }));
    const toggleCategory = (cat: string) => setFilters(f => ({
        ...f,
        categories: f.categories.includes(cat)
            ? f.categories.filter(c => c !== cat)
            : [...f.categories, cat]
    }));
    const setSortBy = (sortBy: CampaignSortOption) => setFilters(f => ({ ...f, sortBy }));
    const clearFilters = () => setFilters(DEFAULT_FILTERS);

    return {
        filters,
        filteredCampaigns,
        resultCount: filteredCampaigns.length,
        activeFilterCount,
        updateSearch,
        setBudgetRange,
        toggleCategory,
        setSortBy,
        clearFilters,
    };
}
