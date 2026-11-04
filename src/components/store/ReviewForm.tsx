"use client";

import { CheckCircle2, ImagePlus, LoaderCircle, Star, X } from "lucide-react";
import Image from "next/image";
import { useTranslations } from "next-intl";
import { useActionState, useRef, useState } from "react";
import { submitReview, type ReviewFormState } from "@/app/actions/review";
import { buttonClass } from "@/components/ui/button";
import { Field, Textarea } from "@/components/ui/Field";
import { submitKeepingValues } from "@/lib/forms";

const MAX_SIDE = 1280;

/** Phone photos become a small JPEG first: the upload limit is 1 MB, and they stay sharp enough. */
async function shrink(file: File) {
  const bitmap = await createImageBitmap(file);
  const scale = Math.min(1, MAX_SIDE / Math.max(bitmap.width, bitmap.height));
  const canvas = document.createElement("canvas");
  canvas.width = Math.round(bitmap.width * scale);
  canvas.height = Math.round(bitmap.height * scale);
  canvas.getContext("2d")!.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
  bitmap.close();
  const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, "image/jpeg", 0.8));
  if (!blob) throw new Error("photo");
  return new File([blob], "photo.jpg", { type: "image/jpeg" });
}

export function ReviewForm({ token, locale, item, photos }: { token: string; locale: string; item: { id: string; name: string; variant: string | null; image: string | null }; photos: boolean }) {
  const t = useTranslations("reviewForm");
  const [rating, setRating] = useState(0);
  const [photo, setPhoto] = useState<File | null>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [photoError, setPhotoError] = useState(false);
  const input = useRef<HTMLInputElement>(null);
  const [state, action, pending] = useActionState<ReviewFormState, FormData>((prev, fd) => {
    if (photo) fd.set("photo", photo);
    return submitReview(token, item.id, locale, prev, fd);
  }, {});

  const pick = async (file: File | undefined) => {
    setPhotoError(false);
    if (!file) return;
    try {
      const small = await shrink(file);
      setPhoto(small);
      setPreview(URL.createObjectURL(small));
    } catch {
      setPhotoError(true);
    }
  };

  const header = (
    <div className="flex items-center gap-3">
      <span className="relative size-14 shrink-0 overflow-hidden rounded-lg bg-warm-100">
        {item.image ? <Image src={item.image} alt="" fill sizes="56px" unoptimized={item.image.endsWith(".svg")} className="object-contain p-1" /> : null}
      </span>
      <p className="min-w-0 font-bold text-ink">
        {item.name}
        {item.variant ? <span className="block text-sm font-normal text-warm-600">{item.variant}</span> : null}
      </p>
    </div>
  );

  if (state.ok) {
    return (
      <section className="rounded-xl border border-warm-200 bg-white p-4">
        {header}
        <p role="status" className="mt-3 flex items-center gap-2 rounded-lg bg-success-soft p-3 text-sm font-semibold text-success">
          <CheckCircle2 className="size-5 shrink-0" aria-hidden="true" />
          {t("thanks")}
        </p>
      </section>
    );
  }

  return (
    <form action={action} onSubmit={(e) => submitKeepingValues(e, action)} className="flex flex-col gap-4 rounded-xl border border-warm-200 bg-white p-4">
      {header}
      <fieldset>
        <legend className="mb-1 text-sm font-semibold text-ink">{t("stars")}</legend>
        <div className="flex gap-1">
          {[1, 2, 3, 4, 5].map((n) => (
            <label key={n} className="grid size-11 cursor-pointer place-items-center rounded-lg has-[:focus-visible]:ring-2 has-[:focus-visible]:ring-yellow-300">
              <input type="radio" name="rating" value={n} required className="sr-only" checked={rating === n} onChange={() => setRating(n)} aria-label={t("starLabel", { n })} />
              <Star className={`size-8 ${n <= rating ? "fill-yellow-500 text-yellow-700" : "fill-warm-200 text-warm-300"}`} aria-hidden="true" />
            </label>
          ))}
        </div>
      </fieldset>
      <Field id={`comment-${item.id}`} label={t("comment")} required>
        {(p) => <Textarea {...p} name="comment" rows={3} minLength={3} maxLength={1000} dir="auto" />}
      </Field>
      {photos ? (
        <div>
          <input ref={input} type="file" accept="image/*" hidden aria-label={t("photo")} onChange={(e) => pick(e.target.files?.[0])} />
          {preview ? (
            <span className="relative inline-block size-20 overflow-hidden rounded-lg bg-warm-100">
              <Image src={preview} alt="" fill sizes="80px" unoptimized className="object-cover" />
              <button
                type="button"
                aria-label={t("removePhoto")}
                onClick={() => {
                  setPhoto(null);
                  setPreview(null);
                  if (input.current) input.current.value = "";
                }}
                className="absolute end-0 top-0 grid size-7 cursor-pointer place-items-center bg-ink text-white"
              >
                <X className="size-4" aria-hidden="true" />
              </button>
            </span>
          ) : (
            <button type="button" onClick={() => input.current?.click()} className={buttonClass({ variant: "outline" })}>
              <ImagePlus className="size-5" aria-hidden="true" />
              {t("photo")}
            </button>
          )}
          {photoError ? <p role="alert" className="mt-1 text-sm text-danger">{t("error.photo")}</p> : null}
        </div>
      ) : null}
      {state.error ? (
        <p role="alert" className="rounded-lg bg-danger-soft p-3 text-sm font-medium text-danger">
          {t(`error.${state.error}`)}
        </p>
      ) : null}
      <button type="submit" disabled={pending || !rating} className={buttonClass()}>
        {pending ? <LoaderCircle className="size-5 animate-spin" aria-hidden="true" /> : null}
        {t("submit")}
      </button>
      <p className="text-xs text-warm-600">{t("note")}</p>
    </form>
  );
}
