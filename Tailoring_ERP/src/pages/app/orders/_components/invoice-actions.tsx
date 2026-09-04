import { useState } from "react";
import { useQuery } from "convex/react";
import { api } from "@/convex/_generated/api.js";
import type { Id } from "@/convex/_generated/dataModel.d.ts";
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
import { downloadInvoicePDF, buildWhatsAppUrl, type InvoiceData } from "@/lib/invoice-pdf.ts";

export default function InvoiceActions({
  orderId,
}: {
  orderId: Id<"orders">;
}) {
  const [generating, setGenerating] = useState(false);

  const order = useQuery(api.orders.getOrder, { id: orderId });
  const tenant = useQuery(api.tenants.getMyTenant, {});
  const paymentSummary = useQuery(api.payments.getPaymentsByOrder, { orderId });

  const isReady = order !== undefined && tenant !== undefined && paymentSummary !== undefined;

  const buildInvoiceData = (): InvoiceData => {
    if (!order || !tenant || !paymentSummary) throw new Error("Data not loaded");
    return {
      orderNumber: order.orderNumber,
      status: order.status,
      dueDate: order.dueDate,
      notes: order.notes,
      totalAmount: order.totalAmount,
      items: order.items,
      customer: order.customer
        ? {
            name: order.customer.name,
            phone: order.customer.phone,
            email: order.customer.email,
          }
        : null,
      shop: {
        name: tenant.name,
        phone: tenant.phone,
        address: tenant.address,
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
