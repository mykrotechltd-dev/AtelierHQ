import { useState } from "react";
import { useRecordPayout, useWorkers } from "@/lib/queries/workers.ts";
import { useOrders } from "@/lib/queries/orders.ts";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { toast } from "sonner";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog.tsx";
import { Button } from "@/components/ui/button.tsx";
import { Input } from "@/components/ui/input.tsx";
import { Textarea } from "@/components/ui/textarea.tsx";
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
  workerId: z.string().min(1, "Select a worker"),
  orderId: z.string().min(1, "Select an order"),
  amount: z.string().min(1, "Amount required"),
  notes: z.string().optional(),
});
type FormValues = z.infer<typeof schema>;

export default function PayoutDialog({
  open,
  onClose,
  preselectedWorkerId,
  preselectedOrderId,
}: {
  open: boolean;
  onClose: () => void;
  preselectedWorkerId?: string;
  preselectedOrderId?: string;
}) {
  const recordPayout = useRecordPayout();
  const workers = useWorkers();
  const { results: orders } = useOrders(undefined, 100);
  const [saving, setSaving] = useState(false);

  const form = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: {
      workerId: preselectedWorkerId ?? "",
      orderId: preselectedOrderId ?? "",
      amount: "",
      notes: "",
    },
  });

  const onSubmit = async (values: FormValues) => {
    setSaving(true);
    try {
      await recordPayout({
        orderId: values.orderId,
        workerId: values.workerId,
        amount: parseFloat(values.amount),
        notes: values.notes || undefined,
      });
      toast.success("Payout recorded");
      form.reset();
      onClose();
    } catch {
      toast.error("Failed to record payout");
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="max-w-sm">
        <DialogHeader>
          <DialogTitle className="font-sans">Record payout</DialogTitle>
        </DialogHeader>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
            <FormField
              control={form.control}
              name="orderId"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Order *</FormLabel>
                  <Select onValueChange={field.onChange} value={field.value}>
                    <FormControl>
                      <SelectTrigger>
                        <SelectValue placeholder="Select order" />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      {orders.map((o) => (
                        <SelectItem key={o.id} value={o.id}>
                          {o.orderNumber} — {o.customerName}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="workerId"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Worker *</FormLabel>
                  <Select onValueChange={field.onChange} value={field.value}>
                    <FormControl>
                      <SelectTrigger>
                        <SelectValue placeholder="Select worker" />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      {(workers ?? []).map((w) => (
                        <SelectItem key={w.id} value={w.id}>
                          {w.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="amount"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Amount *</FormLabel>
                  <FormControl>
                    <Input type="number" min="0" step="0.01" placeholder="0.00" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="notes"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Notes</FormLabel>
                  <FormControl>
                    <Textarea rows={2} placeholder="e.g. Week of 10 Jun payment" {...field} />
                  </FormControl>
                </FormItem>
              )}
            />
            <div className="flex justify-end gap-2 pt-1">
              <Button type="button" variant="secondary" onClick={onClose}>
                Cancel
              </Button>
              <Button type="submit" disabled={saving}>
                {saving ? "Saving..." : "Record payout"}
              </Button>
            </div>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
