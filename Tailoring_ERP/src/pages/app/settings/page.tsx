import { useState } from "react";
import { useMyTenant, useUpdateTenant } from "@/lib/queries/tenants.ts";
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
    </div>
  );
}
