export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[];

export interface Database {
  public: {
    Tables: {
      products: {
        Row: {
          id: string;
          owner_id: string;
          name: string;
          category: string;
          price: number;
          image_url: string | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          owner_id?: string;
          name: string;
          category: string;
          price: number;
          image_url?: string | null;
          created_at?: string;
        };
        Update: {
          id?: string;
          owner_id?: string;
          name?: string;
          category?: string;
          price?: number;
          image_url?: string | null;
          created_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "";
            columns: ["owner_id"];
            isOneToOne: false;
            referencedRelation: "";
            referencedColumns: ["id"];
          },
        ];
      };
      product_attributes: {
        Row: {
          id: string;
          product_id: string;
          dominant_colors: Json | null;
          pattern: string | null;
          formality: string | null;
          style_tags: Json | null;
          season: string | null;
          clothing_type: string | null;
          raw_ai_json: Json | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          product_id: string;
          dominant_colors?: Json | null;
          pattern?: string | null;
          formality?: string | null;
          style_tags?: Json | null;
          season?: string | null;
          clothing_type?: string | null;
          raw_ai_json?: Json | null;
          created_at?: string;
        };
        Update: {
          id?: string;
          product_id?: string;
          dominant_colors?: Json | null;
          pattern?: string | null;
          formality?: string | null;
          style_tags?: Json | null;
          season?: string | null;
          clothing_type?: string | null;
          raw_ai_json?: Json | null;
          created_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "product_attributes_product_id_fkey";
            columns: ["product_id"];
            isOneToOne: false;
            referencedRelation: "products";
            referencedColumns: ["id"];
          },
        ];
      };
      outfits: {
        Row: {
          id: string;
          owner_id: string;
          theme_name: string | null;
          title: string | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          owner_id?: string;
          theme_name?: string | null;
          title?: string | null;
          created_at?: string;
        };
        Update: {
          id?: string;
          owner_id?: string;
          theme_name?: string | null;
          title?: string | null;
          created_at?: string;
        };
        Relationships: [];
      };
      outfit_items: {
        Row: {
          id: string;
          outfit_id: string;
          product_id: string;
          role: string | null;
        };
        Insert: {
          id?: string;
          outfit_id: string;
          product_id: string;
          role?: string | null;
        };
        Update: {
          id?: string;
          outfit_id?: string;
          product_id?: string;
          role?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: "outfit_items_outfit_id_fkey";
            columns: ["outfit_id"];
            isOneToOne: false;
            referencedRelation: "outfits";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "outfit_items_product_id_fkey";
            columns: ["product_id"];
            isOneToOne: false;
            referencedRelation: "products";
            referencedColumns: ["id"];
          },
        ];
      };
      outfit_content: {
        Row: {
          id: string;
          outfit_id: string;
          description: string | null;
          styling_tips: string | null;
          social_caption: string | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          outfit_id: string;
          description?: string | null;
          styling_tips?: string | null;
          social_caption?: string | null;
          created_at?: string;
        };
        Update: {
          id?: string;
          outfit_id?: string;
          description?: string | null;
          styling_tips?: string | null;
          social_caption?: string | null;
          created_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "outfit_content_outfit_id_fkey";
            columns: ["outfit_id"];
            isOneToOne: false;
            referencedRelation: "outfits";
            referencedColumns: ["id"];
          },
        ];
      };
      profiles: {
        Row: {
          id: string;
          full_name: string | null;
          business_name: string | null;
          created_at: string;
        };
        Insert: {
          id: string;
          full_name?: string | null;
          business_name?: string | null;
          created_at?: string;
        };
        Update: {
          id?: string;
          full_name?: string | null;
          business_name?: string | null;
          created_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "profiles_id_fkey";
            columns: ["id"];
            isOneToOne: true;
            referencedRelation: "";
            referencedColumns: ["id"];
          },
        ];
      };
      plans: {
        Row: {
          id: string;
          name: string;
          price_aed: number;
          is_most_popular: boolean;
          outfit_generations_limit: number | null;
          products_limit: number | null;
          ai_captions_limit: number | null;
          languages: string[];
          social_formats: string[] | null;
          analytics_level: string;
          export_formats: string[] | null;
          has_brand_kit: boolean;
          has_priority_generation: boolean;
          team_members_limit: number;
          sort_order: number;
          created_at: string;
        };
        Insert: {
          id: string;
          name: string;
          price_aed: number;
          is_most_popular?: boolean;
          outfit_generations_limit?: number | null;
          products_limit?: number | null;
          ai_captions_limit?: number | null;
          languages?: string[];
          social_formats?: string[] | null;
          analytics_level?: string;
          export_formats?: string[] | null;
          has_brand_kit?: boolean;
          has_priority_generation?: boolean;
          team_members_limit: number;
          sort_order: number;
          created_at?: string;
        };
        Update: {
          id?: string;
          name?: string;
          price_aed?: number;
          is_most_popular?: boolean;
          outfit_generations_limit?: number | null;
          products_limit?: number | null;
          ai_captions_limit?: number | null;
          languages?: string[];
          social_formats?: string[] | null;
          analytics_level?: string;
          export_formats?: string[] | null;
          has_brand_kit?: boolean;
          has_priority_generation?: boolean;
          team_members_limit?: number;
          sort_order?: number;
          created_at?: string;
        };
        Relationships: [];
      };
      subscriptions: {
        Row: {
          id: string;
          user_id: string;
          plan_id: string;
          status: string;
          current_period_start: string;
          current_period_end: string;
          pending_plan_id: string | null;
          outfit_generations_used: number;
          ai_captions_used: number;
          extra_credits_balance: number;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          user_id: string;
          plan_id: string;
          status?: string;
          current_period_start?: string;
          current_period_end: string;
          pending_plan_id?: string | null;
          outfit_generations_used?: number;
          ai_captions_used?: number;
          extra_credits_balance?: number;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          user_id?: string;
          plan_id?: string;
          status?: string;
          current_period_start?: string;
          current_period_end?: string;
          pending_plan_id?: string | null;
          outfit_generations_used?: number;
          ai_captions_used?: number;
          extra_credits_balance?: number;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "subscriptions_plan_id_fkey";
            columns: ["plan_id"];
            isOneToOne: false;
            referencedRelation: "plans";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "subscriptions_pending_plan_id_fkey";
            columns: ["pending_plan_id"];
            isOneToOne: false;
            referencedRelation: "plans";
            referencedColumns: ["id"];
          },
        ];
      };
      billing_transactions: {
        Row: {
          id: string;
          user_id: string;
          type: string;
          description: string;
          amount_aed: number;
          credits: number | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          user_id: string;
          type: string;
          description: string;
          amount_aed: number;
          credits?: number | null;
          created_at?: string;
        };
        Update: {
          id?: string;
          user_id?: string;
          type?: string;
          description?: string;
          amount_aed?: number;
          credits?: number | null;
          created_at?: string;
        };
        Relationships: [];
      };
      usage_events: {
        Row: {
          id: string;
          user_id: string;
          type: string;
          created_at: string;
        };
        Insert: {
          id?: string;
          user_id: string;
          type: string;
          created_at?: string;
        };
        Update: {
          id?: string;
          user_id?: string;
          type?: string;
          created_at?: string;
        };
        Relationships: [];
      };
    };
    Views: Record<string, never>;
    Functions: {
      checkout_subscription: {
        Args: { p_user_id: string; p_plan_id: string };
        Returns: Database["public"]["Tables"]["subscriptions"]["Row"];
      };
      upgrade_subscription: {
        Args: { p_user_id: string; p_new_plan_id: string };
        Returns: Database["public"]["Tables"]["subscriptions"]["Row"];
      };
      downgrade_subscription: {
        Args: { p_user_id: string; p_new_plan_id: string };
        Returns: Database["public"]["Tables"]["subscriptions"]["Row"];
      };
      cancel_pending_downgrade: {
        Args: { p_user_id: string };
        Returns: Database["public"]["Tables"]["subscriptions"]["Row"];
      };
      simulate_renewal: {
        Args: { p_user_id: string };
        Returns: Database["public"]["Tables"]["subscriptions"]["Row"];
      };
      consume_usage_credits: {
        Args: { p_user_id: string; p_type: string; p_count: number };
        Returns: { from_monthly: number; from_extra: number }[];
      };
      refund_usage_credits: {
        Args: {
          p_user_id: string;
          p_type: string;
          p_from_monthly: number;
          p_from_extra: number;
        };
        Returns: undefined;
      };
      add_extra_credits: {
        Args: { p_user_id: string; p_credits: number; p_amount_aed: number };
        Returns: Database["public"]["Tables"]["subscriptions"]["Row"];
      };
      debug_set_usage_near_limit: {
        Args: { p_user_id: string };
        Returns: Database["public"]["Tables"]["subscriptions"]["Row"];
      };
    };
    Enums: Record<string, never>;
    CompositeTypes: Record<string, never>;
  };
}

// Convenience aliases
export type Product = Database["public"]["Tables"]["products"]["Row"];
export type ProductInsert = Database["public"]["Tables"]["products"]["Insert"];
export type ProductAttributes =
  Database["public"]["Tables"]["product_attributes"]["Row"];
export type Outfit = Database["public"]["Tables"]["outfits"]["Row"];
export type OutfitItem = Database["public"]["Tables"]["outfit_items"]["Row"];
export type OutfitContent =
  Database["public"]["Tables"]["outfit_content"]["Row"];
export type Profile = Database["public"]["Tables"]["profiles"]["Row"];
export type Plan = Database["public"]["Tables"]["plans"]["Row"];
export type Subscription = Database["public"]["Tables"]["subscriptions"]["Row"];
export type BillingTransaction =
  Database["public"]["Tables"]["billing_transactions"]["Row"];
export type UsageEvent = Database["public"]["Tables"]["usage_events"]["Row"];

export type SubscriptionWithPlan = Subscription & {
  plan: Plan;
  pendingPlan: Plan | null;
};

export type ProductWithAttributes = Product & {
  product_attributes: ProductAttributes[];
};

export type OutfitWithDetails = Outfit & {
  outfit_items: (OutfitItem & {
    products: Product & { product_attributes: ProductAttributes[] };
  })[];
  outfit_content: OutfitContent[];
};
