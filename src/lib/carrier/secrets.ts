import { createCipheriv, createDecipheriv, hkdfSync, randomBytes } from "node:crypto";

// A delivery company's API key, login and password, kept encrypted in the database (AES-256-GCM).
// The key is derived from SESSION_SECRET, so no new setting is needed; changing that secret makes saved
// credentials unreadable (the owner then types them again).

export type CarrierCredentials = { apiKey?: string; login?: string; password?: string };

const key = (secret: string) => Buffer.from(hkdfSync("sha256", secret, "electrobrothers", "carrier-credentials", 32));

function secretOrThrow(secret = process.env.SESSION_SECRET) {
  if (!secret || secret.length < 32) throw new Error("SESSION_SECRET must be set to encrypt carrier credentials.");
  return secret;
}

/** "v1.<iv>.<tag>.<data>", all base64url. */
export function encryptCredentials(c: CarrierCredentials, secret?: string) {
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", key(secretOrThrow(secret)), iv);
  const data = Buffer.concat([cipher.update(JSON.stringify(c), "utf8"), cipher.final()]);
  return ["v1", iv, cipher.getAuthTag(), data].map((p) => (typeof p === "string" ? p : p.toString("base64url"))).join(".");
}

/** Null when there is nothing saved, or it was saved under another secret or tampered with. */
export function decryptCredentials(sealed: string | null | undefined, secret?: string): CarrierCredentials | null {
  if (!sealed) return null;
  const [v, iv, tag, data] = sealed.split(".");
  if (v !== "v1" || !iv || !tag || !data) return null;
  try {
    const decipher = createDecipheriv("aes-256-gcm", key(secretOrThrow(secret)), Buffer.from(iv, "base64url"));
    decipher.setAuthTag(Buffer.from(tag, "base64url"));
    return JSON.parse(Buffer.concat([decipher.update(Buffer.from(data, "base64url")), decipher.final()]).toString("utf8"));
  } catch {
    return null;
  }
}

/** Which fields are saved, for the admin page: values never go back to the browser. */
export const savedFields = (c: CarrierCredentials | null) => ({ apiKey: !!c?.apiKey, login: !!c?.login, password: !!c?.password });

/** An empty field keeps what was saved; a typed one replaces it. */
export function mergeCredentials(saved: CarrierCredentials | null, typed: CarrierCredentials): CarrierCredentials {
  const pick = (k: keyof CarrierCredentials) => (typed[k]?.trim() ? typed[k]!.trim() : saved?.[k]);
  return { apiKey: pick("apiKey"), login: pick("login"), password: pick("password") };
}

export const newWebhookToken = () => randomBytes(24).toString("base64url");
