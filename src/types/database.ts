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
    PostgrestVersion: "14.4"
  }
  public: {
    Tables: {
      inquiry_reply_reads: {
        Row: {
          user_id: string
          last_read_at: string
        }
        Insert: {
          user_id: string
          last_read_at?: string
        }
        Update: {
          user_id?: string
          last_read_at?: string
        }
        Relationships: []
      }
      inquiry_posts: {
        Row: {
          id: string
          user_id: string
          content: string
          created_at: string
        }
        Insert: {
          id?: string
          user_id: string
          content: string
          created_at?: string
        }
        Update: {
          id?: string
          user_id?: string
          content?: string
          created_at?: string
        }
        Relationships: []
      }
      inquiry_replies: {
        Row: {
          id: string
          post_id: string
          admin_user_id: string
          content: string
          created_at: string
        }
        Insert: {
          id?: string
          post_id: string
          admin_user_id: string
          content: string
          created_at?: string
        }
        Update: {
          id?: string
          post_id?: string
          admin_user_id?: string
          content?: string
          created_at?: string
        }
        Relationships: []
      }
      line_link_codes: {
        Row: {
          id: string
          user_id: string
          code: string
          expires_at: string
          used_at: string | null
          created_at: string
        }
        Insert: {
          id?: string
          user_id: string
          code: string
          expires_at: string
          used_at?: string | null
          created_at?: string
        }
        Update: {
          id?: string
          user_id?: string
          code?: string
          expires_at?: string
          used_at?: string | null
          created_at?: string
        }
        Relationships: []
      }
      line_links: {
        Row: {
          id: string
          user_id: string
          line_source_id: string
          created_at: string
        }
        Insert: {
          id?: string
          user_id: string
          line_source_id: string
          created_at?: string
        }
        Update: {
          id?: string
          user_id?: string
          line_source_id?: string
          created_at?: string
        }
        Relationships: []
      }
      gemini_usage_limits: {
        Row: {
          count: number
          created_at: string
          date: string
          id: string
          updated_at: string
          user_id: string
        }
        Insert: {
          count?: number
          created_at?: string
          date?: string
          id?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          count?: number
          created_at?: string
          date?: string
          id?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      jobs: {
        Row: {
          created_at: string
          error_message: string | null
          id: string
          parser_mode: string | null
          pdf_hash: string | null
          pdf_title: string | null
          r2_object_key: string
          result_data: Json | null
          status: Database["public"]["Enums"]["job_status"]
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          error_message?: string | null
          id?: string
          parser_mode?: string | null
          pdf_hash?: string | null
          pdf_title?: string | null
          r2_object_key: string
          result_data?: Json | null
          status?: Database["public"]["Enums"]["job_status"]
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          error_message?: string | null
          id?: string
          parser_mode?: string | null
          pdf_hash?: string | null
          pdf_title?: string | null
          r2_object_key?: string
          result_data?: Json | null
          status?: Database["public"]["Enums"]["job_status"]
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      page_views: {
        Row: {
          id: string
          path: string
          locale: string | null
          device_type: string
          os: string | null
          browser: string | null
          referrer: string | null
          created_at: string
        }
        Insert: {
          id?: string
          path: string
          locale?: string | null
          device_type?: string
          os?: string | null
          browser?: string | null
          referrer?: string | null
          created_at?: string
        }
        Update: {
          id?: string
          path?: string
          locale?: string | null
          device_type?: string
          os?: string | null
          browser?: string | null
          referrer?: string | null
          created_at?: string
        }
        Relationships: []
      }
      parsed_pdfs: {
        Row: {
          created_at: string
          extracted_json: Json
          pdf_hash: string
        }
        Insert: {
          created_at?: string
          extracted_json: Json
          pdf_hash: string
        }
        Update: {
          created_at?: string
          extracted_json?: Json
          pdf_hash?: string
        }
        Relationships: []
      }
      user_streaks: {
        Row: {
          id: string
          user_id: string
          current_streak: number
          longest_streak: number
          last_active_date: string | null
          total_classifications: number
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          user_id: string
          current_streak?: number
          longest_streak?: number
          last_active_date?: string | null
          total_classifications?: number
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          user_id?: string
          current_streak?: number
          longest_streak?: number
          last_active_date?: string | null
          total_classifications?: number
          created_at?: string
          updated_at?: string
        }
        Relationships: []
      }
      user_integrations: {
        Row: {
          created_at: string
          google_access_token_enc: string | null
          google_calendar_scope_ok: boolean | null
          google_refresh_token_enc: string | null
          id: string
          line_user_id: string | null
          token_expires_at: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          google_access_token_enc?: string | null
          google_calendar_scope_ok?: boolean | null
          google_refresh_token_enc?: string | null
          id?: string
          line_user_id?: string | null
          token_expires_at?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          google_access_token_enc?: string | null
          google_calendar_scope_ok?: boolean | null
          google_refresh_token_enc?: string | null
          id?: string
          line_user_id?: string | null
          token_expires_at?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      [_ in never]: never
    }
    Enums: {
      job_status: "pending" | "processing" | "completed" | "error"
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
      job_status: ["pending", "processing", "completed", "error"],
    },
  },
} as const

// 後方互換性のための型エイリアス
export type JobStatus = Database["public"]["Enums"]["job_status"]
export type Job = Database["public"]["Tables"]["jobs"]["Row"]
export type UserIntegration = Database["public"]["Tables"]["user_integrations"]["Row"]

/** google_calendar_scope_ok フラグの意味 */
export type CalendarScopeStatus = 'allowed' | 'denied' | 'unknown'

export function resolveCalendarScopeStatus(flag: boolean | null | undefined): CalendarScopeStatus {
  if (flag === false) return 'denied'
  if (flag === true) return 'allowed'
  return 'unknown'
}
export type ParsedPdf = Database["public"]["Tables"]["parsed_pdfs"]["Row"]
export type LineLinkCode = Database["public"]["Tables"]["line_link_codes"]["Row"]
export type GarbageEvent = {
  date: string
  garbage_type: string
}
export type JobResultData = {
  calendar_event_count: number
  pdf_hash: string
  skipped_count?: number
}
export type UserStreak = Database['public']['Tables']['user_streaks']['Row']
export type InquiryPost = Database['public']['Tables']['inquiry_posts']['Row']
export type InquiryReply = Database['public']['Tables']['inquiry_replies']['Row']
export type InquiryReplyRead = Database['public']['Tables']['inquiry_reply_reads']['Row']
