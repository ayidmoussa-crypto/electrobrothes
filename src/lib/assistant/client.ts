import "server-only";
import Anthropic from "@anthropic-ai/sdk";
import { comparableImage, storeImageUrl, type ImageType } from "./rules";

let client: Anthropic | undefined;
export const anthropic = () => (client ??= new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY, timeout: 60_000, maxRetries: 2 }));

const MAX_STORE_IMAGE_BYTES = 4 * 1024 * 1024;

/** A store photo Claude can see, or null: SVG placeholders, other hosts and failures are simply skipped. */
export async function fetchStoreImage(url: string, origin: string): Promise<{ type: ImageType; data: string } | null> {
  const safe = storeImageUrl(url, origin);
  if (!safe) return null;
  try {
    const res = await fetch(safe, { signal: AbortSignal.timeout(8000) });
    const type = comparableImage(res.headers.get("content-type"));
    if (!res.ok || !type) return null;
    const bytes = Buffer.from(await res.arrayBuffer());
    return bytes.length > MAX_STORE_IMAGE_BYTES ? null : { type, data: bytes.toString("base64") };
  } catch {
    return null;
  }
}
