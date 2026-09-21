import { useState } from "react";
import {
  useTasks,
  useUpdateTask,
  useDeleteTask,
  useWorkers,
} from "@/lib/queries/workers.ts";
import { toast } from "sonner";
import { differenceInCalendarDays, format, parseISO } from "date-fns";
import PageHeader from "@/components/page-header.tsx";
import Chip, { type ChipTone } from "@/components/chip.tsx";
import InitialsAvatar from "@/components/initials-avatar.tsx";
import { Button } from "@/components/ui/button.tsx";
import { Skeleton } from "@/components/ui/skeleton.tsx";
import {
  Empty,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
  EmptyDescription,
  EmptyContent,
} from "@/components/ui/empty.tsx";
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
import { Banknote, CheckSquare, Clock, Plus, Trash2 } from "lucide-react";
import { cn } from "@/lib/utils.ts";
import CreateTaskDialog from "./_components/create-task-dialog.tsx";
import PayoutDialog from "../workers/_components/payout-dialog.tsx";

type TaskStatus = "pending" | "in_progress" | "done";

const COLUMNS: { status: TaskStatus; label: string; next: string | null }[] = [
  { status: "pending", label: "Pending", next: "in progress" },
  { status: "in_progress", label: "In progress", next: "done" },
  { status: "done", label: "Done", next: null },
];

const STATUS_NEXT: Record<TaskStatus, TaskStatus | null> = {
  pending: "in_progress",
  in_progress: "done",
  done: null,
};

function dueChip(
  dueDate: string,
  status: TaskStatus,
): { tone: ChipTone; label: string } {
  if (status === "done")
    return { tone: "good", label: format(parseISO(dueDate), "dd MMM") };
  const days = differenceInCalendarDays(parseISO(dueDate), new Date());
  if (days < 0) return { tone: "crit", label: "Overdue" };
  if (days === 0) return { tone: "warn", label: "Today" };
  return { tone: "neutral", label: format(parseISO(dueDate), "dd MMM") };
}

export default function TasksPage() {
  const [taskDialogOpen, setTaskDialogOpen] = useState(false);
  const [payoutOpen, setPayoutOpen] = useState(false);
  const [filterWorkerId, setFilterWorkerId] = useState<string | undefined>(
    undefined,
  );

  const tasks = useTasks(undefined, filterWorkerId);
  const workers = useWorkers();
  const updateTask = useUpdateTask();
  const deleteTask = useDeleteTask();

  const handleAdvance = async (taskId: string, current: TaskStatus) => {
    const next = STATUS_NEXT[current];
    if (!next) return;
    try {
      await updateTask({ id: taskId, status: next });
      toast.success(`Task moved to ${next.replace("_", " ")}`);
    } catch {
      toast.error("Failed to update task");
    }
  };

  const handleDelete = async (taskId: string) => {
    try {
      await deleteTask({ id: taskId });
      toast.success("Task deleted");
    } catch {
      toast.error("Failed to delete task");
    }
  };

  const byStatus = (status: TaskStatus) =>
    (tasks ?? []).filter((t) => t.status === status);
  const open = (tasks ?? []).filter((t) => t.status !== "done");
  const overdue = open.filter(
    (t) =>
      t.dueDate &&
      differenceInCalendarDays(parseISO(t.dueDate), new Date()) < 0,
  ).length;

  return (
    <div className="mx-auto max-w-6xl p-4 md:p-8">
      <PageHeader
        eyebrow="Work board"
        title="Tasks"
        description={
          tasks === undefined
            ? "Worker assignments and task board."
            : `${open.length} open · ${overdue} overdue`
        }
      >
        <Button variant="outline" onClick={() => setPayoutOpen(true)}>
          <Banknote /> Record payout
        </Button>
        <Button onClick={() => setTaskDialogOpen(true)}>
          <Plus /> New task
        </Button>
      </PageHeader>

      {(workers ?? []).length > 0 && (
        <div
          role="group"
          aria-label="Filter by worker"
          className="mb-6 flex gap-2 overflow-x-auto pb-1"
        >
          {[
            { id: undefined, name: "All workers" },
            ...(workers ?? []).filter((w) => w.isActive),
          ].map((w) => {
            const active = filterWorkerId === w.id;
            return (
              <button
                key={w.id ?? "all"}
                type="button"
                aria-pressed={active}
                onClick={() => setFilterWorkerId(w.id)}
                className={cn(
                  "min-h-9 shrink-0 cursor-pointer rounded-full border px-3.5 text-[13px] font-semibold transition-colors",
                  active
                    ? "border-foreground bg-foreground text-background"
                    : "bg-card text-muted-foreground hover:border-muted-foreground/50 hover:text-foreground",
                )}
              >
                {w.name}
              </button>
            );
          })}
        </div>
      )}

      {tasks === undefined ? (
        <div className="grid gap-4 md:grid-cols-3">
          {Array.from({ length: 3 }).map((_, i) => (
            <Skeleton key={i} className="h-64 w-full" />
          ))}
        </div>
      ) : tasks.length === 0 && !filterWorkerId ? (
        <Empty>
          <EmptyHeader>
            <EmptyMedia variant="icon">
              <CheckSquare />
            </EmptyMedia>
            <EmptyTitle>No tasks yet</EmptyTitle>
            <EmptyDescription>
              Create a task and assign it to a worker to start the board.
            </EmptyDescription>
          </EmptyHeader>
          <EmptyContent>
            <Button onClick={() => setTaskDialogOpen(true)}>
              <Plus /> New task
            </Button>
          </EmptyContent>
        </Empty>
      ) : (
        <div className="grid items-start gap-4 md:grid-cols-3">
          {COLUMNS.map(({ status, label, next }) => {
            const col = byStatus(status);
            return (
              <section
                key={status}
                aria-label={label}
                className="space-y-2.5 rounded-2xl border bg-muted/60 p-3.5"
              >
                <div className="flex items-center justify-between px-1 pb-1">
                  <h2 className="font-sans text-sm font-semibold">{label}</h2>
                  <Chip>{col.length}</Chip>
                </div>

                {col.length === 0 ? (
                  <p className="py-6 text-center text-[13px] text-muted-foreground">
                    Nothing here
                  </p>
                ) : (
                  col.map((task) => {
                    const chip = task.dueDate
                      ? dueChip(task.dueDate, status)
                      : null;
                    return (
                      <article
                        key={task.id}
                        className="grid gap-2.5 rounded-xl border bg-card p-3.5 shadow-sm"
                      >
                        <b className="font-semibold leading-snug">
                          {task.description}
                        </b>
                        <div className="flex flex-wrap items-center gap-2">
                          <Chip>{task.orderNumber}</Chip>
                          {task.payout != null && (
                            <Chip tone="accent">
                              <Banknote />
                              {task.payout.toLocaleString(undefined, {
                                minimumFractionDigits: 2,
                              })}
                            </Chip>
                          )}
                        </div>
                        <div className="flex items-center justify-between gap-2">
                          <span className="flex min-w-0 items-center gap-2 text-[13px] text-foreground/80">
                            <InitialsAvatar name={task.workerName} size="sm" />
                            <span className="truncate">{task.workerName}</span>
                          </span>
                          {chip && (
                            <Chip tone={chip.tone}>
                              <Clock /> {chip.label}
                            </Chip>
                          )}
                        </div>
                        <div className="flex items-center justify-between pt-0.5">
                          {next ? (
                            <button
                              type="button"
                              onClick={() => handleAdvance(task.id, status)}
                              className="min-h-9 cursor-pointer text-[13px] font-semibold text-primary hover:underline"
                            >
                              Move to {next} →
                            </button>
                          ) : (
                            <span className="text-[13px] font-semibold text-success">
                              Complete
                            </span>
                          )}
                          <AlertDialog>
                            <AlertDialogTrigger asChild>
                              <button
                                type="button"
                                aria-label={`Delete task ${task.description}`}
                                className="grid size-9 cursor-pointer place-items-center rounded-lg text-destructive transition-colors hover:bg-destructive-soft"
                              >
                                <Trash2 className="size-4" />
                              </button>
                            </AlertDialogTrigger>
                            <AlertDialogContent>
                              <AlertDialogHeader>
                                <AlertDialogTitle>
                                  Delete task?
                                </AlertDialogTitle>
                                <AlertDialogDescription>
                                  This will permanently delete this task.
                                </AlertDialogDescription>
                              </AlertDialogHeader>
                              <AlertDialogFooter>
                                <AlertDialogCancel>Cancel</AlertDialogCancel>
                                <AlertDialogAction
                                  onClick={() => handleDelete(task.id)}
                                  className="bg-destructive text-white hover:bg-destructive/90"
                                >
                                  Delete
                                </AlertDialogAction>
                              </AlertDialogFooter>
                            </AlertDialogContent>
                          </AlertDialog>
                        </div>
                      </article>
                    );
                  })
                )}
              </section>
            );
          })}
        </div>
      )}

      <CreateTaskDialog
        open={taskDialogOpen}
        onClose={() => setTaskDialogOpen(false)}
      />
      <PayoutDialog open={payoutOpen} onClose={() => setPayoutOpen(false)} />
    </div>
  );
}
