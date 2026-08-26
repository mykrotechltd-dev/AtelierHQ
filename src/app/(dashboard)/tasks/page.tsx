import Link from "next/link";
import { createServerSupabase } from "@/lib/supabase/server";
import { requireCurrentUser } from "@/lib/utils/tenant";
import { StatusBadge } from "@/components/ui/StatusBadge";
import { TaskStatusButtons } from "@/components/orders/TaskStatusButtons";

const COLUMNS = ["pending", "assigned", "in_progress", "done", "blocked"] as const;

export default async function TasksPage() {
  await requireCurrentUser(); // enforces auth; RLS scopes the query itself (staff see all tasks, workers see only their own)
  const supabase = createServerSupabase();

  // Workers see only their own tasks (enforced by tasks_worker_select RLS);
  // staff+ see every task in the shop.
  const { data: tasks } = await supabase
    .from("tasks")
    .select("id, task_type, status, due_date, pay_amount, orders(order_number), workers(full_name)")
    .order("due_date", { ascending: true, nullsFirst: false });

  const byStatus = Object.fromEntries(COLUMNS.map((c) => [c, tasks?.filter((t) => t.status === c) ?? []]));

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-semibold font-serif text-slate-900">Tasks</h1>
        <p className="text-sm text-slate-500">Cutting, stitching, embroidery and hand work across all orders.</p>
      </div>

      <div className="grid gap-4 md:grid-cols-5">
        {COLUMNS.map((col) => (
          <div key={col} className="rounded-xl border border-slate-200 bg-white p-3">
            <div className="mb-2 flex items-center justify-between">
              <StatusBadge status={col} />
              <span className="text-xs text-slate-400">{(byStatus[col] ?? []).length}</span>
            </div>
            <div className="space-y-2">
              {(byStatus[col] ?? []).map((t) => (
                <div key={t.id} className="rounded-lg border border-slate-100 bg-slate-50 p-2 text-xs">
                  <p className="font-medium capitalize text-slate-800">{t.task_type.replace("_", " ")}</p>
                  <p className="text-slate-500">{t.orders?.[0]?.order_number}</p>
                  <p className="text-slate-500">{t.workers?.[0]?.full_name ?? "Unassigned"}</p>
                  {t.due_date && <p className="text-slate-400">due {t.due_date}</p>}
                  <TaskStatusButtons taskId={t.id} status={t.status} />
                </div>
              ))}
              {(byStatus[col] ?? []).length === 0 && <p className="text-xs text-slate-300">Empty</p>}
            </div>
          </div>
        ))}
      </div>

      <p className="text-xs text-slate-400">
        Assign new tasks from an order's detail page. <Link href="/orders" className="text-brand-600 hover:underline">Go to orders →</Link>
      </p>
    </div>
  );
}
