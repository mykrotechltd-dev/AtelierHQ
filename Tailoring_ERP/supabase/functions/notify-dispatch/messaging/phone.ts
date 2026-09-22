/** Infobip's messaging APIs expect MSISDN-format numbers without a leading
 *  "+" (e.g. "2348012345678", not "+2348012345678"). MessageRecipient
 *  always carries E.164 (with the "+") as the one true internal
 *  representation — every adapter converts only at the point it actually
 *  calls out to Infobip. */
export function toMsisdn(phoneE164: string): string {
  return phoneE164.replace(/^\+/, "");
}
