export const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:3000';

let authToken: string | null = null;

export const setAuthToken = (token: string) => {
    authToken = token;
};

export const getHeaders = (): Record<string, string> => {
    const headers: Record<string, string> = {
        'Content-Type': 'application/json',
    };
    if (authToken) {
        headers['Authorization'] = `Bearer ${authToken}`;
    }

    // Auto-include Telegram user ID from WebApp if available
    try {
        const webApp = (window as any)?.Telegram?.WebApp;
        const telegramId = webApp?.initDataUnsafe?.user?.id;
        if (telegramId) {
            headers['X-Telegram-ID'] = telegramId.toString();
        }
    } catch {
        // Ignore errors reading Telegram context
    }

    return headers;
};

export type DealStatus = 'draft' | 'submitted' | 'negotiating' | 'funded' | 'approved' | 'posted' | 'monitoring' | 'released' | 'cancelled' | 'disputed';

export interface Channel {
    id: string;
    title: string;
    username?: string;
    photoUrl?: string;
    basePriceAmount?: number;
    basePriceCurrency?: string;
    rateCard?: any[];
    verifiedStats?: any;
    telegramChannelId?: number;
    isActive?: boolean;
    description?: string;
    category?: string;
    tags?: string[];
    language?: string;
    avgViews?: number;
}

export interface User {
    id: string;
    telegramId: number; // telegram_id -> telegramId
    firstName: string; // first_name -> firstName
    username?: string;
    photoUrl?: string; // photo_url -> photoUrl
    role?: 'advertiser' | 'owner';
}

export interface Deal {
    id: string;
    advertiserId: string; // advertiser_id
    channelId: string; // channel_id
    channel?: Channel;
    briefText: string; // brief_text
    creativeContent: any; // creative_content
    priceAmount: number; // price_amount
    priceCurrency: string; // price_currency
    status: DealStatus;
    packageTitle?: string;
    packageDescription?: string;
    createdAt: string; // created_at
}

// Auth API
export async function authenticateWithTelegram(initData: string): Promise<{ token: string, user: User }> {
    const response = await fetch(`${API_URL}/auth/telegram`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ initData })
    });
    if (!response.ok) throw new Error('Authentication failed');
    return response.json();
}

// Deals API
export async function getDeals(): Promise<Deal[]> {
    const response = await fetch(`${API_URL}/deals`, { headers: getHeaders() });
    if (!response.ok) {
        throw new Error('Failed to fetch deals');
    }
    return response.json();
}

export async function createDeal(deal: Partial<Deal>, userId?: number): Promise<Deal> {
    const headers = getHeaders() as Record<string, string>;
    if (userId) {
        headers['X-Telegram-ID'] = userId.toString();
    }

    const response = await fetch(`${API_URL}/deals`, {
        method: 'POST',
        headers: headers,
        body: JSON.stringify(deal),
    });
    if (!response.ok) {
        throw new Error('Failed to create deal');
    }
    return response.json();
}

// Briefs API
export interface PublicBrief {
    id: string;
    advertiserId: string;
    title: string;
    content: string;
    budgetRangeMin?: number;
    budgetRangeMax?: number;
    currency: string;
    tags: string[];
    isActive: boolean;
    createdAt: string;
}

export async function getBriefs(filters?: { minBudget?: string, tag?: string }): Promise<PublicBrief[]> {
    const params = new URLSearchParams();
    if (filters?.minBudget) params.append('minBudget', filters.minBudget);
    if (filters?.tag) params.append('tag', filters.tag);

    const response = await fetch(`${API_URL}/briefs?${params.toString()}`, { headers: getHeaders() });
    if (!response.ok) throw new Error('Failed to fetch briefs');
    return response.json();
}

export async function createBrief(brief: Partial<PublicBrief>): Promise<PublicBrief> {
    const response = await fetch(`${API_URL}/briefs`, {
        method: 'POST',
        headers: getHeaders(),
        body: JSON.stringify(brief),
    });
    if (!response.ok) throw new Error('Failed to create brief');
    return response.json();
}

export async function applyToBrief(briefId: string, channelId: string, priceAmount: number): Promise<Deal> {
    const response = await fetch(`${API_URL}/briefs/${briefId}/apply`, {
        method: 'POST',
        headers: getHeaders(),
        body: JSON.stringify({ channelId, priceAmount }),
    });
    if (!response.ok) throw new Error('Failed to apply to brief');
    return response.json();
}

// Channels API (Enhanced)
export async function getMarketplaceChannels(filters?: { minSubscribers?: number, maxPrice?: number }): Promise<Channel[]> {
    const params = new URLSearchParams();
    if (filters?.minSubscribers) params.append('minSubscribers', filters.minSubscribers.toString());
    if (filters?.maxPrice) params.append('maxPrice', filters.maxPrice.toString());

    const response = await fetch(`${API_URL}/channels?${params.toString()}`, { headers: getHeaders() });
    if (!response.ok) throw new Error('Failed to fetch channels');
    return response.json();
}

// Helper for My Channels
export async function getMyChannels(userId: string): Promise<Channel[]> {
    // Calling the new endpoint
    const response = await fetch(`${API_URL}/channels/my`, {
        headers: {
            ...getHeaders(),
            'X-Telegram-ID': userId // Passing explicitly for MVP mock
        } as HeadersInit
    });
    if (!response.ok) throw new Error('Failed to fetch channels');
    return response.json();
}
// Channel Listing
export async function verifyChannel(id: number) {
    const response = await fetch(`${API_URL}/channels/verify`, {
        method: 'POST',
        headers: getHeaders(),
        body: JSON.stringify({ telegram_channel_id: id })
    });
    return response.json();
}

export async function verifyChannelPermissions(id: string | number, options?: { skipExistingCheck?: boolean }, userId?: number) {
    const headers = getHeaders() as Record<string, string>;
    if (userId) {
        headers['X-Telegram-ID'] = userId.toString();
    }

    const response = await fetch(`${API_URL}/channels/verify_permissions`, {
        method: 'POST',
        headers: headers,
        body: JSON.stringify({
            channel_id: id,
            skip_existing_check: options?.skipExistingCheck || false
        })
    });
    return response.json();
}

export async function registerChannel(data: any, userId?: number) {
    const headers = getHeaders() as Record<string, string>;
    if (userId) {
        headers['X-Telegram-ID'] = userId.toString();
    }

    const response = await fetch(`${API_URL}/channels`, {
        method: 'POST',
        headers: headers,
        body: JSON.stringify(data)
    });

    if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Registration failed');
    }
    return response.json();
}

export async function updateChannel(id: string, data: any) {
    const response = await fetch(`${API_URL}/channels/${id}`, {
        method: 'PUT',
        headers: getHeaders(),
        body: JSON.stringify(data)
    });

    if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Update failed');
    }
    return response.json();
}

export async function deleteChannel(id: string) {
    const response = await fetch(`${API_URL}/channels/${id}`, {
        method: 'DELETE',
        headers: getHeaders()
    });

    if (!response.ok) {
        throw new Error('Failed to delete channel');
    }
    return response.json();
}
