"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { setWorkerActive } from "@/app/(dashboard)/workers/actions";

export function WorkerActiveToggle({ workerId, isActive }: { workerId: string; isActive: boolean }) {
  const router = useRouter();
  const [pending, setPending] = useState(false);

  async function toggle() {
    setPending(true);
    const fd = new FormData();
    fd.set("worker_id", workerId);
    fd.set("is_active", String(!isActive));
    await setWorkerActive(fd);
    setPending(false);
    router.refresh();
  }

  return (
    <button
      onClick={toggle}
      disabled={pending}
      className={`rounded-full px-2.5 py-0.5 text-xs font-medium ${
        isActive ? "bg-emerald-100 text-emerald-800 hover:bg-emerald-200" : "bg-slate-100 text-slate-500 hover:bg-slate-200"
      }`}
    >
      {isActive ? "Active" : "Inactive"}
    </button>
  );
}
