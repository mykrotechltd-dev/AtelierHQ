import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "../supabase/client.ts";
import type { Customer, Measurements } from "../supabase/types.ts";
import { usePaginatedQuery } from "./pagination.ts";

function mapCustomer(row: Record<string, unknown>): Customer {
  return {
    id: row.id as string,
    tenantId: row.tenant_id as string,
    name: row.name as string,
    phone: (row.phone as string) ?? null,
    email: (row.email as string) ?? null,
    notes: (row.notes as string) ?? null,
    whatsappOptIn: (row.whatsapp_opt_in as boolean) ?? false,
    measurements: (row.measurements as Measurements) ?? null,
  };
}

export function useCustomers(search: string | undefined, pageSize = 20) {
  return usePaginatedQuery<Customer>(
    ["customers", search ?? ""],
    async (offset, limit) => {
      let query = supabase.from("customers").select("*");
      if (search && search.trim()) {
        query = query.ilike("name", `%${search.trim()}%`);
      }
      const { data, error } = await query
        .order("created_at", { ascending: false })
        .range(offset, offset + limit - 1);
      if (error) throw error;
      return (data ?? []).map(mapCustomer);
    },
    pageSize,
  );
}

export function useCustomer(
  id: string | undefined,
): Customer | null | undefined {
  const query = useQuery({
    queryKey: ["customer", id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("customers")
        .select("*")
        .eq("id", id!)
        .single();
      if (error) throw error;
      return mapCustomer(data);
    },
    enabled: !!id,
  });
  if (!id) return undefined;
  return query.isLoading ? undefined : (query.data ?? null);
}

export function useCreateCustomer() {
  const qc = useQueryClient();
  const { mutateAsync } = useMutation({
    mutationFn: async (input: {
      name: string;
      phone?: string;
      email?: string;
      notes?: string;
      whatsappOptIn?: boolean;
      measurements?: Measurements;
    }) => {
      const { data, error } = await supabase
        .from("customers")
        .insert({
          name: input.name,
          phone: input.phone ?? null,
          email: input.email ?? null,
          notes: input.notes ?? null,
          whatsapp_opt_in: input.whatsappOptIn ?? false,
          measurements: input.measurements ?? null,
        })
        .select()
        .single();
      if (error) throw error;
      return mapCustomer(data);
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["customers"] }),
  });
  return mutateAsync;
}

export function useUpdateCustomer() {
  const qc = useQueryClient();
  const { mutateAsync } = useMutation({
    mutationFn: async (input: {
      id: string;
      name?: string;
      phone?: string;
      email?: string;
      notes?: string;
      whatsappOptIn?: boolean;
      measurements?: Measurements;
    }) => {
      // Spreading camelCase keys straight into .update() only ever worked
      // because every prior field's camelCase name matched its column name
      // (name, phone, email, notes — none have underscores). whatsapp_opt_in
      // doesn't, so it's mapped explicitly rather than joining the spread —
      // the same "conditional explicit mapping" pattern lib/queries/orders.ts
      // already uses for garment_type/unit_price.
      const { id, whatsappOptIn, ...rest } = input;
      const { error } = await supabase
        .from("customers")
        .update({
          ...rest,
          ...(whatsappOptIn !== undefined
            ? { whatsapp_opt_in: whatsappOptIn }
            : {}),
        })
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: (_data, variables) => {
      qc.invalidateQueries({ queryKey: ["customers"] });
      qc.invalidateQueries({ queryKey: ["customer", variables.id] });
    },
  });
  return mutateAsync;
}

export function useDeleteCustomer() {
  const qc = useQueryClient();
  const { mutateAsync } = useMutation({
    mutationFn: async (input: { id: string }) => {
      const { error } = await supabase
        .from("customers")
        .delete()
        .eq("id", input.id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["customers"] }),
  });
  return mutateAsync;
}
