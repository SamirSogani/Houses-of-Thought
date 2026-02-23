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
      analyses: {
        Row: {
          consequences: string
          created_at: string
          id: string
          is_draft: boolean
          is_public: boolean
          overarching_conclusion: string
          overarching_question: string
          purpose: string
          sub_purposes: string
          title: string
          updated_at: string
          user_id: string
        }
        Insert: {
          consequences?: string
          created_at?: string
          id?: string
          is_draft?: boolean
          is_public?: boolean
          overarching_conclusion?: string
          overarching_question?: string
          purpose?: string
          sub_purposes?: string
          title?: string
          updated_at?: string
          user_id?: string
        }
        Update: {
          consequences?: string
          created_at?: string
          id?: string
          is_draft?: boolean
          is_public?: boolean
          overarching_conclusion?: string
          overarching_question?: string
          purpose?: string
          sub_purposes?: string
          title?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      assumptions: {
        Row: {
          assumption_type: string
          content: string
          created_at: string
          id: string
          sub_question_id: string
        }
        Insert: {
          assumption_type?: string
          content?: string
          created_at?: string
          id?: string
          sub_question_id: string
        }
        Update: {
          assumption_type?: string
          content?: string
          created_at?: string
          id?: string
          sub_question_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "assumptions_sub_question_id_fkey"
            columns: ["sub_question_id"]
            isOneToOne: false
            referencedRelation: "sub_questions"
            referencedColumns: ["id"]
          },
        ]
      }
      concepts: {
        Row: {
          analysis_id: string
          created_at: string
          definition: string
          id: string
          term: string
        }
        Insert: {
          analysis_id: string
          created_at?: string
          definition?: string
          id?: string
          term?: string
        }
        Update: {
          analysis_id?: string
          created_at?: string
          definition?: string
          id?: string
          term?: string
        }
        Relationships: [
          {
            foreignKeyName: "concepts_analysis_id_fkey"
            columns: ["analysis_id"]
            isOneToOne: false
            referencedRelation: "analyses"
            referencedColumns: ["id"]
          },
        ]
      }
      pov_labels: {
        Row: {
          analysis_id: string
          created_at: string
          id: string
          label: string
          parent_category: string
          sort_order: number
        }
        Insert: {
          analysis_id: string
          created_at?: string
          id?: string
          label?: string
          parent_category?: string
          sort_order?: number
        }
        Update: {
          analysis_id?: string
          created_at?: string
          id?: string
          label?: string
          parent_category?: string
          sort_order?: number
        }
        Relationships: [
          {
            foreignKeyName: "pov_labels_analysis_id_fkey"
            columns: ["analysis_id"]
            isOneToOne: false
            referencedRelation: "analyses"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          about_me: string
          biological: string
          created_at: string
          current_project: string
          familial: string
          id: string
          individual: string
          location_context: string
          role_title: string
          social: string
          updated_at: string
          user_id: string
        }
        Insert: {
          about_me?: string
          biological?: string
          created_at?: string
          current_project?: string
          familial?: string
          id?: string
          individual?: string
          location_context?: string
          role_title?: string
          social?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          about_me?: string
          biological?: string
          created_at?: string
          current_project?: string
          familial?: string
          id?: string
          individual?: string
          location_context?: string
          role_title?: string
          social?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      sidebar_chats: {
        Row: {
          analysis_id: string
          chat_title: string
          created_at: string
          id: string
          messages: Json
          updated_at: string
          user_id: string
        }
        Insert: {
          analysis_id: string
          chat_title?: string
          created_at?: string
          id?: string
          messages?: Json
          updated_at?: string
          user_id?: string
        }
        Update: {
          analysis_id?: string
          chat_title?: string
          created_at?: string
          id?: string
          messages?: Json
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "sidebar_chats_analysis_id_fkey"
            columns: ["analysis_id"]
            isOneToOne: false
            referencedRelation: "analyses"
            referencedColumns: ["id"]
          },
        ]
      }
      sub_questions: {
        Row: {
          analysis_id: string
          created_at: string
          id: string
          information: string
          is_draft: boolean
          pov_category: string
          pov_label_id: string | null
          question: string
          sort_order: number
          sub_conclusion: string
          updated_at: string
        }
        Insert: {
          analysis_id: string
          created_at?: string
          id?: string
          information?: string
          is_draft?: boolean
          pov_category?: string
          pov_label_id?: string | null
          question?: string
          sort_order?: number
          sub_conclusion?: string
          updated_at?: string
        }
        Update: {
          analysis_id?: string
          created_at?: string
          id?: string
          information?: string
          is_draft?: boolean
          pov_category?: string
          pov_label_id?: string | null
          question?: string
          sort_order?: number
          sub_conclusion?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "sub_questions_analysis_id_fkey"
            columns: ["analysis_id"]
            isOneToOne: false
            referencedRelation: "analyses"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "sub_questions_pov_label_id_fkey"
            columns: ["pov_label_id"]
            isOneToOne: false
            referencedRelation: "pov_labels"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      can_access_analysis: { Args: { p_analysis_id: string }; Returns: boolean }
      can_access_sub_question: {
        Args: { p_sub_question_id: string }
        Returns: boolean
      }
      is_analysis_public: { Args: { p_analysis_id: string }; Returns: boolean }
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
