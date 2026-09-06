import { useState } from "react";
import { usePayments, useOutstandingSummary, useDeletePayment, usePaymentsByOrder } from "@/lib/queries/payments.ts";
import { useOrders } from "@/lib/queries/orders.ts";
import { toast } from "sonner";
import { format, parseISO } from "date-fns";
import PageHeader from "@/components/page-header.tsx";
import { Button } from "@/components/ui/button.tsx";
import { Skeleton } from "@/components/ui/skeleton.tsx";
import { Card, CardContent } from "@/components/ui/card.tsx";
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
  Empty,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
  EmptyDescription,
  EmptyContent,
} from "@/components/ui/empty.tsx";
import { CreditCard, Trash2, TrendingDown, Banknote, Receipt, AlertCircle } from "lucide-react";
import RecordPaymentDialogInner from "./_components/record-payment-dialog.tsx";
import { useNavigate } from "react-router-dom";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog.tsx";

const METHOD_LABELS: Record<string, string> = {
  cash: "Cash",
  bank_transfer: "Bank Transfer",
  card: "Card",
  other: "Other",
};

const METHOD_COLORS: Record<string, string> = {
  cash: "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400",
  bank_transfer: "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400",
  card: "bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-400",
  other: "bg-muted text-muted-foreground",
};

export default function PaymentsPage() {
  const navigate = useNavigate();
  const [payDialogOpen, setPayDialogOpen] = useState(false);

  const summary = useOutstandingSummary();
  const { results, status, loadMore } = usePayments(20);
  const deletePayment = useDeletePayment();

  const handleDelete = async (id: string) => {
    try {
      await deletePayment({ id });
      toast.success("Payment deleted");
    } catch {
      toast.error("Failed to delete payment");
    }
  };

  const isLoading = status === "LoadingFirstPage";

  return (
    <div className="p-6 max-w-5xl mx-auto">
      <PageHeader
        title="Payments"
        description="Customer payments and outstanding balances."
      >
        <Button size="sm" onClick={() => setPayDialogOpen(true)}>
          <CreditCard className="size-3.5 mr-1" /> Record payment
        </Button>
      </PageHeader>

      {/* Summary cards */}
      {summary === undefined ? (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-6">
          {Array.from({ length: 4 }).map((_, i) => (
            <Skeleton key={i} className="h-20 w-full" />
          ))}
        </div>
      ) : (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-6">
          <SummaryCard
            icon={<Receipt className="size-4 text-muted-foreground" />}
            label="Total Billed"
            value={summary.totalBilled}
          />
          <SummaryCard
            icon={<Banknote className="size-4 text-emerald-500" />}
            label="Collected"
            value={summary.totalCollected}
            accent="emerald"
          />
          <SummaryCard
            icon={<TrendingDown className="size-4 text-amber-500" />}
            label="Outstanding"
            value={summary.totalOutstanding}
            accent="amber"
          />
          <SummaryCard
            icon={<AlertCircle className="size-4 text-red-500" />}
            label="Orders with Balance"
            count={summary.ordersWithBalance}
            accent="red"
          />
        </div>
      )}

      {/* Payment list */}
      {isLoading ? (
        <div className="space-y-3">
          {Array.from({ length: 5 }).map((_, i) => (
            <Skeleton key={i} className="h-16 w-full" />
          ))}
        </div>
      ) : results.length === 0 ? (
        <Empty>
          <EmptyHeader>
            <EmptyMedia variant="icon">
              <CreditCard />
            </EmptyMedia>
            <EmptyTitle>No payments recorded</EmptyTitle>
            <EmptyDescription>
              Record a payment against any order to start tracking balances
            </EmptyDescription>
          </EmptyHeader>
          <EmptyContent>
            <Button size="sm" onClick={() => setPayDialogOpen(true)}>
              Record payment
            </Button>
          </EmptyContent>
        </Empty>
      ) : (
        <div className="space-y-2">
          {results.map((payment) => (
            <div
              key={payment.id}
              className="flex items-center justify-between gap-3 rounded-lg border border-border bg-card px-4 py-3"
            >
              <div className="min-w-0 flex-1 grid grid-cols-1 sm:grid-cols-4 gap-x-4 gap-y-0.5 items-center">
                {/* Order + Customer */}
                <div className="sm:col-span-2">
                  <button
                    onClick={() => navigate(`/orders/${payment.orderId}`)}
                    className="font-body text-sm font-medium text-primary hover:underline cursor-pointer"
                  >
                    {payment.orderNumber}
                  </button>
                  <p className="text-xs text-muted-foreground font-body truncate">
                    {payment.customerName}
                  </p>
                </div>
                {/* Method */}
                <div>
                  <span
                    className={`inline-block px-2 py-0.5 rounded-full text-[11px] font-body font-medium ${
                      METHOD_COLORS[payment.method] ?? METHOD_COLORS.other
                    }`}
                  >
                    {METHOD_LABELS[payment.method] ?? payment.method}
                  </span>
                </div>
                {/* Date */}
                <div className="text-xs text-muted-foreground font-body">
                  {format(parseISO(payment.paidAt), "dd MMM yyyy")}
                </div>
              </div>

              <div className="flex items-center gap-3 shrink-0">
                <span className="font-sans font-semibold text-sm tabular-nums">
                  {payment.amount.toLocaleString(undefined, { minimumFractionDigits: 2 })}
                </span>
                <AlertDialog>
                  <AlertDialogTrigger asChild>
                    <button className="text-destructive hover:text-destructive/80 cursor-pointer">
                      <Trash2 className="size-3.5" />
                    </button>
                  </AlertDialogTrigger>
                  <AlertDialogContent>
                    <AlertDialogHeader>
                      <AlertDialogTitle>Delete this payment?</AlertDialogTitle>
                      <AlertDialogDescription>
                        This will remove the payment of{" "}
                        {payment.amount.toLocaleString(undefined, { minimumFractionDigits: 2 })}{" "}
                        from {payment.orderNumber}. This cannot be undone.
                      </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                      <AlertDialogCancel>Cancel</AlertDialogCancel>
                      <AlertDialogAction
                        onClick={() => handleDelete(payment.id)}
                        className="bg-destructive text-white hover:bg-destructive/90"
                      >
                        Delete
                      </AlertDialogAction>
                    </AlertDialogFooter>
                  </AlertDialogContent>
                </AlertDialog>
              </div>
            </div>
          ))}

          {status === "CanLoadMore" && (
            <div className="text-center pt-2">
              <Button variant="secondary" size="sm" onClick={() => loadMore()}>
                Load more
              </Button>
            </div>
          )}
        </div>
      )}

      {payDialogOpen && (
        <GlobalRecordPaymentDialog
          open={payDialogOpen}
          onClose={() => setPayDialogOpen(false)}
        />
      )}
    </div>
  );
}

// ── Summary card ─────────────────────────────────────────────────────────────

function SummaryCard({
  icon,
  label,
  value,
  count,
  accent,
}: {
  icon: React.ReactNode;
  label: string;
  value?: number;
  count?: number;
  accent?: "emerald" | "amber" | "red";
}) {
  const valueColor =
    accent === "emerald"
      ? "text-emerald-600 dark:text-emerald-400"
      : accent === "amber"
        ? "text-amber-600 dark:text-amber-400"
        : accent === "red"
          ? "text-red-600 dark:text-red-400"
          : "text-foreground";

  return (
    <Card>
      <CardContent className="pt-4 pb-4">
        <div className="flex items-center gap-2 mb-1">
          {icon}
          <p className="text-xs font-body text-muted-foreground">{label}</p>
        </div>
        <p className={`font-sans font-bold text-xl tabular-nums ${valueColor}`}>
          {count !== undefined
            ? count
            : (value ?? 0).toLocaleString(undefined, { minimumFractionDigits: 2 })}
        </p>
      </CardContent>
    </Card>
  );
}

// ── Global record payment (picks any order) ──────────────────────────────────

function GlobalRecordPaymentDialog({
  open,
  onClose,
}: {
  open: boolean;
  onClose: () => void;
}) {
  const [selectedOrderId, setSelectedOrderId] = useState<string | null>(null);

  const { results: orders, status: ordersStatus } = useOrders(undefined, 100);

  const balancesResult = usePaymentsByOrder(selectedOrderId ?? undefined);

  const [pickOpen, setPickOpen] = useState(true);

  const nonDeliveredOrders = orders.filter((o) => o.status !== "delivered");
  const selectedOrder = orders.find((o) => o.id === selectedOrderId);

  // Step 1: pick order
  if (pickOpen || !selectedOrderId) {
    return (
      <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle className="font-sans">Choose an order</DialogTitle>
          </DialogHeader>
          {ordersStatus === "LoadingFirstPage" ? (
            <div className="space-y-2">
              {Array.from({ length: 3 }).map((_, i) => (
                <Skeleton key={i} className="h-10 w-full" />
              ))}
            </div>
          ) : nonDeliveredOrders.length === 0 ? (
            <p className="text-sm font-body text-muted-foreground">
              No active orders found.
            </p>
          ) : (
            <div className="space-y-1.5 max-h-72 overflow-y-auto">
              {nonDeliveredOrders.map((order) => (
                <button
                  key={order.id}
                  onClick={() => {
                    setSelectedOrderId(order.id);
                    setPickOpen(false);
                  }}
                  className="w-full text-left rounded-md border border-border px-3 py-2 hover:bg-muted transition-colors cursor-pointer"
                >
                  <span className="font-body text-sm font-medium">
                    {order.orderNumber}
                  </span>
                  <span className="text-xs text-muted-foreground font-body ml-2">
                    {order.customerName}
                  </span>
                </button>
              ))}
            </div>
          )}
          <div className="flex justify-end pt-1">
            <Button variant="secondary" size="sm" onClick={onClose}>
              Cancel
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    );
  }

  // Step 2: record payment
  return (
    <RecordPaymentDialogInner
      open={open}
      onClose={onClose}
      orderId={selectedOrderId}
      orderNumber={selectedOrder?.orderNumber ?? ""}
      outstanding={balancesResult?.outstanding ?? 0}
    />
  );
}
