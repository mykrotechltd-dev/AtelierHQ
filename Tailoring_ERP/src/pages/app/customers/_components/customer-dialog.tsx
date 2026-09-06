import { useState } from "react";
import { useCreateCustomer, useUpdateCustomer } from "@/lib/queries/customers.ts";
import { useMeasurementUnit } from "@/components/providers/measurement-unit.tsx";
import { UnitToggle } from "@/components/ui/unit-toggle.tsx";
import { cmToUnit, unitToCm, unitLabel, type MeasurementUnit } from "@/lib/units.ts";
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
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs.tsx";
import type { Customer } from "@/lib/supabase/types.ts";

const schema = z.object({
  name: z.string().min(1, "Name is required"),
  phone: z.string().optional(),
  email: z.string().email("Invalid email").optional().or(z.literal("")),
  notes: z.string().optional(),
  chest: z.string().optional(),
  waist: z.string().optional(),
  hips: z.string().optional(),
  shoulder: z.string().optional(),
  sleeveLength: z.string().optional(),
  inseam: z.string().optional(),
  neck: z.string().optional(),
  thigh: z.string().optional(),
  height: z.string().optional(),
  weight: z.string().optional(),
  measurementNotes: z.string().optional(),
});

type FormValues = z.infer<typeof schema>;

function toNum(v: string | undefined): number | undefined {
  if (!v || v.trim() === "") return undefined;
  const n = parseFloat(v);
  return isNaN(n) ? undefined : n;
}

/** Parses a typed length value in the given display unit and converts to cm
 *  for storage — `measurements` are always stored in cm. */
function toNumCm(v: string | undefined, unit: MeasurementUnit): number | undefined {
  const n = toNum(v);
  return n === undefined ? undefined : unitToCm(n, unit);
}

/** Formats a stored cm value for display in the given unit — "" when absent. */
function fromCm(cm: number | undefined, unit: MeasurementUnit): string {
  return cm === undefined ? "" : (Math.round(cmToUnit(cm, unit) * 10) / 10).toString();
}

export default function CustomerDialog({
  open,
  onClose,
  customer,
}: {
  open: boolean;
  onClose: () => void;
  customer?: Customer;
}) {
  const createCustomer = useCreateCustomer();
  const updateCustomer = useUpdateCustomer();
  const [saving, setSaving] = useState(false);
  const { unit } = useMeasurementUnit();

  const m = customer?.measurements;
  const form = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: {
      name: customer?.name ?? "",
      phone: customer?.phone ?? "",
      email: customer?.email ?? "",
      notes: customer?.notes ?? "",
      chest: fromCm(m?.chest, unit),
      waist: fromCm(m?.waist, unit),
      hips: fromCm(m?.hips, unit),
      shoulder: fromCm(m?.shoulder, unit),
      sleeveLength: fromCm(m?.sleeveLength, unit),
      inseam: fromCm(m?.inseam, unit),
      neck: fromCm(m?.neck, unit),
      thigh: fromCm(m?.thigh, unit),
      height: fromCm(m?.height, unit),
      weight: m?.weight?.toString() ?? "", // kg — not a length, never converted
      measurementNotes: m?.notes ?? "",
    },
  });

  const onSubmit = async (values: FormValues) => {
    setSaving(true);
    try {
      const measurements = {
        chest: toNumCm(values.chest, unit),
        waist: toNumCm(values.waist, unit),
        hips: toNumCm(values.hips, unit),
        shoulder: toNumCm(values.shoulder, unit),
        sleeveLength: toNumCm(values.sleeveLength, unit),
        inseam: toNumCm(values.inseam, unit),
        neck: toNumCm(values.neck, unit),
        thigh: toNumCm(values.thigh, unit),
        height: toNumCm(values.height, unit),
        weight: toNum(values.weight), // kg — not a length, never converted
        notes: values.measurementNotes || undefined,
      };
      const hasMeasurements = Object.values(measurements).some(
        (v) => v !== undefined
      );

      const payload = {
        name: values.name,
        phone: values.phone || undefined,
        email: values.email || undefined,
        notes: values.notes || undefined,
        measurements: hasMeasurements ? measurements : undefined,
      };

      if (customer) {
        await updateCustomer({ id: customer.id, ...payload });
        toast.success("Customer updated");
      } else {
        await createCustomer(payload);
        toast.success("Customer added");
      }
      form.reset();
      onClose();
    } catch {
      toast.error("Failed to save customer");
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="font-sans">
            {customer ? "Edit customer" : "Add customer"}
          </DialogTitle>
        </DialogHeader>

        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)}>
            <Tabs defaultValue="info" className="w-full">
              <TabsList className="w-full mb-4">
                <TabsTrigger value="info" className="flex-1">Contact info</TabsTrigger>
                <TabsTrigger value="measurements" className="flex-1">Measurements</TabsTrigger>
              </TabsList>

              <TabsContent value="info" className="space-y-4">
                <FormField
                  control={form.control}
                  name="name"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Full name *</FormLabel>
                      <FormControl>
                        <Input placeholder="Amina Okonkwo" {...field} />
                      </FormControl>
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
                      <FormControl>
                        <Input placeholder="+234 801 234 5678" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="email"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Email</FormLabel>
                      <FormControl>
                        <Input placeholder="amina@example.com" {...field} />
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
                        <Textarea
                          placeholder="Any notes about this customer..."
                          rows={3}
                          {...field}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </TabsContent>

              <TabsContent value="measurements" className="space-y-4">
                <div className="flex items-center justify-between">
                  <p className="text-xs text-muted-foreground font-body">
                    All measurements in {unit === "in" ? "inches" : "centimetres"} ({unitLabel(unit)}), except weight
                  </p>
                  <UnitToggle />
                </div>
                <div className="grid grid-cols-2 gap-3">
                  {(
                    [
                      ["chest", `Chest (${unitLabel(unit)})`],
                      ["waist", `Waist (${unitLabel(unit)})`],
                      ["hips", `Hips (${unitLabel(unit)})`],
                      ["shoulder", `Shoulder (${unitLabel(unit)})`],
                      ["sleeveLength", `Sleeve length (${unitLabel(unit)})`],
                      ["inseam", `Inseam (${unitLabel(unit)})`],
                      ["neck", `Neck (${unitLabel(unit)})`],
                      ["thigh", `Thigh (${unitLabel(unit)})`],
                      ["height", `Height (${unitLabel(unit)})`],
                      ["weight", "Weight (kg)"],
                    ] as const
                  ).map(([key, label]) => (
                    <FormField
                      key={key}
                      control={form.control}
                      name={key}
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel className="text-xs">{label}</FormLabel>
                          <FormControl>
                            <Input
                              type="number"
                              min={0}
                              step="0.1"
                              placeholder="—"
                              {...field}
                            />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  ))}
                </div>
                <FormField
                  control={form.control}
                  name="measurementNotes"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Measurement notes</FormLabel>
                      <FormControl>
                        <Textarea
                          placeholder="e.g. Prefers slightly loose fit around shoulders..."
                          rows={2}
                          {...field}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </TabsContent>
            </Tabs>

            <div className="flex justify-end gap-2 mt-6">
              <Button type="button" variant="secondary" onClick={onClose}>
                Cancel
              </Button>
              <Button type="submit" disabled={saving}>
                {saving ? "Saving..." : customer ? "Save changes" : "Add customer"}
              </Button>
            </div>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
