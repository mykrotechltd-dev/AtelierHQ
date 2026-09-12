import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { toast } from "sonner";
import { useAdminSetTenantSubscription } from "@/lib/queries/admin.ts";
import type { AdminTenantRow } from "@/lib/supabase/admin-types.ts";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog.tsx";
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

const schema = z.object({
  status: z.enum(["trialing", "active", "past_due", "canceled"]),
  periodEnd: z.string().optional(),
});
type FormValues = z.infer<typeof schema>;

/** Manual override for the manual-renewal billing model — a shop pays by
 *  bank transfer, or a payment needs comping. Audited server-side the same
 *  as every other admin action (admin_set_tenant_subscription logs to
 *  admin_access_log). */
export default function OverrideSubscriptionDialog({
  tenant,
  onClose,
}: {
  tenant: AdminTenantRow | null;
  onClose: () => void;
}) {
  const setSubscription = useAdminSetTenantSubscription();
  const [saving, setSaving] = useState(false);

  const form = useForm<FormValues>({
    resolver: zodResolver(schema),
    values: {
      status: tenant?.subscriptionStatus ?? "trialing",
      periodEnd: tenant?.currentPeriodEnd?.slice(0, 10) ?? "",
    },
  });

  const onSubmit = async (values: FormValues) => {
    if (!tenant) return;
    setSaving(true);
    try {
      await setSubscription({
        tenantId: tenant.id,
        status: values.status,
        periodEnd: values.periodEnd ? `${values.periodEnd}T23:59:59Z` : null,
      });
      toast.success(`Updated ${tenant.name}'s subscription`);
      onClose();
    } catch {
      toast.error("Failed to update subscription");
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={!!tenant} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="max-w-sm">
        <DialogHeader>
          <DialogTitle className="font-sans">
            Override subscription — {tenant?.name}
          </DialogTitle>
        </DialogHeader>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
            <FormField
              control={form.control}
              name="status"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Status</FormLabel>
                  <Select onValueChange={field.onChange} value={field.value}>
                    <FormControl>
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      <SelectItem value="trialing">Trialing</SelectItem>
                      <SelectItem value="active">Active</SelectItem>
                      <SelectItem value="past_due">Past due</SelectItem>
                      <SelectItem value="canceled">Canceled</SelectItem>
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="periodEnd"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Paid through (optional)</FormLabel>
                  <FormControl>
                    <Input type="date" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <div className="flex justify-end gap-2 pt-1">
              <Button type="button" variant="secondary" onClick={onClose}>
                Cancel
              </Button>
              <Button type="submit" disabled={saving}>
                {saving ? "Saving..." : "Save"}
              </Button>
            </div>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
