"use client";

import { Maximize2, X } from "lucide-react";
import Image from "next/image";
import { useTranslations } from "next-intl";
import { useRef, useState } from "react";

type Img = { url: string; alt: string };

/**
 * Main image with hover zoom that follows the pointer (desktop), a full-screen view
 * in a native <dialog> (tap on mobile, Esc to close) and thumbnails.
 */
export function ProductGallery({ images }: { images: Img[] }) {
  const t = useTranslations("pdp");
  const labels = { zoom: t("zoom"), close: t("close"), imageOf: (n: number) => t("imageOf", { n, total: images.length }) };
  const [index, setIndex] = useState(0);
  const zoomRef = useRef<HTMLDivElement>(null);
  const dialogRef = useRef<HTMLDialogElement>(null);
  const current = images[index];
  if (!current) return null;
  const svg = (url: string) => url.endsWith(".svg");

  return (
    <div className="flex flex-col gap-3">
      <button
        type="button"
        onClick={() => dialogRef.current?.showModal()}
        onMouseMove={(e) => {
          const r = e.currentTarget.getBoundingClientRect();
          zoomRef.current?.style.setProperty("transform-origin", `${((e.clientX - r.left) / r.width) * 100}% ${((e.clientY - r.top) / r.height) * 100}%`);
        }}
        aria-label={labels.zoom}
        className="group relative aspect-square cursor-zoom-in overflow-hidden rounded-xl border border-warm-200 bg-warm-50"
      >
        <div ref={zoomRef} className="absolute inset-0 transition-transform duration-200 [@media(hover:hover)]:group-hover:scale-[2]">
          <Image src={current.url} alt={current.alt} fill priority sizes="(min-width: 1024px) 45vw, 100vw" unoptimized={svg(current.url)} className="object-contain p-6" />
        </div>
        <span className="absolute end-3 bottom-3 grid size-10 place-items-center rounded-full bg-white text-ink shadow">
          <Maximize2 className="size-5" aria-hidden="true" />
        </span>
      </button>

      {images.length > 1 ? (
        <ul className="flex gap-2 overflow-x-auto">
          {images.map((img, i) => (
            <li key={img.url} className="shrink-0">
              <button
                type="button"
                onClick={() => setIndex(i)}
                aria-label={labels.imageOf(i + 1)}
                aria-current={i === index}
                className={`relative size-16 overflow-hidden rounded-lg border-2 bg-warm-50 ${i === index ? "border-ink" : "border-warm-200 hover:border-warm-300"}`}
              >
                <Image src={img.url} alt="" fill sizes="64px" unoptimized={svg(img.url)} className="object-contain p-1" />
              </button>
            </li>
          ))}
        </ul>
      ) : null}

      <dialog
        ref={dialogRef}
        aria-label={current.alt}
        onClick={(e) => e.target === e.currentTarget && e.currentTarget.close()}
        className="m-auto h-dvh max-h-none w-dvw max-w-none bg-white p-0 backdrop:bg-ink/80 md:h-[90vh] md:w-[90vw] md:rounded-xl"
      >
        <div className="relative size-full">
          <Image src={current.url} alt={current.alt} fill sizes="100vw" unoptimized={svg(current.url)} className="object-contain p-6" />
          <button
            type="button"
            onClick={() => dialogRef.current?.close()}
            aria-label={labels.close}
            className="absolute end-3 top-3 grid size-11 place-items-center rounded-full bg-ink text-white"
          >
            <X className="size-5" aria-hidden="true" />
          </button>
        </div>
      </dialog>
    </div>
  );
}
