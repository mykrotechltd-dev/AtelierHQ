/**
 * Placeholder types. Once the schema.sql migration has been applied to a
 * real Supabase project, regenerate this file with:
 *
 *   npx supabase gen types typescript --project-id <project-id> --schema public > src/lib/supabase/database.types.ts
 *
 * Until then this loose `Database` shape keeps the app compiling; it is
 * intentionally not `any` everywhere so autocomplete still works on the
 * tables that matter most while you iterate on the schema.
 */
export type Json = string | number | boolean | null | { [key: string]: Json | undefined } | Json[];

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type LooseTable = { Row: any; Insert: any; Update: any; Relationships: [] };

export type Database = {
  public: {
    Tables: Record<string, LooseTable>;
    Views: Record<string, { Row: any; Relationships: [] }>;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    Functions: Record<string, { Args: any; Returns: any }>;
    Enums: {
      order_status: "received" | "in_progress" | "completed" | "delivered" | "cancelled";
      task_type: "cutting" | "stitching" | "embroidery" | "hand_work" | "finishing" | "alteration";
      task_status: "pending" | "assigned" | "in_progress" | "done" | "blocked";
      user_role: "owner" | "admin" | "staff" | "worker";
      payment_method: "cash" | "card" | "bank_transfer" | "mobile_money" | "other";
    };
  };
};
