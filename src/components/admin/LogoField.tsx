"use client";

import { ImagePlus, LoaderCircle } from "lucide-react";
import { useState } from "react";
import { buttonClass } from "@/components/ui/button";
import { useAdminTr } from "./AdminLang";
import { CarrierLogo } from "./CarrierLogo";
import { inputClass } from "./ui";
import { uploadImage } from "@/lib/upload-client";

/** The delivery company's logo: uploaded to Cloudinary, or a link pasted in. */
export function LogoField({ name, initial, uploadsEnabled }: { name: string; initial: string | null; uploadsEnabled: boolean }) {
  const { tr } = useAdminTr();
  const [url, setUrl] = useState(initial ?? "");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function upload(file: File | undefined) {
    if (!file) return;
    setBusy(true);
    setError(null);
    try {
      const url = await uploadImage(file);
      setUrl(url);
    } catch {
      setError(tr("فشل رفع اللوغو. جرب مرة أخرى ولا حط رابط.", "Logo upload failed. Try again or paste a link."));
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="flex items-center gap-3">
      <CarrierLogo name={name || "?"} logoUrl={url || null} className="size-14" />
      <div className="flex min-w-0 flex-1 flex-col gap-2">
        <input name="logoUrl" value={url} onChange={(e) => setUrl(e.target.value)} type="url" dir="ltr" placeholder="https://…/logo.png" aria-label={tr("رابط اللوغو", "Logo link")} className={`${inputClass} text-start`} />
        <div className="flex flex-wrap items-center gap-2">
          {uploadsEnabled ? (
            <label className={buttonClass({ variant: "outline", className: "w-fit cursor-pointer" })}>
              {busy ? <LoaderCircle className="size-4 animate-spin" aria-hidden="true" /> : <ImagePlus className="size-4" aria-hidden="true" />}
              {tr("رفع اللوغو", "Upload logo")}
              <input type="file" accept="image/png,image/jpeg,image/webp,image/svg+xml" className="sr-only" disabled={busy} onChange={(e) => upload(e.target.files?.[0])} />
            </label>
          ) : null}
          {url ? (
            <button type="button" onClick={() => setUrl("")} className={buttonClass({ variant: "ghost" })}>
              {tr("حيد اللوغو", "Remove logo")}
            </button>
          ) : null}
        </div>
        {error ? (
          <p role="alert" className="text-xs font-semibold text-danger">
            {error}
          </p>
        ) : null}
      </div>
    </div>
  );
}
