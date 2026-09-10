import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import { format, parseISO } from "date-fns";

export type InvoiceOrderItem = {
  description: string;
  garmentType?: string;
  fabric?: string;
  quantity: number;
  unitPrice: number;
  notes?: string;
};

export type InvoiceData = {
  orderNumber: string;
  status: string;
  dueDate?: string;
  notes?: string;
  totalAmount: number;
  items: InvoiceOrderItem[];
  customer: {
    name: string;
    phone?: string;
    email?: string;
  } | null;
  shop: {
    name: string;
    phone?: string;
    address?: string;
    currency: string;
  };
  payments: {
    amount: number;
    method: string;
    paidAt: string;
  }[];
  totalPaid: number;
  outstanding: number;
};

// Navy + gold brand colours (RGB)
const NAVY: [number, number, number] = [28, 40, 80];
const GOLD: [number, number, number] = [180, 140, 60];
const LIGHT_BG: [number, number, number] = [248, 246, 240];
const GRAY: [number, number, number] = [100, 100, 100];
const GREEN: [number, number, number] = [39, 138, 80];

function fmt(amount: number, currency: string) {
  return `${currency} ${amount.toLocaleString("en", { minimumFractionDigits: 2 })}`;
}

export function generateInvoicePDF(data: InvoiceData): jsPDF {
  const doc = new jsPDF({ unit: "mm", format: "a4" });
  const pageW = doc.internal.pageSize.getWidth();
  const margin = 18;
  let y = 18;

  // ── Header band ────────────────────────────────────────────────────────────
  doc.setFillColor(...NAVY);
  doc.rect(0, 0, pageW, 36, "F");

  // Shop name
  doc.setTextColor(255, 255, 255);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(18);
  doc.text(data.shop.name.toUpperCase(), margin, 15);

  // INVOICE label right-aligned
  doc.setFontSize(22);
  doc.setTextColor(...GOLD);
  doc.text("INVOICE", pageW - margin, 22, { align: "right" });

  // Order number under INVOICE
  doc.setFontSize(9);
  doc.setFont("helvetica", "normal");
  doc.setTextColor(200, 200, 200);
  doc.text(data.orderNumber, pageW - margin, 29, { align: "right" });

  y = 44;

  // ── Shop meta (left) + Order meta (right) ─────────────────────────────────
  doc.setTextColor(...GRAY);
  doc.setFontSize(8.5);
  doc.setFont("helvetica", "normal");
  const shopLines: string[] = [];
  if (data.shop.phone) shopLines.push(data.shop.phone);
  if (data.shop.address) shopLines.push(data.shop.address);
  shopLines.forEach((line, i) => {
    doc.text(line, margin, y + i * 5);
  });

  // Order meta right column
  const metaRight = pageW - margin;
  const metaLabels = [
    ["Date:", format(new Date(), "dd MMM yyyy")],
    [
      "Status:",
      data.status.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase()),
    ],
    ...(data.dueDate
      ? [["Due:", format(parseISO(data.dueDate), "dd MMM yyyy")]]
      : []),
  ];
  metaLabels.forEach(([label, value], i) => {
    doc.setFont("helvetica", "bold");
    doc.setTextColor(...NAVY);
    doc.text(label, metaRight - 45, y + i * 5.5);
    doc.setFont("helvetica", "normal");
    doc.setTextColor(...GRAY);
    doc.text(value, metaRight, y + i * 5.5, { align: "right" });
  });

  y += Math.max(shopLines.length * 5, metaLabels.length * 5.5) + 8;

  // ── Divider ────────────────────────────────────────────────────────────────
  doc.setDrawColor(...GOLD);
  doc.setLineWidth(0.5);
  doc.line(margin, y, pageW - margin, y);
  y += 6;

  // ── Bill To ───────────────────────────────────────────────────────────────
  if (data.customer) {
    doc.setFillColor(...LIGHT_BG);
    doc.roundedRect(margin, y, pageW / 2 - margin - 4, 24, 2, 2, "F");

    doc.setFontSize(7.5);
    doc.setFont("helvetica", "bold");
    doc.setTextColor(...GOLD);
    doc.text("BILL TO", margin + 4, y + 6);

    doc.setFont("helvetica", "bold");
    doc.setFontSize(10);
    doc.setTextColor(...NAVY);
    doc.text(data.customer.name, margin + 4, y + 13);

    doc.setFont("helvetica", "normal");
    doc.setFontSize(8.5);
    doc.setTextColor(...GRAY);
    const contactLines: string[] = [];
    if (data.customer.phone) contactLines.push(data.customer.phone);
    if (data.customer.email) contactLines.push(data.customer.email);
    contactLines.forEach((line, i) => {
      doc.text(line, margin + 4, y + 19 + i * 5);
    });

    y += 30;
  }

  // ── Items table ────────────────────────────────────────────────────────────
  const tableBody = data.items.map((item) => {
    const label = [item.description, item.garmentType, item.fabric]
      .filter(Boolean)
      .join(" · ");
    return [
      label,
      item.quantity.toString(),
      fmt(item.unitPrice, data.shop.currency),
      fmt(item.quantity * item.unitPrice, data.shop.currency),
    ];
  });

  autoTable(doc, {
    startY: y,
    head: [["Description", "Qty", "Unit Price", "Total"]],
    body: tableBody,
    theme: "grid",
    styles: {
      fontSize: 9,
      cellPadding: 3,
      textColor: [40, 40, 40] as [number, number, number],
    },
    headStyles: {
      fillColor: NAVY,
      textColor: [255, 255, 255] as [number, number, number],
      fontStyle: "bold",
      fontSize: 9,
    },
    columnStyles: {
      0: { cellWidth: "auto" },
      1: { cellWidth: 16, halign: "center" },
      2: { cellWidth: 36, halign: "right" },
      3: { cellWidth: 38, halign: "right", fontStyle: "bold" },
    },
    alternateRowStyles: { fillColor: LIGHT_BG },
    margin: { left: margin, right: margin },
  });

  y =
    (doc as jsPDF & { lastAutoTable: { finalY: number } }).lastAutoTable
      .finalY + 6;

  // ── Totals block ──────────────────────────────────────────────────────────
  const totalsX = pageW - margin - 70;
  const totalsW = 70;

  // Background
  doc.setFillColor(...LIGHT_BG);
  doc.roundedRect(
    totalsX,
    y,
    totalsW,
    data.payments.length > 0 ? 36 : 18,
    2,
    2,
    "F",
  );

  // Order total
  doc.setFont("helvetica", "normal");
  doc.setFontSize(9);
  doc.setTextColor(...GRAY);
  doc.text("Order Total:", totalsX + 4, y + 7);
  doc.setFont("helvetica", "bold");
  doc.setTextColor(...NAVY);
  doc.text(
    fmt(data.totalAmount, data.shop.currency),
    totalsX + totalsW - 4,
    y + 7,
    { align: "right" },
  );

  if (data.payments.length > 0) {
    // Paid
    doc.setFont("helvetica", "normal");
    doc.setFontSize(9);
    doc.setTextColor(...GRAY);
    doc.text("Paid:", totalsX + 4, y + 15);
    doc.setFont("helvetica", "bold");
    doc.setTextColor(...GREEN);
    doc.text(
      fmt(data.totalPaid, data.shop.currency),
      totalsX + totalsW - 4,
      y + 15,
      { align: "right" },
    );

    // Outstanding
    doc.setDrawColor(...GOLD);
    doc.setLineWidth(0.3);
    doc.line(totalsX + 4, y + 20, totalsX + totalsW - 4, y + 20);

    doc.setFont("helvetica", "bold");
    doc.setFontSize(10.5);
    const outstandingColor: [number, number, number] =
      data.outstanding > 0 ? [200, 100, 30] : [...GREEN];
    doc.setTextColor(...outstandingColor);
    doc.text(
      data.outstanding > 0 ? "Balance Due:" : "Paid in Full",
      totalsX + 4,
      y + 28,
    );
    if (data.outstanding > 0) {
      doc.text(
        fmt(data.outstanding, data.shop.currency),
        totalsX + totalsW - 4,
        y + 28,
        { align: "right" },
      );
    }

    y += 42;
  } else {
    y += 24;
  }

  // ── Payment history (if any) ──────────────────────────────────────────────
  if (data.payments.length > 0) {
    doc.setFont("helvetica", "bold");
    doc.setFontSize(8.5);
    doc.setTextColor(...NAVY);
    doc.text("Payment History", margin, y + 5);
    y += 7;

    autoTable(doc, {
      startY: y,
      head: [["Date", "Method", "Amount"]],
      body: data.payments.map((p) => [
        format(parseISO(p.paidAt), "dd MMM yyyy"),
        p.method.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase()),
        fmt(p.amount, data.shop.currency),
      ]),
      theme: "plain",
      styles: {
        fontSize: 8.5,
        cellPadding: 2.5,
        textColor: [60, 60, 60] as [number, number, number],
      },
      headStyles: {
        fillColor: LIGHT_BG,
        textColor: NAVY,
        fontStyle: "bold",
        fontSize: 8,
      },
      columnStyles: {
        2: { halign: "right" },
      },
      margin: { left: margin, right: margin },
    });

    y =
      (doc as jsPDF & { lastAutoTable: { finalY: number } }).lastAutoTable
        .finalY + 6;
  }

  // ── Notes ─────────────────────────────────────────────────────────────────
  if (data.notes) {
    doc.setFont("helvetica", "italic");
    doc.setFontSize(8.5);
    doc.setTextColor(...GRAY);
    const noteLines = doc.splitTextToSize(
      `Notes: ${data.notes}`,
      pageW - margin * 2,
    );
    doc.text(noteLines, margin, y);
    y += noteLines.length * 5 + 4;
  }

  // ── Footer ─────────────────────────────────────────────────────────────────
  const pageH = doc.internal.pageSize.getHeight();
  doc.setDrawColor(...GOLD);
  doc.setLineWidth(0.4);
  doc.line(margin, pageH - 14, pageW - margin, pageH - 14);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(7.5);
  doc.setTextColor(...GRAY);
  doc.text(
    `${data.shop.name} · Thank you for your business!`,
    pageW / 2,
    pageH - 9,
    { align: "center" },
  );

  return doc;
}

export function downloadInvoicePDF(data: InvoiceData): void {
  const doc = generateInvoicePDF(data);
  doc.save(`invoice-${data.orderNumber}.pdf`);
}

export function getInvoicePDFBlob(data: InvoiceData): Blob {
  const doc = generateInvoicePDF(data);
  return doc.output("blob");
}

export function getInvoicePDFDataUrl(data: InvoiceData): string {
  const doc = generateInvoicePDF(data);
  return doc.output("dataurlstring");
}

export function buildWhatsAppUrl(data: InvoiceData): string {
  const curr = data.shop.currency;
  const outstanding =
    data.outstanding > 0
      ? `\nBalance due: ${curr} ${data.outstanding.toLocaleString("en", { minimumFractionDigits: 2 })}`
      : "\nPayment: Fully paid ✓";

  const message = [
    `Hello ${data.customer?.name ?? ""},`,
    ``,
    `Here is your invoice from *${data.shop.name}*:`,
    ``,
    `Order: *${data.orderNumber}*`,
    `Total: *${curr} ${data.totalAmount.toLocaleString("en", { minimumFractionDigits: 2 })}*${outstanding}`,
    data.dueDate ? `Due: ${format(parseISO(data.dueDate), "dd MMM yyyy")}` : "",
    ``,
    `Thank you for your business!`,
  ]
    .filter((l) => l !== undefined)
    .join("\n")
    .trim();

  const phone = data.customer?.phone?.replace(/\D/g, "") ?? "";
  const base = phone ? `https://wa.me/${phone}` : "https://wa.me/";
  return `${base}?text=${encodeURIComponent(message)}`;
}
