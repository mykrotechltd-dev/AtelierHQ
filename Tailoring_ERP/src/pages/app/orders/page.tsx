import { useState } from "react";
import { useOrders } from "@/lib/queries/orders.ts";
import { useNavigate } from "react-router-dom";
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
import { ClipboardList, CalendarDays, User } from "lucide-react";
import { StatusBadge } from "./_components/status-badge.tsx";
import { STATUS_CONFIG, type OrderStatus } from "@/lib/order-status.ts";
import CreateOrderDialog from "./_components/create-order-dialog.tsx";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs.tsx";
import { cn } from "@/lib/utils.ts";
import { format, parseISO } from "date-fns";

// "all" stands in for `undefined` (no filter) — Radix Tabs needs a real
// string value, and undefined isn't one.
const STATUS_TABS = [
  { value: "all", label: "All" },
  { value: "received", label: "Received" },
  { value: "in_progress", label: "In Progress" },
  { value: "completed", label: "Completed" },
  { value: "delivered", label: "Delivered" },
] as const;

export default function OrdersPage() {
  const navigate = useNavigate();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [statusFilter, setStatusFilter] = useState<OrderStatus | undefined>(
    undefined,
  );

  const { results, status, loadMore } = useOrders(statusFilter, 20);

  return (
    <div className="p-6 max-w-5xl mx-auto">
      <PageHeader
        title="Orders"
        description="Track orders from received to delivered."
      >
        <Button size="sm" onClick={() => setDialogOpen(true)}>
          New order
        </Button>
      </PageHeader>

      {/* Status filter tabs */}
      <Tabs
        value={statusFilter ?? "all"}
        onValueChange={(v) =>
          setStatusFilter(v === "all" ? undefined : (v as OrderStatus))
        }
        className="mb-6"
      >
        <TabsList className="w-full justify-start overflow-x-auto">
          {STATUS_TABS.map((tab) => (
            <TabsTrigger
              key={tab.value}
              value={tab.value}
              className="text-xs whitespace-nowrap"
            >
              {tab.label}
            </TabsTrigger>
          ))}
        </TabsList>
      </Tabs>

      {/* List */}
      {status === "LoadingFirstPage" ? (
        <div className="space-y-3">
          {Array.from({ length: 4 }).map((_, i) => (
            <Skeleton key={i} className="h-24 w-full" />
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
                ? "Try a different status filter"
                : "Create your first order to get started"}
            </EmptyDescription>
          </EmptyHeader>
          {!statusFilter && (
            <EmptyContent>
              <Button size="sm" onClick={() => setDialogOpen(true)}>
                New order
              </Button>
            </EmptyContent>
          )}
        </Empty>
      ) : (
        <div className="space-y-2">
          {results.map((order) => (
            <button
              key={order.id}
              onClick={() => navigate(`/orders/${order.id}`)}
              className={cn(
                "w-full text-left rounded-lg border border-border bg-card px-4 py-3",
                "hover:border-primary/40 hover:shadow-sm transition-all cursor-pointer",
              )}
            >
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="font-sans font-semibold text-sm text-foreground">
                      {order.orderNumber}
                    </span>
                    <StatusBadge status={order.status} />
                  </div>
                  <div className="flex flex-wrap gap-x-4 gap-y-1 mt-1.5">
                    <span className="flex items-center gap-1 text-xs text-muted-foreground font-body">
                      <User className="size-3" /> {order.customerName}
                    </span>
                    {order.dueDate && (
                      <span className="flex items-center gap-1 text-xs text-muted-foreground font-body">
                        <CalendarDays className="size-3" />
                        Due {format(parseISO(order.dueDate), "dd MMM yyyy")}
                      </span>
                    )}
                  </div>
                </div>
                <p className="font-sans font-semibold text-sm text-foreground shrink-0">
                  {order.totalAmount.toLocaleString(undefined, {
                    minimumFractionDigits: 2,
                  })}
                </p>
              </div>
            </button>
          ))}

          {status === "CanLoadMore" && (
            <div className="pt-4 text-center">
              <Button variant="secondary" size="sm" onClick={() => loadMore()}>
                Load more
              </Button>
            </div>
          )}
        </div>
      )}

      <CreateOrderDialog
        open={dialogOpen}
        onClose={() => setDialogOpen(false)}
      />
    </div>
  );
}
