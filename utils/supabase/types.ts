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
      ai_generated_scripts: {
        Row: {
          ai_metadata: Json | null
          category: string | null
          content: string
          created_at: string
          description: string | null
          id: number
          is_saved_as_script: boolean | null
          name: string
          objections: Json | null
          prompt: string
          saved_script_id: number | null
          session_id: string
          updated_at: string | null
          user_id: string
          version_number: number
        }
        Insert: {
          ai_metadata?: Json | null
          category?: string | null
          content: string
          created_at?: string
          description?: string | null
          id?: number
          is_saved_as_script?: boolean | null
          name: string
          objections?: Json | null
          prompt: string
          saved_script_id?: number | null
          session_id?: string
          updated_at?: string | null
          user_id: string
          version_number?: number
        }
        Update: {
          ai_metadata?: Json | null
          category?: string | null
          content?: string
          created_at?: string
          description?: string | null
          id?: number
          is_saved_as_script?: boolean | null
          name?: string
          objections?: Json | null
          prompt?: string
          saved_script_id?: number | null
          session_id?: string
          updated_at?: string | null
          user_id?: string
          version_number?: number
        }
        Relationships: [
          {
            foreignKeyName: "ai_generated_scripts_saved_script_id_fkey"
            columns: ["saved_script_id"]
            isOneToOne: false
            referencedRelation: "scripts"
            referencedColumns: ["id"]
          },
        ]
      }
      call_history: {
        Row: {
          call_outcome: string | null
          call_sid: string | null
          contact_company: string | null
          contact_email: string | null
          contact_id: number | null
          contact_list_id: number
          contact_location: string | null
          contact_name: string
          contact_phone: string
          contact_position: string | null
          created_at: string | null
          duration: number | null
          ended_at: string | null
          id: string
          notes: string | null
          recording_available: boolean | null
          recording_url: string | null
          session_id: string
          started_at: string
          updated_at: string | null
          user_id: string
        }
        Insert: {
          call_outcome?: string | null
          call_sid?: string | null
          contact_company?: string | null
          contact_email?: string | null
          contact_id?: number | null
          contact_list_id: number
          contact_location?: string | null
          contact_name: string
          contact_phone: string
          contact_position?: string | null
          created_at?: string | null
          duration?: number | null
          ended_at?: string | null
          id?: string
          notes?: string | null
          recording_available?: boolean | null
          recording_url?: string | null
          session_id: string
          started_at?: string
          updated_at?: string | null
          user_id: string
        }
        Update: {
          call_outcome?: string | null
          call_sid?: string | null
          contact_company?: string | null
          contact_email?: string | null
          contact_id?: number | null
          contact_list_id?: number
          contact_location?: string | null
          contact_name?: string
          contact_phone?: string
          contact_position?: string | null
          created_at?: string | null
          duration?: number | null
          ended_at?: string | null
          id?: string
          notes?: string | null
          recording_available?: boolean | null
          recording_url?: string | null
          session_id?: string
          started_at?: string
          updated_at?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "call_history_contact_id_fkey"
            columns: ["contact_id"]
            isOneToOne: false
            referencedRelation: "contacts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "call_history_contact_list_id_fkey"
            columns: ["contact_list_id"]
            isOneToOne: false
            referencedRelation: "contact_lists"
            referencedColumns: ["id"]
          },
        ]
      }
      contact_lists: {
        Row: {
          created_at: string | null
          description: string | null
          id: number
          name: string
          status: string | null
          updated_at: string | null
          user_id: string
        }
        Insert: {
          created_at?: string | null
          description?: string | null
          id?: number
          name: string
          status?: string | null
          updated_at?: string | null
          user_id: string
        }
        Update: {
          created_at?: string | null
          description?: string | null
          id?: number
          name?: string
          status?: string | null
          updated_at?: string | null
          user_id?: string
        }
        Relationships: []
      }
      contacts: {
        Row: {
          call_attempts: number | null
          company: string | null
          contact_list_id: number
          created_at: string | null
          email: string | null
          id: number
          last_called_at: string | null
          name: string
          notes: string | null
          phone: string
          position: string | null
          status: string | null
          updated_at: string | null
          user_id: string
        }
        Insert: {
          call_attempts?: number | null
          company?: string | null
          contact_list_id: number
          created_at?: string | null
          email?: string | null
          id?: number
          last_called_at?: string | null
          name: string
          notes?: string | null
          phone: string
          position?: string | null
          status?: string | null
          updated_at?: string | null
          user_id: string
        }
        Update: {
          call_attempts?: number | null
          company?: string | null
          contact_list_id?: number
          created_at?: string | null
          email?: string | null
          id?: number
          last_called_at?: string | null
          name?: string
          notes?: string | null
          phone?: string
          position?: string | null
          status?: string | null
          updated_at?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "contacts_contact_list_id_fkey"
            columns: ["contact_list_id"]
            isOneToOne: false
            referencedRelation: "contact_lists"
            referencedColumns: ["id"]
          },
        ]
      }
      recordings: {
        Row: {
          call_history_id: string | null
          call_sid: string
          channels: number | null
          created_at: string | null
          download_status: string | null
          duration: number | null
          file_size: number | null
          id: string
          recording_sid: string
          recording_url: string
          source: string | null
          status: string | null
          storage_bucket: string | null
          storage_path: string | null
          transcribed_at: string | null
          transcription_confidence: number | null
          transcription_duration: number | null
          transcription_error: string | null
          transcription_language: string | null
          transcription_method: string | null
          transcription_segments: Json | null
          transcription_status: string | null
          transcription_text: string | null
          transcription_words: Json | null
          updated_at: string | null
          user_id: string | null
        }
        Insert: {
          call_history_id?: string | null
          call_sid: string
          channels?: number | null
          created_at?: string | null
          download_status?: string | null
          duration?: number | null
          file_size?: number | null
          id?: string
          recording_sid: string
          recording_url: string
          source?: string | null
          status?: string | null
          storage_bucket?: string | null
          storage_path?: string | null
          transcribed_at?: string | null
          transcription_confidence?: number | null
          transcription_duration?: number | null
          transcription_error?: string | null
          transcription_language?: string | null
          transcription_method?: string | null
          transcription_segments?: Json | null
          transcription_status?: string | null
          transcription_text?: string | null
          transcription_words?: Json | null
          updated_at?: string | null
          user_id?: string | null
        }
        Update: {
          call_history_id?: string | null
          call_sid?: string
          channels?: number | null
          created_at?: string | null
          download_status?: string | null
          duration?: number | null
          file_size?: number | null
          id?: string
          recording_sid?: string
          recording_url?: string
          source?: string | null
          status?: string | null
          storage_bucket?: string | null
          storage_path?: string | null
          transcribed_at?: string | null
          transcription_confidence?: number | null
          transcription_duration?: number | null
          transcription_error?: string | null
          transcription_language?: string | null
          transcription_method?: string | null
          transcription_segments?: Json | null
          transcription_status?: string | null
          transcription_text?: string | null
          transcription_words?: Json | null
          updated_at?: string | null
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "recordings_call_history_id_fkey"
            columns: ["call_history_id"]
            isOneToOne: false
            referencedRelation: "call_history"
            referencedColumns: ["id"]
          },
        ]
      }
      scripts: {
        Row: {
          avg_call_duration: string | null
          category: string | null
          content: string
          created_at: string
          description: string | null
          id: number
          linked_lists: string[] | null
          name: string
          objections: Json | null
          status: string | null
          success_rate: number | null
          updated_at: string | null
          usage_count: number | null
          user_id: string
        }
        Insert: {
          avg_call_duration?: string | null
          category?: string | null
          content: string
          created_at?: string
          description?: string | null
          id?: number
          linked_lists?: string[] | null
          name: string
          objections?: Json | null
          status?: string | null
          success_rate?: number | null
          updated_at?: string | null
          usage_count?: number | null
          user_id: string
        }
        Update: {
          avg_call_duration?: string | null
          category?: string | null
          content?: string
          created_at?: string
          description?: string | null
          id?: number
          linked_lists?: string[] | null
          name?: string
          objections?: Json | null
          status?: string | null
          success_rate?: number | null
          updated_at?: string | null
          usage_count?: number | null
          user_id?: string
        }
        Relationships: []
      }
    }
    Views: {
      current_timezone: {
        Row: {
          current_time_estonia: string | null
          current_time_utc: string | null
          current_timezone: string | null
        }
        Relationships: []
      }
    }
    Functions: {
      ensure_estonian_timezone: {
        Args: Record<PropertyKey, never>
        Returns: undefined
      }
      set_estonian_timezone: {
        Args: Record<PropertyKey, never>
        Returns: undefined
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

// Export additional types for easier use
export type Script = Tables<'scripts'>
export type AIGeneratedScript = Tables<'ai_generated_scripts'>
export type Contact = Tables<'contacts'>
export type ContactList = Tables<'contact_lists'>
export type CallHistory = Tables<'call_history'>
export type Recording = Tables<'recordings'> 