import { useState } from "react";
import { useMyTenant, useUpdateTenant, useFincraSettings, useSetFincraSettings } from "@/lib/queries/tenants.ts";
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
import { Checkbox } from "@/components/ui/checkbox.tsx";
import { Skeleton } from "@/components/ui/skeleton.tsx";
import { CreditCard, CheckCircle2 } from "lucide-react";

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

const fincraSchema = z.object({
  businessId: z.string().min(1, "Required"),
  publicKey: z.string().min(1, "Required"),
  secretKey: z.string().min(1, "Required"),
  webhookSecret: z.string().min(1, "Required"),
  isLive: z.boolean(),
});
type FincraFormValues = z.infer<typeof fincraSchema>;

export default function SettingsPage() {
  const tenant = useMyTenant();
  const updateTenant = useUpdateTenant();
  const [saving, setSaving] = useState(false);

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

      {tenant !== undefined && <FincraCard />}
    </div>
  );
}

// ── Fincra credentials ───────────────────────────────────────────────────────
// Each shop connects its own Fincra business account directly — there's no
// confirmed public API for this platform to create per-tenant sub-accounts.
// The secret key and webhook secret are write-only from here on: once saved
// they're never read back (see get_fincra_settings_public()).

function FincraCard() {
  const fincraSettings = useFincraSettings();
  const setFincraSettings = useSetFincraSettings();
  const [editing, setEditing] = useState(false);
  const [saving, setSaving] = useState(false);

  const form = useForm<FincraFormValues>({
    resolver: zodResolver(fincraSchema),
    defaultValues: { businessId: "", publicKey: "", secretKey: "", webhookSecret: "", isLive: false },
  });

  const onSubmit = async (values: FincraFormValues) => {
    setSaving(true);
    try {
      await setFincraSettings(values);
      toast.success("Fincra connected");
      form.reset();
      setEditing(false);
    } catch {
      toast.error("Failed to save Fincra credentials");
    } finally {
      setSaving(false);
    }
  };

  return (
    <Card className="mt-4">
      <CardHeader>
        <CardTitle className="font-sans text-lg flex items-center gap-2">
          <CreditCard className="size-4" /> Fincra Payments
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        {fincraSettings === undefined ? (
          <Skeleton className="h-24 w-full" />
        ) : fincraSettings?.connected && !editing ? (
          <>
            <div className="flex items-center gap-2 text-emerald-600 dark:text-emerald-400">
              <CheckCircle2 className="size-4" />
              <span className="text-sm font-body font-medium">Connected and accepting card payments</span>
            </div>
            <p className="text-xs text-muted-foreground font-body">
              Business ID: {fincraSettings.businessId} · Mode: {fincraSettings.isLive ? "Live" : "Sandbox"}
            </p>
            <Button size="sm" variant="secondary" onClick={() => setEditing(true)}>
              Update credentials
            </Button>
          </>
        ) : (
          <>
            <p className="text-sm text-muted-foreground font-body">
              Connect your own Fincra business account to accept card payments — sign up at fincra.com if
              you haven't already, then paste your credentials from the Fincra dashboard below.
            </p>
            <Form {...form}>
              <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-3">
                <FormField control={form.control} name="businessId" render={({ field }) => (
                  <FormItem>
                    <FormLabel className="text-xs">Business ID</FormLabel>
                    <FormControl><Input {...field} /></FormControl>
                    <FormMessage />
                  </FormItem>
                )} />
                <FormField control={form.control} name="publicKey" render={({ field }) => (
                  <FormItem>
                    <FormLabel className="text-xs">Public key</FormLabel>
                    <FormControl><Input {...field} /></FormControl>
                    <FormMessage />
                  </FormItem>
                )} />
                <FormField control={form.control} name="secretKey" render={({ field }) => (
                  <FormItem>
                    <FormLabel className="text-xs">Secret key</FormLabel>
                    <FormControl><Input type="password" {...field} /></FormControl>
                    <FormMessage />
                  </FormItem>
                )} />
                <FormField control={form.control} name="webhookSecret" render={({ field }) => (
                  <FormItem>
                    <FormLabel className="text-xs">Webhook secret</FormLabel>
                    <FormControl><Input type="password" {...field} /></FormControl>
                    <FormMessage />
                  </FormItem>
                )} />
                <FormField control={form.control} name="isLive" render={({ field }) => (
                  <FormItem className="flex flex-row items-center gap-2 space-y-0">
                    <FormControl>
                      <Checkbox checked={field.value} onCheckedChange={(v) => field.onChange(v === true)} />
                    </FormControl>
                    <FormLabel className="text-xs font-normal">Live mode (uncheck for sandbox/test keys)</FormLabel>
                  </FormItem>
                )} />
                <div className="flex gap-2">
                  <Button type="submit" size="sm" disabled={saving}>
                    {saving ? "Saving..." : "Save credentials"}
                  </Button>
                  {fincraSettings?.connected && (
                    <Button type="button" size="sm" variant="secondary" onClick={() => setEditing(false)}>
                      Cancel
                    </Button>
                  )}
                </div>
              </form>
            </Form>
          </>
        )}
      </CardContent>
    </Card>
  );
}
