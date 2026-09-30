export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  public: {
    Tables: {
      product_images: {
        Row: {
          created_at: string
          id: string
          image_url: string
          product_code: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          image_url: string
          product_code: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          image_url?: string
          product_code?: string
          user_id?: string
        }
        Relationships: []
      }
      product_import_batches: {
        Row: {
          id: string
          user_id: string
          batch_name: string
          source_file_name: string | null
          product_count: number
          created_at: string
        }
        Insert: {
          id?: string
          user_id: string
          batch_name: string
          source_file_name?: string | null
          product_count?: number
          created_at?: string
        }
        Update: {
          id?: string
          user_id?: string
          batch_name?: string
          source_file_name?: string | null
          product_count?: number
          created_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "product_import_batches_user_id_fkey"
            columns: ["user_id"]
            referencedRelation: "users"
            referencedColumns: ["id"]
          }
        ]
      }
      products: {
        Row: {
          cbm: string
          created_at: string
          description: string | null
          dimensions: string | null
          height: string | null
          id: string
          import_batch_id: string | null
          length: string | null
          price: number
          product_code: string
          sno: number
          user_id: string
          width: string | null
        }
        Insert: {
          cbm?: string
          created_at?: string
          description?: string | null
          dimensions?: string | null
          height?: string | null
          id?: string
          import_batch_id?: string | null
          length?: string | null
          price?: number
          product_code: string
          sno: number
          user_id: string
          width?: string | null
        }
        Update: {
          cbm?: string
          created_at?: string
          description?: string | null
          dimensions?: string | null
          height?: string | null
          id?: string
          import_batch_id?: string | null
          length?: string | null
          price?: number
          product_code?: string
          sno?: number
          user_id?: string
          width?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "products_import_batch_id_fkey"
            columns: ["import_batch_id"]
            referencedRelation: "product_import_batches"
            referencedColumns: ["id"]
          }
        ]
      }
      catalogs: {
        Row: {
          id: string
          user_id: string
          name: string
          description: string | null
          import_batch_id: string | null
          layout: string
          cover_title: string | null
          cover_subtitle: string | null
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          user_id: string
          name: string
          description?: string | null
          import_batch_id?: string | null
          layout?: string
          cover_title?: string | null
          cover_subtitle?: string | null
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          user_id?: string
          name?: string
          description?: string | null
          import_batch_id?: string | null
          layout?: string
          cover_title?: string | null
          cover_subtitle?: string | null
          created_at?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "catalogs_user_id_fkey"
            columns: ["user_id"]
            referencedRelation: "users"
            referencedColumns: ["id"]
          }
        ]
      }
      catalog_products: {
        Row: {
          id: string
          catalog_id: string
          product_id: string
          sort_order: number
          created_at: string
        }
        Insert: {
          id?: string
          catalog_id: string
          product_id: string
          sort_order?: number
          created_at?: string
        }
        Update: {
          id?: string
          catalog_id?: string
          product_id?: string
          sort_order?: number
          created_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "catalog_products_catalog_id_fkey"
            columns: ["catalog_id"]
            referencedRelation: "catalogs"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "catalog_products_product_id_fkey"
            columns: ["product_id"]
            referencedRelation: "products"
            referencedColumns: ["id"]
          }
        ]
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      get_public_product: {
        Args: { product_uuid: string }
        Returns: {
          id: string
          sno: number
          product_code: string
          dimensions: string | null
          length: string | null
          width: string | null
          height: string | null
          price: number
          cbm: string
          description: string | null
          image_url: string | null
        }[]
      }
    }
    Enums: {
      [_ in never]: never
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
}

type DefaultSchema = Database[Extract<keyof Database, "public">]

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof Database },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof Database
  }
    ? keyof (Database[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        Database[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never = never,
> = DefaultSchemaTableNameOrOptions extends { schema: keyof Database }
  ? (Database[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      Database[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
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
    | { schema: keyof Database },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof Database
  }
    ? keyof Database[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends { schema: keyof Database }
  ? Database[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
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
    | { schema: keyof Database },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof Database
  }
    ? keyof Database[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends { schema: keyof Database }
  ? Database[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
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
    | { schema: keyof Database },
  EnumName extends DefaultSchemaEnumNameOrOptions extends {
    schema: keyof Database
  }
    ? keyof Database[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never = never,
> = DefaultSchemaEnumNameOrOptions extends { schema: keyof Database }
  ? Database[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
    ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
    : never

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof DefaultSchema["CompositeTypes"]
    | { schema: keyof Database },
  CompositeTypeName extends PublicCompositeTypeNameOrOptions extends {
    schema: keyof Database
  }
    ? keyof Database[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never = never,
> = PublicCompositeTypeNameOrOptions extends { schema: keyof Database }
  ? Database[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never

export const Constants = {
  public: {
    Enums: {},
  },
} as const
