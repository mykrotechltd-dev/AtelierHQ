import { useState } from "react";
import { useRecordPayment } from "@/lib/queries/payments.ts";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { toast } from "sonner";
import { format } from "date-fns";
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

const METHODS = [
  { value: "cash", label: "Cash" },
  { value: "bank_transfer", label: "Bank Transfer" },
  { value: "card", label: "Card" },
  { value: "other", label: "Other" },
] as const;

const schema = z.object({
  amount: z.string().min(1, "Amount is required"),
  method: z.enum(["cash", "bank_transfer", "card", "other"]),
  paidAt: z.string().min(1, "Date is required"),
  notes: z.string().optional(),
});
type FormValues = z.infer<typeof schema>;

export default function RecordPaymentDialog({
  open,
  onClose,
  orderId,
  orderNumber,
  outstanding,
}: {
  open: boolean;
  onClose: () => void;
  orderId: string;
  orderNumber: string;
  outstanding: number;
}) {
  const recordPayment = useRecordPayment();
  const [saving, setSaving] = useState(false);

  const form = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: {
      amount: outstanding > 0 ? outstanding.toFixed(2) : "",
      method: "cash",
      paidAt: format(new Date(), "yyyy-MM-dd"),
      notes: "",
    },
  });

  const onSubmit = async (values: FormValues) => {
    const amount = parseFloat(values.amount);
    if (isNaN(amount) || amount <= 0) {
      form.setError("amount", { message: "Enter a valid amount" });
      return;
    }
    setSaving(true);
    try {
      await recordPayment({
        orderId,
        amount,
        method: values.method,
        notes: values.notes || undefined,
        paidAt: new Date(values.paidAt).toISOString(),
      });
      toast.success("Payment recorded");
      form.reset();
      onClose();
    } catch (err) {
      const message = err instanceof Error ? err.message : "Failed to record payment";
      toast.error(message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="max-w-sm">
        <DialogHeader>
          <DialogTitle className="font-sans">Record payment</DialogTitle>
        </DialogHeader>

        {outstanding > 0 && (
          <div className="rounded-md bg-muted px-3 py-2 text-sm font-body text-muted-foreground -mt-1">
            Outstanding on <span className="font-medium text-foreground">{orderNumber}</span>:{" "}
            <span className="font-semibold text-foreground">
              {outstanding.toLocaleString(undefined, { minimumFractionDigits: 2 })}
            </span>
          </div>
        )}

        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
            <FormField
              control={form.control}
              name="amount"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Amount *</FormLabel>
                  <FormControl>
                    <Input type="number" min="0.01" step="0.01" placeholder="0.00" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="method"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Method *</FormLabel>
                  <Select onValueChange={field.onChange} value={field.value}>
                    <FormControl>
                      <SelectTrigger>
                        <SelectValue placeholder="Select method" />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      {METHODS.map((m) => (
                        <SelectItem key={m.value} value={m.value}>
                          {m.label}
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
              name="paidAt"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Date *</FormLabel>
                  <FormControl>
                    <Input type="date" {...field} />
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
                    <Textarea rows={2} placeholder="e.g. Deposit payment" {...field} />
                  </FormControl>
                </FormItem>
              )}
            />
            <div className="flex justify-end gap-2 pt-1">
              <Button type="button" variant="secondary" onClick={onClose}>
                Cancel
              </Button>
              <Button type="submit" disabled={saving}>
                {saving ? "Saving..." : "Record payment"}
              </Button>
            </div>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
