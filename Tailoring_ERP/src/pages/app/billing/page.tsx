import { useState } from "react";
import { format, parseISO } from "date-fns";
import { toast } from "sonner";
import {
  useBillingState,
  useSubscriptionInvoices,
  useStartSubscriptionCheckout,
  useActivePlans,
} from "@/lib/queries/billing.ts";
import { formatCurrency } from "@/lib/format-currency.ts";
import { cn } from "@/lib/utils.ts";
import PageHeader from "@/components/page-header.tsx";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card.tsx";
import { Button } from "@/components/ui/button.tsx";
import { Badge } from "@/components/ui/badge.tsx";
import { Skeleton } from "@/components/ui/skeleton.tsx";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table.tsx";
import { CheckCircle2, Clock, ShieldAlert } from "lucide-react";

export default function BillingPage() {
  const billing = useBillingState();
  const invoices = useSubscriptionInvoices();
  const plans = useActivePlans();
  const startCheckout = useStartSubscriptionCheckout();
  const [redirecting, setRedirecting] = useState(false);
  const [selectedPlan, setSelectedPlan] = useState<string | undefined>();

  // Default the selection to the shop's current plan, or the cheapest
  // option, until the user actively picks one — derived at render time
  // rather than synced into state via an effect.
  const effectivePlan = selectedPlan ?? billing?.plan?.code ?? plans?.[0]?.code;

  const handleSubscribe = async () => {
    if (!effectivePlan) return;
    setRedirecting(true);
    try {
      const url = await startCheckout(effectivePlan);
      window.location.href = url;
    } catch (err) {
      setRedirecting(false);
      const message =
        err instanceof Error ? err.message : "Could not start checkout";
      toast.error(message);
    }
  };

  return (
    <div className="p-6 max-w-2xl mx-auto">
      <PageHeader
        title="Billing"
        description="Your AtelierHQ subscription."
      />

      {billing === undefined ? (
        <Skeleton className="h-48 w-full" />
      ) : (
        <>
          <Card>
            <CardHeader>
              <CardTitle className="font-sans text-lg flex items-center justify-between">
                Subscription
                <StateBadge state={billing.state} />
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              {billing.state === "trialing" && (
                <p className="text-sm text-muted-foreground font-body">
                  {billing.daysLeft > 0
                    ? `${billing.daysLeft} day${billing.daysLeft === 1 ? "" : "s"} left in your free trial.`
                    : "Your free trial ends today."}{" "}
                  Trial ends {format(parseISO(billing.trialEndsAt), "dd MMM yyyy")}.
                </p>
              )}
              {billing.state === "active" && billing.currentPeriodEnd && (
                <p className="text-sm text-muted-foreground font-body">
                  Your subscription is active until{" "}
                  {format(parseISO(billing.currentPeriodEnd), "dd MMM yyyy")}.
                </p>
              )}
              {billing.state === "readonly" && (
                <p className="text-sm text-destructive font-body">
                  Your trial has ended and you don't have an active
                  subscription. Your data is safe and visible, but you can't
                  create or edit anything until you subscribe.
                </p>
              )}

              {plans === undefined ? (
                <Skeleton className="h-20 w-full" />
              ) : (
                <div className="grid gap-2 sm:grid-cols-3">
                  {plans.map((plan) => {
                    const isCurrent = billing.plan?.code === plan.code;
                    const isSelected = effectivePlan === plan.code;
                    return (
                      <button
                        key={plan.code}
                        type="button"
                        onClick={() => setSelectedPlan(plan.code)}
                        className={cn(
                          "rounded-lg border p-3 text-left transition-colors",
                          isSelected
                            ? "border-primary ring-1 ring-primary"
                            : "border-border hover:border-primary/50",
                        )}
                      >
                        <div className="flex items-center justify-between">
                          <p className="text-sm font-medium text-foreground">
                            {plan.name}
                          </p>
                          {isCurrent && (
                            <Badge variant="secondary" className="text-[10px]">
                              Current
                            </Badge>
                          )}
                        </div>
                        <p className="text-lg font-bold font-display mt-1">
                          {formatCurrency(plan.amount, plan.currency, 2)}
                        </p>
                        <p className="text-xs text-muted-foreground">
                          every {plan.intervalDays} days
                        </p>
                      </button>
                    );
                  })}
                </div>
              )}

              <Button
                onClick={handleSubscribe}
                disabled={redirecting || !effectivePlan}
              >
                {redirecting
                  ? "Redirecting…"
                  : billing.state === "active" && effectivePlan === billing.plan?.code
                    ? "Renew now"
                    : billing.state === "active"
                      ? "Switch plan"
                      : "Subscribe"}
              </Button>
            </CardContent>
          </Card>

          <Card className="mt-4">
            <CardHeader>
              <CardTitle className="font-sans text-lg">
                Payment history
              </CardTitle>
            </CardHeader>
            <CardContent>
              {invoices === undefined ? (
                <Skeleton className="h-24 w-full" />
              ) : invoices.length === 0 ? (
                <p className="text-sm text-muted-foreground font-body">
                  No payments yet.
                </p>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Date</TableHead>
                      <TableHead>Period</TableHead>
                      <TableHead className="text-right">Amount</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {invoices.map((inv) => (
                      <TableRow key={inv.id}>
                        <TableCell>
                          {format(parseISO(inv.paidAt), "dd MMM yyyy")}
                        </TableCell>
                        <TableCell className="text-muted-foreground">
                          {format(parseISO(inv.periodStart), "dd MMM")} –{" "}
                          {format(parseISO(inv.periodEnd), "dd MMM yyyy")}
                        </TableCell>
                        <TableCell className="text-right font-medium">
                          {formatCurrency(inv.amount, inv.currency, 2)}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>
        </>
      )}
    </div>
  );
}

function StateBadge({ state }: { state: "trialing" | "active" | "readonly" }) {
  if (state === "active") {
    return (
      <Badge variant="secondary" className="text-emerald-600 dark:text-emerald-400">
        <CheckCircle2 className="size-3" /> Active
      </Badge>
    );
  }
  if (state === "trialing") {
    return (
      <Badge variant="secondary">
        <Clock className="size-3" /> Trial
      </Badge>
    );
  }
  return (
    <Badge variant="destructive">
      <ShieldAlert className="size-3" /> Read-only
    </Badge>
  );
}