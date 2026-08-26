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
    PostgrestVersion: "14.15"
  }
  public: {
    Tables: {
      app_sessions: {
        Row: {
          created_at: string
          expires_at: string
          token: string
          user_id: string
        }
        Insert: {
          created_at?: string
          expires_at: string
          token: string
          user_id: string
        }
        Update: {
          created_at?: string
          expires_at?: string
          token?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "app_sessions_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "discord_users"
            referencedColumns: ["id"]
          },
        ]
      }
      discord_users: {
        Row: {
          access_token: string | null
          avatar: string | null
          created_at: string
          email: string | null
          global_name: string | null
          id: string
          refresh_token: string | null
          token_expires_at: string | null
          updated_at: string
          username: string
        }
        Insert: {
          access_token?: string | null
          avatar?: string | null
          created_at?: string
          email?: string | null
          global_name?: string | null
          id: string
          refresh_token?: string | null
          token_expires_at?: string | null
          updated_at?: string
          username: string
        }
        Update: {
          access_token?: string | null
          avatar?: string | null
          created_at?: string
          email?: string | null
          global_name?: string | null
          id?: string
          refresh_token?: string | null
          token_expires_at?: string | null
          updated_at?: string
          username?: string
        }
        Relationships: []
      }
      glow_transactions: {
        Row: {
          amount: number
          created_at: string
          id: string
          kind: string
          note: string | null
          user_id: string
        }
        Insert: {
          amount: number
          created_at?: string
          id?: string
          kind: string
          note?: string | null
          user_id: string
        }
        Update: {
          amount?: number
          created_at?: string
          id?: string
          kind?: string
          note?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "glow_transactions_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "discord_users"
            referencedColumns: ["id"]
          },
        ]
      }
      glow_wallets: {
        Row: {
          balance: number
          last_daily_at: string | null
          streak: number
          total_earned: number
          updated_at: string
          user_id: string
        }
        Insert: {
          balance?: number
          last_daily_at?: string | null
          streak?: number
          total_earned?: number
          updated_at?: string
          user_id: string
        }
        Update: {
          balance?: number
          last_daily_at?: string | null
          streak?: number
          total_earned?: number
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "glow_wallets_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: true
            referencedRelation: "discord_users"
            referencedColumns: ["id"]
          },
        ]
      }
      guild_items: {
        Row: {
          created_at: string
          data: Json
          enabled: boolean
          guild_id: string
          id: string
          kind: string
          name: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          data?: Json
          enabled?: boolean
          guild_id: string
          id?: string
          kind: string
          name: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          data?: Json
          enabled?: boolean
          guild_id?: string
          id?: string
          kind?: string
          name?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "guild_items_guild_id_fkey"
            columns: ["guild_id"]
            isOneToOne: false
            referencedRelation: "guilds"
            referencedColumns: ["id"]
          },
        ]
      }
      guild_modules: {
        Row: {
          config: Json
          enabled: boolean
          guild_id: string
          id: string
          module: string
          updated_at: string
        }
        Insert: {
          config?: Json
          enabled?: boolean
          guild_id: string
          id?: string
          module: string
          updated_at?: string
        }
        Update: {
          config?: Json
          enabled?: boolean
          guild_id?: string
          id?: string
          module?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "guild_modules_guild_id_fkey"
            columns: ["guild_id"]
            isOneToOne: false
            referencedRelation: "guilds"
            referencedColumns: ["id"]
          },
        ]
      }
      guilds: {
        Row: {
          created_at: string
          icon: string | null
          id: string
          locale: string
          name: string
          prefix: string
          timezone: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          icon?: string | null
          id: string
          locale?: string
          name: string
          prefix?: string
          timezone?: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          icon?: string | null
          id?: string
          locale?: string
          name?: string
          prefix?: string
          timezone?: string
          updated_at?: string
        }
        Relationships: []
      }
      scam_reports: {
        Row: {
          created_at: string
          description: string
          evidence_urls: Json
          guild_id: string
          id: string
          reported_avatar: string | null
          reported_user_id: string
          reported_username: string | null
          reporter_id: string
          reporter_name: string | null
          reviewed_at: string | null
          reviewed_by: string | null
          review_message_id: string | null
          review_error: string | null
          role_assigned: boolean
          role_assignment_error: string | null
          status: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          description: string
          evidence_urls?: Json
          guild_id: string
          id?: string
          reported_avatar?: string | null
          reported_user_id: string
          reported_username?: string | null
          reporter_id: string
          reporter_name?: string | null
          reviewed_at?: string | null
          reviewed_by?: string | null
          review_message_id?: string | null
          review_error?: string | null
          role_assigned?: boolean
          role_assignment_error?: string | null
          status?: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          description?: string
          evidence_urls?: Json
          guild_id?: string
          id?: string
          reported_avatar?: string | null
          reported_user_id?: string
          reported_username?: string | null
          reporter_id?: string
          reporter_name?: string | null
          reviewed_at?: string | null
          reviewed_by?: string | null
          review_message_id?: string | null
          review_error?: string | null
          role_assigned?: boolean
          role_assignment_error?: string | null
          status?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "scam_reports_guild_id_fkey"
            columns: ["guild_id"]
            isOneToOne: false
            referencedRelation: "guilds"
            referencedColumns: ["id"]
          },
        ]
      }
      member_levels: {
        Row: {
          avatar: string | null
          daily_xp: number
          guild_id: string
          id: string
          level: number
          monthly_xp: number
          updated_at: string
          user_id: string
          username: string | null
          voice_minutes: number
          weekly_xp: number
          xp: number
        }
        Insert: {
          avatar?: string | null
          daily_xp?: number
          guild_id: string
          id?: string
          level?: number
          monthly_xp?: number
          updated_at?: string
          user_id: string
          username?: string | null
          voice_minutes?: number
          weekly_xp?: number
          xp?: number
        }
        Update: {
          avatar?: string | null
          daily_xp?: number
          guild_id?: string
          id?: string
          level?: number
          monthly_xp?: number
          updated_at?: string
          user_id?: string
          username?: string | null
          voice_minutes?: number
          weekly_xp?: number
          xp?: number
        }
        Relationships: [
          {
            foreignKeyName: "member_levels_guild_id_fkey"
            columns: ["guild_id"]
            isOneToOne: false
            referencedRelation: "guilds"
            referencedColumns: ["id"]
          },
        ]
      }
      moderation_cases: {
        Row: {
          action: string
          active: boolean
          created_at: string
          duration_minutes: number | null
          expires_at: string | null
          guild_id: string
          id: string
          moderator_id: string | null
          moderator_name: string | null
          reason: string | null
          target_avatar: string | null
          target_id: string
          target_name: string | null
        }
        Insert: {
          action: string
          active?: boolean
          created_at?: string
          duration_minutes?: number | null
          expires_at?: string | null
          guild_id: string
          id?: string
          moderator_id?: string | null
          moderator_name?: string | null
          reason?: string | null
          target_avatar?: string | null
          target_id: string
          target_name?: string | null
        }
        Update: {
          action?: string
          active?: boolean
          created_at?: string
          duration_minutes?: number | null
          expires_at?: string | null
          guild_id?: string
          id?: string
          moderator_id?: string | null
          moderator_name?: string | null
          reason?: string | null
          target_avatar?: string | null
          target_id?: string
          target_name?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "moderation_cases_guild_id_fkey"
            columns: ["guild_id"]
            isOneToOne: false
            referencedRelation: "guilds"
            referencedColumns: ["id"]
          },
        ]
      }
      suggestions: {
        Row: {
          anonymous: boolean
          author_id: string
          author_name: string | null
          content: string
          created_at: string
          downvotes: number
          guild_id: string
          id: string
          image_url: string | null
          staff_note: string | null
          status: string
          updated_at: string
          upvotes: number
        }
        Insert: {
          anonymous?: boolean
          author_id: string
          author_name?: string | null
          content: string
          created_at?: string
          downvotes?: number
          guild_id: string
          id?: string
          image_url?: string | null
          staff_note?: string | null
          status?: string
          updated_at?: string
          upvotes?: number
        }
        Update: {
          anonymous?: boolean
          author_id?: string
          author_name?: string | null
          content?: string
          created_at?: string
          downvotes?: number
          guild_id?: string
          id?: string
          image_url?: string | null
          staff_note?: string | null
          status?: string
          updated_at?: string
          upvotes?: number
        }
        Relationships: [
          {
            foreignKeyName: "suggestions_guild_id_fkey"
            columns: ["guild_id"]
            isOneToOne: false
            referencedRelation: "guilds"
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
      [_ in never]: never
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
    Enums: {},
  },
} as const
