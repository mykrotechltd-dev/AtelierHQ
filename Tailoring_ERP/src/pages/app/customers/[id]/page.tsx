import { useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { useCustomer, useDeleteCustomer } from "@/lib/queries/customers.ts";
import { useMeasurementUnit } from "@/components/providers/measurement-unit.tsx";
import { UnitToggle } from "@/components/ui/unit-toggle.tsx";
import { formatMeasurement, unitLabel } from "@/lib/units.ts";
import { toast } from "sonner";
import PageHeader from "@/components/page-header.tsx";
import { Button } from "@/components/ui/button.tsx";
import { Skeleton } from "@/components/ui/skeleton.tsx";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card.tsx";
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
  Phone,
  Mail,
  FileText,
  Ruler,
  Pencil,
  Trash2,
  ArrowLeft,
} from "lucide-react";
import CustomerDialog from "../_components/customer-dialog.tsx";

const MEASUREMENT_LABELS: Record<string, string> = {
  chest: "Chest",
  waist: "Waist",
  hips: "Hips",
  shoulder: "Shoulder",
  sleeveLength: "Sleeve length",
  inseam: "Inseam",
  neck: "Neck",
  thigh: "Thigh",
  height: "Height",
  weight: "Weight",
};

export default function CustomerDetailPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [editOpen, setEditOpen] = useState(false);
  const deleteCustomer = useDeleteCustomer();
  const { unit } = useMeasurementUnit();

  const customer = useCustomer(id);

  const handleDelete = async () => {
    if (!id) return;
    try {
      await deleteCustomer({ id });
      toast.success("Customer deleted");
      navigate("/customers", { replace: true });
    } catch {
      toast.error("Failed to delete customer");
    }
  };

  if (!customer) {
    return (
      <div className="p-6 max-w-3xl mx-auto space-y-4">
        <Skeleton className="h-8 w-48" />
        <Skeleton className="h-40 w-full" />
        <Skeleton className="h-60 w-full" />
      </div>
    );
  }

  return (
    <div className="p-6 max-w-3xl mx-auto">
      <button
        onClick={() => navigate("/customers")}
        className="flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground mb-4 font-body cursor-pointer"
      >
        <ArrowLeft className="size-4" /> All customers
      </button>

      <PageHeader title={customer.name}>
        <Button size="sm" variant="secondary" onClick={() => setEditOpen(true)}>
          <Pencil className="size-3.5 mr-1" /> Edit
        </Button>
        <AlertDialog>
          <AlertDialogTrigger asChild>
            <Button size="sm" variant="destructive">
              <Trash2 className="size-3.5 mr-1" /> Delete
            </Button>
          </AlertDialogTrigger>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Delete customer?</AlertDialogTitle>
              <AlertDialogDescription>
                This will permanently delete {customer.name} and all their data.
                This cannot be undone.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>Cancel</AlertDialogCancel>
              <AlertDialogAction
                onClick={handleDelete}
                className="bg-destructive text-white hover:bg-destructive/90"
              >
                Delete
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </PageHeader>

      {/* Contact info */}
      <Card className="mb-4">
        <CardHeader className="pb-3">
          <CardTitle className="font-sans text-sm text-muted-foreground uppercase tracking-wide">
            Contact
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-2">
          {customer.phone ? (
            <div className="flex items-center gap-2 font-body text-sm">
              <Phone className="size-4 text-muted-foreground" />
              <span>{customer.phone}</span>
            </div>
          ) : null}
          {customer.email ? (
            <div className="flex items-center gap-2 font-body text-sm">
              <Mail className="size-4 text-muted-foreground" />
              <span>{customer.email}</span>
            </div>
          ) : null}
          {!customer.phone && !customer.email && (
            <p className="text-sm text-muted-foreground font-body">
              No contact info recorded
            </p>
          )}
          {customer.notes ? (
            <div className="flex items-start gap-2 font-body text-sm pt-1 border-t border-border mt-2">
              <FileText className="size-4 text-muted-foreground mt-0.5 shrink-0" />
              <span className="text-muted-foreground">{customer.notes}</span>
            </div>
          ) : null}
        </CardContent>
      </Card>

      {/* Measurements */}
      <Card>
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <CardTitle className="font-sans text-sm text-muted-foreground uppercase tracking-wide flex items-center gap-2">
              <Ruler className="size-4" /> Measurements
            </CardTitle>
            <div className="flex items-center gap-2">
              {customer.measurements && <UnitToggle />}
              {!customer.measurements && (
                <Button
                  size="sm"
                  variant="secondary"
                  onClick={() => setEditOpen(true)}
                  className="text-xs"
                >
                  Add measurements
                </Button>
              )}
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {customer.measurements ? (
            <div className="space-y-3">
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                {Object.entries(MEASUREMENT_LABELS).map(([key, label]) => {
                  const val =
                    customer.measurements?.[
                      key as keyof typeof customer.measurements
                    ];
                  if (
                    val === undefined ||
                    val === null ||
                    typeof val === "string"
                  )
                    return null;
                  const isWeight = key === "weight";
                  return (
                    <div key={key} className="bg-muted rounded-md px-3 py-2">
                      <p className="text-xs text-muted-foreground font-body">
                        {label}
                      </p>
                      <p className="font-sans font-medium text-sm">
                        {isWeight ? val : formatMeasurement(val, unit)}{" "}
                        {isWeight ? "kg" : unitLabel(unit)}
                      </p>
                    </div>
                  );
                })}
              </div>
              {customer.measurements.notes && (
                <p className="text-sm text-muted-foreground font-body border-t border-border pt-3">
                  {customer.measurements.notes}
                </p>
              )}
            </div>
          ) : (
            <p className="text-sm text-muted-foreground font-body">
              No measurements recorded yet
            </p>
          )}
        </CardContent>
      </Card>

      <CustomerDialog
        open={editOpen}
        onClose={() => setEditOpen(false)}
        customer={customer}
      />
    </div>
  );
}
