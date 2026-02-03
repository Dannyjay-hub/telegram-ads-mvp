export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  // Allows to automatically instantiate createClient with right options
  // instead of createClient<Database, { PostgrestVersion: 'XX' }>(URL, KEY)
  __InternalSupabase: {
    PostgrestVersion: "14.1"
  }
  public: {
    Tables: {
      campaign_applications: {
        Row: {
          applied_at: string | null
          campaign_id: string
          channel_id: string
          deal_id: string | null
          id: string
          reviewed_at: string | null
          status: string | null
        }
        Insert: {
          applied_at?: string | null
          campaign_id: string
          channel_id: string
          deal_id?: string | null
          id?: string
          reviewed_at?: string | null
          status?: string | null
        }
        Update: {
          applied_at?: string | null
          campaign_id?: string
          channel_id?: string
          deal_id?: string | null
          id?: string
          reviewed_at?: string | null
          status?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "campaign_applications_campaign_id_fkey"
            columns: ["campaign_id"]
            isOneToOne: false
            referencedRelation: "campaigns"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "campaign_applications_channel_id_fkey"
            columns: ["channel_id"]
            isOneToOne: false
            referencedRelation: "channels"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "campaign_applications_deal_id_fkey"
            columns: ["deal_id"]
            isOneToOne: false
            referencedRelation: "deals"
            referencedColumns: ["id"]
          },
        ]
      }
      campaigns: {
        Row: {
          advertiser_id: string | null
          brief: string | null
          brief_text: string | null
          campaign_type: string | null
          created_at: string | null
          creative_content: Json | null
          currency: string | null
          eligibility_criteria: Json | null
          escrow_allocated: number | null
          escrow_available: number | null
          escrow_deposited: number | null
          escrow_funded: boolean | null
          escrow_wallet_address: string | null
          expired_at: string | null
          expires_at: string | null
          id: string
          individual_slot_budget: number
          max_subscribers: number | null
          media_urls: string[] | null
          min_avg_views: number | null
          min_subscribers: number | null
          per_channel_budget: number | null
          required_categories: string[] | null
          required_languages: string[] | null
          slots: number
          slots_filled: number | null
          starts_at: string | null
          status: string
          title: string
          total_budget: number
          type: string
          updated_at: string | null
        }
        Insert: {
          advertiser_id?: string | null
          brief?: string | null
          brief_text?: string | null
          campaign_type?: string | null
          created_at?: string | null
          creative_content?: Json | null
          currency?: string | null
          eligibility_criteria?: Json | null
          escrow_allocated?: number | null
          escrow_available?: number | null
          escrow_deposited?: number | null
          escrow_funded?: boolean | null
          escrow_wallet_address?: string | null
          expired_at?: string | null
          expires_at?: string | null
          id?: string
          individual_slot_budget: number
          max_subscribers?: number | null
          media_urls?: string[] | null
          min_avg_views?: number | null
          min_subscribers?: number | null
          per_channel_budget?: number | null
          required_categories?: string[] | null
          required_languages?: string[] | null
          slots?: number
          slots_filled?: number | null
          starts_at?: string | null
          status?: string
          title: string
          total_budget: number
          type?: string
          updated_at?: string | null
        }
        Update: {
          advertiser_id?: string | null
          brief?: string | null
          brief_text?: string | null
          campaign_type?: string | null
          created_at?: string | null
          creative_content?: Json | null
          currency?: string | null
          eligibility_criteria?: Json | null
          escrow_allocated?: number | null
          escrow_available?: number | null
          escrow_deposited?: number | null
          escrow_funded?: boolean | null
          escrow_wallet_address?: string | null
          expired_at?: string | null
          expires_at?: string | null
          id?: string
          individual_slot_budget?: number
          max_subscribers?: number | null
          media_urls?: string[] | null
          min_avg_views?: number | null
          min_subscribers?: number | null
          per_channel_budget?: number | null
          required_categories?: string[] | null
          required_languages?: string[] | null
          slots?: number
          slots_filled?: number | null
          starts_at?: string | null
          status?: string
          title?: string
          total_budget?: number
          type?: string
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "campaigns_advertiser_id_fkey"
            columns: ["advertiser_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      channel_admins: {
        Row: {
          can_approve_creative: boolean | null
          can_manage_finance: boolean | null
          can_negotiate: boolean | null
          channel_id: string | null
          created_at: string | null
          id: string
          is_owner: boolean | null
          permissions: Json | null
          role: string | null
          user_id: string | null
        }
        Insert: {
          can_approve_creative?: boolean | null
          can_manage_finance?: boolean | null
          can_negotiate?: boolean | null
          channel_id?: string | null
          created_at?: string | null
          id?: string
          is_owner?: boolean | null
          permissions?: Json | null
          role?: string | null
          user_id?: string | null
        }
        Update: {
          can_approve_creative?: boolean | null
          can_manage_finance?: boolean | null
          can_negotiate?: boolean | null
          channel_id?: string | null
          created_at?: string | null
          id?: string
          is_owner?: boolean | null
          permissions?: Json | null
          role?: string | null
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "channel_admins_channel_id_fkey"
            columns: ["channel_id"]
            isOneToOne: false
            referencedRelation: "channels"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "channel_admins_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      channels: {
        Row: {
          avg_views: number | null
          base_price_amount: number | null
          base_price_currency: string | null
          category: string | null
          created_at: string | null
          description: string | null
          id: string
          is_active: boolean | null
          is_verified: boolean | null
          language: string | null
          permissions: Json | null
          photo_url: string | null
          pricing: Json | null
          rate_card: Json | null
          stats_json: Json | null
          status: string | null
          tags: string[] | null
          telegram_channel_id: number
          title: string
          updated_at: string | null
          username: string | null
          verified_stats: Json | null
        }
        Insert: {
          avg_views?: number | null
          base_price_amount?: number | null
          base_price_currency?: string | null
          category?: string | null
          created_at?: string | null
          description?: string | null
          id?: string
          is_active?: boolean | null
          is_verified?: boolean | null
          language?: string | null
          permissions?: Json | null
          photo_url?: string | null
          pricing?: Json | null
          rate_card?: Json | null
          stats_json?: Json | null
          status?: string | null
          tags?: string[] | null
          telegram_channel_id: number
          title: string
          updated_at?: string | null
          username?: string | null
          verified_stats?: Json | null
        }
        Update: {
          avg_views?: number | null
          base_price_amount?: number | null
          base_price_currency?: string | null
          category?: string | null
          created_at?: string | null
          description?: string | null
          id?: string
          is_active?: boolean | null
          is_verified?: boolean | null
          language?: string | null
          permissions?: Json | null
          photo_url?: string | null
          pricing?: Json | null
          rate_card?: Json | null
          stats_json?: Json | null
          status?: string | null
          tags?: string[] | null
          telegram_channel_id?: number
          title?: string
          updated_at?: string | null
          username?: string | null
          verified_stats?: Json | null
        }
        Relationships: []
      }
      deals: {
        Row: {
          actual_post_time: string | null
          advertiser_id: string | null
          advertiser_wallet_address: string | null
          bidding_history: Json | null
          bids_today_count: number | null
          brief_id: string | null
          brief_text: string | null
          campaign_id: string | null
          channel_id: string | null
          channel_owner_wallet: string | null
          content_items: Json | null
          created_at: string | null
          creative_content: Json | null
          escrow_wallet_id: string | null
          expires_at: string | null
          id: string
          last_activity_at: string | null
          last_bid_at: string | null
          min_duration_hours: number | null
          negotiation_status: string | null
          origin: string | null
          package_description: string | null
          package_title: string | null
          payment_confirmed_at: string | null
          payment_memo: string | null
          payment_tx_hash: string | null
          payout_at: string | null
          payout_tx_hash: string | null
          price_amount: number
          price_currency: string | null
          refund_at: string | null
          refund_tx_hash: string | null
          rejection_reason: string | null
          requested_post_time: string | null
          status: Database["public"]["Enums"]["deal_status"] | null
          status_updated_at: string | null
          updated_at: string | null
        }
        Insert: {
          actual_post_time?: string | null
          advertiser_id?: string | null
          advertiser_wallet_address?: string | null
          bidding_history?: Json | null
          bids_today_count?: number | null
          brief_id?: string | null
          brief_text?: string | null
          campaign_id?: string | null
          channel_id?: string | null
          channel_owner_wallet?: string | null
          content_items?: Json | null
          created_at?: string | null
          creative_content?: Json | null
          escrow_wallet_id?: string | null
          expires_at?: string | null
          id?: string
          last_activity_at?: string | null
          last_bid_at?: string | null
          min_duration_hours?: number | null
          negotiation_status?: string | null
          origin?: string | null
          package_description?: string | null
          package_title?: string | null
          payment_confirmed_at?: string | null
          payment_memo?: string | null
          payment_tx_hash?: string | null
          payout_at?: string | null
          payout_tx_hash?: string | null
          price_amount: number
          price_currency?: string | null
          refund_at?: string | null
          refund_tx_hash?: string | null
          rejection_reason?: string | null
          requested_post_time?: string | null
          status?: Database["public"]["Enums"]["deal_status"] | null
          status_updated_at?: string | null
          updated_at?: string | null
        }
        Update: {
          actual_post_time?: string | null
          advertiser_id?: string | null
          advertiser_wallet_address?: string | null
          bidding_history?: Json | null
          bids_today_count?: number | null
          brief_id?: string | null
          brief_text?: string | null
          campaign_id?: string | null
          channel_id?: string | null
          channel_owner_wallet?: string | null
          content_items?: Json | null
          created_at?: string | null
          creative_content?: Json | null
          escrow_wallet_id?: string | null
          expires_at?: string | null
          id?: string
          last_activity_at?: string | null
          last_bid_at?: string | null
          min_duration_hours?: number | null
          negotiation_status?: string | null
          origin?: string | null
          package_description?: string | null
          package_title?: string | null
          payment_confirmed_at?: string | null
          payment_memo?: string | null
          payment_tx_hash?: string | null
          payout_at?: string | null
          payout_tx_hash?: string | null
          price_amount?: number
          price_currency?: string | null
          refund_at?: string | null
          refund_tx_hash?: string | null
          rejection_reason?: string | null
          requested_post_time?: string | null
          status?: Database["public"]["Enums"]["deal_status"] | null
          status_updated_at?: string | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "deals_advertiser_id_fkey"
            columns: ["advertiser_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "deals_brief_id_fkey"
            columns: ["brief_id"]
            isOneToOne: false
            referencedRelation: "public_briefs"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "deals_campaign_id_fkey"
            columns: ["campaign_id"]
            isOneToOne: false
            referencedRelation: "campaigns"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "deals_channel_id_fkey"
            columns: ["channel_id"]
            isOneToOne: false
            referencedRelation: "channels"
            referencedColumns: ["id"]
          },
        ]
      }
      pending_payouts: {
        Row: {
          amount_ton: number
          completed_at: string | null
          created_at: string | null
          currency: string | null
          deal_id: string | null
          error_message: string | null
          id: string
          memo: string | null
          reason: string | null
          recipient_address: string
          retry_count: number | null
          status: string | null
          tx_hash: string | null
          type: string | null
        }
        Insert: {
          amount_ton: number
          completed_at?: string | null
          created_at?: string | null
          currency?: string | null
          deal_id?: string | null
          error_message?: string | null
          id?: string
          memo?: string | null
          reason?: string | null
          recipient_address: string
          retry_count?: number | null
          status?: string | null
          tx_hash?: string | null
          type?: string | null
        }
        Update: {
          amount_ton?: number
          completed_at?: string | null
          created_at?: string | null
          currency?: string | null
          deal_id?: string | null
          error_message?: string | null
          id?: string
          memo?: string | null
          reason?: string | null
          recipient_address?: string
          retry_count?: number | null
          status?: string | null
          tx_hash?: string | null
          type?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "pending_payouts_deal_id_fkey"
            columns: ["deal_id"]
            isOneToOne: false
            referencedRelation: "deals"
            referencedColumns: ["id"]
          },
        ]
      }
      public_briefs: {
        Row: {
          advertiser_id: string | null
          budget_range_max: number | null
          budget_range_min: number | null
          content: string
          created_at: string | null
          currency: string | null
          id: string
          is_active: boolean | null
          tags: string[] | null
          title: string
        }
        Insert: {
          advertiser_id?: string | null
          budget_range_max?: number | null
          budget_range_min?: number | null
          content: string
          created_at?: string | null
          currency?: string | null
          id?: string
          is_active?: boolean | null
          tags?: string[] | null
          title: string
        }
        Update: {
          advertiser_id?: string | null
          budget_range_max?: number | null
          budget_range_min?: number | null
          content?: string
          created_at?: string | null
          currency?: string | null
          id?: string
          is_active?: boolean | null
          tags?: string[] | null
          title?: string
        }
        Relationships: [
          {
            foreignKeyName: "public_briefs_advertiser_id_fkey"
            columns: ["advertiser_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      transactions: {
        Row: {
          amount: number
          created_at: string | null
          description: string | null
          id: string
          reference_id: string | null
          type: string
          wallet_id: string | null
        }
        Insert: {
          amount: number
          created_at?: string | null
          description?: string | null
          id?: string
          reference_id?: string | null
          type: string
          wallet_id?: string | null
        }
        Update: {
          amount?: number
          created_at?: string | null
          description?: string | null
          id?: string
          reference_id?: string | null
          type?: string
          wallet_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "transactions_wallet_id_fkey"
            columns: ["wallet_id"]
            isOneToOne: false
            referencedRelation: "wallets"
            referencedColumns: ["id"]
          },
        ]
      }
      unlisted_drafts: {
        Row: {
          created_at: string | null
          draft_data: Json
          id: string
          telegram_channel_id: number
          updated_at: string | null
          user_id: string | null
        }
        Insert: {
          created_at?: string | null
          draft_data: Json
          id?: string
          telegram_channel_id: number
          updated_at?: string | null
          user_id?: string | null
        }
        Update: {
          created_at?: string | null
          draft_data?: Json
          id?: string
          telegram_channel_id?: number
          updated_at?: string | null
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "unlisted_drafts_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      users: {
        Row: {
          created_at: string | null
          current_negotiating_deal_id: string | null
          first_name: string | null
          id: string
          telegram_id: number
          updated_at: string | null
          username: string | null
        }
        Insert: {
          created_at?: string | null
          current_negotiating_deal_id?: string | null
          first_name?: string | null
          id?: string
          telegram_id: number
          updated_at?: string | null
          username?: string | null
        }
        Update: {
          created_at?: string | null
          current_negotiating_deal_id?: string | null
          first_name?: string | null
          id?: string
          telegram_id?: number
          updated_at?: string | null
          username?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "users_current_negotiating_deal_id_fkey"
            columns: ["current_negotiating_deal_id"]
            isOneToOne: false
            referencedRelation: "deals"
            referencedColumns: ["id"]
          },
        ]
      }
      wallets: {
        Row: {
          balance: number | null
          currency: string | null
          id: string
          user_id: string | null
        }
        Insert: {
          balance?: number | null
          currency?: string | null
          id?: string
          user_id?: string | null
        }
        Update: {
          balance?: number | null
          currency?: string | null
          id?: string
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "wallets_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      [_ in never]: never
    }
    Enums: {
      deal_status:
        | "draft"
        | "submitted"
        | "negotiating"
        | "funded"
        | "approved"
        | "posted"
        | "monitoring"
        | "released"
        | "cancelled"
        | "disputed"
        | "rejected"
        | "pending_refund"
        | "refunded"
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
}

type DatabaseWithoutInternals = Omit<Database, "__InternalSupabase">

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, "public">]

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] &
        DefaultSchema["Views"])
    ? (DefaultSchema["Tables"] &
        DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
        Row: infer R
      }
      ? R
      : never
    : never

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Insert: infer I
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Insert: infer I
      }
      ? I
      : never
    : never

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Update: infer U
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Update: infer U
      }
      ? U
      : never
    : never

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    | keyof DefaultSchema["Enums"]
    | { schema: keyof DatabaseWithoutInternals },
  EnumName extends DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never = never,
> = DefaultSchemaEnumNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
    ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
    : never

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof DefaultSchema["CompositeTypes"]
    | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never

export const Constants = {
  public: {
    Enums: {
      deal_status: [
        "draft",
        "submitted",
        "negotiating",
        "funded",
        "approved",
        "posted",
        "monitoring",
        "released",
        "cancelled",
        "disputed",
        "rejected",
        "pending_refund",
        "refunded",
      ],
    },
  },
} as const
