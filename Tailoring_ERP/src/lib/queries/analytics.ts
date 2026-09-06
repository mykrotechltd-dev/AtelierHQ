import { useQuery } from "@tanstack/react-query";
import { supabase } from "../supabase/client.ts";

interface DashboardStats {
  orderCounts: { received: number; in_progress: number; completed: number; delivered: number };
  totalOrders: number;
  revenueThisMonth: number;
  totalCollected: number;
  totalBilled: number;
  totalOutstanding: number;
  activeWorkers: number;
  tasksDone: number;
  tasksPending: number;
  tasksInProgress: number;
}

export function useDashboardStats(): DashboardStats | undefined {
  const query = useQuery({
    queryKey: ["dashboardStats"],
    queryFn: async () => {
      const { data, error } = await supabase.rpc("get_dashboard_stats");
      if (error) throw error;
      return data as DashboardStats;
    },
  });
  return query.isLoading ? undefined : query.data;
}

interface RevenueMonth {
  key: string;
  label: string;
  billed: number;
  collected: number;
}

export function useRevenueByMonth(): RevenueMonth[] | undefined {
  const query = useQuery({
    queryKey: ["revenueByMonth"],
    queryFn: async () => {
      const { data, error } = await supabase.rpc("get_revenue_by_month");
      if (error) throw error;
      return data as RevenueMonth[];
    },
  });
  return query.isLoading ? undefined : query.data;
}

interface TopCustomer {
  name: string;
  total: number;
  orderCount: number;
}

export function useTopCustomers(): TopCustomer[] | undefined {
  const query = useQuery({
    queryKey: ["topCustomers"],
    queryFn: async () => {
      const { data, error } = await supabase.rpc("get_top_customers");
      if (error) throw error;
      return data as TopCustomer[];
    },
  });
  return query.isLoading ? undefined : query.data;
}

interface WorkerPerformance {
  name: string;
  specialization: string | null;
  isActive: boolean;
  done: number;
  pending: number;
  inProgress: number;
  totalTasks: number;
  taskEarnings: number;
  payoutTotal: number;
}

export function useWorkerPerformance(): WorkerPerformance[] | undefined {
  const query = useQuery({
    queryKey: ["workerPerformance"],
    queryFn: async () => {
      const { data, error } = await supabase.rpc("get_worker_performance");
      if (error) throw error;
      return data as WorkerPerformance[];
    },
  });
  return query.isLoading ? undefined : query.data;
}
