export type DealStatus =
    | 'draft'
    | 'submitted'
    | 'pending'       // Awaiting payment
    | 'negotiating'
    | 'funded'        // Payment received
    | 'approved'      // Channel accepted
    | 'in_progress'   // Drafting/scheduling
    | 'posted'        // Content published
    | 'monitoring'    // Safety period
    | 'released'      // Funds released (completed)
    | 'refunded'      // Refund issued
    | 'cancelled'
    | 'disputed';

// Content item in a deal order
export interface ContentItem {
    type: string;       // 'post' | 'story' | 'reels'
    title: string;
    quantity: number;
    unitPrice: number;
}

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
    language?: string;
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
    contentItems?: ContentItem[];  // Selected packages

    priceAmount: number;
    priceCurrency: string;

    // Escrow payment tracking (memo-based)
    paymentMemo?: string;           // "deal_{uuid}" for matching
    advertiserWalletAddress?: string;
    channelOwnerWallet?: string;

    // Transaction hashes
    paymentTxHash?: string;
    paymentConfirmedAt?: Date;
    payoutTxHash?: string;
    payoutAt?: Date;
    refundTxHash?: string;
    refundAt?: Date;

    // Lifecycle
    status: DealStatus;
    statusUpdatedAt?: Date;
    expiresAt?: Date;
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
