import { NextRequest, NextResponse } from "next/server";
import { createServerSupabase } from "@/lib/supabase/server";
import { renderInvoicePdf } from "@/lib/pdf/invoice";

/**
 * GET /invoices/:orderId            -> streams the PDF inline (view/print/download)
 * GET /invoices/:orderId?share=1    -> generates (or reuses) the PDF, uploads it to the
 *                                      private `invoices` storage bucket, and returns a
 *                                      short-lived signed URL for sharing via WhatsApp.
 *
 * Auth: relies on the cookie-scoped Supabase client, so RLS still applies —
 * a user can only ever generate an invoice for an order in their own tenant.
 */
export async function GET(request: NextRequest, { params }: { params: { orderId: string } }) {
  const supabase = createServerSupabase();

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { data: profile } = await supabase.from("profiles").select("tenant_id").eq("id", user.id).single();
  if (!profile) return NextResponse.json({ error: "No tenant" }, { status: 403 });

  const [{ data: order }, { data: items }, { data: tenant }] = await Promise.all([
    supabase.from("orders").select("*, customers(full_name, phone, address)").eq("id", params.orderId).single(),
    supabase.from("order_items").select("*").eq("order_id", params.orderId),
    supabase.from("tenants").select("name, phone, address, currency").eq("id", profile.tenant_id).single(),
  ]);

  if (!order || !tenant) return NextResponse.json({ error: "Order not found" }, { status: 404 });

  const customer = order.customers;

  // Reuse the existing invoice number if one was already issued for this order.
  const { data: existingInvoice } = await supabase
    .from("invoices")
    .select("invoice_number")
    .eq("order_id", params.orderId)
    .order("issued_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  const invoiceNumber = existingInvoice?.invoice_number ?? `INV-${order.order_number.replace("ORD-", "")}`;

  const pdfBuffer = await renderInvoicePdf({
    tenant: { name: tenant.name, phone: tenant.phone, address: tenant.address, currency: tenant.currency ?? "NGN" },
    invoiceNumber,
    issuedAt: new Date().toLocaleDateString(),
    order: { orderNumber: order.order_number, dueDate: order.due_date },
    customer: { fullName: customer?.full_name ?? "Customer", phone: customer?.phone ?? "", address: customer?.address ?? null },
    items: (items ?? []).map((i) => ({
      garmentType: i.garment_type,
      description: i.description,
      quantity: i.quantity,
      unitPrice: i.unit_price,
    })),
    discount: order.discount,
    amountPaid: order.amount_paid,
  });

  const wantsShareLink = request.nextUrl.searchParams.get("share") === "1";

  if (!wantsShareLink) {
    return new NextResponse(new Uint8Array(pdfBuffer), {
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `inline; filename="${invoiceNumber}.pdf"`,
      },
    });
  }

  const path = `${profile.tenant_id}/${params.orderId}/${invoiceNumber}.pdf`;

  const { error: uploadError } = await supabase.storage
    .from("invoices")
    .upload(path, pdfBuffer, { contentType: "application/pdf", upsert: true });

  if (uploadError) {
    return NextResponse.json({ error: `Could not upload invoice: ${uploadError.message}` }, { status: 500 });
  }

  await supabase.from("invoices").upsert(
    {
      tenant_id: profile.tenant_id,
      order_id: params.orderId,
      invoice_number: invoiceNumber,
      status: "issued",
      pdf_path: path,
      total_amount: order.total_amount,
      issued_by: user.id,
    },
    { onConflict: "tenant_id,invoice_number" }
  );

  // Signed URL — the bucket is private, so this is the only way to reach the
  // file from outside Supabase, and it expires instead of staying public forever.
  const { data: signed, error: signError } = await supabase.storage
    .from("invoices")
    .createSignedUrl(path, 60 * 60 * 24 * 7); // 7 days

  if (signError || !signed) {
    return NextResponse.json({ error: "Could not create share link" }, { status: 500 });
  }

  const whatsappPhone = (customer?.phone ?? "").replace(/[^0-9]/g, "");
  const message = `Hi ${customer?.full_name ?? ""}, here's your invoice ${invoiceNumber} from ${tenant.name}: ${signed.signedUrl}`;
  const whatsappShareUrl = `https://wa.me/${whatsappPhone}?text=${encodeURIComponent(message)}`;

  return NextResponse.json({ pdfUrl: signed.signedUrl, whatsappShareUrl });
}
