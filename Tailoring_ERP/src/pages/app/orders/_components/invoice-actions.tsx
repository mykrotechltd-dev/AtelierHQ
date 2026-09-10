import { useState } from "react";
import { useOrder } from "@/lib/queries/orders.ts";
import { useMyTenant } from "@/lib/queries/tenants.ts";
import { usePaymentsByOrder } from "@/lib/queries/payments.ts";
import { toast } from "sonner";
import { Button } from "@/components/ui/button.tsx";
import { Spinner } from "@/components/ui/spinner.tsx";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu.tsx";
import { FileText, Download, MessageCircle, ChevronDown } from "lucide-react";
import {
  downloadInvoicePDF,
  buildWhatsAppUrl,
  type InvoiceData,
} from "@/lib/invoice-pdf.ts";

export default function InvoiceActions({ orderId }: { orderId: string }) {
  const [generating, setGenerating] = useState(false);

  const order = useOrder(orderId);
  const tenant = useMyTenant();
  const paymentSummary = usePaymentsByOrder(orderId);

  const isReady = !!order && !!tenant && paymentSummary !== undefined;

  const buildInvoiceData = (): InvoiceData => {
    if (!order || !tenant || !paymentSummary)
      throw new Error("Data not loaded");
    return {
      orderNumber: order.orderNumber,
      status: order.status,
      dueDate: order.dueDate ?? undefined,
      notes: order.notes ?? undefined,
      totalAmount: order.totalAmount,
      items: order.items.map((i) => ({
        ...i,
        garmentType: i.garmentType ?? undefined,
        fabric: i.fabric ?? undefined,
        notes: i.notes ?? undefined,
      })),
      customer: order.customer
        ? {
            name: order.customer.name,
            phone: order.customer.phone ?? undefined,
            email: order.customer.email ?? undefined,
          }
        : null,
      shop: {
        name: tenant.name,
        phone: tenant.phone ?? undefined,
        address: tenant.address ?? undefined,
        currency: tenant.currency,
      },
      payments: paymentSummary.payments.map((p) => ({
        amount: p.amount,
        method: p.method,
        paidAt: p.paidAt,
      })),
      totalPaid: paymentSummary.totalPaid,
      outstanding: paymentSummary.outstanding,
    };
  };

  const handleDownload = async () => {
    if (!isReady) return;
    setGenerating(true);
    try {
      const data = buildInvoiceData();
      downloadInvoicePDF(data);
      toast.success("Invoice downloaded");
    } catch {
      toast.error("Failed to generate invoice");
    } finally {
      setGenerating(false);
    }
  };

  const handleWhatsApp = () => {
    if (!isReady) return;
    try {
      const data = buildInvoiceData();
      const url = buildWhatsAppUrl(data);
      window.open(url, "_blank", "noopener,noreferrer");
    } catch {
      toast.error("Failed to open WhatsApp");
    }
  };

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button size="sm" variant="secondary" disabled={!isReady || generating}>
          {generating ? (
            <Spinner className="size-3.5 mr-1" />
          ) : (
            <FileText className="size-3.5 mr-1" />
          )}
          Invoice
          <ChevronDown className="size-3.5 ml-1" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        <DropdownMenuItem onClick={handleDownload} className="cursor-pointer">
          <Download className="size-3.5 mr-2" />
          Download PDF
        </DropdownMenuItem>
        <DropdownMenuItem onClick={handleWhatsApp} className="cursor-pointer">
          <MessageCircle className="size-3.5 mr-2" />
          Share via WhatsApp
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
