import { useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { differenceInCalendarDays, parseISO } from "date-fns";
import { ClipboardList, Clock, Plus } from "lucide-react";
import { useOrders } from "@/lib/queries/orders.ts";
import { useMyTenant } from "@/lib/queries/tenants.ts";
import { formatCurrency } from "@/lib/format-currency.ts";
import { STATUS_CONFIG, type OrderStatus } from "@/lib/order-status.ts";
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
import { StatusBadge } from "./_components/status-badge.tsx";
import CreateOrderDialog from "./_components/create-order-dialog.tsx";
import { cn } from "@/lib/utils.ts";

const STATUS_TABS = [
  { value: undefined, label: "All" },
  { value: "received", label: "Received" },
  { value: "in_progress", label: "In progress" },
  { value: "completed", label: "Completed" },
  { value: "delivered", label: "Delivered" },
] as const;

const BOARD: OrderStatus[] = [
  "received",
  "in_progress",
  "completed",
  "delivered",
];

function dueChip(
  dueDate: string,
  status: OrderStatus,
): { tone: ChipTone; label: string } | null {
  if (status === "delivered") return null;
  const days = differenceInCalendarDays(parseISO(dueDate), new Date());
  if (days < 0)
    return {
      tone: "crit",
      label: `Overdue ${-days} day${days === -1 ? "" : "s"}`,
    };
  if (days === 0) return { tone: "warn", label: "Due today" };
  return { tone: "neutral", label: `In ${days} day${days === 1 ? "" : "s"}` };
}

export default function OrdersPage() {
  const navigate = useNavigate();
  const tenant = useMyTenant();
  const currency = tenant?.currency ?? "USD";
  const [params, setParams] = useSearchParams();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [layout, setLayout] = useState<"list" | "board">("list");

  const raw = params.get("status");
  const statusFilter =
    raw && raw in STATUS_CONFIG ? (raw as OrderStatus) : undefined;
  const setStatusFilter = (s: OrderStatus | undefined) =>
    setParams(s ? { status: s } : {}, { replace: true });

  const { results, status, loadMore } = useOrders(statusFilter, 50);

  const chipFor = (o: (typeof results)[number]) =>
    o.dueDate ? dueChip(o.dueDate, o.status) : null;

  return (
    <div className="mx-auto max-w-5xl p-4 md:p-8">
      <PageHeader
        eyebrow="Production flow"
        title="Orders"
        description="Track every order from received to delivered."
      >
        <div
          role="group"
          aria-label="Layout"
          className="inline-flex rounded-xl border bg-card p-0.5"
        >
          {(["list", "board"] as const).map((l) => (
            <button
              key={l}
              type="button"
              aria-pressed={layout === l}
              onClick={() => setLayout(l)}
              className={cn(
                "min-h-9 cursor-pointer rounded-[10px] px-3.5 text-[13px] font-semibold capitalize transition-colors",
                layout === l
                  ? "bg-foreground text-background"
                  : "text-muted-foreground hover:text-foreground",
              )}
            >
              {l}
            </button>
          ))}
        </div>
        <Button onClick={() => setDialogOpen(true)}>
          <Plus /> New order
        </Button>
      </PageHeader>

      <div className="overflow-hidden rounded-2xl border bg-card shadow-sm">
        <div
          role="group"
          aria-label="Filter by status"
          className="flex gap-2 overflow-x-auto border-b p-4 md:px-5"
        >
          {STATUS_TABS.map((tab) => {
            const active = statusFilter === tab.value;
            return (
              <button
                key={String(tab.value)}
                type="button"
                aria-pressed={active}
                onClick={() =>
                  setStatusFilter(tab.value as OrderStatus | undefined)
                }
                className={cn(
                  "min-h-9 shrink-0 cursor-pointer rounded-full border px-3.5 text-[13px] font-semibold transition-colors",
                  active
                    ? "border-foreground bg-foreground text-background"
                    : "bg-card text-muted-foreground hover:border-muted-foreground/50 hover:text-foreground",
                )}
              >
                {tab.label}
              </button>
            );
          })}
        </div>

        {status === "LoadingFirstPage" ? (
          <div className="space-y-px">
            {Array.from({ length: 4 }).map((_, i) => (
              <Skeleton key={i} className="h-[76px] w-full rounded-none" />
            ))}
          </div>
        ) : results.length === 0 ? (
          <Empty>
            <EmptyHeader>
              <EmptyMedia variant="icon">
                <ClipboardList />
              </EmptyMedia>
              <EmptyTitle>
                {statusFilter
                  ? `No ${STATUS_CONFIG[statusFilter].label.toLowerCase()} orders`
                  : "No orders yet"}
              </EmptyTitle>
              <EmptyDescription>
                {statusFilter
                  ? "Try a different status."
                  : "Create your first order to see it move through the workshop."}
              </EmptyDescription>
            </EmptyHeader>
            {!statusFilter && (
              <EmptyContent>
                <Button onClick={() => setDialogOpen(true)}>
                  <Plus /> New order
                </Button>
              </EmptyContent>
            )}
          </Empty>
        ) : layout === "list" ? (
          <ul className="divide-y">
            {results.map((order) => {
              const chip = chipFor(order);
              return (
                <li key={order.id}>
                  <button
                    type="button"
                    onClick={() => navigate(`/orders/${order.id}`)}
                    className="flex w-full cursor-pointer flex-wrap items-center gap-x-4 gap-y-2 px-4 py-4 text-left transition-colors hover:bg-muted/50 md:px-5"
                  >
                    <span className="flex min-w-0 flex-1 basis-48 items-center gap-3.5">
                      <InitialsAvatar name={order.customerName} />
                      <span className="min-w-0">
                        <b className="block truncate font-semibold">
                          {order.customerName}
                        </b>
                        <span className="text-[13px] text-muted-foreground">
                          {order.orderNumber}
                        </span>
                      </span>
                    </span>
                    {chip && (
                      <Chip tone={chip.tone}>
                        <Clock /> {chip.label}
                      </Chip>
                    )}
                    <StatusBadge status={order.status} />
                    <b className="min-w-24 text-right tabular-nums">
                      {formatCurrency(order.totalAmount, currency)}
                    </b>
                  </button>
                </li>
              );
            })}
          </ul>
        ) : (
          <div className="grid gap-3.5 p-4 sm:grid-cols-2 lg:grid-cols-4 md:p-5">
            {BOARD.filter((s) => !statusFilter || s === statusFilter).map(
              (s) => {
                const items = results.filter((o) => o.status === s);
                return (
                  <section
                    key={s}
                    aria-label={STATUS_CONFIG[s].label}
                    className="space-y-2.5 rounded-2xl bg-muted/60 p-3"
                  >
                    <div className="flex items-center justify-between px-1">
                      <h2 className="font-sans text-sm font-semibold">
                        {STATUS_CONFIG[s].label}
                      </h2>
                      <Chip>{items.length}</Chip>
                    </div>
                    {items.length === 0 && (
                      <p className="px-1 py-4 text-center text-[13px] text-muted-foreground">
                        Nothing here
                      </p>
                    )}
                    {items.map((o) => {
                      const chip = chipFor(o);
                      return (
                        <button
                          key={o.id}
                          type="button"
                          onClick={() => navigate(`/orders/${o.id}`)}
                          className="grid w-full cursor-pointer gap-2 rounded-xl border bg-card p-3.5 text-left shadow-sm transition-colors hover:border-muted-foreground/40"
                        >
                          <span className="flex items-start justify-between gap-2">
                            <b className="font-semibold">{o.customerName}</b>
                            <span className="text-[13px] tabular-nums text-muted-foreground">
                              {formatCurrency(o.totalAmount, currency)}
                            </span>
                          </span>
                          <span className="text-[13px] text-muted-foreground">
                            {o.orderNumber}
                          </span>
                          {chip && (
                            <Chip
                              tone={chip.tone}
                              className="justify-self-start"
                            >
                              <Clock /> {chip.label}
                            </Chip>
                          )}
                        </button>
                      );
                    })}
                  </section>
                );
              },
            )}
          </div>
        )}
      </div>

      {status === "CanLoadMore" && (
        <div className="pt-5 text-center">
          <Button variant="outline" onClick={() => loadMore()}>
            Load more
          </Button>
        </div>
      )}

      <CreateOrderDialog
        open={dialogOpen}
        onClose={() => setDialogOpen(false)}
      />
    </div>
  );
}
