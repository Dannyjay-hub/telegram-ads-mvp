export type Json =
    | string
    | number
    | boolean
    | null
    | { [key: string]: Json | undefined }
    | Json[]

export interface Database {
    public: {
        Tables: {
            users: {
                Row: {
                    id: string
                    telegram_id: number
                    username: string | null
                    first_name: string | null
                    created_at: string
                    updated_at: string
                }
                Insert: {
                    id?: string
                    telegram_id: number
                    username?: string | null
                    first_name?: string | null
                    created_at?: string
                    updated_at?: string
                }
                Update: Partial<Database['public']['Tables']['users']['Insert']>
            }
            channels: {
                Row: {
                    id: string
                    telegram_channel_id: number
                    title: string
                    username: string | null
                    photo_url: string | null
                    verified_stats: Json
                    stats_json: Json
                    description: string | null
                    base_price_amount: number | null
                    base_price_currency: string | null
                    pricing: Json // { base_price: 200, custom_options: [...] }
                    is_active: boolean | null
                    is_verified: boolean
                    status: 'active' | 'paused' | 'delisted'
                    permissions: Json // Bot permissions
                    rate_card: Json // Legacy support, prefer 'pricing'
                    created_at: string
                    updated_at: string
                }
                Insert: {
                    id?: string
                    telegram_channel_id: number
                    title: string
                    username?: string | null
                    photo_url?: string | null
                    verified_stats?: Json
                    stats_json?: Json
                    description?: string | null
                    base_price_amount?: number | null
                    base_price_currency?: string | null
                    pricing?: Json
                    is_active?: boolean | null
                    is_verified?: boolean
                    status?: 'active' | 'paused' | 'delisted'
                    permissions?: Json
                    rate_card?: Json
                    created_at?: string
                    updated_at?: string
                }
                Update: Partial<Database['public']['Tables']['channels']['Insert']>
            }
            channel_admins: { // PR Managers and Owners
                Row: {
                    channel_id: string
                    user_id: string
                    role: 'owner' | 'manager'
                    permissions: Json // { can_withdraw: boolean, can_approve: boolean }
                    is_owner: boolean // Legacy? Keep for backward compat or sync with role
                    can_negotiate: boolean
                }
                Insert: {
                    channel_id: string
                    user_id: string
                    role?: 'owner' | 'manager'
                    permissions?: Json
                    is_owner?: boolean
                    can_negotiate?: boolean
                }
                Update: Partial<Database['public']['Tables']['channel_admins']['Insert']>
            }
            campaigns: {
                Row: {
                    id: string
                    advertiser_id: string
                    title: string
                    brief_text: string | null
                    creative_content: Json | null
                    total_budget: number
                    slots: number
                    individual_slot_budget: number
                    status: 'open' | 'closed' | 'completed' | 'cancelled'
                    type: 'open' | 'closed'
                    eligibility_criteria: Json | null
                    created_at: string
                    updated_at: string
                }
                Insert: {
                    id?: string
                    advertiser_id: string
                    title: string
                    brief_text?: string | null
                    creative_content?: Json | null
                    total_budget: number
                    slots?: number
                    individual_slot_budget: number
                    status?: 'open' | 'closed' | 'completed' | 'cancelled'
                    type?: 'open' | 'closed'
                    eligibility_criteria?: Json | null
                    created_at?: string
                    updated_at?: string
                }
                Update: Partial<Database['public']['Tables']['campaigns']['Insert']>
            }
            deals: {
                Row: {
                    id: string
                    campaign_id: string | null
                    advertiser_id: string | null
                    channel_id: string | null
                    brief_text: string | null
                    creative_content: Json | null
                    price_amount: number
                    price_currency: string | null
                    escrow_wallet_id: string | null
                    requested_post_time: string | null
                    actual_post_time: string | null
                    min_duration_hours: number | null
                    status: DealStatus
                    origin: 'campaign' | 'direct'
                    negotiation_status: 'pending' | 'accepted' | 'rejected'
                    bids_today_count: number
                    last_bid_at: string | null
                    bidding_history: Json
                    rejection_reason: string | null
                    last_activity_at: string | null
                    created_at: string
                    updated_at: string
                }
                Insert: {
                    id?: string
                    campaign_id?: string | null
                    advertiser_id?: string | null
                    channel_id?: string | null
                    brief_text?: string | null
                    creative_content?: Json | null
                    price_amount: number
                    price_currency?: string | null
                    escrow_wallet_id?: string | null
                    requested_post_time?: string | null
                    actual_post_time?: string | null
                    min_duration_hours?: number | null
                    status?: DealStatus
                    origin?: 'campaign' | 'direct'
                    negotiation_status?: 'pending' | 'accepted' | 'rejected'
                    bids_today_count?: number
                    last_bid_at?: string | null
                    bidding_history?: Json
                    rejection_reason?: string | null
                    last_activity_at?: string | null
                    created_at?: string
                    updated_at?: string
                }
                Update: Partial<Database['public']['Tables']['deals']['Insert']>
            }
            wallets: {
                Row: {
                    id: string
                    user_id: string
                    balance: number
                    currency: string
                    created_at: string
                    updated_at: string
                }
                Insert: {
                    id?: string
                    user_id: string
                    balance?: number
                    currency?: string
                    created_at?: string
                    updated_at?: string
                }
                Update: Partial<Database['public']['Tables']['wallets']['Insert']>
            }
            transactions: {
                Row: {
                    id: string
                    wallet_id: string
                    amount: number
                    type: 'deposit' | 'escrow' | 'payout' | 'refund' | 'withdrawal' | 'fee'
                    reference_id: string | null
                    description: string | null
                    created_at: string
                }
                Insert: {
                    id?: string
                    wallet_id: string
                    amount: number
                    type: 'deposit' | 'escrow' | 'payout' | 'refund' | 'withdrawal' | 'fee'
                    reference_id?: string | null
                    description?: string | null
                    created_at?: string
                }
                Update: Partial<Database['public']['Tables']['transactions']['Insert']>
            }
            unlisted_drafts: {
                Row: {
                    id: string
                    telegram_channel_id: number
                    user_id: string
                    draft_data: Json
                    created_at: string
                    updated_at: string
                }
                Insert: {
                    id?: string
                    telegram_channel_id: number
                    user_id: string
                    draft_data: Json
                    created_at?: string
                    updated_at?: string
                }
                Update: Partial<Database['public']['Tables']['unlisted_drafts']['Insert']>
            }
        }
    }
}

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
