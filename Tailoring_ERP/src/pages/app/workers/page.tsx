import { useState } from "react";
import {
  useWorkers,
  useDeleteWorker,
  useUpdateWorker,
} from "@/lib/queries/workers.ts";
import { useWorkerPerformance } from "@/lib/queries/analytics.ts";
import { useMyTenant } from "@/lib/queries/tenants.ts";
import { formatCurrency } from "@/lib/format-currency.ts";
import type { Worker } from "@/lib/supabase/types.ts";
import { toast } from "sonner";
import PageHeader from "@/components/page-header.tsx";
import KpiCard from "@/components/kpi-card.tsx";
import Chip from "@/components/chip.tsx";
import Meter from "@/components/meter.tsx";
import InitialsAvatar from "@/components/initials-avatar.tsx";
import { Button } from "@/components/ui/button.tsx";
import { Skeleton } from "@/components/ui/skeleton.tsx";
import { Card } from "@/components/ui/card.tsx";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog.tsx";
import {
  Empty,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
  EmptyDescription,
  EmptyContent,
} from "@/components/ui/empty.tsx";
import {
  Phone,
  Pencil,
  Plus,
  Power,
  Trash2,
  UserCheck,
  Banknote,
} from "lucide-react";
import { cn } from "@/lib/utils.ts";
import WorkerDialog from "./_components/worker-dialog.tsx";
import PayoutDialog from "./_components/payout-dialog.tsx";

type Perf = NonNullable<ReturnType<typeof useWorkerPerformance>>[number];

export default function WorkersPage() {
  const workers = useWorkers();
  const performance = useWorkerPerformance();
  const tenant = useMyTenant();
  const currency = tenant?.currency ?? "USD";
  const deleteWorker = useDeleteWorker();
  const toggleActive = useUpdateWorker();

  const [addOpen, setAddOpen] = useState(false);
  const [editWorker, setEditWorker] = useState<Worker | undefined>(undefined);
  const [payoutWorkerId, setPayoutWorkerId] = useState<string | undefined>(
    undefined,
  );

  const handleDelete = async (id: string) => {
    try {
      await deleteWorker({ id });
      toast.success("Worker removed");
    } catch {
      toast.error("Failed to remove worker");
    }
  };

  const handleToggleActive = async (worker: Worker) => {
    try {
      await toggleActive({ id: worker.id, isActive: !worker.isActive });
      toast.success(
        worker.isActive ? "Worker deactivated" : "Worker activated",
      );
    } catch {
      toast.error("Failed to update worker");
    }
  };

  const perfFor = (name: string): Perf | undefined =>
    performance?.find((p) => p.name === name);
  const dueFor = (p: Perf | undefined) =>
    p ? Math.max(0, p.taskEarnings - p.payoutTotal) : 0;

  const active = (workers ?? []).filter((w) => w.isActive);
  const inactive = (workers ?? []).filter((w) => !w.isActive);
  const totalDue = active.reduce((a, w) => a + dueFor(perfFor(w.name)), 0);
  const openTasks = (performance ?? [])
    .filter((p) => p.isActive)
    .reduce((a, p) => a + p.pending + p.inProgress, 0);
  const peopleDue = active.filter((w) => dueFor(perfFor(w.name)) > 0).length;
  const busiest = Math.max(
    1,
    ...(performance ?? []).map((p) => p.pending + p.inProgress),
  );

  return (
    <div className="mx-auto max-w-5xl p-4 md:p-8">
      <PageHeader
        eyebrow="Atelier team"
        title="Workers"
        description="Your tailoring team, their workload and what you owe them."
      >
        <Button onClick={() => setAddOpen(true)}>
          <Plus /> Add worker
        </Button>
      </PageHeader>

      {workers === undefined ? (
        <div className="space-y-3">
          {Array.from({ length: 3 }).map((_, i) => (
            <Skeleton key={i} className="h-28 w-full" />
          ))}
        </div>
      ) : workers.length === 0 ? (
        <Empty>
          <EmptyHeader>
            <EmptyMedia variant="icon">
              <UserCheck />
            </EmptyMedia>
            <EmptyTitle>No workers yet</EmptyTitle>
            <EmptyDescription>
              Add your first team member so you can assign tasks and track
              payouts.
            </EmptyDescription>
          </EmptyHeader>
          <EmptyContent>
            <Button onClick={() => setAddOpen(true)}>
              <Plus /> Add worker
            </Button>
          </EmptyContent>
        </Empty>
      ) : (
        <div className="space-y-7">
          <div className="grid gap-3 sm:grid-cols-3 md:gap-4">
            <KpiCard
              raised
              label="Payouts due"
              value={formatCurrency(totalDue, currency)}
              chip={
                peopleDue === 0
                  ? "All paid up"
                  : `${peopleDue} ${peopleDue === 1 ? "person" : "people"}`
              }
              tone={peopleDue === 0 ? "good" : "warn"}
            />
            <KpiCard
              label="Open tasks"
              value={String(openTasks)}
              chip={`across ${active.length} active`}
              tone="accent"
            />
            <KpiCard
              label="Team size"
              value={String(workers.length)}
              chip={`${inactive.length} inactive`}
            />
          </div>

          {active.length > 0 && (
            <section aria-label="Active workers">
              <h2 className="mb-3 text-[11.5px] font-semibold uppercase tracking-[0.14em] text-muted-foreground">
                Active ({active.length})
              </h2>
              <div className="grid gap-4 sm:grid-cols-2">
                {active.map((worker) => (
                  <WorkerCard
                    key={worker.id}
                    worker={worker}
                    perf={perfFor(worker.name)}
                    due={dueFor(perfFor(worker.name))}
                    busiest={busiest}
                    currency={currency}
                    onEdit={() => setEditWorker(worker)}
                    onDelete={() => handleDelete(worker.id)}
                    onToggleActive={() => handleToggleActive(worker)}
                    onPayout={() => setPayoutWorkerId(worker.id)}
                  />
                ))}
              </div>
            </section>
          )}

          {inactive.length > 0 && (
            <section aria-label="Inactive workers">
              <h2 className="mb-3 text-[11.5px] font-semibold uppercase tracking-[0.14em] text-muted-foreground">
                Inactive ({inactive.length})
              </h2>
              <div className="grid gap-4 sm:grid-cols-2">
                {inactive.map((worker) => (
                  <WorkerCard
                    key={worker.id}
                    worker={worker}
                    perf={perfFor(worker.name)}
                    due={dueFor(perfFor(worker.name))}
                    busiest={busiest}
                    currency={currency}
                    onEdit={() => setEditWorker(worker)}
                    onDelete={() => handleDelete(worker.id)}
                    onToggleActive={() => handleToggleActive(worker)}
                    onPayout={() => setPayoutWorkerId(worker.id)}
                  />
                ))}
              </div>
            </section>
          )}
        </div>
      )}

      <WorkerDialog open={addOpen} onClose={() => setAddOpen(false)} />
      <WorkerDialog
        open={editWorker !== undefined}
        onClose={() => setEditWorker(undefined)}
        worker={editWorker}
      />
      <PayoutDialog
        open={payoutWorkerId !== undefined}
        onClose={() => setPayoutWorkerId(undefined)}
        preselectedWorkerId={payoutWorkerId}
      />
    </div>
  );
}

function IconButton({
  label,
  onClick,
  children,
  className,
}: {
  label: string;
  onClick?: () => void;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <button
      type="button"
      aria-label={label}
      title={label}
      onClick={onClick}
      className={cn(
        "grid size-9 cursor-pointer place-items-center rounded-lg text-muted-foreground transition-colors hover:bg-muted hover:text-foreground",
        className,
      )}
    >
      {children}
    </button>
  );
}

function WorkerCard({
  worker,
  perf,
  due,
  busiest,
  currency,
  onEdit,
  onDelete,
  onToggleActive,
  onPayout,
}: {
  worker: Worker;
  perf: Perf | undefined;
  due: number;
  busiest: number;
  currency: string;
  onEdit: () => void;
  onDelete: () => void;
  onToggleActive: () => void;
  onPayout: () => void;
}) {
  const open = perf ? perf.pending + perf.inProgress : 0;
  return (
    <Card className={cn("gap-4 p-5", !worker.isActive && "opacity-65")}>
      <div className="flex items-start gap-3.5">
        <InitialsAvatar name={worker.name} size="lg" />
        <div className="min-w-0 flex-1">
          <b className="block truncate font-semibold">{worker.name}</b>
          <p className="text-[13px] text-muted-foreground">
            {worker.specialization ?? "Team member"}
          </p>
          {worker.phone && (
            <p className="mt-0.5 flex items-center gap-1.5 text-[13px] text-muted-foreground">
              <Phone className="size-3.5" /> {worker.phone}
            </p>
          )}
        </div>
        <div className="-mr-1.5 -mt-1 flex items-center">
          <IconButton label={`Edit ${worker.name}`} onClick={onEdit}>
            <Pencil className="size-4" />
          </IconButton>
          <IconButton
            label={worker.isActive ? "Deactivate" : "Activate"}
            onClick={onToggleActive}
          >
            <Power className="size-4" />
          </IconButton>
          <AlertDialog>
            <AlertDialogTrigger asChild>
              <IconButton
                label={`Remove ${worker.name}`}
                className="text-destructive hover:text-destructive"
              >
                <Trash2 className="size-4" />
              </IconButton>
            </AlertDialogTrigger>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>Remove {worker.name}?</AlertDialogTitle>
                <AlertDialogDescription>
                  This will permanently remove this worker. This cannot be
                  undone.
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel>Cancel</AlertDialogCancel>
                <AlertDialogAction
                  onClick={onDelete}
                  className="bg-destructive text-white hover:bg-destructive/90"
                >
                  Remove
                </AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        </div>
      </div>

      <div>
        <div className="mb-2 flex justify-between text-[13px]">
          <span className="text-muted-foreground">Workload</span>
          <b className="tabular-nums">{open} open</b>
        </div>
        <Meter
          value={open}
          max={busiest}
          tone={open === busiest && open > 0 ? "warn" : "primary"}
          label={`${worker.name} has ${open} open tasks`}
        />
      </div>

      <div className="flex items-center justify-between gap-3">
        <Chip tone={due > 0 ? "warn" : "good"}>
          {due > 0 ? `Due ${formatCurrency(due, currency)}` : "Paid up"}
        </Chip>
        <Button variant="outline" size="sm" onClick={onPayout}>
          <Banknote /> Record payout
        </Button>
      </div>
    </Card>
  );
}
