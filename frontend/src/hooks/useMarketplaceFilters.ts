import { useState, useMemo, useEffect } from 'react';
import type { Channel } from '@/lib/api';
import { parseTagArray } from '@/lib/parseTagArray';

/**
 * Debounce hook - delays value updates to prevent excessive re-renders
 */
function useDebounce<T>(value: T, delay: number): T {
    const [debouncedValue, setDebouncedValue] = useState<T>(value);

    useEffect(() => {
        const timer = setTimeout(() => {
            setDebouncedValue(value);
        }, delay);

        return () => clearTimeout(timer);
    }, [value, delay]);

    return debouncedValue;
}

// ============ FILTER STATE TYPES ============

export type SortOption = 'subscribers' | 'price' | 'rating' | 'newest';

export interface FilterState {
    search: string;
    categories: string[];
    languages: string[];
    subscribers: [number, number] | null;
    price: [number, number] | null;
    minRating: number | null;  // null = any, 0 = unrated only, 3/4 = min rating
    sortBy: SortOption;
}

export const DEFAULT_FILTERS: FilterState = {
    search: '',
    categories: [],
    languages: [],
    subscribers: null,
    price: null,
    minRating: null,
    sortBy: 'subscribers',
};

// ============ PRESET OPTIONS ============

export const CATEGORY_OPTIONS = [
    'Crypto', 'Tech', 'News', 'Entertainment', 'Education',
    'Gaming', 'Finance', 'Lifestyle', 'Business', 'Sports',
    'Music', 'Art', 'Food', 'Travel', 'Health'
];

export const LANGUAGE_OPTIONS = [
    'English', 'Russian', 'Spanish', 'Portuguese', 'Chinese', 'Arabic', 'Hindi',
    'French', 'German', 'Japanese', 'Korean', 'Indonesian', 'Turkish', 'Italian', 'Other'
];

export const SUBSCRIBER_PRESETS: { label: string; value: [number, number] | null }[] = [
    { label: 'Any', value: null },
    { label: '0-1K', value: [0, 1000] },
    { label: '1K-10K', value: [1000, 10000] },
    { label: '10K-50K', value: [10000, 50000] },
    { label: '50K-100K', value: [50000, 100000] },
    { label: '100K+', value: [100000, Infinity] },
];

export const PRICE_PRESETS: { label: string; value: [number, number] | null }[] = [
    { label: 'Any', value: null },
    { label: '0-5', value: [0, 5] },
    { label: '5-20', value: [5, 20] },
    { label: '20-50', value: [20, 50] },
    { label: '50+', value: [50, Infinity] },
];

export const RATING_PRESETS: { label: string; value: number | null }[] = [
    { label: 'Any', value: null },
    { label: '4+⭐', value: 4 },
    { label: '3+⭐', value: 3 },
    { label: 'Unrated', value: 0 },
];

export const SORT_OPTIONS: { label: string; value: SortOption }[] = [
    { label: 'Most Subscribers', value: 'subscribers' },
    { label: 'Lowest Price', value: 'price' },
    { label: 'Highest Rated', value: 'rating' },
    { label: 'Newest', value: 'newest' },
];

// ============ MAIN HOOK ============

export function useMarketplaceFilters(channels: Channel[]) {
    const [filters, setFilters] = useState<FilterState>(DEFAULT_FILTERS);

    // Debounce search to prevent lag on every keystroke
    const debouncedSearch = useDebounce(filters.search, 300);

    // Count active filters (for badge on Filters button)
    const activeFilterCount = useMemo(() => {
        let count = 0;
        if (filters.languages.length > 0) count++;
        if (filters.subscribers !== null) count++;
        if (filters.price !== null) count++;
        if (filters.minRating !== null) count++;
        return count;
    }, [filters]);

    // Master filter + sort logic
    const filteredChannels = useMemo(() => {
        return channels
            .filter(channel => {
                // 1. Search (Title or Username) - uses debounced value
                if (debouncedSearch) {
                    const query = debouncedSearch.toLowerCase();
                    const matchesTitle = channel.title?.toLowerCase().includes(query);
                    const matchesUsername = channel.username?.toLowerCase().includes(query);
                    if (!matchesTitle && !matchesUsername) return false;
                }

                // 2. Categories (OR logic - match any selected)
                if (filters.categories.length > 0) {
                    const channelCategories = parseTagArray(channel.category);
                    const hasMatch = channelCategories.some(cat =>
                        filters.categories.some(f => f.toLowerCase() === cat.toLowerCase())
                    );
                    if (!hasMatch) return false;
                }

                // 3. Languages (OR logic)
                if (filters.languages.length > 0) {
                    const channelLanguages = parseTagArray(channel.language);
                    const hasMatch = channelLanguages.some(lang =>
                        filters.languages.some(f => f.toLowerCase() === lang.toLowerCase())
                    );
                    if (!hasMatch) return false;
                }

                // 4. Subscribers Range
                if (filters.subscribers) {
                    const [min, max] = filters.subscribers;
                    const count = channel.verifiedStats?.subscribers || 0;
                    if (count < min || count > max) return false;
                }

                // 5. Price Range (min package price)
                if (filters.price) {
                    const [min, max] = filters.price;
                    const minPrice = channel.rateCard?.length
                        ? Math.min(...channel.rateCard.map((p: any) => p.price || Infinity))
                        : 0;
                    if (minPrice < min || minPrice > max) return false;
                }

                // 6. Rating
                if (filters.minRating !== null) {
                    const rating = (channel as any).rating || 0;
                    if (filters.minRating === 0) {
                        // "Unrated" - show only channels with no rating
                        if (rating > 0) return false;
                    } else {
                        // Min rating filter
                        if (rating < filters.minRating) return false;
                    }
                }

                return true;
            })
            .sort((a, b) => {
                // Sorting
                switch (filters.sortBy) {
                    case 'price': {
                        const priceA = a.rateCard?.length
                            ? Math.min(...a.rateCard.map((p: any) => p.price || Infinity))
                            : Infinity;
                        const priceB = b.rateCard?.length
                            ? Math.min(...b.rateCard.map((p: any) => p.price || Infinity))
                            : Infinity;
                        return priceA - priceB; // Lowest first
                    }
                    case 'rating': {
                        const ratingA = (a as any).rating || 0;
                        const ratingB = (b as any).rating || 0;
                        return ratingB - ratingA; // Highest first
                    }
                    case 'newest': {
                        const dateA = new Date((a as any).createdAt || 0).getTime();
                        const dateB = new Date((b as any).createdAt || 0).getTime();
                        return dateB - dateA; // Newest first
                    }
                    case 'subscribers':
                    default: {
                        const subsA = a.verifiedStats?.subscribers || 0;
                        const subsB = b.verifiedStats?.subscribers || 0;
                        return subsB - subsA; // Most first
                    }
                }
            });
    }, [channels, debouncedSearch, filters]);

    // Helper functions for updating filters
    const updateSearch = (search: string) => {
        setFilters(prev => ({ ...prev, search }));
    };

    const toggleCategory = (category: string) => {
        setFilters(prev => ({
            ...prev,
            categories: prev.categories.includes(category)
                ? prev.categories.filter(c => c !== category)
                : [...prev.categories, category]
        }));
    };

    const toggleLanguage = (language: string) => {
        setFilters(prev => ({
            ...prev,
            languages: prev.languages.includes(language)
                ? prev.languages.filter(l => l !== language)
                : [...prev.languages, language]
        }));
    };

    const setSubscribers = (range: [number, number] | null) => {
        setFilters(prev => ({ ...prev, subscribers: range }));
    };

    const setPrice = (range: [number, number] | null) => {
        setFilters(prev => ({ ...prev, price: range }));
    };

    const setRating = (minRating: number | null) => {
        setFilters(prev => ({ ...prev, minRating }));
    };

    const setSortBy = (sortBy: SortOption) => {
        setFilters(prev => ({ ...prev, sortBy }));
    };

    const clearFilters = () => {
        setFilters(DEFAULT_FILTERS);
    };

    const clearAdvancedFilters = () => {
        setFilters(prev => ({
            ...prev,
            languages: [],
            subscribers: null,
            price: null,
            minRating: null,
        }));
    };

    return {
        filters,
        setFilters,
        filteredChannels,
        resultCount: filteredChannels.length,
        activeFilterCount,
        // Helpers
        updateSearch,
        toggleCategory,
        toggleLanguage,
        setSubscribers,
        setPrice,
        setRating,
        setSortBy,
        clearFilters,
        clearAdvancedFilters,
    };
}
