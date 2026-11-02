import "server-only";
import { createHash } from "node:crypto";

export const cloudinaryConfigured = () => !!(process.env.CLOUDINARY_CLOUD_NAME && process.env.CLOUDINARY_API_KEY && process.env.CLOUDINARY_API_SECRET);

/** Uploads from the server. Returns the hosted URL, or null when it fails: callers carry on without a photo. */
export async function uploadImage(base64: string, folder: string, mediaType = "image/jpeg") {
  if (!cloudinaryConfigured()) return null;
  const timestamp = Math.floor(Date.now() / 1000);
  const signature = createHash("sha1").update(`folder=${folder}&timestamp=${timestamp}${process.env.CLOUDINARY_API_SECRET}`).digest("hex");
  const body = new FormData();
  body.set("file", `data:${mediaType};base64,${base64}`);
  body.set("api_key", process.env.CLOUDINARY_API_KEY!);
  body.set("timestamp", String(timestamp));
  body.set("folder", folder);
  body.set("signature", signature);
  try {
    const res = await fetch(`https://api.cloudinary.com/v1_1/${process.env.CLOUDINARY_CLOUD_NAME}/image/upload`, { method: "POST", body, signal: AbortSignal.timeout(20_000) });
    if (!res.ok) return null;
    return ((await res.json()) as { secure_url?: string }).secure_url ?? null;
  } catch {
    return null;
  }
}
