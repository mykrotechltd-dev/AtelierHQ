import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "../supabase/client.ts";
import type { Task, TaskStatus, Worker, WorkerPayout } from "../supabase/types.ts";
import { usePaginatedQuery } from "./pagination.ts";

function mapWorker(row: Record<string, unknown>): Worker {
  return {
    id: row.id as string,
    tenantId: row.tenant_id as string,
    userId: (row.user_id as string) ?? null,
    name: row.name as string,
    phone: (row.phone as string) ?? null,
    specialization: (row.specialization as string) ?? null,
    isActive: row.is_active as boolean,
  };
}

function mapTask(row: Record<string, unknown>): Task {
  return {
    id: row.id as string,
    tenantId: row.tenant_id as string,
    orderId: row.order_id as string,
    orderItemId: (row.order_item_id as string) ?? null,
    workerId: row.worker_id as string,
    description: row.description as string,
    status: row.status as TaskStatus,
    dueDate: (row.due_date as string) ?? null,
    completedAt: (row.completed_at as string) ?? null,
    payout: row.payout === null || row.payout === undefined ? null : Number(row.payout),
  };
}

function mapPayout(row: Record<string, unknown>): WorkerPayout {
  return {
    id: row.id as string,
    tenantId: row.tenant_id as string,
    workerId: row.worker_id as string,
    amount: Number(row.amount),
    notes: (row.notes as string) ?? null,
    paidAt: row.paid_at as string,
  };
}

// ── Workers ──────────────────────────────────────────────────────────────────

export function useWorkers(): Worker[] | undefined {
  const query = useQuery({
    queryKey: ["workers"],
    queryFn: async () => {
      const { data, error } = await supabase.from("workers").select("*").order("created_at", { ascending: false });
      if (error) throw error;
      return (data ?? []).map(mapWorker);
    },
  });
  return query.isLoading ? undefined : query.data;
}

export function useWorker(id: string | undefined): Worker | null | undefined {
  const query = useQuery({
    queryKey: ["worker", id],
    queryFn: async () => {
      const { data, error } = await supabase.from("workers").select("*").eq("id", id!).single();
      if (error) throw error;
      return mapWorker(data);
    },
    enabled: !!id,
  });
  if (!id) return undefined;
  return query.isLoading ? undefined : (query.data ?? null);
}

export function useCreateWorker() {
  const qc = useQueryClient();
  const { mutateAsync } = useMutation({
    mutationFn: async (input: { name: string; phone?: string; specialization?: string }) => {
      const { error } = await supabase.from("workers").insert({
        name: input.name,
        phone: input.phone ?? null,
        specialization: input.specialization ?? null,
        is_active: true,
      });
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["workers"] }),
  });
  return mutateAsync;
}

export function useUpdateWorker() {
  const qc = useQueryClient();
  const { mutateAsync } = useMutation({
    mutationFn: async (input: { id: string; name?: string; phone?: string; specialization?: string; isActive?: boolean }) => {
      const { id, isActive, ...rest } = input;
      const { error } = await supabase
        .from("workers")
        .update({ ...rest, ...(isActive !== undefined ? { is_active: isActive } : {}) })
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: (_d, v) => {
      qc.invalidateQueries({ queryKey: ["workers"] });
      qc.invalidateQueries({ queryKey: ["worker", v.id] });
    },
  });
  return mutateAsync;
}

export function useDeleteWorker() {
  const qc = useQueryClient();
  const { mutateAsync } = useMutation({
    mutationFn: async (input: { id: string }) => {
      const { error } = await supabase.from("workers").delete().eq("id", input.id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["workers"] }),
  });
  return mutateAsync;
}

// ── Tasks ─────────────────────────────────────────────────────────────────────

export function useTasks(status: TaskStatus | undefined, workerId: string | undefined) {
  const query = useQuery({
    queryKey: ["tasks", status ?? "", workerId ?? ""],
    queryFn: async () => {
      let q = supabase.from("tasks").select("*, workers(name), orders(order_number)");
      if (status) q = q.eq("status", status);
      if (workerId) q = q.eq("worker_id", workerId);
      const { data, error } = await q.order("created_at", { ascending: false });
      if (error) throw error;
      return (data ?? []).map((row) => ({
        ...mapTask(row),
        workerName: (row.workers as unknown as { name: string } | null)?.name ?? "Unknown",
        orderNumber: (row.orders as unknown as { order_number: string } | null)?.order_number ?? "—",
      }));
    },
  });
  return query.isLoading ? undefined : (query.data ?? []);
}

export function useCreateTask() {
  const qc = useQueryClient();
  const { mutateAsync } = useMutation({
    mutationFn: async (input: {
      orderId: string;
      orderItemId?: string;
      workerId: string;
      description: string;
      dueDate?: string;
      payout?: number;
    }) => {
      const { error } = await supabase.from("tasks").insert({
        order_id: input.orderId,
        order_item_id: input.orderItemId ?? null,
        worker_id: input.workerId,
        description: input.description,
        status: "pending",
        due_date: input.dueDate ?? null,
        payout: input.payout ?? null,
      });
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["tasks"] }),
  });
  return mutateAsync;
}

export function useUpdateTask() {
  const qc = useQueryClient();
  const { mutateAsync } = useMutation({
    mutationFn: async (input: {
      id: string;
      description?: string;
      workerId?: string;
      dueDate?: string;
      payout?: number;
      status?: TaskStatus;
    }) => {
      const { id, workerId, ...rest } = input;
      const { error } = await supabase
        .from("tasks")
        .update({ ...rest, ...(workerId !== undefined ? { worker_id: workerId } : {}) })
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["tasks"] });
      qc.invalidateQueries({ queryKey: ["workerPerformance"] });
    },
  });
  return mutateAsync;
}

export function useDeleteTask() {
  const qc = useQueryClient();
  const { mutateAsync } = useMutation({
    mutationFn: async (input: { id: string }) => {
      const { error } = await supabase.from("tasks").delete().eq("id", input.id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["tasks"] }),
  });
  return mutateAsync;
}

// ── Payouts ───────────────────────────────────────────────────────────────────

export function usePayouts(workerId: string | undefined, pageSize = 20) {
  return usePaginatedQuery<WorkerPayout & { workerName: string }>(
    ["payouts", workerId ?? ""],
    async (offset, limit) => {
      let q = supabase.from("worker_payouts").select("*, workers(name)");
      if (workerId) q = q.eq("worker_id", workerId);
      const { data, error } = await q.order("paid_at", { ascending: false }).range(offset, offset + limit - 1);
      if (error) throw error;
      return (data ?? []).map((row) => ({
        ...mapPayout(row),
        workerName: (row.workers as unknown as { name: string } | null)?.name ?? "Unknown",
      }));
    },
    pageSize
  );
}

export function useRecordPayout() {
  const qc = useQueryClient();
  const { mutateAsync } = useMutation({
    mutationFn: async (input: { workerId: string; amount: number; notes?: string }) => {
      const { error } = await supabase.from("worker_payouts").insert({
        worker_id: input.workerId,
        amount: input.amount,
        notes: input.notes ?? null,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["payouts"] });
      qc.invalidateQueries({ queryKey: ["workerPerformance"] });
    },
  });
  return mutateAsync;
}

export function useDeletePayout() {
  const qc = useQueryClient();
  const { mutateAsync } = useMutation({
    mutationFn: async (input: { id: string }) => {
      const { error } = await supabase.from("worker_payouts").delete().eq("id", input.id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["payouts"] }),
  });
  return mutateAsync;
}
