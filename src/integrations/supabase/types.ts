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
          assignment_submission_id: string | null
          consequences: string
          created_at: string
          id: string
          is_draft: boolean
          is_public: boolean
          overarching_conclusion: string
          overarching_question: string
          owner_account_type: Database["public"]["Enums"]["account_type"]
          purpose: string
          sub_purposes: string
          title: string
          updated_at: string
          user_id: string
        }
        Insert: {
          assignment_submission_id?: string | null
          consequences?: string
          created_at?: string
          id?: string
          is_draft?: boolean
          is_public?: boolean
          overarching_conclusion?: string
          overarching_question?: string
          owner_account_type?: Database["public"]["Enums"]["account_type"]
          purpose?: string
          sub_purposes?: string
          title?: string
          updated_at?: string
          user_id?: string
        }
        Update: {
          assignment_submission_id?: string | null
          consequences?: string
          created_at?: string
          id?: string
          is_draft?: boolean
          is_public?: boolean
          overarching_conclusion?: string
          overarching_question?: string
          owner_account_type?: Database["public"]["Enums"]["account_type"]
          purpose?: string
          sub_purposes?: string
          title?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "analyses_assignment_submission_id_fkey"
            columns: ["assignment_submission_id"]
            isOneToOne: false
            referencedRelation: "assignment_submissions"
            referencedColumns: ["id"]
          },
        ]
      }
      assignment_submissions: {
        Row: {
          analysis_id: string | null
          assignment_id: string
          id: string
          response_text: string | null
          started_at: string
          status: Database["public"]["Enums"]["submission_status"]
          student_id: string
          submitted_at: string | null
        }
        Insert: {
          analysis_id?: string | null
          assignment_id: string
          id?: string
          response_text?: string | null
          started_at?: string
          status?: Database["public"]["Enums"]["submission_status"]
          student_id: string
          submitted_at?: string | null
        }
        Update: {
          analysis_id?: string | null
          assignment_id?: string
          id?: string
          response_text?: string | null
          started_at?: string
          status?: Database["public"]["Enums"]["submission_status"]
          student_id?: string
          submitted_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "assignment_submissions_analysis_id_fkey"
            columns: ["analysis_id"]
            isOneToOne: false
            referencedRelation: "analyses"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "assignment_submissions_assignment_id_fkey"
            columns: ["assignment_id"]
            isOneToOne: false
            referencedRelation: "assignments"
            referencedColumns: ["id"]
          },
        ]
      }
      assignments: {
        Row: {
          classroom_id: string
          created_at: string
          due_at: string | null
          id: string
          mode: Database["public"]["Enums"]["assignment_mode"]
          prefilled_question: string | null
          prefilled_sub_purposes: string | null
          prompt: string
          response_type: string | null
          teacher_id: string
          template_analysis_id: string | null
          title: string
          updated_at: string
        }
        Insert: {
          classroom_id: string
          created_at?: string
          due_at?: string | null
          id?: string
          mode?: Database["public"]["Enums"]["assignment_mode"]
          prefilled_question?: string | null
          prefilled_sub_purposes?: string | null
          prompt?: string
          response_type?: string | null
          teacher_id?: string
          template_analysis_id?: string | null
          title?: string
          updated_at?: string
        }
        Update: {
          classroom_id?: string
          created_at?: string
          due_at?: string | null
          id?: string
          mode?: Database["public"]["Enums"]["assignment_mode"]
          prefilled_question?: string | null
          prefilled_sub_purposes?: string | null
          prompt?: string
          response_type?: string | null
          teacher_id?: string
          template_analysis_id?: string | null
          title?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "assignments_classroom_id_fkey"
            columns: ["classroom_id"]
            isOneToOne: false
            referencedRelation: "classrooms"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "assignments_template_analysis_id_fkey"
            columns: ["template_analysis_id"]
            isOneToOne: false
            referencedRelation: "analyses"
            referencedColumns: ["id"]
          },
        ]
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
      attachments: {
        Row: {
          created_at: string
          file_name: string
          file_size: number
          id: string
          mime_type: string
          owner_id: string
          parent_id: string
          parent_type: string
          storage_path: string
        }
        Insert: {
          created_at?: string
          file_name: string
          file_size: number
          id?: string
          mime_type: string
          owner_id?: string
          parent_id: string
          parent_type: string
          storage_path: string
        }
        Update: {
          created_at?: string
          file_name?: string
          file_size?: number
          id?: string
          mime_type?: string
          owner_id?: string
          parent_id?: string
          parent_type?: string
          storage_path?: string
        }
        Relationships: []
      }
      classroom_members: {
        Row: {
          classroom_id: string
          id: string
          joined_at: string
          owner_account_type: Database["public"]["Enums"]["account_type"]
          student_id: string
        }
        Insert: {
          classroom_id: string
          id?: string
          joined_at?: string
          owner_account_type?: Database["public"]["Enums"]["account_type"]
          student_id: string
        }
        Update: {
          classroom_id?: string
          id?: string
          joined_at?: string
          owner_account_type?: Database["public"]["Enums"]["account_type"]
          student_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "classroom_members_classroom_id_fkey"
            columns: ["classroom_id"]
            isOneToOne: false
            referencedRelation: "classrooms"
            referencedColumns: ["id"]
          },
        ]
      }
      classrooms: {
        Row: {
          code: string
          created_at: string
          id: string
          name: string
          owner_account_type: Database["public"]["Enums"]["account_type"]
          student_cap: number | null
          teacher_id: string
          updated_at: string
        }
        Insert: {
          code: string
          created_at?: string
          id?: string
          name?: string
          owner_account_type?: Database["public"]["Enums"]["account_type"]
          student_cap?: number | null
          teacher_id?: string
          updated_at?: string
        }
        Update: {
          code?: string
          created_at?: string
          id?: string
          name?: string
          owner_account_type?: Database["public"]["Enums"]["account_type"]
          student_cap?: number | null
          teacher_id?: string
          updated_at?: string
        }
        Relationships: []
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
      draft_runs: {
        Row: {
          analysis_id: string
          created_at: string
          draft_info: Json
          final_logic_score: number
          final_resilience_score: number
          id: string
          iterations: number
          log_messages: Json
          status: string
          sub_questions_generated: number
          updated_at: string
          user_id: string
        }
        Insert: {
          analysis_id: string
          created_at?: string
          draft_info?: Json
          final_logic_score?: number
          final_resilience_score?: number
          id?: string
          iterations?: number
          log_messages?: Json
          status?: string
          sub_questions_generated?: number
          updated_at?: string
          user_id?: string
        }
        Update: {
          analysis_id?: string
          created_at?: string
          draft_info?: Json
          final_logic_score?: number
          final_resilience_score?: number
          id?: string
          iterations?: number
          log_messages?: Json
          status?: string
          sub_questions_generated?: number
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "draft_runs_analysis_id_fkey"
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
          account_type: Database["public"]["Enums"]["account_type"]
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
          username: string | null
        }
        Insert: {
          about_me?: string
          account_type?: Database["public"]["Enums"]["account_type"]
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
          username?: string | null
        }
        Update: {
          about_me?: string
          account_type?: Database["public"]["Enums"]["account_type"]
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
          username?: string | null
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
      site_visits: {
        Row: {
          created_at: string
          id: string
          path: string
          visitor_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          path?: string
          visitor_id: string
        }
        Update: {
          created_at?: string
          id?: string
          path?: string
          visitor_id?: string
        }
        Relationships: []
      }
      staging_group_items: {
        Row: {
          group_id: string
          item_id: string
          sort_order: number
        }
        Insert: {
          group_id: string
          item_id: string
          sort_order?: number
        }
        Update: {
          group_id?: string
          item_id?: string
          sort_order?: number
        }
        Relationships: [
          {
            foreignKeyName: "staging_group_items_group_id_fkey"
            columns: ["group_id"]
            isOneToOne: false
            referencedRelation: "staging_groups"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "staging_group_items_item_id_fkey"
            columns: ["item_id"]
            isOneToOne: false
            referencedRelation: "staging_items"
            referencedColumns: ["id"]
          },
        ]
      }
      staging_groups: {
        Row: {
          analysis_id: string
          assumption_mode: string | null
          base_type: string
          created_at: string
          id: string
          name: string
          sort_order: number
          updated_at: string
        }
        Insert: {
          analysis_id: string
          assumption_mode?: string | null
          base_type?: string
          created_at?: string
          id?: string
          name?: string
          sort_order?: number
          updated_at?: string
        }
        Update: {
          analysis_id?: string
          assumption_mode?: string | null
          base_type?: string
          created_at?: string
          id?: string
          name?: string
          sort_order?: number
          updated_at?: string
        }
        Relationships: []
      }
      staging_items: {
        Row: {
          analysis_id: string
          content: string
          created_at: string
          id: string
          sort_order: number
          type: string
          updated_at: string
        }
        Insert: {
          analysis_id: string
          content?: string
          created_at?: string
          id?: string
          sort_order?: number
          type?: string
          updated_at?: string
        }
        Update: {
          analysis_id?: string
          content?: string
          created_at?: string
          id?: string
          sort_order?: number
          type?: string
          updated_at?: string
        }
        Relationships: []
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
      test_results: {
        Row: {
          analysis_id: string
          created_at: string
          id: string
          result: Json
          score: number
          test_type: string
          user_id: string
        }
        Insert: {
          analysis_id: string
          created_at?: string
          id?: string
          result?: Json
          score?: number
          test_type: string
          user_id?: string
        }
        Update: {
          analysis_id?: string
          created_at?: string
          id?: string
          result?: Json
          score?: number
          test_type?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "test_results_analysis_id_fkey"
            columns: ["analysis_id"]
            isOneToOne: false
            referencedRelation: "analyses"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      _clone_analysis: {
        Args: { p_src_analysis_id: string; p_target_user: string }
        Returns: string
      }
      attachment_row_for_storage: {
        Args: { p_name: string }
        Returns: {
          created_at: string
          file_name: string
          file_size: number
          id: string
          mime_type: string
          owner_id: string
          parent_id: string
          parent_type: string
          storage_path: string
        }
        SetofOptions: {
          from: "*"
          to: "attachments"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      can_access_analysis: { Args: { p_analysis_id: string }; Returns: boolean }
      can_access_staging_group: {
        Args: { p_group_id: string }
        Returns: boolean
      }
      can_access_sub_question: {
        Args: { p_sub_question_id: string }
        Returns: boolean
      }
      can_attach_to: {
        Args: { p_parent_id: string; p_parent_type: string }
        Returns: boolean
      }
      can_teacher_view_analysis: {
        Args: { p_analysis_id: string }
        Returns: boolean
      }
      can_view_attachment: {
        Args: { p_attachment_id: string }
        Returns: boolean
      }
      current_account_type: {
        Args: never
        Returns: Database["public"]["Enums"]["account_type"]
      }
      generate_classroom_code: { Args: never; Returns: string }
      is_analysis_public: { Args: { p_analysis_id: string }; Returns: boolean }
      is_assignment_owner: {
        Args: { p_assignment_id: string }
        Returns: boolean
      }
      is_classroom_member: {
        Args: { p_classroom_id: string }
        Returns: boolean
      }
      is_classroom_owner: { Args: { p_classroom_id: string }; Returns: boolean }
      join_classroom: { Args: { p_code: string }; Returns: Json }
      leave_classroom: { Args: never; Returns: Json }
      regenerate_classroom_code: {
        Args: { p_classroom_id: string }
        Returns: Json
      }
      start_assignment: { Args: { p_assignment_id: string }; Returns: Json }
      submit_assignment: { Args: { p_submission_id: string }; Returns: Json }
      unsubmit_assignment: { Args: { p_submission_id: string }; Returns: Json }
    }
    Enums: {
      account_type: "standard" | "student" | "teacher"
      assignment_mode: "empty" | "prefilled" | "template" | "none"
      submission_status: "in_progress" | "submitted"
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
      account_type: ["standard", "student", "teacher"],
      assignment_mode: ["empty", "prefilled", "template", "none"],
      submission_status: ["in_progress", "submitted"],
    },
  },
} as const
