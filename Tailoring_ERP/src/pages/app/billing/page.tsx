import { useState } from "react";
import { Link } from "react-router-dom";
import { format, parseISO } from "date-fns";
import { toast } from "sonner";
import { CheckCircle2, Crown, ShieldAlert } from "lucide-react";
import {
  useBillingState,
  useSubscriptionInvoices,
  useStartSubscriptionCheckout,
  useActivePlans,
} from "@/lib/queries/billing.ts";
import { formatCurrency } from "@/lib/format-currency.ts";
import { cn } from "@/lib/utils.ts";
import PageHeader from "@/components/page-header.tsx";
import Chip from "@/components/chip.tsx";
import Meter from "@/components/meter.tsx";
import { Card } from "@/components/ui/card.tsx";
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

const INCLUDED = [
  "Unlimited customers and orders",
  "Pattern drafting studio",
  "Worker management and payouts",
  "Revenue reports and invoices",
  "Fincra payment integration",
  "Multi-currency support",
  "Priority support",
];

const TRIAL_DAYS = 30;

export default function BillingPage() {
  const billing = useBillingState();
  const invoices = useSubscriptionInvoices();
  const plans = useActivePlans();
  const startCheckout = useStartSubscriptionCheckout();
  const [redirecting, setRedirecting] = useState(false);
  const [selectedPlan, setSelectedPlan] = useState<string | undefined>();

  // Default the selection to the shop's current plan, or the first option,
  // until the user actively picks one, derived at render time rather than
  // synced into state via an effect.
  const effectivePlan = selectedPlan ?? billing?.plan?.code ?? plans?.[0]?.code;
  const chosen = plans?.find((p) => p.code === effectivePlan);

  // "Best value" only means something when plans differ in length: it marks
  // the lowest price per day.
  const perDay = (p: { amount: number; intervalDays: number }) =>
    p.amount / Math.max(1, p.intervalDays);
  const cheapest =
    plans &&
    plans.length > 1 &&
    new Set(plans.map((p) => p.intervalDays)).size > 1
      ? [...plans].sort((a, b) => perDay(a) - perDay(b))[0]?.code
      : undefined;

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

  const cta =
    billing?.state === "active" && effectivePlan === billing.plan?.code
      ? "Renew now"
      : billing?.state === "active"
        ? "Switch plan"
        : "Subscribe";

  return (
    <div className="mx-auto max-w-2xl space-y-6 p-4 md:p-8">
      <PageHeader
        eyebrow="Subscription"
        title="Billing"
        description="Manage your AtelierHQ subscription."
        className="mb-0"
      />

      {billing === undefined ? (
        <Skeleton className="h-48 w-full" />
      ) : (
        <>
          <Card className="gap-4 p-5 md:p-6">
            <div className="flex flex-wrap items-center gap-4">
              <span
                className={cn(
                  "grid size-11 shrink-0 place-items-center rounded-xl",
                  billing.state === "readonly"
                    ? "bg-destructive-soft text-destructive"
                    : "bg-accent text-accent-foreground",
                )}
              >
                {billing.state === "readonly" ? (
                  <ShieldAlert className="size-5" />
                ) : (
                  <Crown className="size-5" />
                )}
              </span>
              <div className="min-w-0 flex-1 basis-56">
                <p className="font-sans text-base font-semibold">
                  {billing.state === "trialing"
                    ? billing.daysLeft > 0
                      ? `Free trial · ${billing.daysLeft} day${billing.daysLeft === 1 ? "" : "s"} remaining`
                      : "Free trial · ends today"
                    : billing.state === "active"
                      ? "Subscription active"
                      : "Trial ended"}
                </p>
                <p className="text-[13px] text-muted-foreground">
                  {billing.state === "trialing" &&
                    `Full access to all features until ${format(parseISO(billing.trialEndsAt), "dd MMM yyyy")}.`}
                  {billing.state === "active" &&
                    billing.currentPeriodEnd &&
                    `Paid until ${format(parseISO(billing.currentPeriodEnd), "dd MMM yyyy")}.`}
                  {billing.state === "readonly" &&
                    "Your data is safe and visible, but you can't create or edit anything until you subscribe."}
                </p>
              </div>
              {billing.state === "trialing" && (
                <Chip tone="accent">Trial active</Chip>
              )}
              {billing.state === "active" && (
                <Chip tone="good">
                  <CheckCircle2 /> Active
                </Chip>
              )}
              {billing.state === "readonly" && (
                <Chip tone="crit">Read-only</Chip>
              )}
            </div>
            {billing.state === "trialing" && (
              <>
                <Meter
                  value={TRIAL_DAYS - billing.daysLeft}
                  max={TRIAL_DAYS}
                  className="h-2"
                  label={`${TRIAL_DAYS - billing.daysLeft} of ${TRIAL_DAYS} trial days used`}
                />
                <p className="-mt-1 text-[13px] text-muted-foreground">
                  {TRIAL_DAYS - billing.daysLeft} of {TRIAL_DAYS} days used
                </p>
              </>
            )}
          </Card>

          <section aria-labelledby="plans-h" className="space-y-3.5">
            <h2 id="plans-h" className="font-sans text-lg font-semibold">
              Choose a plan
            </h2>
            {plans === undefined ? (
              <Skeleton className="h-36 w-full" />
            ) : (
              <div
                role="radiogroup"
                aria-label="Plan"
                className="grid gap-3.5 sm:grid-cols-2"
              >
                {plans.map((plan) => {
                  const isSelected = effectivePlan === plan.code;
                  const isCurrent = billing.plan?.code === plan.code;
                  return (
                    <button
                      key={plan.code}
                      type="button"
                      role="radio"
                      aria-checked={isSelected}
                      onClick={() => setSelectedPlan(plan.code)}
                      className={cn(
                        "relative flex min-h-36 cursor-pointer flex-col justify-end gap-1 rounded-2xl border-[1.5px] bg-card p-5 text-left transition-colors",
                        isSelected
                          ? "border-primary bg-accent/60"
                          : "hover:border-muted-foreground/50",
                      )}
                    >
                      {(plan.code === cheapest || isCurrent) && (
                        <Chip tone="accent" className="absolute left-4 top-4">
                          {isCurrent ? "Current" : "Best value"}
                        </Chip>
                      )}
                      <span
                        aria-hidden="true"
                        className={cn(
                          "absolute right-4 top-4 size-5 rounded-full border-[1.5px] bg-background",
                          isSelected &&
                            "border-primary bg-[radial-gradient(circle,var(--primary)_0_5px,var(--background)_6px)]",
                        )}
                      />
                      <b className="font-semibold">{plan.name}</b>
                      <span className="font-display text-2xl font-semibold tabular-nums tracking-tight">
                        {formatCurrency(plan.amount, plan.currency, 0)}
                        <small className="ml-1.5 font-body text-[13px] font-medium text-muted-foreground">
                          every {plan.intervalDays} days
                        </small>
                      </span>
                    </button>
                  );
                })}
              </div>
            )}
            <Button
              size="lg"
              onClick={handleSubscribe}
              disabled={redirecting || !effectivePlan}
              className="w-full sm:w-auto"
            >
              <Crown />
              {redirecting
                ? "Redirecting…"
                : `${cta}${chosen ? ` · ${chosen.name}` : ""}`}
            </Button>
          </section>

          <Card className="gap-4 p-5 md:p-6">
            <h2 className="font-sans text-base font-semibold">
              Everything included
            </h2>
            <ul className="space-y-3">
              {INCLUDED.map((item) => (
                <li key={item} className="flex items-center gap-3 text-sm">
                  <CheckCircle2 className="size-[18px] shrink-0 text-primary" />
                  {item}
                </li>
              ))}
            </ul>
          </Card>

          <Card className="flex-row flex-wrap items-center gap-4 p-5">
            <span className="grid size-11 shrink-0 place-items-center rounded-xl bg-muted text-xs font-bold tracking-wider">
              FIN
            </span>
            <div className="min-w-0 flex-1 basis-56">
              <b className="font-semibold">Fincra payments</b>
              <p className="text-[13px] text-muted-foreground">
                Connect your own Fincra account to take payments from your
                clients.
              </p>
            </div>
            <Button variant="outline" asChild>
              <Link to="/settings">Connect</Link>
            </Button>
          </Card>

          <Card className="gap-4 p-5 md:p-6">
            <h2 className="font-sans text-base font-semibold">
              Payment history
            </h2>
            {invoices === undefined ? (
              <Skeleton className="h-24 w-full" />
            ) : invoices.length === 0 ? (
              <p className="text-sm text-muted-foreground">No payments yet.</p>
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
                      <TableCell className="text-right font-medium tabular-nums">
                        {formatCurrency(inv.amount, inv.currency, 2)}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </Card>
        </>
      )}
    </div>
  );
}
