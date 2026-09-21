import { format, parseISO } from "date-fns";
import { ShieldCheck } from "lucide-react";
import { useAdminAuditLog } from "@/lib/queries/admin-monitoring.ts";
import PageHeader from "@/components/page-header.tsx";
import Chip, { type ChipTone } from "@/components/chip.tsx";
import InitialsAvatar from "@/components/initials-avatar.tsx";
import { Skeleton } from "@/components/ui/skeleton.tsx";
import MonitoringUnavailable from "../_components/monitoring-unavailable.tsx";

function kindOf(action: string): { label: string; tone: ChipTone } {
  if (action.startsWith("set_") || action.includes("override"))
    return { label: "Write", tone: "warn" };
  if (action.includes("view_as") || action.includes("session"))
    return { label: "Session", tone: "accent" };
  if (action.includes("login")) return { label: "Auth", tone: "neutral" };
  return { label: "Read", tone: "neutral" };
}

export default function AdminAuditPage() {
  const { data, isLoading, isError, retry } = useAdminAuditLog(100);

  return (
    <div className="mx-auto max-w-6xl p-4 md:p-8">
      <PageHeader
        eyebrow="Who looked at what"
        title="Audit log"
        description="Every platform admin read, write and session. Entries cannot be edited."
      >
        <Chip tone="accent" className="font-mono">
          Append-only
        </Chip>
      </PageHeader>

      <div className="overflow-hidden rounded-2xl border bg-card shadow-sm">
        {isLoading ? (
          <div className="space-y-px">
            {Array.from({ length: 6 }).map((_, i) => (
              <Skeleton key={i} className="h-16 w-full rounded-none" />
            ))}
          </div>
        ) : isError ? (
          <div className="p-5">
            <MonitoringUnavailable onRetry={retry} />
          </div>
        ) : !data || data.length === 0 ? (
          <p className="p-10 text-center text-sm text-muted-foreground">
            Nothing recorded yet.
          </p>
        ) : (
          <ul className="divide-y">
            {data.map((row) => {
              const kind = kindOf(row.action);
              return (
                <li
                  key={row.id}
                  className="flex flex-wrap items-start gap-x-4 gap-y-2 px-4 py-4 md:px-5"
                >
                  <span className="w-28 shrink-0 pt-1 font-mono text-xs text-muted-foreground">
                    {format(parseISO(row.createdAt), "dd MMM HH:mm")}
                  </span>
                  <span className="flex min-w-44 items-center gap-2.5 pt-0.5">
                    <InitialsAvatar
                      name={row.adminEmail ?? "admin"}
                      size="sm"
                    />
                    <span className="truncate text-sm">
                      {row.adminEmail ?? "Unknown admin"}
                    </span>
                  </span>
                  <span className="min-w-0 flex-1 basis-64">
                    <span className="flex flex-wrap items-center gap-2">
                      <Chip tone={kind.tone} className="font-mono">
                        {kind.label}
                      </Chip>
                      <span className="font-mono text-xs">{row.action}</span>
                    </span>
                    {(row.detail || row.targetTenantName || row.reason) && (
                      <span className="mt-1.5 block text-[13px] text-muted-foreground">
                        {[row.targetTenantName, row.detail]
                          .filter(Boolean)
                          .join(" · ")}
                        {row.reason ? ` · reason: ${row.reason}` : ""}
                      </span>
                    )}
                  </span>
                  <span className="w-14 pt-1 text-right font-mono text-xs tabular-nums text-muted-foreground">
                    {row.rowCount || "—"}
                  </span>
                  <span className="hidden w-28 pt-1 font-mono text-xs text-muted-foreground sm:block">
                    {row.ip ?? ""}
                  </span>
                </li>
              );
            })}
          </ul>
        )}
        <p className="flex items-center gap-2.5 border-t px-4 py-3.5 text-[13px] text-muted-foreground md:px-5">
          <ShieldCheck className="size-4 shrink-0" />
          Viewing this page is itself recorded. Row counts show how many records
          each read returned.
        </p>
      </div>
    </div>
  );
}
