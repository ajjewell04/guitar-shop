export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[];

export type Database = {
  // Allows to automatically instantiate createClient with right options
  // instead of createClient<Database, { PostgrestVersion: 'XX' }>(URL, KEY)
  __InternalSupabase: {
    PostgrestVersion: "14.1";
  };
  graphql_public: {
    Tables: {
      [_ in never]: never;
    };
    Views: {
      [_ in never]: never;
    };
    Functions: {
      graphql: {
        Args: {
          extensions?: Json;
          operationName?: string;
          query?: string;
          variables?: Json;
        };
        Returns: Json;
      };
    };
    Enums: {
      [_ in never]: never;
    };
    CompositeTypes: {
      [_ in never]: never;
    };
  };
  public: {
    Tables: {
      asset_files: {
        Row: {
          asset_id: string | null;
          bucket: string;
          bytes: number | null;
          created_on: string;
          etag: string | null;
          file_variant: Database["public"]["Enums"]["file_variant"];
          filename: string | null;
          id: string;
          last_updated: string;
          meta: Json | null;
          mime_type: string | null;
          object_key: string | null;
          owner_id: string;
          sha256: string | null;
        };
        Insert: {
          asset_id?: string | null;
          bucket: string;
          bytes?: number | null;
          created_on?: string;
          etag?: string | null;
          file_variant?: Database["public"]["Enums"]["file_variant"];
          filename?: string | null;
          id?: string;
          last_updated?: string;
          meta?: Json | null;
          mime_type?: string | null;
          object_key?: string | null;
          owner_id?: string;
          sha256?: string | null;
        };
        Update: {
          asset_id?: string | null;
          bucket?: string;
          bytes?: number | null;
          created_on?: string;
          etag?: string | null;
          file_variant?: Database["public"]["Enums"]["file_variant"];
          filename?: string | null;
          id?: string;
          last_updated?: string;
          meta?: Json | null;
          mime_type?: string | null;
          object_key?: string | null;
          owner_id?: string;
          sha256?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: "asset_files_asset_id_fkey";
            columns: ["asset_id"];
            isOneToOne: false;
            referencedRelation: "assets";
            referencedColumns: ["id"];
          },
        ];
      };
      assets: {
        Row: {
          asset_file_id: string | null;
          created_on: string;
          id: string;
          last_updated: string;
          meta: Json;
          name: string;
          owner_id: string;
          part_type: Database["public"]["Enums"]["part_type"] | null;
          preview_file_id: string | null;
          upload_date: string | null;
          upload_status: Database["public"]["Enums"]["upload_status"] | null;
        };
        Insert: {
          asset_file_id?: string | null;
          created_on?: string;
          id?: string;
          last_updated?: string;
          meta?: Json;
          name?: string;
          owner_id?: string;
          part_type?: Database["public"]["Enums"]["part_type"] | null;
          preview_file_id?: string | null;
          upload_date?: string | null;
          upload_status?: Database["public"]["Enums"]["upload_status"] | null;
        };
        Update: {
          asset_file_id?: string | null;
          created_on?: string;
          id?: string;
          last_updated?: string;
          meta?: Json;
          name?: string;
          owner_id?: string;
          part_type?: Database["public"]["Enums"]["part_type"] | null;
          preview_file_id?: string | null;
          upload_date?: string | null;
          upload_status?: Database["public"]["Enums"]["upload_status"] | null;
        };
        Relationships: [
          {
            foreignKeyName: "assets_asset_file_id_fkey";
            columns: ["asset_file_id"];
            isOneToOne: false;
            referencedRelation: "asset_files";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "assets_preview_file_id_fkey";
            columns: ["preview_file_id"];
            isOneToOne: false;
            referencedRelation: "asset_files";
            referencedColumns: ["id"];
          },
        ];
      };
      project_nodes: {
        Row: {
          asset_id: string | null;
          created_on: string;
          id: string;
          last_updated: string;
          meta: Json;
          name: string;
          overrides: Json;
          parent_id: string | null;
          project_id: string;
          sort_index: number;
          transforms: Json;
          type: Database["public"]["Enums"]["node_type"];
        };
        Insert: {
          asset_id?: string | null;
          created_on?: string;
          id?: string;
          last_updated?: string;
          meta: Json;
          name: string;
          overrides: Json;
          parent_id?: string | null;
          project_id?: string;
          sort_index?: number;
          transforms: Json;
          type: Database["public"]["Enums"]["node_type"];
        };
        Update: {
          asset_id?: string | null;
          created_on?: string;
          id?: string;
          last_updated?: string;
          meta?: Json;
          name?: string;
          overrides?: Json;
          parent_id?: string | null;
          project_id?: string;
          sort_index?: number;
          transforms?: Json;
          type?: Database["public"]["Enums"]["node_type"];
        };
        Relationships: [
          {
            foreignKeyName: "project_nodes_asset_id_fkey";
            columns: ["asset_id"];
            isOneToOne: false;
            referencedRelation: "assets";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "project_nodes_parent_id_fkey";
            columns: ["parent_id"];
            isOneToOne: false;
            referencedRelation: "project_nodes";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "project_nodes_project_id_fkey";
            columns: ["project_id"];
            isOneToOne: false;
            referencedRelation: "projects";
            referencedColumns: ["id"];
          },
        ];
      };
      projects: {
        Row: {
          created_on: string;
          id: string;
          last_updated: string;
          name: string;
          owner_id: string;
          preview_file_id: string | null;
          root_node_id: string | null;
        };
        Insert: {
          created_on?: string;
          id?: string;
          last_updated?: string;
          name?: string;
          owner_id?: string;
          preview_file_id?: string | null;
          root_node_id?: string | null;
        };
        Update: {
          created_on?: string;
          id?: string;
          last_updated?: string;
          name?: string;
          owner_id?: string;
          preview_file_id?: string | null;
          root_node_id?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: "projects_preview_file_id_fkey";
            columns: ["preview_file_id"];
            isOneToOne: false;
            referencedRelation: "asset_files";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "projects_root_node_id_fkey";
            columns: ["root_node_id"];
            isOneToOne: false;
            referencedRelation: "project_nodes";
            referencedColumns: ["id"];
          },
        ];
      };
    };
    Views: {
      [_ in never]: never;
    };
    Functions: {
      create_project_with_root: {
        Args: { p_name: string };
        Returns: {
          project_id: string;
          root_node_id: string;
        }[];
      };
      promote_project_root: {
        Args: { p_new_root_node_id: string; p_project_id: string };
        Returns: {
          project_id: string;
          root_node_id: string;
        }[];
      };
    };
    Enums: {
      asset_scope: "project" | "local_library" | "public_library";
      asset_type: "model" | "material" | "picture";
      file_variant: "original" | "optimized" | "preview";
      node_type: "assembly" | "part";
      part_type:
        | "body"
        | "neck"
        | "headstock"
        | "bridge"
        | "tuning_machine"
        | "pickup"
        | "pickguard"
        | "knob"
        | "switch"
        | "strap_button"
        | "output_jack"
        | "miscellaneous";
      upload_status: "approved" | "rejected" | "pending";
    };
    CompositeTypes: {
      [_ in never]: never;
    };
  };
};

type DatabaseWithoutInternals = Omit<Database, "__InternalSupabase">;

type DefaultSchema = DatabaseWithoutInternals[Extract<
  keyof Database,
  "public"
>];

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals;
}
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R;
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] &
        DefaultSchema["Views"])
    ? (DefaultSchema["Tables"] &
        DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
        Row: infer R;
      }
      ? R
      : never
    : never;

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals;
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Insert: infer I;
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Insert: infer I;
      }
      ? I
      : never
    : never;

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals;
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Update: infer U;
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Update: infer U;
      }
      ? U
      : never
    : never;

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    | keyof DefaultSchema["Enums"]
    | { schema: keyof DatabaseWithoutInternals },
  EnumName extends DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never = never,
> = DefaultSchemaEnumNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals;
}
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
    ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
    : never;

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof DefaultSchema["CompositeTypes"]
    | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals;
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never;

export const Constants = {
  graphql_public: {
    Enums: {},
  },
  public: {
    Enums: {
      asset_scope: ["project", "local_library", "public_library"],
      asset_type: ["model", "material", "picture"],
      file_variant: ["original", "optimized", "preview"],
      node_type: ["assembly", "part"],
      part_type: [
        "body",
        "neck",
        "headstock",
        "bridge",
        "tuning_machine",
        "pickup",
        "pickguard",
        "knob",
        "switch",
        "strap_button",
        "output_jack",
        "miscellaneous",
      ],
      upload_status: ["approved", "rejected", "pending"],
    },
  },
} as const;
