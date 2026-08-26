import { NextRequest, NextResponse } from "next/server";
import { createServerSupabase } from "@/lib/supabase/server";
import { generateSkirtBlock } from "@/lib/pattern/skirtBlock";
import { generateBodiceBlock } from "@/lib/pattern/bodiceBlock";
import { renderPatternPdf } from "@/lib/pdf/pattern";

const GENERATORS = {
  skirt: { fn: generateSkirtBlock, label: "Basic skirt block (front)" },
  bodice: { fn: generateBodiceBlock, label: "Basic bodice block (front)" },
} as const;

export async function GET(request: NextRequest, { params }: { params: { orderItemId: string } }) {
  const supabase = createServerSupabase();

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { data: profile } = await supabase.from("profiles").select("tenant_id").eq("id", user.id).single();
  if (!profile) return NextResponse.json({ error: "No tenant" }, { status: 403 });

  const blockParam = request.nextUrl.searchParams.get("block");
  const block = blockParam && blockParam in GENERATORS ? (blockParam as keyof typeof GENERATORS) : null;
  if (!block) {
    return NextResponse.json({ error: "Pass ?block=skirt or ?block=bodice" }, { status: 400 });
  }

  const { data: item } = await supabase
    .from("order_items")
    .select("id, garment_type, measurement_id, orders(order_number, customers(full_name))")
    .eq("id", params.orderItemId)
    .single();

  if (!item) return NextResponse.json({ error: "Order item not found" }, { status: 404 });
  if (!item.measurement_id) {
    return NextResponse.json({ error: "This item has no measurement linked — edit it on the order page first" }, { status: 400 });
  }

  const [{ data: measurement }, { data: tenant }] = await Promise.all([
    supabase.from("measurements").select("values, unit").eq("id", item.measurement_id).single(),
    supabase.from("tenants").select("name").eq("id", profile.tenant_id).single(),
  ]);

  if (!measurement) return NextResponse.json({ error: "Linked measurement not found" }, { status: 404 });

  const { fn, label } = GENERATORS[block];
  const result = fn(measurement.values as Record<string, string | number>, measurement.unit as "in" | "cm");

  const pdfBuffer = await renderPatternPdf({
    shopName: tenant?.name ?? "",
    orderNumber: item.orders?.[0]?.order_number ?? "",
    customerName: item.orders?.[0]?.customers?.[0]?.full_name ?? "",
    garmentType: item.garment_type,
    blockLabel: label,
    pieces: result.pieces,
    warnings: result.warnings,
  });

  return new NextResponse(new Uint8Array(pdfBuffer), {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `inline; filename="pattern-${block}-${item.orders?.[0]?.order_number ?? params.orderItemId}.pdf"`,
    },
  });
}
