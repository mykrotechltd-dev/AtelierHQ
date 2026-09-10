import { useState } from "react";
import { useCreateTask, useWorkers } from "@/lib/queries/workers.ts";
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
  orderId: z.string().min(1, "Select an order"),
  workerId: z.string().min(1, "Select a worker"),
  description: z.string().min(1, "Description required"),
  dueDate: z.string().optional(),
  payout: z.string().optional(),
});
type FormValues = z.infer<typeof schema>;

export default function CreateTaskDialog({
  open,
  onClose,
  preselectedWorkerId,
}: {
  open: boolean;
  onClose: () => void;
  preselectedWorkerId?: string;
}) {
  const createTask = useCreateTask();
  const [saving, setSaving] = useState(false);

  const { results: ordersResult } = useOrders(undefined, 100);
  const workers = useWorkers();

  const orders = ordersResult.filter((o) => o.status !== "delivered");

  const form = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: {
      orderId: "",
      workerId: preselectedWorkerId ?? "",
      description: "",
      dueDate: "",
      payout: "",
    },
  });

  const onSubmit = async (values: FormValues) => {
    setSaving(true);
    try {
      await createTask({
        orderId: values.orderId,
        workerId: values.workerId,
        description: values.description,
        dueDate: values.dueDate || undefined,
        payout: values.payout ? parseFloat(values.payout) : undefined,
      });
      toast.success("Task created");
      form.reset();
      onClose();
    } catch {
      toast.error("Failed to create task");
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="font-sans">New task</DialogTitle>
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
                      {(workers ?? [])
                        .filter((w) => w.isActive)
                        .map((w) => (
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
              name="description"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Description *</FormLabel>
                  <FormControl>
                    <Textarea
                      rows={2}
                      placeholder="e.g. Sew the jacket lining for ORD-0001"
                      {...field}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <div className="grid grid-cols-2 gap-3">
              <FormField
                control={form.control}
                name="dueDate"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Due date</FormLabel>
                    <FormControl>
                      <Input type="date" {...field} />
                    </FormControl>
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="payout"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Payout amount</FormLabel>
                    <FormControl>
                      <Input
                        type="number"
                        min="0"
                        step="0.01"
                        placeholder="0.00"
                        {...field}
                      />
                    </FormControl>
                  </FormItem>
                )}
              />
            </div>
            <div className="flex justify-end gap-2 pt-1">
              <Button type="button" variant="secondary" onClick={onClose}>
                Cancel
              </Button>
              <Button type="submit" disabled={saving}>
                {saving ? "Creating..." : "Create task"}
              </Button>
            </div>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
