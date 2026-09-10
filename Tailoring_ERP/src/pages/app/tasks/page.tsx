import { useState } from "react";
import {
  useTasks,
  useUpdateTask,
  useDeleteTask,
  useWorkers,
} from "@/lib/queries/workers.ts";
import { toast } from "sonner";
import { format, parseISO } from "date-fns";
import PageHeader from "@/components/page-header.tsx";
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
import {
  CheckSquare,
  CalendarDays,
  ArrowRight,
  Trash2,
  Banknote,
} from "lucide-react";
import { cn } from "@/lib/utils.ts";
import CreateTaskDialog from "./_components/create-task-dialog.tsx";
import PayoutDialog from "../workers/_components/payout-dialog.tsx";

type TaskStatus = "pending" | "in_progress" | "done";

const COLUMNS: {
  status: TaskStatus;
  label: string;
  color: string;
  dot: string;
}[] = [
  {
    status: "pending",
    label: "Pending",
    color: "border-t-blue-400",
    dot: "bg-blue-400",
  },
  {
    status: "in_progress",
    label: "In Progress",
    color: "border-t-amber-400",
    dot: "bg-amber-400",
  },
  {
    status: "done",
    label: "Done",
    color: "border-t-emerald-500",
    dot: "bg-emerald-500",
  },
];

const STATUS_NEXT: Record<TaskStatus, TaskStatus | null> = {
  pending: "in_progress",
  in_progress: "done",
  done: null,
};

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

  const getTasksByStatus = (status: TaskStatus) =>
    (tasks ?? []).filter((t) => t.status === status);

  return (
    <div className="p-6 max-w-6xl mx-auto">
      <PageHeader
        title="Tasks"
        description="Worker assignments and task board."
      >
        <Button
          size="sm"
          variant="secondary"
          onClick={() => setPayoutOpen(true)}
        >
          <Banknote className="size-3.5 mr-1" /> Record payout
        </Button>
        <Button size="sm" onClick={() => setTaskDialogOpen(true)}>
          New task
        </Button>
      </PageHeader>

      {/* Worker filter */}
      {(workers ?? []).length > 0 && (
        <div className="flex gap-1.5 flex-wrap mb-6">
          <button
            onClick={() => setFilterWorkerId(undefined)}
            className={cn(
              "px-3 py-1 rounded-full text-xs font-body border transition-colors cursor-pointer",
              filterWorkerId === undefined
                ? "bg-primary text-primary-foreground border-primary"
                : "border-border text-muted-foreground hover:border-primary/40",
            )}
          >
            All workers
          </button>
          {(workers ?? [])
            .filter((w) => w.isActive)
            .map((w) => (
              <button
                key={w.id}
                onClick={() => setFilterWorkerId(w.id)}
                className={cn(
                  "px-3 py-1 rounded-full text-xs font-body border transition-colors cursor-pointer",
                  filterWorkerId === w.id
                    ? "bg-primary text-primary-foreground border-primary"
                    : "border-border text-muted-foreground hover:border-primary/40",
                )}
              >
                {w.name}
              </button>
            ))}
        </div>
      )}

      {tasks === undefined ? (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
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
              Create a task and assign it to a worker
            </EmptyDescription>
          </EmptyHeader>
          <EmptyContent>
            <Button size="sm" onClick={() => setTaskDialogOpen(true)}>
              New task
            </Button>
          </EmptyContent>
        </Empty>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {COLUMNS.map(({ status, label, color, dot }) => {
            const col = getTasksByStatus(status);
            return (
              <div
                key={status}
                className={cn(
                  "rounded-lg border-t-2 border border-border bg-card",
                  color,
                )}
              >
                {/* Column header */}
                <div className="flex items-center justify-between px-3 py-2.5 border-b border-border">
                  <div className="flex items-center gap-2">
                    <span className={cn("size-2 rounded-full", dot)} />
                    <span className="font-body text-sm font-medium">
                      {label}
                    </span>
                  </div>
                  <span className="text-xs text-muted-foreground font-body bg-muted rounded-full px-2 py-0.5">
                    {col.length}
                  </span>
                </div>

                {/* Cards */}
                <div className="p-2 space-y-2 min-h-[120px]">
                  {col.length === 0 ? (
                    <p className="text-center text-xs text-muted-foreground font-body py-6">
                      No tasks
                    </p>
                  ) : (
                    col.map((task) => (
                      <div
                        key={task.id}
                        className="rounded-md border border-border bg-background px-3 py-2.5 space-y-1.5"
                      >
                        <p className="font-body text-xs font-medium text-foreground leading-snug">
                          {task.description}
                        </p>
                        <div className="flex flex-wrap gap-x-3 gap-y-1">
                          <span className="text-[11px] text-muted-foreground font-body">
                            {task.workerName}
                          </span>
                          <span className="text-[11px] text-muted-foreground font-body">
                            {task.orderNumber}
                          </span>
                        </div>
                        {task.dueDate && (
                          <div className="flex items-center gap-1 text-[11px] text-muted-foreground font-body">
                            <CalendarDays className="size-3" />
                            {format(parseISO(task.dueDate), "dd MMM")}
                          </div>
                        )}
                        {task.payout != null && (
                          <div className="flex items-center gap-1 text-[11px] text-accent font-body">
                            <Banknote className="size-3" />
                            {task.payout.toLocaleString(undefined, {
                              minimumFractionDigits: 2,
                            })}
                          </div>
                        )}
                        <div className="flex items-center justify-between pt-1">
                          {STATUS_NEXT[status as TaskStatus] ? (
                            <Button
                              size="sm"
                              variant="secondary"
                              className="h-6 px-2 text-[11px]"
                              onClick={() =>
                                handleAdvance(task.id, status as TaskStatus)
                              }
                            >
                              Move <ArrowRight className="size-3 ml-1" />
                            </Button>
                          ) : (
                            <span className="text-[11px] text-emerald-600 font-body font-medium">
                              ✓ Done
                            </span>
                          )}
                          <AlertDialog>
                            <AlertDialogTrigger asChild>
                              <button className="text-destructive hover:text-destructive/80 cursor-pointer">
                                <Trash2 className="size-3.5" />
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
                      </div>
                    ))
                  )}
                </div>
              </div>
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
