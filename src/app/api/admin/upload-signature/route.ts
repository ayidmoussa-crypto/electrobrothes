import { createHash } from "node:crypto";
import { getAdmin } from "@/lib/admin";

// Signed direct upload to Cloudinary: the browser sends the file straight to Cloudinary,
// the API secret never leaves the server. Admin only.
export async function POST() {
  if (!(await getAdmin())) return Response.json({ error: "unauthorized" }, { status: 401 });

  const cloudName = process.env.CLOUDINARY_CLOUD_NAME;
  const apiKey = process.env.CLOUDINARY_API_KEY;
  const apiSecret = process.env.CLOUDINARY_API_SECRET;
  if (!cloudName || !apiKey || !apiSecret) return Response.json({ error: "not_configured" }, { status: 503 });

  const timestamp = Math.floor(Date.now() / 1000);
  const folder = "electrobrothers/products";
  // Cloudinary signature: SHA-1 of the sorted params + secret.
  const signature = createHash("sha1").update(`folder=${folder}&timestamp=${timestamp}${apiSecret}`).digest("hex");

  return Response.json({ cloudName, apiKey, timestamp, folder, signature }, { headers: { "Cache-Control": "no-store" } });
}
