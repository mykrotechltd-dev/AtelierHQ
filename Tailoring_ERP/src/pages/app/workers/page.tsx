import { useState } from "react";
import { useWorkers, useDeleteWorker, useUpdateWorker } from "@/lib/queries/workers.ts";
import type { Worker } from "@/lib/supabase/types.ts";
import { toast } from "sonner";
import PageHeader from "@/components/page-header.tsx";
import { Button } from "@/components/ui/button.tsx";
import { Skeleton } from "@/components/ui/skeleton.tsx";
import { Card, CardContent } from "@/components/ui/card.tsx";
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
import { Phone, Pencil, Trash2, UserCheck, CheckCircle2, Circle, Banknote } from "lucide-react";
import { cn } from "@/lib/utils.ts";
import WorkerDialog from "./_components/worker-dialog.tsx";
import PayoutDialog from "./_components/payout-dialog.tsx";

export default function WorkersPage() {
  const workers = useWorkers();
  const deleteWorker = useDeleteWorker();
  const toggleActive = useUpdateWorker();

  const [addOpen, setAddOpen] = useState(false);
  const [editWorker, setEditWorker] = useState<Worker | undefined>(undefined);
  const [payoutWorkerId, setPayoutWorkerId] = useState<string | undefined>(undefined);

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
      toast.success(worker.isActive ? "Worker deactivated" : "Worker activated");
    } catch {
      toast.error("Failed to update worker");
    }
  };

  const active = (workers ?? []).filter((w) => w.isActive);
  const inactive = (workers ?? []).filter((w) => !w.isActive);

  return (
    <div className="p-6 max-w-4xl mx-auto">
      <PageHeader title="Workers" description="Manage your tailoring team.">
        <Button size="sm" onClick={() => setAddOpen(true)}>
          Add worker
        </Button>
      </PageHeader>

      {workers === undefined ? (
        <div className="space-y-3">
          {Array.from({ length: 3 }).map((_, i) => (
            <Skeleton key={i} className="h-20 w-full" />
          ))}
        </div>
      ) : workers.length === 0 ? (
        <Empty>
          <EmptyHeader>
            <EmptyMedia variant="icon">
              <UserCheck />
            </EmptyMedia>
            <EmptyTitle>No workers yet</EmptyTitle>
            <EmptyDescription>Add your first team member to assign tasks</EmptyDescription>
          </EmptyHeader>
          <EmptyContent>
            <Button size="sm" onClick={() => setAddOpen(true)}>
              Add worker
            </Button>
          </EmptyContent>
        </Empty>
      ) : (
        <div className="space-y-6">
          {/* Active workers */}
          {active.length > 0 && (
            <section>
              <p className="text-xs font-body font-medium text-muted-foreground uppercase tracking-widest mb-3">
                Active ({active.length})
              </p>
              <div className="grid sm:grid-cols-2 gap-3">
                {active.map((worker) => (
                  <WorkerCard
                    key={worker.id}
                    worker={worker}
                    onEdit={() => setEditWorker(worker)}
                    onDelete={() => handleDelete(worker.id)}
                    onToggleActive={() => handleToggleActive(worker)}
                    onPayout={() => setPayoutWorkerId(worker.id)}
                  />
                ))}
              </div>
            </section>
          )}

          {/* Inactive workers */}
          {inactive.length > 0 && (
            <section>
              <p className="text-xs font-body font-medium text-muted-foreground uppercase tracking-widest mb-3">
                Inactive ({inactive.length})
              </p>
              <div className="grid sm:grid-cols-2 gap-3">
                {inactive.map((worker) => (
                  <WorkerCard
                    key={worker.id}
                    worker={worker}
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

function WorkerCard({
  worker,
  onEdit,
  onDelete,
  onToggleActive,
  onPayout,
}: {
  worker: Worker;
  onEdit: () => void;
  onDelete: () => void;
  onToggleActive: () => void;
  onPayout: () => void;
}) {
  return (
    <Card className={cn(!worker.isActive && "opacity-60")}>
      <CardContent className="pt-4 pb-4">
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2">
              <p className="font-sans font-semibold text-base truncate">{worker.name}</p>
              {worker.isActive ? (
                <CheckCircle2 className="size-3.5 text-emerald-500 shrink-0" />
              ) : (
                <Circle className="size-3.5 text-muted-foreground shrink-0" />
              )}
            </div>
            {worker.specialization && (
              <p className="text-xs text-muted-foreground font-body mt-0.5">
                {worker.specialization}
              </p>
            )}
            {worker.phone && (
              <p className="flex items-center gap-1 text-xs text-muted-foreground font-body mt-1">
                <Phone className="size-3" /> {worker.phone}
              </p>
            )}
          </div>

          <div className="flex items-center gap-1 shrink-0">
            <Button
              size="sm"
              variant="secondary"
              className="h-7 px-2 text-xs"
              onClick={onPayout}
            >
              <Banknote className="size-3.5 mr-1" /> Pay
            </Button>
            <button
              onClick={onEdit}
              className="p-1 text-muted-foreground hover:text-foreground cursor-pointer"
            >
              <Pencil className="size-3.5" />
            </button>
            <button
              onClick={onToggleActive}
              className="p-1 text-muted-foreground hover:text-foreground cursor-pointer"
              title={worker.isActive ? "Deactivate" : "Activate"}
            >
              {worker.isActive ? (
                <Circle className="size-3.5" />
              ) : (
                <CheckCircle2 className="size-3.5" />
              )}
            </button>
            <AlertDialog>
              <AlertDialogTrigger asChild>
                <button className="p-1 text-destructive hover:text-destructive/80 cursor-pointer">
                  <Trash2 className="size-3.5" />
                </button>
              </AlertDialogTrigger>
              <AlertDialogContent>
                <AlertDialogHeader>
                  <AlertDialogTitle>Remove {worker.name}?</AlertDialogTitle>
                  <AlertDialogDescription>
                    This will permanently remove this worker. This cannot be undone.
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
      </CardContent>
    </Card>
  );
}
