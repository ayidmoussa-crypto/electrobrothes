import { ProxyAgent, fetch as undiciFetch } from "undici";

/**
 * The fetch used for Express Relais calls. With a static-IP proxy set (ER_PROXY_URL, or FIXIE_URL which the Fixie
 * integration adds), every call leaves through it, so Express Relais always sees the same IP. Without one, a plain fetch.
 * Only the Express Relais client uses this: the rest of the shop never goes through the proxy.
 */
export function erFetch(env: Record<string, string | undefined> = process.env): typeof fetch {
  const proxy = (env.ER_PROXY_URL || env.FIXIE_URL || "").trim();
  if (!proxy) return fetch;
  const dispatcher = new ProxyAgent(proxy);
  return ((input: string | URL, init?: RequestInit) => undiciFetch(input, { ...init, dispatcher } as never)) as unknown as typeof fetch;
}
