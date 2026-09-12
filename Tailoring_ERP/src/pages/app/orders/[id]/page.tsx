import { useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import {
  useOrder,
  useAddOrderItem,
  useUpdateOrderItem,
  useUpdateOrder,
  useAdvanceOrderStatus,
  useDeleteOrderItem,
  useDeleteOrder,
  useAddMaterial,
  useUpdateMaterial,
  useDeleteMaterial,
  type OrderItemWithMaterials,
} from "@/lib/queries/orders.ts";
import {
  usePaymentsByOrder,
  useDeletePayment,
} from "@/lib/queries/payments.ts";
import { useOrderPaymentTrail } from "@/lib/queries/workers.ts";
import type { Order, Measurements } from "@/lib/supabase/types.ts";
import {
  GARMENT_TYPES,
  MEASUREMENT_LABELS,
  measurementSpecForGarment,
  type MeasurementField,
} from "@/lib/garment-types.ts";
import { toast } from "sonner";
import { format, parseISO } from "date-fns";
import PageHeader from "@/components/page-header.tsx";
import { Button } from "@/components/ui/button.tsx";
import { Skeleton } from "@/components/ui/skeleton.tsx";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card.tsx";
import RecordPaymentDialog from "../../payments/_components/record-payment-dialog.tsx";
import PayoutDialog from "../../workers/_components/payout-dialog.tsx";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog.tsx";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog.tsx";
import {
  Form,
  FormField,
  FormItem,
  FormLabel,
  FormControl,
  FormMessage,
} from "@/components/ui/form.tsx";
import { Input } from "@/components/ui/input.tsx";
import { Textarea } from "@/components/ui/textarea.tsx";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select.tsx";
import { StatusBadge } from "../_components/status-badge.tsx";
import { STATUS_CONFIG, type OrderStatus } from "@/lib/order-status.ts";
import {
  ArrowLeft,
  ArrowRight,
  Pencil,
  Trash2,
  Plus,
  User,
  CalendarDays,
  FileText,
  CreditCard,
  CheckCircle2,
  Banknote,
  AlertTriangle,
} from "lucide-react";
import InvoiceActions from "../_components/invoice-actions.tsx";
import { useForm, useWatch } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";

// ---- Item form ----
const itemSchema = z.object({
  description: z.string().min(1, "Required"),
  garmentType: z.string().optional(),
  fabric: z.string().optional(),
  quantity: z.string().min(1),
  unitPrice: z.string().min(1),
  notes: z.string().optional(),
});
type ItemFormValues = z.infer<typeof itemSchema>;

interface MaterialLine {
  id?: string; // absent = not yet saved
  name: string;
  quantity: string;
  unitPrice: string;
}

function ItemDialog({
  open,
  onClose,
  orderId,
  item,
  customerMeasurements,
}: {
  open: boolean;
  onClose: () => void;
  orderId: string;
  item?: OrderItemWithMaterials;
  customerMeasurements: Measurements | null;
}) {
  const addItem = useAddOrderItem();
  const updateItem = useUpdateOrderItem();
  const addMaterial = useAddMaterial();
  const updateMaterial = useUpdateMaterial();
  const deleteMaterial = useDeleteMaterial();
  const [saving, setSaving] = useState(false);
  const [measurements, setMeasurements] = useState<Partial<Measurements>>(
    item?.measurements ?? {},
  );
  const [materials, setMaterials] = useState<MaterialLine[]>(
    item?.materials.map((m) => ({
      id: m.id,
      name: m.name,
      quantity: String(m.quantity),
      unitPrice: String(m.unitPrice),
    })) ?? [],
  );
  const [removedMaterialIds, setRemovedMaterialIds] = useState<string[]>([]);

  const form = useForm<ItemFormValues>({
    resolver: zodResolver(itemSchema),
    defaultValues: {
      description: item?.description ?? "",
      garmentType: item?.garmentType ?? "",
      fabric: item?.fabric ?? "",
      quantity: item?.quantity?.toString() ?? "1",
      unitPrice: item?.unitPrice?.toString() ?? "",
      notes: item?.notes ?? "",
    },
  });

  const garmentType = useWatch({ control: form.control, name: "garmentType" });
  const spec = measurementSpecForGarment(garmentType);
  const fields = spec ? [...spec.required, ...spec.optional] : [];

  // Pre-fill from the customer's profile only for a brand-new item that has
  // no measurements of its own yet — never overwrites an existing snapshot.
  const handleGarmentTypeChange = (value: string) => {
    form.setValue("garmentType", value);
    if (!item && customerMeasurements) {
      const nextSpec = measurementSpecForGarment(value);
      if (nextSpec) {
        const prefill: Partial<Measurements> = { ...measurements };
        for (const f of [...nextSpec.required, ...nextSpec.optional]) {
          if (
            prefill[f] === undefined &&
            customerMeasurements[f] !== undefined
          ) {
            prefill[f] = customerMeasurements[f];
          }
        }
        setMeasurements(prefill);
      }
    }
  };

  const missingRequired =
    spec?.required.filter((f) => measurements[f] === undefined) ?? [];

  const addMaterialLine = () =>
    setMaterials((prev) => [
      ...prev,
      { name: "", quantity: "1", unitPrice: "" },
    ]);
  const updateMaterialLine = (index: number, patch: Partial<MaterialLine>) =>
    setMaterials((prev) =>
      prev.map((m, i) => (i === index ? { ...m, ...patch } : m)),
    );
  const removeMaterialLine = (index: number) => {
    const line = materials[index];
    if (line.id) setRemovedMaterialIds((prev) => [...prev, line.id!]);
    setMaterials((prev) => prev.filter((_, i) => i !== index));
  };
  const materialLineTotal = (m: MaterialLine) =>
    (parseFloat(m.quantity) || 0) * (parseFloat(m.unitPrice) || 0);
  const materialsSubtotal = materials.reduce(
    (sum, m) => sum + materialLineTotal(m),
    0,
  );

  const onSubmit = async (values: ItemFormValues) => {
    setSaving(true);
    try {
      const measurementsPayload =
        Object.keys(measurements).length > 0
          ? (measurements as Measurements)
          : undefined;
      const payload = {
        description: values.description,
        garmentType: values.garmentType || undefined,
        fabric: values.fabric || undefined,
        quantity: parseFloat(values.quantity),
        unitPrice: parseFloat(values.unitPrice),
        notes: values.notes || undefined,
        measurements: measurementsPayload,
      };

      let itemId: string;
      if (item) {
        await updateItem({ id: item.id, ...payload });
        itemId = item.id;
        toast.success("Item updated");
      } else {
        itemId = await addItem({ orderId, ...payload });
        toast.success("Item added");
      }

      for (const removedId of removedMaterialIds) {
        await deleteMaterial({ id: removedId, orderId });
      }
      for (const line of materials) {
        if (!line.name.trim()) continue;
        const materialPayload = {
          name: line.name,
          quantity: parseFloat(line.quantity) || 0,
          unitPrice: parseFloat(line.unitPrice) || 0,
        };
        if (line.id) {
          await updateMaterial({ id: line.id, orderId, ...materialPayload });
        } else {
          await addMaterial({
            orderId,
            orderItemId: itemId,
            ...materialPayload,
          });
        }
      }

      form.reset();
      onClose();
    } catch {
      toast.error("Failed to save item");
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="max-w-md max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="font-sans">
            {item ? "Edit item" : "Add item"}
          </DialogTitle>
        </DialogHeader>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
            <FormField
              control={form.control}
              name="description"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Description *</FormLabel>
                  <FormControl>
                    <Input placeholder="e.g. Ankara Senator suit" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <div className="grid grid-cols-2 gap-3">
              <FormField
                control={form.control}
                name="garmentType"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel className="text-xs">Garment type</FormLabel>
                    <Select
                      onValueChange={handleGarmentTypeChange}
                      value={field.value}
                    >
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue placeholder="Select type" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        {GARMENT_TYPES.map((t) => (
                          <SelectItem key={t} value={t}>
                            {t}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="fabric"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel className="text-xs">Fabric</FormLabel>
                    <FormControl>
                      <Input placeholder="Ankara, Silk…" {...field} />
                    </FormControl>
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="quantity"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel className="text-xs">Qty *</FormLabel>
                    <FormControl>
                      <Input type="number" min="1" step="1" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="unitPrice"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel className="text-xs">Unit price *</FormLabel>
                    <FormControl>
                      <Input
                        type="number"
                        min="0"
                        step="0.01"
                        placeholder="0.00"
                        {...field}
                      />
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
                  <FormLabel>Notes</FormLabel>
                  <FormControl>
                    <Input placeholder="Special instructions…" {...field} />
                  </FormControl>
                </FormItem>
              )}
            />

            {/* Measurements — frozen snapshot for this garment */}
            {fields.length > 0 && (
              <div className="space-y-2 rounded-md border border-border p-3">
                <p className="text-xs font-body font-medium text-muted-foreground uppercase tracking-wide">
                  Measurements (
                  {item
                    ? "saved with this item"
                    : "from customer profile — editable"}
                  )
                </p>
                <div className="grid grid-cols-2 gap-2">
                  {fields.map((f) => (
                    <div key={f}>
                      <label className="text-xs font-body text-muted-foreground">
                        {MEASUREMENT_LABELS[f]}
                        {spec?.required.includes(f) ? " *" : ""}
                      </label>
                      <Input
                        type="number"
                        min={0}
                        step="0.1"
                        placeholder="—"
                        value={measurements[f]?.toString() ?? ""}
                        onChange={(e) => {
                          const v = e.target.value;
                          setMeasurements((prev) => ({
                            ...prev,
                            [f]: v === "" ? undefined : parseFloat(v),
                          }));
                        }}
                      />
                    </div>
                  ))}
                </div>
                {missingRequired.length > 0 && (
                  <p className="flex items-center gap-1 text-xs text-warning font-body">
                    <AlertTriangle className="size-3.5" />
                    Missing:{" "}
                    {missingRequired
                      .map((f) => MEASUREMENT_LABELS[f])
                      .join(", ")}
                  </p>
                )}
              </div>
            )}

            {/* Bill of materials */}
            <div className="space-y-2 rounded-md border border-border p-3">
              <div className="flex items-center justify-between">
                <p className="text-xs font-body font-medium text-muted-foreground uppercase tracking-wide">
                  Materials
                </p>
                <Button
                  type="button"
                  size="sm"
                  variant="secondary"
                  onClick={addMaterialLine}
                >
                  <Plus className="size-3 mr-1" /> Add material
                </Button>
              </div>
              {materials.length === 0 ? (
                <p className="text-xs text-muted-foreground font-body">
                  No materials added.
                </p>
              ) : (
                <div className="space-y-1.5">
                  {materials.map((m, i) => (
                    <div
                      key={m.id ?? `new-${i}`}
                      className="grid grid-cols-[1fr_60px_80px_auto] gap-1.5 items-center"
                    >
                      <Input
                        placeholder="Buttons, lining…"
                        value={m.name}
                        onChange={(e) =>
                          updateMaterialLine(i, { name: e.target.value })
                        }
                      />
                      <Input
                        type="number"
                        min="0"
                        step="0.01"
                        placeholder="Qty"
                        value={m.quantity}
                        onChange={(e) =>
                          updateMaterialLine(i, { quantity: e.target.value })
                        }
                      />
                      <Input
                        type="number"
                        min="0"
                        step="0.01"
                        placeholder="Price"
                        value={m.unitPrice}
                        onChange={(e) =>
                          updateMaterialLine(i, { unitPrice: e.target.value })
                        }
                      />
                      <button
                        type="button"
                        onClick={() => removeMaterialLine(i)}
                        aria-label="Remove material line"
                        className="text-destructive hover:text-destructive/80 cursor-pointer justify-self-center"
                      >
                        <Trash2 className="size-3.5" />
                      </button>
                    </div>
                  ))}
                  <div className="flex justify-end pt-1">
                    <span className="text-xs font-body text-muted-foreground">
                      Materials subtotal:{" "}
                      <span className="font-medium text-foreground">
                        {materialsSubtotal.toLocaleString(undefined, {
                          minimumFractionDigits: 2,
                        })}
                      </span>
                    </span>
                  </div>
                </div>
              )}
            </div>

            <div className="flex justify-end gap-2 pt-1">
              <Button type="button" variant="secondary" onClick={onClose}>
                Cancel
              </Button>
              <Button type="submit" disabled={saving}>
                {saving ? "Saving…" : item ? "Save changes" : "Add item"}
              </Button>
            </div>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}

// ---- Edit order meta dialog ----
const editSchema = z.object({
  dueDate: z.string().optional(),
  notes: z.string().optional(),
});
type EditFormValues = z.infer<typeof editSchema>;

function EditOrderDialog({
  open,
  onClose,
  order,
}: {
  open: boolean;
  onClose: () => void;
  order: Order;
}) {
  const updateOrder = useUpdateOrder();
  const [saving, setSaving] = useState(false);
  const form = useForm<EditFormValues>({
    resolver: zodResolver(editSchema),
    defaultValues: { dueDate: order.dueDate ?? "", notes: order.notes ?? "" },
  });

  const onSubmit = async (values: EditFormValues) => {
    setSaving(true);
    try {
      await updateOrder({
        id: order.id,
        dueDate: values.dueDate || undefined,
        notes: values.notes || undefined,
      });
      toast.success("Order updated");
      onClose();
    } catch {
      toast.error("Failed to update order");
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="max-w-sm">
        <DialogHeader>
          <DialogTitle className="font-sans">Edit order</DialogTitle>
        </DialogHeader>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
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
              name="notes"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Notes</FormLabel>
                  <FormControl>
                    <Textarea rows={3} {...field} />
                  </FormControl>
                </FormItem>
              )}
            />
            <div className="flex justify-end gap-2">
              <Button type="button" variant="secondary" onClick={onClose}>
                Cancel
              </Button>
              <Button type="submit" disabled={saving}>
                {saving ? "Saving…" : "Save"}
              </Button>
            </div>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}

// ---- Main page ----
export default function OrderDetailPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [itemDialogOpen, setItemDialogOpen] = useState(false);
  const [editingItem, setEditingItem] = useState<
    OrderItemWithMaterials | undefined
  >(undefined);
  const [editOrderOpen, setEditOrderOpen] = useState(false);
  const [paymentDialogOpen, setPaymentDialogOpen] = useState(false);
  const [payoutDialogOpen, setPayoutDialogOpen] = useState(false);

  const advanceStatus = useAdvanceOrderStatus();
  const deleteItem = useDeleteOrderItem();
  const deleteOrder = useDeleteOrder();

  const order = useOrder(id);
  const paymentSummary = usePaymentsByOrder(id);
  const deletePayment = useDeletePayment();
  const paymentTrail = useOrderPaymentTrail(id);

  const handleAdvance = async () => {
    if (!id) return;
    try {
      await advanceStatus({ id });
      toast.success("Status updated");
    } catch {
      toast.error("Could not update status");
    }
  };

  const handleDeleteItem = async (itemId: string) => {
    try {
      await deleteItem({ id: itemId });
      toast.success("Item removed");
    } catch {
      toast.error("Failed to remove item");
    }
  };

  const handleDeleteOrder = async () => {
    if (!id) return;
    try {
      await deleteOrder({ id });
      toast.success("Order deleted");
      navigate("/orders", { replace: true });
    } catch {
      toast.error("Failed to delete order");
    }
  };

  if (!order) {
    return (
      <div className="p-6 max-w-3xl mx-auto space-y-4">
        <Skeleton className="h-8 w-48" />
        <Skeleton className="h-32 w-full" />
        <Skeleton className="h-48 w-full" />
      </div>
    );
  }

  const statusCfg = STATUS_CONFIG[order.status as OrderStatus];

  return (
    <div className="p-6 max-w-3xl mx-auto">
      <button
        onClick={() => navigate("/orders")}
        className="flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground mb-4 font-body cursor-pointer"
      >
        <ArrowLeft className="size-4" /> All orders
      </button>

      <PageHeader title={order.orderNumber}>
        <InvoiceActions orderId={id as string} />
        <Button
          size="sm"
          variant="secondary"
          onClick={() => setEditOrderOpen(true)}
        >
          <Pencil className="size-3.5 mr-1" /> Edit
        </Button>
        {statusCfg.nextLabel && (
          <Button size="sm" onClick={handleAdvance}>
            {statusCfg.nextLabel} <ArrowRight className="size-3.5 ml-1" />
          </Button>
        )}
        <AlertDialog>
          <AlertDialogTrigger asChild>
            <Button size="sm" variant="destructive">
              <Trash2 className="size-3.5 mr-1" /> Delete
            </Button>
          </AlertDialogTrigger>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>
                Delete order {order.orderNumber}?
              </AlertDialogTitle>
              <AlertDialogDescription>
                This permanently deletes the order and all its items. This
                cannot be undone.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>Cancel</AlertDialogCancel>
              <AlertDialogAction
                onClick={handleDeleteOrder}
                className="bg-destructive text-white hover:bg-destructive/90"
              >
                Delete
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </PageHeader>

      {/* Status + meta */}
      <Card className="mb-4">
        <CardContent className="pt-4">
          <div className="flex flex-wrap gap-4 items-start">
            <div>
              <p className="text-xs text-muted-foreground font-body mb-1">
                Status
              </p>
              <StatusBadge status={order.status} />
            </div>
            {order.customer && (
              <div>
                <p className="text-xs text-muted-foreground font-body mb-1">
                  Customer
                </p>
                <button
                  onClick={() => navigate(`/customers/${order.customer!.id}`)}
                  className="flex items-center gap-1 text-sm font-body text-primary hover:underline cursor-pointer"
                >
                  <User className="size-3.5" /> {order.customer.name}
                </button>
              </div>
            )}
            {order.dueDate && (
              <div>
                <p className="text-xs text-muted-foreground font-body mb-1">
                  Due
                </p>
                <span className="flex items-center gap-1 text-sm font-body">
                  <CalendarDays className="size-3.5 text-muted-foreground" />
                  {format(parseISO(order.dueDate), "dd MMM yyyy")}
                </span>
              </div>
            )}
            <div>
              <p className="text-xs text-muted-foreground font-body mb-1">
                Total
              </p>
              <span className="font-sans font-semibold text-base">
                {order.totalAmount.toLocaleString(undefined, {
                  minimumFractionDigits: 2,
                })}
              </span>
            </div>
          </div>
          {order.notes && (
            <div className="flex items-start gap-2 mt-3 pt-3 border-t border-border">
              <FileText className="size-4 text-muted-foreground mt-0.5 shrink-0" />
              <p className="text-sm text-muted-foreground font-body">
                {order.notes}
              </p>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Items */}
      <Card>
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <CardTitle className="font-sans text-sm text-muted-foreground uppercase tracking-wide">
              Items ({order.items.length})
            </CardTitle>
            <Button
              size="sm"
              variant="secondary"
              onClick={() => {
                setEditingItem(undefined);
                setItemDialogOpen(true);
              }}
            >
              <Plus className="size-3.5 mr-1" /> Add item
            </Button>
          </div>
        </CardHeader>
        <CardContent className="space-y-2">
          {order.items.length === 0 ? (
            <p className="text-sm text-muted-foreground font-body">
              No items yet — add one above.
            </p>
          ) : (
            order.items.map((item) => (
              <div
                key={item.id}
                className="flex items-start justify-between gap-3 rounded-md border border-border px-3 py-2.5"
              >
                <div className="min-w-0 flex-1">
                  <p className="font-body text-sm font-medium text-foreground truncate">
                    {item.description}
                  </p>
                  <div className="flex flex-wrap gap-x-3 mt-0.5">
                    {item.garmentType && (
                      <span className="text-xs text-muted-foreground font-body">
                        {item.garmentType}
                      </span>
                    )}
                    {item.fabric && (
                      <span className="text-xs text-muted-foreground font-body">
                        {item.fabric}
                      </span>
                    )}
                    <span className="text-xs text-muted-foreground font-body">
                      Qty: {item.quantity} ×{" "}
                      {item.unitPrice.toLocaleString(undefined, {
                        minimumFractionDigits: 2,
                      })}
                    </span>
                    {item.materialCostTotal > 0 && (
                      <span className="text-xs text-muted-foreground font-body">
                        Materials:{" "}
                        {item.materialCostTotal.toLocaleString(undefined, {
                          minimumFractionDigits: 2,
                        })}
                      </span>
                    )}
                  </div>
                  {item.notes && (
                    <p className="text-xs text-muted-foreground font-body mt-0.5 italic">
                      {item.notes}
                    </p>
                  )}
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  <span className="font-sans font-semibold text-sm">
                    {(item.quantity * item.unitPrice).toLocaleString(
                      undefined,
                      { minimumFractionDigits: 2 },
                    )}
                  </span>
                  <button
                    onClick={() => {
                      setEditingItem(item);
                      setItemDialogOpen(true);
                    }}
                    aria-label={`Edit ${item.description}`}
                    className="text-muted-foreground hover:text-foreground cursor-pointer"
                  >
                    <Pencil className="size-3.5" />
                  </button>
                  <AlertDialog>
                    <AlertDialogTrigger asChild>
                      <button
                        aria-label={`Remove ${item.description}`}
                        className="text-destructive hover:text-destructive/80 cursor-pointer"
                      >
                        <Trash2 className="size-3.5" />
                      </button>
                    </AlertDialogTrigger>
                    <AlertDialogContent>
                      <AlertDialogHeader>
                        <AlertDialogTitle>Remove item?</AlertDialogTitle>
                        <AlertDialogDescription>
                          Remove &quot;{item.description}&quot; from this order?
                        </AlertDialogDescription>
                      </AlertDialogHeader>
                      <AlertDialogFooter>
                        <AlertDialogCancel>Cancel</AlertDialogCancel>
                        <AlertDialogAction
                          onClick={() => handleDeleteItem(item.id)}
                          className="bg-destructive text-white hover:bg-destructive/90"
                        >
                          Remove
                        </AlertDialogAction>
                      </AlertDialogFooter>
                    </AlertDialogContent>
                  </AlertDialog>
                </div>
              </div>
            ))
          )}

          {/* Total row */}
          {order.items.length > 0 && (
            <div className="flex justify-end pt-2 border-t border-border">
              <div className="text-right">
                <p className="text-xs text-muted-foreground font-body">
                  Order total
                </p>
                <p className="font-sans font-bold text-lg">
                  {order.totalAmount.toLocaleString(undefined, {
                    minimumFractionDigits: 2,
                  })}
                </p>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Job Costing — internal margin, never shown to or derived from the customer balance */}
      <Card className="mt-4">
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <CardTitle className="font-sans text-sm text-muted-foreground uppercase tracking-wide">
              Job Costing
            </CardTitle>
            <Button
              size="sm"
              variant="secondary"
              onClick={() => setPayoutDialogOpen(true)}
            >
              <Banknote className="size-3.5 mr-1" /> Record worker payment
            </Button>
          </div>
        </CardHeader>
        <CardContent className="space-y-3">
          {paymentTrail === undefined ? (
            <Skeleton className="h-16 w-full" />
          ) : (
            (() => {
              const jobCostTotal = paymentTrail.reduce(
                (sum, p) => sum + p.amount,
                0,
              );
              const materialCostTotal = order.materialCostTotal;
              const jobMargin =
                order.totalAmount - jobCostTotal - materialCostTotal;
              return (
                <>
                  <div className="flex flex-wrap gap-4 rounded-md bg-muted px-4 py-3">
                    <div>
                      <p className="text-xs font-body text-muted-foreground">
                        Job cost (worker payments)
                      </p>
                      <p className="font-sans font-semibold text-sm">
                        {jobCostTotal.toLocaleString(undefined, {
                          minimumFractionDigits: 2,
                        })}
                      </p>
                    </div>
                    <div>
                      <p className="text-xs font-body text-muted-foreground">
                        Material cost
                      </p>
                      <p className="font-sans font-semibold text-sm">
                        {materialCostTotal.toLocaleString(undefined, {
                          minimumFractionDigits: 2,
                        })}
                      </p>
                    </div>
                    <div>
                      <p className="text-xs font-body text-muted-foreground">
                        Job margin
                      </p>
                      <p
                        className={`font-sans font-semibold text-sm ${jobMargin < 0 ? "text-destructive" : "text-success"}`}
                      >
                        {jobMargin.toLocaleString(undefined, {
                          minimumFractionDigits: 2,
                        })}
                      </p>
                    </div>
                  </div>

                  {/* Payment trail */}
                  {paymentTrail.length === 0 ? (
                    <p className="text-sm text-muted-foreground font-body">
                      No worker payments recorded against this order yet.
                    </p>
                  ) : (
                    <div className="space-y-1.5">
                      {paymentTrail.map((p) => (
                        <div
                          key={p.id}
                          className="flex items-center justify-between gap-3 rounded-md border border-border px-3 py-2"
                        >
                          <div className="flex items-center gap-3">
                            <span className="text-xs font-body text-muted-foreground">
                              {format(parseISO(p.paidAt), "dd MMM yyyy")}
                            </span>
                            <span className="text-xs font-body font-medium">
                              {p.workerName}
                            </span>
                            {p.notes && (
                              <span className="text-xs font-body text-muted-foreground italic truncate max-w-[180px]">
                                {p.notes}
                              </span>
                            )}
                          </div>
                          <span className="font-sans font-semibold text-sm">
                            {p.amount.toLocaleString(undefined, {
                              minimumFractionDigits: 2,
                            })}
                          </span>
                        </div>
                      ))}
                    </div>
                  )}
                </>
              );
            })()
          )}
        </CardContent>
      </Card>

      {/* Payments & Balance */}
      <Card className="mt-4">
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <CardTitle className="font-sans text-sm text-muted-foreground uppercase tracking-wide">
              Payments & Balance
            </CardTitle>
            {paymentSummary && paymentSummary.outstanding > 0 && (
              <Button
                size="sm"
                variant="secondary"
                onClick={() => setPaymentDialogOpen(true)}
              >
                <CreditCard className="size-3.5 mr-1" /> Record payment
              </Button>
            )}
          </div>
        </CardHeader>
        <CardContent className="space-y-3">
          {paymentSummary === undefined ? (
            <Skeleton className="h-16 w-full" />
          ) : (
            <>
              {/* Balance summary row */}
              <div className="flex flex-wrap gap-4 rounded-md bg-muted px-4 py-3">
                <div>
                  <p className="text-xs font-body text-muted-foreground">
                    Order total
                  </p>
                  <p className="font-sans font-semibold text-sm">
                    {paymentSummary.orderTotal.toLocaleString(undefined, {
                      minimumFractionDigits: 2,
                    })}
                  </p>
                </div>
                <div>
                  <p className="text-xs font-body text-muted-foreground">
                    Paid
                  </p>
                  <p className="font-sans font-semibold text-sm text-success">
                    {paymentSummary.totalPaid.toLocaleString(undefined, {
                      minimumFractionDigits: 2,
                    })}
                  </p>
                </div>
                <div>
                  <p className="text-xs font-body text-muted-foreground">
                    Outstanding
                  </p>
                  <p
                    className={`font-sans font-semibold text-sm ${paymentSummary.outstanding > 0 ? "text-warning" : "text-success"}`}
                  >
                    {paymentSummary.outstanding.toLocaleString(undefined, {
                      minimumFractionDigits: 2,
                    })}
                  </p>
                </div>
                {paymentSummary.outstanding === 0 && (
                  <div className="flex items-center gap-1 text-success">
                    <CheckCircle2 className="size-4" />
                    <span className="text-xs font-body font-medium">
                      Fully paid
                    </span>
                  </div>
                )}
              </div>

              {/* Payment history */}
              {paymentSummary.payments.length === 0 ? (
                <p className="text-sm text-muted-foreground font-body">
                  No payments recorded yet.{" "}
                  <button
                    onClick={() => setPaymentDialogOpen(true)}
                    className="text-primary hover:underline cursor-pointer"
                  >
                    Record the first payment
                  </button>
                </p>
              ) : (
                <div className="space-y-1.5">
                  {paymentSummary.payments.map((p) => (
                    <div
                      key={p.id}
                      className="flex items-center justify-between gap-3 rounded-md border border-border px-3 py-2"
                    >
                      <div className="flex items-center gap-3">
                        <span className="text-xs font-body text-muted-foreground">
                          {format(parseISO(p.paidAt), "dd MMM yyyy")}
                        </span>
                        <span className="text-xs font-body px-2 py-0.5 rounded-full bg-muted capitalize">
                          {p.method.replace("_", " ")}
                        </span>
                        {p.notes && (
                          <span className="text-xs font-body text-muted-foreground italic truncate max-w-[180px]">
                            {p.notes}
                          </span>
                        )}
                      </div>
                      <div className="flex items-center gap-2 shrink-0">
                        <span className="font-sans font-semibold text-sm text-success">
                          +
                          {p.amount.toLocaleString(undefined, {
                            minimumFractionDigits: 2,
                          })}
                        </span>
                        <AlertDialog>
                          <AlertDialogTrigger asChild>
                            <button
                              aria-label="Delete payment"
                              className="text-destructive hover:text-destructive/80 cursor-pointer"
                            >
                              <Trash2 className="size-3.5" />
                            </button>
                          </AlertDialogTrigger>
                          <AlertDialogContent>
                            <AlertDialogHeader>
                              <AlertDialogTitle>
                                Delete payment?
                              </AlertDialogTitle>
                              <AlertDialogDescription>
                                Remove this payment of{" "}
                                {p.amount.toLocaleString(undefined, {
                                  minimumFractionDigits: 2,
                                })}
                                ? This cannot be undone.
                              </AlertDialogDescription>
                            </AlertDialogHeader>
                            <AlertDialogFooter>
                              <AlertDialogCancel>Cancel</AlertDialogCancel>
                              <AlertDialogAction
                                onClick={() => deletePayment({ id: p.id })}
                                className="bg-destructive text-white hover:bg-destructive/90"
                              >
                                Delete
                              </AlertDialogAction>
                            </AlertDialogFooter>
                          </AlertDialogContent>
                        </AlertDialog>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </>
          )}
        </CardContent>
      </Card>

      <ItemDialog
        open={itemDialogOpen}
        onClose={() => {
          setItemDialogOpen(false);
          setEditingItem(undefined);
        }}
        orderId={id as string}
        item={editingItem}
        customerMeasurements={order.customer?.measurements ?? null}
      />
      <EditOrderDialog
        open={editOrderOpen}
        onClose={() => setEditOrderOpen(false)}
        order={order}
      />
      {paymentDialogOpen && paymentSummary !== undefined && (
        <RecordPaymentDialog
          open={paymentDialogOpen}
          onClose={() => setPaymentDialogOpen(false)}
          orderId={id as string}
          orderNumber={order.orderNumber}
          outstanding={paymentSummary.outstanding}
        />
      )}
      {payoutDialogOpen && (
        <PayoutDialog
          open={payoutDialogOpen}
          onClose={() => setPayoutDialogOpen(false)}
          preselectedOrderId={id as string}
        />
      )}
    </div>
  );
}
