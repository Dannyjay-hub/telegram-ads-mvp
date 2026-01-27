export type DealStatus =
    | 'draft'
    | 'submitted'
    | 'negotiating'
    | 'funded'
    | 'approved'
    | 'posted'
    | 'monitoring'
    | 'released'
    | 'cancelled'
    | 'disputed';

export interface User {
    id: string;
    telegramId: number;
    firstName: string;
    username?: string;
    photoUrl?: string;
    role?: 'advertiser' | 'owner';
    currentNegotiatingDealId?: string | null; // For bot relay
    createdAt?: Date;
    updatedAt?: Date;
}

export interface Channel {
    id: string;
    telegramChannelId: number;
    title: string;
    username?: string;
    photoUrl?: string;
    verifiedStats?: any;
    statsJson?: any; // Full analytics
    avgViews?: number;
    basePriceAmount?: number;
    basePriceCurrency?: string;
    rateCard?: any[];
    pricing?: any; // Phase 1 Pricing JSON
    isActive: boolean;
    isVerified?: boolean;
    status?: 'active' | 'paused' | 'delisted';
    permissions?: any; // Bot permissions
    description?: string;
    category?: string;
    tags?: string[];
    createdAt?: Date;
    updatedAt?: Date;
}

export interface Deal {
    id: string;
    advertiserId: string;
    channelId: string;
    briefId?: string;

    briefText: string;
    creativeContent?: any;

    priceAmount: number;
    priceCurrency: string;

    status: DealStatus;
    rejectionReason?: string;

    createdAt: Date;
    updatedAt: Date;
}

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
    createdAt: Date;
}
