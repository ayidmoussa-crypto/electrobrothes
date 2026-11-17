import { createHash } from "node:crypto";
import { getOwner } from "@/lib/admin";
import { UPLOAD_FORMATS } from "@/lib/upload-client";

// Signed direct upload to Cloudinary: the browser sends the file straight to Cloudinary,
// the API secret never leaves the server. Admin only.
export async function POST() {
  if (!(await getOwner())) return Response.json({ error: "unauthorized" }, { status: 401 });

  const cloudName = process.env.CLOUDINARY_CLOUD_NAME;
  const apiKey = process.env.CLOUDINARY_API_KEY;
  const apiSecret = process.env.CLOUDINARY_API_SECRET;
  if (!cloudName || !apiKey || !apiSecret) return Response.json({ error: "not_configured" }, { status: 503 });

  const timestamp = Math.floor(Date.now() / 1000);
  const folder = "electrobrothers/products";
  // Cloudinary signature: SHA-1 of the params sorted by name + secret. The format list is signed, so Cloudinary
  // refuses any other kind of file (it reads the file itself, not the name the browser gives).
  const signature = createHash("sha1").update(`allowed_formats=${UPLOAD_FORMATS}&folder=${folder}&timestamp=${timestamp}${apiSecret}`).digest("hex");

  return Response.json({ cloudName, apiKey, timestamp, folder, allowedFormats: UPLOAD_FORMATS, signature }, { headers: { "Cache-Control": "no-store" } });
}
