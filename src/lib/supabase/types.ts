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
    };
    Views: Record<string, never>;
    Functions: Record<string, never>;
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

export type ProductWithAttributes = Product & {
  product_attributes: ProductAttributes[];
};

export type OutfitWithDetails = Outfit & {
  outfit_items: (OutfitItem & {
    products: Product & { product_attributes: ProductAttributes[] };
  })[];
  outfit_content: OutfitContent[];
};
