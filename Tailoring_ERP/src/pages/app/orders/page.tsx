import { useState } from "react";
import { usePaginatedQuery } from "convex/react";
import { api } from "@/convex/_generated/api.js";
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
import { StatusBadge, STATUS_CONFIG, type OrderStatus } from "./_components/status-badge.tsx";
import CreateOrderDialog from "./_components/create-order-dialog.tsx";
import { cn } from "@/lib/utils.ts";
import { format, parseISO } from "date-fns";

const STATUS_TABS = [
  { value: undefined, label: "All" },
  { value: "received", label: "Received" },
  { value: "in_progress", label: "In Progress" },
  { value: "completed", label: "Completed" },
  { value: "delivered", label: "Delivered" },
] as const;

export default function OrdersPage() {
  const navigate = useNavigate();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [statusFilter, setStatusFilter] = useState<OrderStatus | undefined>(undefined);

  const { results, status, loadMore } = usePaginatedQuery(
    api.orders.listOrders,
    { status: statusFilter },
    { initialNumItems: 20 }
  );

  return (
    <div className="p-6 max-w-5xl mx-auto">
      <PageHeader title="Orders" description="Track orders from received to delivered.">
        <Button size="sm" onClick={() => setDialogOpen(true)}>
          New order
        </Button>
      </PageHeader>

      {/* Status filter tabs */}
      <div className="flex gap-1 mb-6 overflow-x-auto pb-1">
        {STATUS_TABS.map((tab) => (
          <button
            key={String(tab.value)}
            onClick={() => setStatusFilter(tab.value as OrderStatus | undefined)}
            className={cn(
              "px-3 py-1.5 rounded-md text-xs font-body whitespace-nowrap transition-colors cursor-pointer",
              statusFilter === tab.value
                ? "bg-primary text-primary-foreground font-medium"
                : "text-muted-foreground hover:text-foreground hover:bg-muted"
            )}
          >
            {tab.label}
          </button>
        ))}
      </div>

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
              {statusFilter ? `No ${STATUS_CONFIG[statusFilter].label.toLowerCase()} orders` : "No orders yet"}
            </EmptyTitle>
            <EmptyDescription>
              {statusFilter ? "Try a different status filter" : "Create your first order to get started"}
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
              key={order._id}
              onClick={() => navigate(`/orders/${order._id}`)}
              className={cn(
                "w-full text-left rounded-lg border border-border bg-card px-4 py-3",
                "hover:border-primary/40 hover:shadow-sm transition-all cursor-pointer"
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
                  {order.totalAmount.toLocaleString(undefined, { minimumFractionDigits: 2 })}
                </p>
              </div>
            </button>
          ))}

          {status === "CanLoadMore" && (
            <div className="pt-4 text-center">
              <Button variant="secondary" size="sm" onClick={() => loadMore(20)}>
                Load more
              </Button>
            </div>
          )}
        </div>
      )}

      <CreateOrderDialog open={dialogOpen} onClose={() => setDialogOpen(false)} />
    </div>
  );
}
