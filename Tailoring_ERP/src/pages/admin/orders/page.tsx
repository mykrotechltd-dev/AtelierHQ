import { useState } from "react";
import { format, parseISO } from "date-fns";
import { useDebounce } from "@/hooks/use-debounce.ts";
import { useAdminOrders } from "@/lib/queries/admin.ts";
import { orderTone } from "../_lib/admin-tone.ts";
import { AdminStatusBadge } from "../_components/admin-status-badge.tsx";
import { AdminErrorState } from "../_components/admin-error-state.tsx";
import PageHeader from "@/components/page-header.tsx";
import { Input } from "@/components/ui/input.tsx";
import { Button } from "@/components/ui/button.tsx";
import { Skeleton } from "@/components/ui/skeleton.tsx";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table.tsx";
import {
  Empty,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
  EmptyDescription,
} from "@/components/ui/empty.tsx";
import { ClipboardList, Search } from "lucide-react";
import { formatCurrency } from "@/lib/format-currency.ts";

function fmt(n: number, currency: string) {
  return formatCurrency(n, currency, 2);
}

export default function AdminOrdersPage() {
  const [search, setSearch] = useState("");
  const [debouncedSearch] = useDebounce(search, 300);
  const { results, status, loadMore, retry } = useAdminOrders(
    debouncedSearch || undefined,
    20,
  );

  return (
    <div className="p-6 max-w-6xl mx-auto">
      <PageHeader
        title="Orders"
        description="Every order across every shop, newest first."
      />

      <div className="relative mb-6 max-w-sm">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-muted-foreground" />
        <Input
          placeholder="Search by order number…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="pl-9"
        />
      </div>

      {status === "LoadingFirstPage" ? (
        <div className="space-y-3">
          {Array.from({ length: 5 }).map((_, i) => (
            <Skeleton key={i} className="h-12 w-full" />
          ))}
        </div>
      ) : status === "Error" ? (
        <AdminErrorState onRetry={retry} />
      ) : results.length === 0 ? (
        <Empty>
          <EmptyHeader>
            <EmptyMedia variant="icon">
              <ClipboardList />
            </EmptyMedia>
            <EmptyTitle>No orders found</EmptyTitle>
            <EmptyDescription>
              {debouncedSearch
                ? `No results for "${debouncedSearch}"`
                : "No shop has created an order yet"}
            </EmptyDescription>
          </EmptyHeader>
        </Empty>
      ) : (
        <div className="rounded-lg border border-border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Order</TableHead>
                <TableHead>Shop</TableHead>
                <TableHead>Client</TableHead>
                <TableHead>Garment</TableHead>
                <TableHead>Deadline</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="text-right">Total</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {results.map((order) => {
                const { tone, label } = orderTone(order.status, order.dueDate);
                return (
                  <TableRow key={order.id}>
                    <TableCell className="font-medium">
                      {order.orderNumber}
                    </TableCell>
                    <TableCell className="text-muted-foreground">
                      {order.tenantName}
                    </TableCell>
                    <TableCell>{order.customerName}</TableCell>
                    <TableCell className="text-muted-foreground">
                      {order.garmentTypes.length > 0
                        ? order.garmentTypes.join(", ")
                        : "—"}
                    </TableCell>
                    <TableCell className="text-muted-foreground">
                      {order.dueDate
                        ? format(parseISO(order.dueDate), "dd MMM yyyy")
                        : "—"}
                    </TableCell>
                    <TableCell>
                      <AdminStatusBadge tone={tone} label={label} />
                    </TableCell>
                    <TableCell className="text-right font-medium">
                      {fmt(order.totalAmount, order.currency)}
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </div>
      )}

      {status === "CanLoadMore" && (
        <div className="pt-4 text-center">
          <Button variant="secondary" size="sm" onClick={() => loadMore()}>
            Load more
          </Button>
        </div>
      )}
    </div>
  );
}
