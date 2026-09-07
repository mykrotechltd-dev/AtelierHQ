import { useEffect, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { useMyTenant, useUpdateTenant, useConnectStripe, useRefreshStripeStatus } from "@/lib/queries/tenants.ts";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { toast } from "sonner";
import PageHeader from "@/components/page-header.tsx";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card.tsx";
import { Button } from "@/components/ui/button.tsx";
import { Input } from "@/components/ui/input.tsx";
import {
  Form,
  FormField,
  FormItem,
  FormLabel,
  FormControl,
  FormMessage,
} from "@/components/ui/form.tsx";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select.tsx";
import { Skeleton } from "@/components/ui/skeleton.tsx";
import { CreditCard, CheckCircle2, AlertTriangle, Clock } from "lucide-react";

const CURRENCIES = [
  "USD","NGN","GBP","EUR","GHS","KES","ZAR","INR","CAD","AUD",
];

const schema = z.object({
  name: z.string().min(2),
  phone: z.string().optional(),
  address: z.string().optional(),
  currency: z.string().min(1),
});
type FormValues = z.infer<typeof schema>;

export default function SettingsPage() {
  const tenant = useMyTenant();
  const updateTenant = useUpdateTenant();
  const connectStripe = useConnectStripe();
  const refreshStripeStatus = useRefreshStripeStatus();
  const [saving, setSaving] = useState(false);
  const [connecting, setConnecting] = useState(false);
  const [searchParams, setSearchParams] = useSearchParams();

  // Returning from Stripe's hosted onboarding — re-sync the live status.
  useEffect(() => {
    if (searchParams.get("stripe") === "return") {
      refreshStripeStatus()
        .catch(() => toast.error("Could not refresh Stripe status"))
        .finally(() => {
          searchParams.delete("stripe");
          setSearchParams(searchParams, { replace: true });
        });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchParams]);

  const handleConnectStripe = async () => {
    setConnecting(true);
    try {
      const url = await connectStripe();
      window.location.href = url;
    } catch {
      toast.error("Could not start Stripe onboarding");
      setConnecting(false);
    }
  };

  const form = useForm<FormValues>({
    resolver: zodResolver(schema),
    values: {
      name: tenant?.name ?? "",
      phone: tenant?.phone ?? "",
      address: tenant?.address ?? "",
      currency: tenant?.currency ?? "USD",
    },
  });

  const onSubmit = async (values: FormValues) => {
    setSaving(true);
    try {
      await updateTenant(values);
      toast.success("Settings saved");
    } catch {
      toast.error("Failed to save settings");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="p-6 max-w-2xl mx-auto">
      <PageHeader title="Settings" description="Manage your shop details." />

      {tenant === undefined ? (
        <Skeleton className="h-64 w-full" />
      ) : (
        <Card>
          <CardHeader>
            <CardTitle className="font-sans text-lg">Shop Information</CardTitle>
          </CardHeader>
          <CardContent>
            <Form {...form}>
              <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
                <FormField
                  control={form.control}
                  name="name"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Shop name</FormLabel>
                      <FormControl><Input {...field} /></FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="currency"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Currency</FormLabel>
                      <Select onValueChange={field.onChange} value={field.value}>
                        <FormControl>
                          <SelectTrigger><SelectValue /></SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          {CURRENCIES.map((c) => (
                            <SelectItem key={c} value={c}>{c}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="phone"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Phone</FormLabel>
                      <FormControl><Input {...field} /></FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="address"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Address</FormLabel>
                      <FormControl><Input {...field} /></FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <Button type="submit" disabled={saving}>
                  {saving ? "Saving..." : "Save changes"}
                </Button>
              </form>
            </Form>
          </CardContent>
        </Card>
      )}

      {tenant !== undefined && (
        <Card className="mt-4">
          <CardHeader>
            <CardTitle className="font-sans text-lg flex items-center gap-2">
              <CreditCard className="size-4" /> Stripe Payments
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {tenant?.stripeOnboardingStatus === "active" ? (
              <>
                <div className="flex items-center gap-2 text-emerald-600 dark:text-emerald-400">
                  <CheckCircle2 className="size-4" />
                  <span className="text-sm font-body font-medium">Connected and accepting card payments</span>
                </div>
                <p className="text-xs text-muted-foreground font-body">
                  Account country: {tenant.stripeCountry ?? "—"} · Currency: {tenant.stripeDefaultCurrency ?? "—"}
                </p>
              </>
            ) : tenant?.stripeOnboardingStatus === "pending" ? (
              <>
                <div className="flex items-center gap-2 text-amber-600 dark:text-amber-400">
                  <Clock className="size-4" />
                  <span className="text-sm font-body font-medium">Onboarding in progress with Stripe</span>
                </div>
                <Button size="sm" variant="secondary" disabled={connecting} onClick={handleConnectStripe}>
                  {connecting ? "Redirecting…" : "Continue onboarding"}
                </Button>
              </>
            ) : tenant?.stripeOnboardingStatus === "restricted" ? (
              <>
                <div className="flex items-center gap-2 text-red-600 dark:text-red-400">
                  <AlertTriangle className="size-4" />
                  <span className="text-sm font-body font-medium">Stripe has restricted this account — more information is needed</span>
                </div>
                <Button size="sm" variant="secondary" disabled={connecting} onClick={handleConnectStripe}>
                  {connecting ? "Redirecting…" : "Resolve on Stripe"}
                </Button>
              </>
            ) : (
              <>
                <p className="text-sm text-muted-foreground font-body">
                  Connect a Stripe account to accept card payments from customers, directly into your own bank account.
                </p>
                <Button size="sm" disabled={connecting} onClick={handleConnectStripe}>
                  {connecting ? "Redirecting…" : "Connect with Stripe"}
                </Button>
              </>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  );
}
