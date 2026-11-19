// Which visitor a rate limit counts (pure: no request, no database), so it can be tested directly.

/**
 * The visitor's address from the request headers, in order of trust:
 * - x-vercel-forwarded-for and x-real-ip are set by Vercel's edge from the real connection, never passed through
 *   from the client;
 * - x-forwarded-for comes last: its first entry is whatever the client sent when no trusted proxy rewrites it.
 * IPv6 addresses are cut to their /64, the block one subscriber holds, so a client cannot take a fresh limit with each
 * address of its own block.
 */
export function pickClientIp(get: (name: string) => string | null | undefined) {
  for (const name of ["x-vercel-forwarded-for", "x-real-ip", "x-forwarded-for"]) {
    const value = get(name)?.split(",")[0]?.trim();
    if (value) return normalizeIp(value);
  }
  return "unknown";
}

/** IPv4 as is; IPv4-mapped IPv6 as its IPv4; any other IPv6 as its /64 prefix ("2001:db8:0:1::/64"). */
export function normalizeIp(raw: string) {
  const ip = raw.replace(/^\[|\](:\d+)?$/g, "").replace(/%.*$/, "").toLowerCase().slice(0, 64);
  if (!ip.includes(":")) return ip;
  const mapped = ip.match(/^::ffff:(\d{1,3}(?:\.\d{1,3}){3})$/);
  if (mapped) return mapped[1];
  const [head, tail] = ip.split("::");
  const left = head ? head.split(":") : [];
  const right = tail !== undefined && tail ? tail.split(":") : [];
  const groups = tail === undefined ? left : [...left, ...Array(Math.max(0, 8 - left.length - right.length)).fill("0"), ...right];
  if (groups.length !== 8 || !groups.every((g) => /^[0-9a-f]{1,4}$/.test(g))) return ip;
  return `${groups.slice(0, 4).map((g) => g.replace(/^0+(?=.)/, "")).join(":")}::/64`;
}
