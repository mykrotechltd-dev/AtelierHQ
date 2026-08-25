import { NextRequest, NextResponse } from "next/server";

/**
 * WhatsApp Business Cloud API webhook (Meta).
 * GET  — the verification handshake Meta performs once when you register this URL.
 * POST — inbound messages/status updates. This stub just logs; wire it up to
 * feed the AI assistant (a customer messaging "where's my order?" should be
 * answered by looking up their open orders by phone number) once the
 * assistant's tool-calling loop is in place — see the implementation plan's
 * AI assistant phase.
 */
export async function GET(request: NextRequest) {
  const params = request.nextUrl.searchParams;
  const mode = params.get("hub.mode");
  const token = params.get("hub.verify_token");
  const challenge = params.get("hub.challenge");

  if (mode === "subscribe" && token === process.env.WHATSAPP_VERIFY_TOKEN) {
    return new NextResponse(challenge ?? "", { status: 200 });
  }
  return NextResponse.json({ error: "Verification failed" }, { status: 403 });
}

export async function POST(request: NextRequest) {
  const payload = await request.json();

  // TODO: resolve the sending phone number to a tenant + customer, then
  // route to the AI assistant's tool-calling loop or a simple FAQ/status lookup.
  console.log("WhatsApp inbound:", JSON.stringify(payload));

  return NextResponse.json({ received: true });
}
