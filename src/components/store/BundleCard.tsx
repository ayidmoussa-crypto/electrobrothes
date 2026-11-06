import { Plus } from "lucide-react";
import Image from "next/image";
import { getTranslations } from "next-intl/server";
import { Link } from "@/i18n/navigation";
import type { Locale } from "@/i18n/routing";
import type { BundleData } from "@/lib/bundles-data";
import { formatMAD } from "@/lib/money";

/** The pack's own photo, or its products side by side with a "+" between them. */
export function BundleVisual({ bundle: b, locale, sizes, priority = false }: { bundle: BundleData; locale: Locale; sizes: string; priority?: boolean }) {
  const name = locale === "ar" ? b.nameAr : b.nameEn;
  if (b.image) {
    return <Image src={b.image} alt={name} fill sizes={sizes} priority={priority} unoptimized={b.image.endsWith(".svg")} className="object-contain p-4" />;
  }
  // Each unit once: "2 cases" shows two cases, so a pack never looks like a single product.
  const shown = b.items.filter((i) => i.image).flatMap((i) => Array.from({ length: i.quantity }, () => i)).slice(0, 3);
  return (
    <div className="absolute inset-0 flex items-center justify-center gap-1 p-3" role="img" aria-label={name}>
      {shown.map((i, n) => (
        <div key={n} className="contents">
          {n > 0 ? (
            <span aria-hidden="true" className="z-10 grid size-7 shrink-0 place-items-center rounded-full bg-ink text-yellow-500">
              <Plus className="size-4" strokeWidth={3} />
            </span>
          ) : null}
          <div className="relative aspect-square min-w-0 flex-1">
            <Image src={i.image!.url} alt="" fill sizes="20vw" unoptimized={i.image!.url.endsWith(".svg")} className="object-contain" />
          </div>
        </div>
      ))}
    </div>
  );
}

export async function BundleCard({ bundle: b, locale, priority = false }: { bundle: BundleData; locale: Locale; priority?: boolean }) {
  const t = await getTranslations({ locale, namespace: "bundles" });
  const ar = locale === "ar";
  const name = ar ? b.nameAr : b.nameEn;

  return (
    <article className="group relative flex h-full flex-col overflow-hidden rounded-xl border border-warm-200 bg-white transition-shadow duration-200 hover:shadow-lg hover:shadow-ink/10">
      <div className="relative aspect-[4/3] bg-warm-50 transition-transform duration-300 group-hover:scale-[1.02]">
        <BundleVisual bundle={b} locale={locale} sizes="(min-width: 1024px) 25vw, (min-width: 640px) 40vw, 80vw" priority={priority} />
        {b.saving > 0 ? (
          <span className="absolute start-2 top-2 rounded-md bg-success-soft px-2 py-1 text-sm font-bold text-success">{t("save", { amount: formatMAD(b.saving, locale) })}</span>
        ) : null}
      </div>

      <div className="flex flex-1 flex-col gap-1.5 p-3 sm:p-4">
        <p className="text-xs font-medium text-warm-500">{t("pieces", { count: b.items.reduce((s, i) => s + i.quantity, 0) })}</p>
        <h3 className="line-clamp-2 text-sm font-semibold text-ink sm:text-base">
          {/* Stretched link: the whole card is clickable, one tab stop. */}
          <Link href={`/bundles/${b.slug}`} className="after:absolute after:inset-0 after:content-['']">
            {name}
          </Link>
        </h3>
        <p className="line-clamp-2 text-sm text-warm-600">
          {b.items.map((i) => `${i.quantity > 1 ? `${i.quantity}× ` : ""}${ar ? i.nameAr : i.nameEn}`).join(" + ")}
        </p>
        <div className="mt-auto flex flex-wrap items-baseline gap-x-2 pt-2">
          <span className="text-lg font-extrabold text-ink">{formatMAD(b.price, locale)}</span>
          {b.saving > 0 ? <s className="text-sm text-warm-500">{formatMAD(b.separate, locale)}</s> : null}
        </div>
      </div>
    </article>
  );
}
