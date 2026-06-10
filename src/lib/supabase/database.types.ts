/**
 * Hand-authored database types for the F1 surface (no Supabase CLI in this env).
 * Mirrors the structure `supabase gen types typescript` produces so supabase-js
 * resolves rows/RPC args correctly. Keep in sync with supabase/migrations/*.sql;
 * regenerate with the CLI once Docker is available.
 */
export type Json = string | number | boolean | null | { [key: string]: Json | undefined } | Json[];

export type Database = {
  __InternalSupabase: {
    PostgrestVersion: "12";
  };
  public: {
    Tables: {
      profiles: {
        Row: { id: string; display_name: string; created_at: string };
        Insert: { id: string; display_name: string; created_at?: string };
        Update: { id?: string; display_name?: string; created_at?: string };
        Relationships: [];
      };
      groups: {
        Row: { id: string; name: string; created_by: string; created_at: string };
        Insert: { id?: string; name: string; created_by: string; created_at?: string };
        Update: { id?: string; name?: string; created_by?: string; created_at?: string };
        Relationships: [];
      };
      group_members: {
        Row: { group_id: string; user_id: string; role: GroupRole; joined_at: string };
        Insert: { group_id: string; user_id: string; role?: GroupRole; joined_at?: string };
        Update: { group_id?: string; user_id?: string; role?: GroupRole; joined_at?: string };
        Relationships: [];
      };
      group_invites: {
        Row: {
          id: string;
          group_id: string;
          code: string;
          created_by: string;
          expires_at: string;
          created_at: string;
        };
        Insert: {
          id?: string;
          group_id: string;
          code: string;
          created_by: string;
          expires_at?: string;
          created_at?: string;
        };
        Update: {
          id?: string;
          group_id?: string;
          code?: string;
          created_by?: string;
          expires_at?: string;
          created_at?: string;
        };
        Relationships: [];
      };
      decks: {
        Row: {
          id: string;
          user_id: string;
          name: string;
          commander_name: string;
          commander_scryfall_id: string | null;
          color_identity: string[];
          source: DeckSource;
          source_url: string | null;
          card_data: Json | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          user_id: string;
          name: string;
          commander_name: string;
          commander_scryfall_id?: string | null;
          color_identity?: string[];
          source: DeckSource;
          source_url?: string | null;
          card_data?: Json | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          user_id?: string;
          name?: string;
          commander_name?: string;
          commander_scryfall_id?: string | null;
          color_identity?: string[];
          source?: DeckSource;
          source_url?: string | null;
          card_data?: Json | null;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [];
      };
      matches: {
        Row: {
          id: string;
          group_id: string;
          host_id: string;
          status: MatchStatus;
          winner_user_id: string | null;
          started_at: string;
          finalized_at: string | null;
        };
        Insert: {
          id?: string;
          group_id: string;
          host_id: string;
          status?: MatchStatus;
          winner_user_id?: string | null;
          started_at?: string;
          finalized_at?: string | null;
        };
        Update: {
          id?: string;
          group_id?: string;
          host_id?: string;
          status?: MatchStatus;
          winner_user_id?: string | null;
          started_at?: string;
          finalized_at?: string | null;
        };
        Relationships: [];
      };
      match_participants: {
        Row: {
          id: string;
          match_id: string;
          user_id: string;
          deck_id: string | null;
          deck_name_snapshot: string | null;
          commander_snapshot: string | null;
          verified: boolean;
          joined_at: string;
          placement: number | null;
        };
        Insert: {
          id?: string;
          match_id: string;
          user_id: string;
          deck_id?: string | null;
          deck_name_snapshot?: string | null;
          commander_snapshot?: string | null;
          verified?: boolean;
          joined_at?: string;
          placement?: number | null;
        };
        Update: {
          id?: string;
          match_id?: string;
          user_id?: string;
          deck_id?: string | null;
          deck_name_snapshot?: string | null;
          commander_snapshot?: string | null;
          verified?: boolean;
          joined_at?: string;
          placement?: number | null;
        };
        Relationships: [];
      };
    };
    Views: {
      group_player_winrates: {
        Row: {
          group_id: string | null;
          user_id: string | null;
          games: number | null;
          wins: number | null;
          win_rate: number | null;
        };
        Relationships: [];
      };
      group_deck_play_counts: {
        Row: {
          group_id: string | null;
          deck_id: string | null;
          deck_name_snapshot: string | null;
          commander_snapshot: string | null;
          times_played: number | null;
        };
        Relationships: [];
      };
      group_deck_winrates: {
        Row: {
          group_id: string | null;
          deck_id: string | null;
          deck_name_snapshot: string | null;
          commander_snapshot: string | null;
          games: number | null;
          wins: number | null;
          win_rate: number | null;
        };
        Relationships: [];
      };
      group_head_to_head: {
        Row: {
          group_id: string | null;
          player_id: string | null;
          opponent_id: string | null;
          games_together: number | null;
          player_wins: number | null;
          opponent_wins: number | null;
        };
        Relationships: [];
      };
    };
    Functions: {
      create_group: { Args: { p_name: string }; Returns: string };
      create_invite: { Args: { p_group_id: string }; Returns: string };
      accept_invite: { Args: { p_code: string }; Returns: string };
      is_group_member: { Args: { g: string }; Returns: boolean };
      finalize_match: {
        Args: { p_match_id: string; p_winner: string; p_placements?: Json };
        Returns: undefined;
      };
    };
    Enums: { group_role: GroupRole; deck_source: DeckSource; match_status: MatchStatus };
    CompositeTypes: {
      [_ in never]: never;
    };
  };
};

export type GroupRole = "admin" | "member";
export type DeckSource = "archidekt" | "manual";
export type MatchStatus = "open" | "finalized" | "cancelled";
