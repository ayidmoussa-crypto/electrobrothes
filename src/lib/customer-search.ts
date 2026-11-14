// Finding a past buyer while typing a new order by hand. Pure: tested without a database.

/** One past buyer, grouped by phone number: their latest name, city and address, and how buying went. */
export type PastCustomer = {
  phone: string;
  name: string;
  cityId: string;
  city: string;
  address: string;
  orders: number;
  delivered: number;
  returned: number;
  spent: number;
  last: string;
  blocked: boolean;
};

/**
 * What to look for: the words as typed, and the phone digits without the country code or the leading 0, so
 * "06 63 27 25 81", "0663272581" and "+212663272581" all find the same buyer. Fewer than 3 digits: no phone search.
 */
export function customerSearchTerms(raw: string) {
  const text = raw.trim().replace(/\s+/g, " ").slice(0, 60);
  let digits = text.replace(/\D/g, "");
  if (digits.startsWith("00212")) digits = digits.slice(5);
  else if (digits.startsWith("212")) digits = digits.slice(3);
  else if (digits.startsWith("0")) digits = digits.slice(1);
  return { text, digits: digits.length >= 3 ? digits : "" };
}

/** Two letters for the round badge: "Ayoub Idmoussa" → "AI", "محمد" → "مح". */
export function initials(name: string) {
  const words = name.trim().split(/\s+/).filter(Boolean);
  if (!words.length) return "?";
  const letters = words.length > 1 ? [...words[0]][0] + [...words[1]][0] : [...words[0]].slice(0, 2).join("");
  return letters.toUpperCase();
}
