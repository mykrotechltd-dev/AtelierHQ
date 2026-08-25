"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { updateTaskStatus } from "@/app/(dashboard)/tasks/actions";

const NEXT_STATUS: Record<string, string | null> = {
  pending: "assigned",
  assigned: "in_progress",
  in_progress: "done",
  done: null,
  blocked: "in_progress",
};

export function TaskStatusButtons({ taskId, status }: { taskId: string; status: string }) {
  const router = useRouter();
  const [pending, setPending] = useState(false);
  const next = NEXT_STATUS[status];

  async function advance() {
    if (!next) return;
    setPending(true);
    const fd = new FormData();
    fd.set("task_id", taskId);
    fd.set("status", next);
    await updateTaskStatus(fd);
    setPending(false);
    router.refresh();
  }

  if (!next) return null;

  return (
    <button
      onClick={advance}
      disabled={pending}
      className="mt-1 rounded border border-slate-300 bg-white px-1.5 py-0.5 text-[10px] font-medium capitalize text-slate-600 hover:bg-slate-100 disabled:opacity-60"
    >
      Mark {next.replace("_", " ")}
    </button>
  );
}
