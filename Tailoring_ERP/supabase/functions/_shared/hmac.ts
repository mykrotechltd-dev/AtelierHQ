// Shared HMAC webhook-signature helpers.
//
// hmacSha512Hex/safeEqual were written once in fincra-checkout/index.ts and
// copied into subscription-billing/index.ts — both call it against a
// Fincra webhook signed with HMAC-SHA512. notify-dispatch's Infobip
// delivery-status webhook is signed with HMAC-SHA256 instead (per Infobip's
// docs, unlike Fincra's SHA512), so this now needs both algorithms rather
// than just one — extracted here, with a third caller, instead of
// copy-pasting a third near-identical block.

async function hmacHex(
  secret: string,
  message: string,
  hash: "SHA-256" | "SHA-512",
): Promise<string> {
  const enc = new TextEncoder();
  const key = await crypto.subtle.importKey(
    "raw",
    enc.encode(secret),
    { name: "HMAC", hash },
    false,
    ["sign"],
  );
  const sig = await crypto.subtle.sign("HMAC", key, enc.encode(message));
  return Array.from(new Uint8Array(sig))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

export function hmacSha512Hex(secret: string, message: string): Promise<string> {
  return hmacHex(secret, message, "SHA-512");
}

export function hmacSha256Hex(secret: string, message: string): Promise<string> {
  return hmacHex(secret, message, "SHA-256");
}

/** Constant-time string comparison — a webhook signature check must never
 *  leak timing information about how much of the expected value matched. */
export function safeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}
