import { useState } from "react";
import { format, formatDistanceToNowStrict, parseISO } from "date-fns";
import { ChevronDown, Search, ShieldCheck } from "lucide-react";
import { useDebounce } from "@/hooks/use-debounce.ts";
import { useAdminTenants } from "@/lib/queries/admin.ts";
import { useAdminActivity } from "@/lib/queries/admin-monitoring.ts";
import type { AdminActivityEvent } from "@/lib/supabase/admin-monitoring-types.ts";
import PageHeader from "@/components/page-header.tsx";
import Chip, { type ChipTone } from "@/components/chip.tsx";
import InitialsAvatar from "@/components/initials-avatar.tsx";
import { Button } from "@/components/ui/button.tsx";
import { Skeleton } from "@/components/ui/skeleton.tsx";
import MonitoringUnavailable from "../_components/monitoring-unavailable.tsx";
import { cn } from "@/lib/utils.ts";

const CATEGORIES = [
  { value: "", label: "All" },
  { value: "orders", label: "Orders" },
  { value: "payments", label: "Payments" },
  { value: "customers", label: "Customers" },
  { value: "team", label: "Team" },
];

const KIND: Record<string, string> = {
  order: "order",
  payment: "payment",
  payout: "worker payout",
  customer: "customer",
  worker: "worker",
  task: "task",
};

const VERB: Record<string, string> = {
  created: "Added",
  updated: "Updated",
  deleted: "Removed",
  status_changed: "Moved",
};

function describe(e: AdminActivityEvent): string {
  const [kind, verb] = e.action.split(".");
  const noun = KIND[kind] ?? kind;
  const meta = e.metadata as { amount?: number; from?: string; to?: string };
  if (verb === "status_changed") {
    const to = (meta.to ?? "").replace("_", " ");
    return `Moved ${noun} ${e.resource ?? ""} to ${to}`.replace("  ", " ");
  }
  if (kind === "payment" && verb === "created")
    return `Recorded a payment of ${Number(meta.amount ?? 0).toLocaleString()}`;
  if (kind === "payout" && verb === "created")
    return `Paid a worker ${Number(meta.amount ?? 0).toLocaleString()}`;
  if (kind === "order" && verb === "created")
    return `Created order ${e.resource ?? ""}`.trim();
  return `${VERB[verb] ?? verb} ${kind === "order" || kind === "task" ? "" : "a "}${noun}`.replace(
    "  ",
    " ",
  );
}

const ROLE_TONE: Record<string, ChipTone> = {
  owner: "accent",
  worker: "neutral",
  system: "warn",
  member: "neutral",
};

export default function AdminActivityPage() {
  const [category, setCategory] = useState("");
  const [tenantId, setTenantId] = useState("");
  const [search, setSearch] = useState("");
  const [debouncedSearch] = useDebounce(search, 350);
  const [live, setLive] = useState(true);
  const [open, setOpen] = useState<number | null>(null);

  const shops = useAdminTenants(undefined, 100);
  const { data, isLoading, isError, retry } = useAdminActivity(
    { category, tenantId, search: debouncedSearch },
    live && open === null,
  );

  return (
    <div className="mx-auto max-w-6xl p-4 md:p-8">
      <PageHeader
        eyebrow="All shops · all people"
        title="Activity"
        description={
          data
            ? `${data.length} recent events. Names and emails are visible to platform admins only.`
            : "What people are doing across every shop."
        }
      >
        <span
          className={cn(
            "inline-flex items-center gap-2 font-mono text-[11px] font-medium uppercase tracking-widest",
            live ? "text-success" : "text-muted-foreground",
          )}
        >
          <i
            className={cn(
              "size-2 rounded-full",
              live ? "animate-pulse bg-success" : "bg-muted-foreground",
            )}
          />
          {live ? "Live" : "Paused"}
        </span>
        <Button variant="outline" onClick={() => setLive((v) => !v)}>
          {live ? "Pause stream" : "Resume stream"}
        </Button>
      </PageHeader>

      <div className="overflow-hidden rounded-2xl border bg-card shadow-sm">
        <div className="flex flex-wrap items-center gap-3 border-b p-4 md:px-5">
          <label className="flex min-h-11 min-w-56 flex-1 items-center gap-2.5 rounded-xl border bg-background px-3.5 text-muted-foreground focus-within:border-primary sm:max-w-xs">
            <Search className="size-4 shrink-0" />
            <span className="sr-only">Search activity</span>
            <input
              type="search"
              placeholder="Search person, action or order"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="min-w-0 flex-1 bg-transparent text-sm text-foreground outline-none placeholder:text-muted-foreground"
            />
          </label>
          <label className="sr-only" htmlFor="activity-shop">
            Shop
          </label>
          <select
            id="activity-shop"
            value={tenantId}
            onChange={(e) => setTenantId(e.target.value)}
            className="min-h-11 rounded-xl border bg-background px-3 text-sm"
          >
            <option value="">All shops</option>
            {shops.results.map((s) => (
              <option key={s.id} value={s.id}>
                {s.name}
              </option>
            ))}
          </select>
          <div
            role="group"
            aria-label="Category"
            className="flex flex-wrap gap-2"
          >
            {CATEGORIES.map((c) => (
              <button
                key={c.value}
                type="button"
                aria-pressed={category === c.value}
                onClick={() => setCategory(c.value)}
                className={cn(
                  "min-h-9 cursor-pointer rounded-full border px-3.5 text-[13px] font-semibold transition-colors",
                  category === c.value
                    ? "border-foreground bg-foreground text-background"
                    : "bg-card text-muted-foreground hover:border-muted-foreground/50 hover:text-foreground",
                )}
              >
                {c.label}
              </button>
            ))}
          </div>
        </div>

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
            No activity yet. Events appear here as people create orders, record
            payments and update customers.
          </p>
        ) : (
          <ul className="divide-y">
            {data.map((e) => {
              const expanded = open === e.id;
              return (
                <li key={e.id}>
                  <button
                    type="button"
                    aria-expanded={expanded}
                    onClick={() => setOpen(expanded ? null : e.id)}
                    className="flex w-full cursor-pointer flex-wrap items-center gap-x-4 gap-y-2 px-4 py-3.5 text-left transition-colors hover:bg-muted/50 md:px-5"
                  >
                    <span className="w-16 shrink-0 font-mono text-xs text-muted-foreground">
                      {formatDistanceToNowStrict(parseISO(e.createdAt))}
                    </span>
                    <InitialsAvatar name={e.actorEmail ?? "system"} size="sm" />
                    <span className="min-w-0 flex-1 basis-56">
                      <b className="block truncate font-semibold">
                        {describe(e)}
                      </b>
                      <span className="text-[13px] text-muted-foreground">
                        {e.actorEmail ?? "System"} ·{" "}
                        <span className="font-mono text-xs">{e.action}</span>
                      </span>
                    </span>
                    <Chip tone={ROLE_TONE[e.actorRole] ?? "neutral"}>
                      {e.actorRole}
                    </Chip>
                    <span className="hidden min-w-32 text-sm sm:block">
                      {e.tenantName}
                    </span>
                    <ChevronDown
                      className={cn(
                        "size-4 text-muted-foreground transition-transform",
                        expanded && "rotate-180",
                      )}
                    />
                  </button>
                  {expanded && (
                    <div className="space-y-3 bg-muted/50 px-4 py-4 md:px-5">
                      <dl className="grid grid-cols-2 gap-x-6 gap-y-3 font-mono text-xs md:grid-cols-4">
                        {[
                          ["event_id", String(e.id)],
                          ["shop", e.tenantName],
                          ["ip", e.ip ?? "not recorded"],
                          [
                            "occurred_at",
                            format(
                              parseISO(e.createdAt),
                              "dd MMM yyyy HH:mm:ss",
                            ),
                          ],
                        ].map(([k, v]) => (
                          <div key={k} className="min-w-0">
                            <dt className="uppercase tracking-widest text-muted-foreground">
                              {k}
                            </dt>
                            <dd className="mt-0.5 break-words">{v}</dd>
                          </div>
                        ))}
                      </dl>
                      <pre className="overflow-auto rounded-lg border bg-background p-3.5 font-mono text-xs leading-relaxed">
                        {JSON.stringify(
                          {
                            action: e.action,
                            resource: e.resource,
                            metadata: e.metadata,
                          },
                          null,
                          2,
                        )}
                      </pre>
                    </div>
                  )}
                </li>
              );
            })}
          </ul>
        )}

        <p className="flex items-center gap-2.5 border-t px-4 py-3.5 text-[13px] text-muted-foreground md:px-5">
          <ShieldCheck className="size-4 shrink-0" />
          Opening this page is written to the audit log. The live stream itself
          is not, so the log stays readable.
        </p>
      </div>
    </div>
  );
}
