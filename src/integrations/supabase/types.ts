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
      characters: {
        Row: {
          created_at: string
          id: string
          name: string
          scene_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          name: string
          scene_id: string
        }
        Update: {
          created_at?: string
          id?: string
          name?: string
          scene_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "characters_scene_id_fkey"
            columns: ["scene_id"]
            isOneToOne: false
            referencedRelation: "scenes"
            referencedColumns: ["id"]
          },
        ]
      }
      line_blocks: {
        Row: {
          created_at: string
          id: string
          modern_hint: string | null
          order_index: number
          preceding_cue_raw: string | null
          scene_id: string
          section_id: string | null
          speaker_name: string
          text_raw: string
        }
        Insert: {
          created_at?: string
          id?: string
          modern_hint?: string | null
          order_index: number
          preceding_cue_raw?: string | null
          scene_id: string
          section_id?: string | null
          speaker_name: string
          text_raw: string
        }
        Update: {
          created_at?: string
          id?: string
          modern_hint?: string | null
          order_index?: number
          preceding_cue_raw?: string | null
          scene_id?: string
          section_id?: string | null
          speaker_name?: string
          text_raw?: string
        }
        Relationships: [
          {
            foreignKeyName: "line_blocks_scene_id_fkey"
            columns: ["scene_id"]
            isOneToOne: false
            referencedRelation: "scenes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "line_blocks_section_id_fkey"
            columns: ["section_id"]
            isOneToOne: false
            referencedRelation: "script_sections"
            referencedColumns: ["id"]
          },
        ]
      }
      practice_attempts: {
        Row: {
          character_name: string
          created_at: string
          id: string
          lineblock_id: string | null
          mode: string
          scene_id: string
          success: boolean
        }
        Insert: {
          character_name: string
          created_at?: string
          id?: string
          lineblock_id?: string | null
          mode: string
          scene_id: string
          success?: boolean
        }
        Update: {
          character_name?: string
          created_at?: string
          id?: string
          lineblock_id?: string | null
          mode?: string
          scene_id?: string
          success?: boolean
        }
        Relationships: [
          {
            foreignKeyName: "practice_attempts_lineblock_id_fkey"
            columns: ["lineblock_id"]
            isOneToOne: false
            referencedRelation: "line_blocks"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "practice_attempts_scene_id_fkey"
            columns: ["scene_id"]
            isOneToOne: false
            referencedRelation: "scenes"
            referencedColumns: ["id"]
          },
        ]
      }
      productions: {
        Row: {
          active_scene_id: string | null
          created_at: string
          description: string | null
          id: string
          is_active: boolean
          name: string
          updated_at: string
        }
        Insert: {
          active_scene_id?: string | null
          created_at?: string
          description?: string | null
          id?: string
          is_active?: boolean
          name: string
          updated_at?: string
        }
        Update: {
          active_scene_id?: string | null
          created_at?: string
          description?: string | null
          id?: string
          is_active?: boolean
          name?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "productions_active_scene_id_fkey"
            columns: ["active_scene_id"]
            isOneToOne: false
            referencedRelation: "scenes"
            referencedColumns: ["id"]
          },
        ]
      }
      scenes: {
        Row: {
          created_at: string
          id: string
          normalized_text: string | null
          pdf_text_raw: string | null
          production_id: string | null
          source_pdf: string | null
          title: string
        }
        Insert: {
          created_at?: string
          id?: string
          normalized_text?: string | null
          pdf_text_raw?: string | null
          production_id?: string | null
          source_pdf?: string | null
          title?: string
        }
        Update: {
          created_at?: string
          id?: string
          normalized_text?: string | null
          pdf_text_raw?: string | null
          production_id?: string | null
          source_pdf?: string | null
          title?: string
        }
        Relationships: [
          {
            foreignKeyName: "scenes_production_id_fkey"
            columns: ["production_id"]
            isOneToOne: false
            referencedRelation: "productions"
            referencedColumns: ["id"]
          },
        ]
      }
      script_sections: {
        Row: {
          act_number: number | null
          created_at: string
          id: string
          order_index: number
          scene_id: string
          scene_number: number | null
          title: string
        }
        Insert: {
          act_number?: number | null
          created_at?: string
          id?: string
          order_index: number
          scene_id: string
          scene_number?: number | null
          title: string
        }
        Update: {
          act_number?: number | null
          created_at?: string
          id?: string
          order_index?: number
          scene_id?: string
          scene_number?: number | null
          title?: string
        }
        Relationships: [
          {
            foreignKeyName: "script_sections_scene_id_fkey"
            columns: ["scene_id"]
            isOneToOne: false
            referencedRelation: "scenes"
            referencedColumns: ["id"]
          },
        ]
      }
      stage_directions: {
        Row: {
          created_at: string
          id: string
          order_index: number
          scene_id: string
          text_raw: string
        }
        Insert: {
          created_at?: string
          id?: string
          order_index: number
          scene_id: string
          text_raw: string
        }
        Update: {
          created_at?: string
          id?: string
          order_index?: number
          scene_id?: string
          text_raw?: string
        }
        Relationships: [
          {
            foreignKeyName: "stage_directions_scene_id_fkey"
            columns: ["scene_id"]
            isOneToOne: false
            referencedRelation: "scenes"
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
