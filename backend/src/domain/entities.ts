export type DealStatus =
    | 'draft'
    | 'submitted'
    | 'pending'       // Awaiting payment
    | 'negotiating'
    | 'funded'        // Payment received
    | 'draft_pending' // Channel accepted, awaiting draft from owner
    | 'draft_submitted' // Draft submitted, awaiting advertiser review
    | 'changes_requested' // Advertiser requested changes
    | 'approved'      // Draft approved, ready for scheduling
    | 'scheduling'    // Negotiating post time
    | 'scheduled'     // Time agreed, waiting to post
    | 'rejected'      // Channel rejected (refund queued)
    | 'in_progress'   // Drafting/scheduling (legacy)
    | 'posted'        // Content published
    | 'failed_to_post' // Posting failed (bot removed, etc.)
    | 'monitoring'    // Safety period
    | 'payout_pending' // Monitoring passed, payout waiting (no wallet or queue failed)
    | 'released'      // Funds released (completed)
    | 'refunded'      // Refund completed
    | 'pending_refund' // Refund failed to queue, needs manual intervention
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
    payoutWallet?: string; // TON wallet for receiving payouts
    createdAt?: Date;
    updatedAt?: Date;
}

export interface Deal {
    id: string;
    advertiserId: string;
    channelId: string;
    briefId?: string;
    campaignId?: string; // Link to campaign if created via campaign application

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

    // Post-escrow draft fields
    draftText?: string;
    draftMediaFileId?: string;
    draftMediaType?: string;
    draftSubmittedAt?: Date;
    draftFeedback?: string;

    // Scheduling fields
    proposedPostTime?: string;
    timeProposedBy?: 'advertiser' | 'channel_owner';
    agreedPostTime?: string;

    // Monitoring fields
    postedMessageId?: number;
    postedAt?: Date;
    monitoringEndAt?: string;

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

// ============================================
// CAMPAIGN SYSTEM
// ============================================

export type CampaignType = 'open' | 'closed';

export type CampaignStatus = 'draft' | 'active' | 'filled' | 'expired' | 'expired_pending' | 'ended';

export type ApplicationStatus = 'pending' | 'approved' | 'rejected';

export interface Campaign {
    id: string;
    advertiserId: string;

    // Content
    title: string;
    brief: string;
    mediaUrls?: string[];

    // Budget
    totalBudget: number;
    currency: string;
    slots: number;
    perChannelBudget: number; // Generated column

    // Type
    campaignType: CampaignType;

    // Eligibility Criteria
    minSubscribers: number;
    maxSubscribers?: number;
    requiredLanguages?: string[];
    minAvgViews: number;
    requiredCategories?: string[];

    // Duration
    startsAt: Date;
    expiresAt?: Date;

    // Status & Slots
    status: CampaignStatus;
    slotsFilled: number;

    // Escrow Tracking
    paymentMemo?: string;           // Unique memo for payment verification
    paymentExpiresAt?: Date;        // 15-min payment window
    escrowTxHash?: string;          // Transaction hash of deposit
    escrowWalletAddress?: string;
    escrowDeposited: number;
    escrowAllocated: number;
    escrowAvailable: number; // Generated column
    escrowFunded: boolean;   // Generated column
    fundedAt?: Date;

    // Draft
    draftStep?: number;             // For resume at correct step
    expiresInDays?: number;         // Campaign duration in days

    // Timestamps
    createdAt: Date;
    updatedAt: Date;
    expiredAt?: Date;
}

export interface CampaignApplication {
    id: string;
    campaignId: string;
    channelId: string;
    status: ApplicationStatus;
    dealId?: string;
    appliedAt: Date;
    reviewedAt?: Date;
}

export interface CampaignInsert {
    advertiserId: string;
    title: string;
    brief: string;
    mediaUrls?: string[];
    totalBudget: number;
    currency?: string;
    slots: number;
    campaignType?: CampaignType;
    minSubscribers?: number;
    maxSubscribers?: number;
    requiredLanguages?: string[];
    minAvgViews?: number;
    requiredCategories?: string[];
    startsAt?: Date;
    expiresAt?: Date;
    paymentMemo?: string;  // For escrow tracking
    paymentExpiresAt?: Date;  // 15-min payment window
    draftStep?: number;  // For resume draft functionality
    expiresInDays?: number;  // Campaign duration in days (for draft resume)
}

export interface CampaignUpdate {
    title?: string;
    brief?: string;
    mediaUrls?: string[];
    totalBudget?: number;
    slots?: number;
    status?: CampaignStatus;
    campaignType?: 'open' | 'closed';
    minSubscribers?: number;
    maxSubscribers?: number;
    requiredLanguages?: string[];
    minAvgViews?: number;
    requiredCategories?: string[];
    expiresAt?: Date;
    escrowDeposited?: number;
    escrowAllocated?: number;
    slotsFilled?: number;
    draftStep?: number;
    expiresInDays?: number;
    paymentMemo?: string;
    paymentExpiresAt?: Date;
}
