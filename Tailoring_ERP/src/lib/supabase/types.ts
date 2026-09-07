// Hand-written types for the AtelierHQ schema (supabase/schema.sql).
// `Database` mirrors the Postgres shape (snake_case) for supabase-js typing;
// the app-facing types below (camelCase) are what components consume —
// src/lib/queries/* maps between the two.

export type OrderStatus = "received" | "in_progress" | "completed" | "delivered";
export type TaskStatus = "pending" | "in_progress" | "done";
export type PaymentMethod = "cash" | "bank_transfer" | "card" | "other" | "stripe";
export type UserRole = "owner" | "worker";
export type StripeOnboardingStatus = "not_started" | "pending" | "active" | "restricted";

export interface Measurements {
  chest?: number;
  waist?: number;
  hips?: number;
  shoulder?: number;
  sleeveLength?: number;
  inseam?: number;
  neck?: number;
  thigh?: number;
  height?: number;
  weight?: number;
  notes?: string;
}

export interface Database {
  public: {
    Tables: {
      tenants: {
        Row: {
          id: string;
          name: string;
          phone: string | null;
          address: string | null;
          currency: string;
          owner_id: string | null;
          stripe_connect_account_id: string | null;
          stripe_onboarding_status: StripeOnboardingStatus;
          stripe_country: string | null;
          stripe_default_currency: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: Partial<Database["public"]["Tables"]["tenants"]["Row"]> & { name: string };
        Update: Partial<Database["public"]["Tables"]["tenants"]["Row"]>;
      };
      profiles: {
        Row: {
          id: string;
          tenant_id: string;
          full_name: string | null;
          email: string | null;
          role: UserRole;
          created_at: string;
        };
        Insert: Partial<Database["public"]["Tables"]["profiles"]["Row"]> & { id: string; tenant_id: string };
        Update: Partial<Database["public"]["Tables"]["profiles"]["Row"]>;
      };
      customers: {
        Row: {
          id: string;
          tenant_id: string;
          name: string;
          phone: string | null;
          email: string | null;
          notes: string | null;
          measurements: Measurements | null;
          created_at: string;
          updated_at: string;
        };
        Insert: Partial<Database["public"]["Tables"]["customers"]["Row"]> & { tenant_id: string; name: string };
        Update: Partial<Database["public"]["Tables"]["customers"]["Row"]>;
      };
      workers: {
        Row: {
          id: string;
          tenant_id: string;
          user_id: string | null;
          name: string;
          phone: string | null;
          specialization: string | null;
          is_active: boolean;
          created_at: string;
        };
        Insert: Partial<Database["public"]["Tables"]["workers"]["Row"]> & { tenant_id: string; name: string };
        Update: Partial<Database["public"]["Tables"]["workers"]["Row"]>;
      };
      orders: {
        Row: {
          id: string;
          tenant_id: string;
          customer_id: string;
          order_number: string;
          status: OrderStatus;
          due_date: string | null;
          total_amount: number;
          notes: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: Partial<Database["public"]["Tables"]["orders"]["Row"]> & { tenant_id: string; customer_id: string };
        Update: Partial<Database["public"]["Tables"]["orders"]["Row"]>;
      };
      order_items: {
        Row: {
          id: string;
          order_id: string;
          tenant_id: string;
          description: string;
          garment_type: string | null;
          fabric: string | null;
          quantity: number;
          unit_price: number;
          notes: string | null;
          measurements: Measurements | null;
          created_at: string;
        };
        Insert: Partial<Database["public"]["Tables"]["order_items"]["Row"]> & {
          order_id: string;
          tenant_id: string;
          description: string;
        };
        Update: Partial<Database["public"]["Tables"]["order_items"]["Row"]>;
      };
      order_materials: {
        Row: {
          id: string;
          tenant_id: string;
          order_item_id: string;
          name: string;
          quantity: number;
          unit_price: number;
          line_total: number;
          created_at: string;
        };
        Insert: Partial<Database["public"]["Tables"]["order_materials"]["Row"]> & {
          tenant_id: string;
          order_item_id: string;
          name: string;
        };
        Update: Partial<Database["public"]["Tables"]["order_materials"]["Row"]>;
      };
      tasks: {
        Row: {
          id: string;
          tenant_id: string;
          order_id: string;
          order_item_id: string | null;
          worker_id: string;
          description: string;
          status: TaskStatus;
          due_date: string | null;
          completed_at: string | null;
          payout: number | null;
          created_at: string;
          updated_at: string;
        };
        Insert: Partial<Database["public"]["Tables"]["tasks"]["Row"]> & {
          tenant_id: string;
          order_id: string;
          worker_id: string;
          description: string;
        };
        Update: Partial<Database["public"]["Tables"]["tasks"]["Row"]>;
      };
      payments: {
        Row: {
          id: string;
          tenant_id: string;
          customer_id: string;
          order_id: string;
          amount: number;
          method: PaymentMethod;
          notes: string | null;
          paid_at: string;
          external_reference: string | null;
          charged_currency: string | null;
          charged_amount: number | null;
        };
        Insert: Partial<Database["public"]["Tables"]["payments"]["Row"]> & {
          tenant_id: string;
          customer_id: string;
          order_id: string;
          amount: number;
        };
        Update: Partial<Database["public"]["Tables"]["payments"]["Row"]>;
      };
      worker_payouts: {
        Row: {
          id: string;
          tenant_id: string;
          worker_id: string;
          order_id: string | null;
          amount: number;
          notes: string | null;
          paid_at: string;
        };
        Insert: Partial<Database["public"]["Tables"]["worker_payouts"]["Row"]> & {
          tenant_id: string;
          worker_id: string;
          amount: number;
        };
        Update: Partial<Database["public"]["Tables"]["worker_payouts"]["Row"]>;
      };
    };
  };
}

// ── App-facing (camelCase) types, what components actually consume ──────────

export interface Tenant {
  id: string;
  name: string;
  phone: string | null;
  address: string | null;
  currency: string;
  role?: UserRole;
  stripeConnectAccountId: string | null;
  stripeOnboardingStatus: StripeOnboardingStatus;
  stripeCountry: string | null;
  stripeDefaultCurrency: string | null;
}

export interface Customer {
  id: string;
  tenantId: string;
  name: string;
  phone: string | null;
  email: string | null;
  notes: string | null;
  measurements: Measurements | null;
}

export interface Worker {
  id: string;
  tenantId: string;
  userId: string | null;
  name: string;
  phone: string | null;
  specialization: string | null;
  isActive: boolean;
}

export interface Order {
  id: string;
  tenantId: string;
  customerId: string;
  orderNumber: string;
  status: OrderStatus;
  dueDate: string | null;
  totalAmount: number;
  notes: string | null;
}

export interface OrderItem {
  id: string;
  orderId: string;
  tenantId: string;
  description: string;
  garmentType: string | null;
  fabric: string | null;
  quantity: number;
  unitPrice: number;
  notes: string | null;
  /** Frozen snapshot of the customer's measurements at the time this garment
   *  was added — never re-synced from customers.measurements afterward. */
  measurements: Measurements | null;
}

export interface OrderMaterial {
  id: string;
  tenantId: string;
  orderItemId: string;
  name: string;
  quantity: number;
  unitPrice: number;
  lineTotal: number;
}

export interface Task {
  id: string;
  tenantId: string;
  orderId: string;
  orderItemId: string | null;
  workerId: string;
  description: string;
  status: TaskStatus;
  dueDate: string | null;
  completedAt: string | null;
  payout: number | null;
}

export interface Payment {
  id: string;
  tenantId: string;
  customerId: string;
  orderId: string;
  amount: number;
  method: PaymentMethod;
  notes: string | null;
  paidAt: string;
  externalReference: string | null;
  chargedCurrency: string | null;
  chargedAmount: number | null;
}

export interface WorkerPayout {
  id: string;
  tenantId: string;
  workerId: string;
  orderId: string | null;
  amount: number;
  notes: string | null;
  paidAt: string;
}
