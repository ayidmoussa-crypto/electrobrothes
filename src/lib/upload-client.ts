// The one way the admin uploads a picture: signed by our server, sent straight to Cloudinary.
// The format list is part of the signature, so Cloudinary itself refuses anything else, whatever the browser says.

export const UPLOAD_FORMATS = "jpg,jpeg,png,webp,avif,svg";
export const MAX_UPLOAD_BYTES = 8 * 1024 * 1024;
const TYPES = new Set(["image/jpeg", "image/png", "image/webp", "image/avif", "image/svg+xml"]);

/** Returns the https link of the uploaded picture, or throws. */
export async function uploadImage(file: File): Promise<string> {
  // Fast answer in the browser; the real check is Cloudinary reading the file against the signed list.
  if (!TYPES.has(file.type) || file.size > MAX_UPLOAD_BYTES) throw new Error("file");
  const sig = await fetch("/api/admin/upload-signature", { method: "POST" }).then((r) => r.json());
  if (sig.error) throw new Error(sig.error);
  const body = new FormData();
  body.append("file", file);
  body.append("api_key", sig.apiKey);
  body.append("timestamp", String(sig.timestamp));
  body.append("folder", sig.folder);
  body.append("allowed_formats", sig.allowedFormats);
  body.append("signature", sig.signature);
  const res = await fetch(`https://api.cloudinary.com/v1_1/${sig.cloudName}/image/upload`, { method: "POST", body }).then((r) => r.json());
  if (typeof res.secure_url !== "string") throw new Error("upload");
  return res.secure_url;
}
