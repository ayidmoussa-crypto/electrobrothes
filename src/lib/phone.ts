// Moroccan phone numbers: mobiles 06/07 and landlines 05, 9 digits after the 0.
const MOROCCAN = /^(?:\+212|00212|212|0)([5-7]\d{8})$/;

/** Returns the E.164 form (+212612345678) or null when the number is not Moroccan. */
export function normalizeMoroccanPhone(input: string): string | null {
  const compact = input.replace(/[\s.\-()]/g, "");
  const match = MOROCCAN.exec(compact);
  return match ? `+212${match[1]}` : null;
}

/** Any way of writing a Moroccan number → the digits wa.me links expect (212612345678); null when not Moroccan. */
export function whatsappDigits(input: string): string | null {
  return normalizeMoroccanPhone(input)?.slice(1) ?? null;
}

/** "+212612345678" → "06 12 34 56 78" (how Moroccans write it). */
export function formatMoroccanPhone(e164: string): string {
  const local = `0${e164.slice(4)}`;
  return local.replace(/^(\d{2})(\d{2})(\d{2})(\d{2})(\d{2})$/, "$1 $2 $3 $4 $5");
}
