import { useState } from "react";
import { useCreateWorker, useUpdateWorker } from "@/lib/queries/workers.ts";
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
import {
  Form,
  FormField,
  FormItem,
  FormLabel,
  FormControl,
  FormMessage,
} from "@/components/ui/form.tsx";
import type { Worker } from "@/lib/supabase/types.ts";

const schema = z.object({
  name: z.string().min(1, "Name is required"),
  phone: z.string().optional(),
  specialization: z.string().optional(),
});
type FormValues = z.infer<typeof schema>;

export default function WorkerDialog({
  open,
  onClose,
  worker,
}: {
  open: boolean;
  onClose: () => void;
  worker?: Worker;
}) {
  const createWorker = useCreateWorker();
  const updateWorker = useUpdateWorker();
  const [saving, setSaving] = useState(false);

  const form = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: {
      name: worker?.name ?? "",
      phone: worker?.phone ?? "",
      specialization: worker?.specialization ?? "",
    },
  });

  const onSubmit = async (values: FormValues) => {
    setSaving(true);
    try {
      if (worker) {
        await updateWorker({
          id: worker.id,
          name: values.name,
          phone: values.phone || undefined,
          specialization: values.specialization || undefined,
        });
        toast.success("Worker updated");
      } else {
        await createWorker({
          name: values.name,
          phone: values.phone || undefined,
          specialization: values.specialization || undefined,
        });
        toast.success("Worker added");
      }
      form.reset();
      onClose();
    } catch {
      toast.error("Failed to save worker");
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="max-w-sm">
        <DialogHeader>
          <DialogTitle className="font-sans">
            {worker ? "Edit worker" : "Add worker"}
          </DialogTitle>
        </DialogHeader>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
            <FormField
              control={form.control}
              name="name"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Full name *</FormLabel>
                  <FormControl>
                    <Input placeholder="Emeka Adeyemi" {...field} />
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
              name="specialization"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Specialization</FormLabel>
                  <FormControl>
                    <Input placeholder="e.g. Embroidery, Cutting" {...field} />
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
                {saving ? "Saving..." : worker ? "Save changes" : "Add worker"}
              </Button>
            </div>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
