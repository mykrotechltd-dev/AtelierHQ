import { useState } from "react";
import { useCreateOrder } from "@/lib/queries/orders.ts";
import { useCustomers } from "@/lib/queries/customers.ts";
import { useNavigate } from "react-router-dom";
import { useForm, useFieldArray } from "react-hook-form";
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
import { Separator } from "@/components/ui/separator.tsx";
import { Plus, Trash2 } from "lucide-react";

const itemSchema = z.object({
  description: z.string().min(1, "Description required"),
  garmentType: z.string().optional(),
  fabric: z.string().optional(),
  quantity: z.string().min(1),
  unitPrice: z.string().min(1),
  notes: z.string().optional(),
});

const schema = z.object({
  customerId: z.string().min(1, "Select a customer"),
  dueDate: z.string().optional(),
  notes: z.string().optional(),
  items: z.array(itemSchema).min(1, "Add at least one item"),
});

type FormValues = z.infer<typeof schema>;

export default function CreateOrderDialog({
  open,
  onClose,
}: {
  open: boolean;
  onClose: () => void;
}) {
  const navigate = useNavigate();
  const createOrder = useCreateOrder();
  const [saving, setSaving] = useState(false);

  // Load customers for selector
  const { results: customers } = useCustomers(undefined, 100);

  const form = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: {
      customerId: "",
      dueDate: "",
      notes: "",
      items: [{ description: "", garmentType: "", fabric: "", quantity: "1", unitPrice: "", notes: "" }],
    },
  });

  const { fields, append, remove } = useFieldArray({
    control: form.control,
    name: "items",
  });

  const watchItems = form.watch("items");
  const total = watchItems.reduce((sum, item) => {
    const qty = parseFloat(item.quantity) || 0;
    const price = parseFloat(item.unitPrice) || 0;
    return sum + qty * price;
  }, 0);

  const onSubmit = async (values: FormValues) => {
    setSaving(true);
    try {
      const orderId = await createOrder({
        customerId: values.customerId,
        dueDate: values.dueDate || undefined,
        notes: values.notes || undefined,
        items: values.items.map((i) => ({
          description: i.description,
          garmentType: i.garmentType || undefined,
          fabric: i.fabric || undefined,
          quantity: parseFloat(i.quantity),
          unitPrice: parseFloat(i.unitPrice),
          notes: i.notes || undefined,
        })),
      });
      toast.success("Order created");
      form.reset();
      onClose();
      navigate(`/orders/${orderId}`);
    } catch {
      toast.error("Failed to create order");
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="font-sans">New order</DialogTitle>
        </DialogHeader>

        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-5">
            {/* Customer + due date */}
            <div className="grid grid-cols-2 gap-4">
              <FormField
                control={form.control}
                name="customerId"
                render={({ field }) => (
                  <FormItem className="col-span-2 sm:col-span-1">
                    <FormLabel>Customer *</FormLabel>
                    <Select onValueChange={field.onChange} value={field.value}>
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue placeholder="Select customer" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        {customers.map((c) => (
                          <SelectItem key={c.id} value={c.id}>
                            {c.name}
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
                name="dueDate"
                render={({ field }) => (
                  <FormItem className="col-span-2 sm:col-span-1">
                    <FormLabel>Due date</FormLabel>
                    <FormControl>
                      <Input type="date" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            <FormField
              control={form.control}
              name="notes"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Order notes</FormLabel>
                  <FormControl>
                    <Textarea rows={2} placeholder="Any special instructions..." {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <Separator />

            {/* Items */}
            <div>
              <div className="flex items-center justify-between mb-3">
                <p className="font-body text-sm font-medium">Items</p>
                <Button
                  type="button"
                  size="sm"
                  variant="secondary"
                  onClick={() =>
                    append({
                      description: "",
                      garmentType: "",
                      fabric: "",
                      quantity: "1",
                      unitPrice: "",
                      notes: "",
                    })
                  }
                >
                  <Plus className="size-3.5 mr-1" /> Add item
                </Button>
              </div>

              <div className="space-y-4">
                {fields.map((field, index) => (
                  <div key={field.id} className="rounded-lg border border-border p-4 space-y-3">
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-body text-muted-foreground">
                        Item {index + 1}
                      </span>
                      {fields.length > 1 && (
                        <button
                          type="button"
                          onClick={() => remove(index)}
                          className="text-destructive hover:text-destructive/80 cursor-pointer"
                        >
                          <Trash2 className="size-4" />
                        </button>
                      )}
                    </div>

                    <FormField
                      control={form.control}
                      name={`items.${index}.description`}
                      render={({ field: f }) => (
                        <FormItem>
                          <FormLabel className="text-xs">Description *</FormLabel>
                          <FormControl>
                            <Input placeholder="e.g. Ankara Senator suit" {...f} />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />

                    <div className="grid grid-cols-2 gap-3">
                      <FormField
                        control={form.control}
                        name={`items.${index}.garmentType`}
                        render={({ field: f }) => (
                          <FormItem>
                            <FormLabel className="text-xs">Garment type</FormLabel>
                            <FormControl>
                              <Input placeholder="e.g. Suit, Dress" {...f} />
                            </FormControl>
                          </FormItem>
                        )}
                      />
                      <FormField
                        control={form.control}
                        name={`items.${index}.fabric`}
                        render={({ field: f }) => (
                          <FormItem>
                            <FormLabel className="text-xs">Fabric</FormLabel>
                            <FormControl>
                              <Input placeholder="e.g. Ankara, Silk" {...f} />
                            </FormControl>
                          </FormItem>
                        )}
                      />
                      <FormField
                        control={form.control}
                        name={`items.${index}.quantity`}
                        render={({ field: f }) => (
                          <FormItem>
                            <FormLabel className="text-xs">Qty *</FormLabel>
                            <FormControl>
                              <Input type="number" min="1" step="1" {...f} />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                      <FormField
                        control={form.control}
                        name={`items.${index}.unitPrice`}
                        render={({ field: f }) => (
                          <FormItem>
                            <FormLabel className="text-xs">Unit price *</FormLabel>
                            <FormControl>
                              <Input type="number" min="0" step="0.01" placeholder="0.00" {...f} />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                    </div>

                    <FormField
                      control={form.control}
                      name={`items.${index}.notes`}
                      render={({ field: f }) => (
                        <FormItem>
                          <FormLabel className="text-xs">Item notes</FormLabel>
                          <FormControl>
                            <Input placeholder="Special instructions..." {...f} />
                          </FormControl>
                        </FormItem>
                      )}
                    />
                  </div>
                ))}
              </div>

              {form.formState.errors.items?.root && (
                <p className="text-sm text-destructive mt-1 font-body">
                  {form.formState.errors.items.root.message}
                </p>
              )}
            </div>

            {/* Total */}
            <div className="flex justify-end">
              <div className="bg-muted rounded-lg px-4 py-2 text-right">
                <p className="text-xs text-muted-foreground font-body">Total</p>
                <p className="font-sans text-lg font-semibold">
                  {total.toLocaleString(undefined, { minimumFractionDigits: 2 })}
                </p>
              </div>
            </div>

            <div className="flex justify-end gap-2 pt-2">
              <Button type="button" variant="secondary" onClick={onClose}>
                Cancel
              </Button>
              <Button type="submit" disabled={saving}>
                {saving ? "Creating..." : "Create order"}
              </Button>
            </div>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
