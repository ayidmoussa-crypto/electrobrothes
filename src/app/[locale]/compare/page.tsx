import { Select } from "@/components/ui/Select";
import { GitCompareArrows, X } from "lucide-react";
import type { Metadata } from "next";
import Image from "next/image";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { Suspense } from "react";
import { Breadcrumbs } from "@/components/store/Breadcrumbs";
import { Price } from "@/components/store/Price";
import { Rating } from "@/components/store/Rating";
import { StockStatus } from "@/components/store/StockStatus";
import { buttonClass } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/Skeleton";
import { StatePanel } from "@/components/ui/States";
import { getPathname, Link } from "@/i18n/navigation";
import type { Locale } from "@/i18n/routing";
import { getCategories, getProduct, getProductCards } from "@/lib/catalog";

export const metadata: Metadata = { robots: { index: false, follow: true } };

const MAX = 3;
type Raw = Record<string, string | string[] | undefined>;

/** ?p=a,b,c (or repeated p=) → up to 3 unique slugs. */
const slugsFrom = (raw: Raw) =>
  [...new Set((Array.isArray(raw.p) ? raw.p : raw.p ? [raw.p] : []).flatMap((s) => s.split(",")).filter(Boolean))].slice(0, MAX);

async function Comparison({ locale, searchParams }: { locale: Locale; searchParams: Promise<Raw> }) {
  const slugs = slugsFrom(await searchParams);
  const [t, ts, products, categories] = await Promise.all([
    getTranslations({ locale, namespace: "compare" }),
    getTranslations({ locale, namespace: "specs" }),
    Promise.all(slugs.map((s) => getProduct(s))),
    getCategories(),
  ]);
  const items = products.filter((p) => p !== null);
  const ar = locale === "ar";
  const href = (keep: string[]) => (keep.length ? `/compare?p=${keep.join(",")}` : "/compare");

  // Picker options grouped by category, minus what is already compared.
  const groups = await Promise.all(
    categories.map(async (c) => ({
      label: ar ? c.nameAr : c.nameEn,
      options: (await getProductCards({ categorySlug: c.slug })).filter((p) => !slugs.includes(p.slug)),
    })),
  );

  const specKeys = [...new Set(items.flatMap((p) => p.specs.map((s) => s.key)))];

  const addForm =
    items.length < MAX ? (
      <form action={getPathname({ href: "/compare", locale })} method="get" className="flex flex-col gap-2 sm:flex-row">
        {items.map((p) => (
          <input key={p.slug} type="hidden" name="p" value={p.slug} />
        ))}
        <label htmlFor="compare-add" className="sr-only">
          {t("add")}
        </label>
        <Select
          id="compare-add"
          name="p"
          required
          defaultValue=""
          className="min-h-11 flex-1 cursor-pointer rounded-lg border border-warm-200 bg-warm-100 px-3 text-base text-warm-800"
        >
          <option value="" disabled>
            {t("choose")}
          </option>
          {groups.map((g) =>
            g.options.length ? (
              <optgroup key={g.label} label={g.label}>
                {g.options.map((o) => (
                  <option key={o.slug} value={o.slug}>
                    {ar ? o.nameAr : o.nameEn}
                  </option>
                ))}
              </optgroup>
            ) : null,
          )}
        </Select>
        <button type="submit" className={buttonClass()}>
          {t("addButton")}
        </button>
      </form>
    ) : null;

  if (!items.length) {
    return (
      <>
        <StatePanel icon={GitCompareArrows} title={t("title")} description={t("empty")} />
        <div className="mx-auto max-w-xl">{addForm}</div>
      </>
    );
  }

  const row = "border-b border-warm-200";
  const th = "sticky start-0 z-10 bg-warm-50 px-3 py-3 text-start align-top text-sm font-semibold text-ink";
  const td = "px-3 py-3 align-top text-sm text-warm-800";

  return (
    <>
      {addForm ? <div className="mb-6 max-w-xl">{addForm}</div> : null}
      {/* Horizontal scroll only inside the table on small screens; the label column stays put. */}
      <div className="overflow-x-auto rounded-xl border border-warm-200">
        <table className="w-full min-w-[36rem] border-collapse">
          <caption className="sr-only">{t("title")}</caption>
          <thead>
            <tr className={row}>
              <td className="sticky start-0 z-10 w-32 bg-warm-50" />
              {items.map((p) => (
                <th key={p.slug} scope="col" className="min-w-44 px-3 py-4 text-start align-top">
                  <div className="relative mb-3 aspect-square w-full max-w-40 rounded-lg bg-warm-50">
                    {p.images[0] ? (
                      <Image src={p.images[0].url} alt="" fill sizes="160px" unoptimized={p.images[0].url.endsWith(".svg")} className="object-contain p-3" />
                    ) : null}
                  </div>
                  <Link href={`/products/${p.slug}`} className="font-bold text-ink underline-offset-4 hover:underline">
                    {ar ? p.nameAr : p.nameEn}
                  </Link>
                  <Link
                    href={href(slugs.filter((s) => s !== p.slug))}
                    className="mt-2 flex min-h-11 items-center gap-1 text-sm font-medium text-warm-600 hover:text-ink"
                  >
                    <X className="size-4" aria-hidden="true" />
                    {t("remove")}
                  </Link>
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            <tr className={row}>
              <th scope="row" className={th}>{t("price")}</th>
              {items.map((p) => {
                const cheapest = p.variants.reduce((a, b) => (b.price < a.price ? b : a));
                return (
                  <td key={p.slug} className={td}>
                    <Price price={cheapest.price} compareAtPrice={cheapest.compareAtPrice} from={p.variants.some((v) => v.price !== cheapest.price)} locale={locale} />
                  </td>
                );
              })}
            </tr>
            <tr className={row}>
              <th scope="row" className={th}>{t("brand")}</th>
              {items.map((p) => (
                <td key={p.slug} className={td} dir="ltr">{p.brand.name}</td>
              ))}
            </tr>
            <tr className={row}>
              <th scope="row" className={th}>{t("rating")}</th>
              {items.map((p) => (
                <td key={p.slug} className={td}>
                  {p.rating !== null ? <Rating value={p.rating} count={p.reviews.length} locale={locale} /> : "—"}
                </td>
              ))}
            </tr>
            <tr className={row}>
              <th scope="row" className={th}>{t("warranty")}</th>
              {items.map((p) => (
                <td key={p.slug} className={td}>{p.warrantyMonths > 0 ? t("months", { months: p.warrantyMonths }) : "—"}</td>
              ))}
            </tr>
            <tr className={row}>
              <th scope="row" className={th}>{t("availability")}</th>
              {items.map((p) => (
                <td key={p.slug} className={td}>
                  <StockStatus stock={p.variants.reduce((s, v) => s + v.stock, 0)} locale={locale} />
                </td>
              ))}
            </tr>
            {specKeys.map((key) => (
              <tr key={key} className={`${row} last:border-0`}>
                <th scope="row" className={th}>{ts.has(key) ? ts(key) : key}</th>
                {items.map((p) => {
                  const s = p.specs.find((x) => x.key === key);
                  return (
                    <td key={p.slug} className={td}>{s ? (ar ? s.valueAr : s.valueEn) : "—"}</td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </>
  );
}

export default async function ComparePage({ params, searchParams }: PageProps<"/[locale]/compare">) {
  const locale = (await params).locale as Locale;
  setRequestLocale(locale);
  const t = await getTranslations("compare");

  return (
    <div className="mx-auto max-w-7xl px-4 pb-16">
      <Breadcrumbs locale={locale} items={[{ label: t("title") }]} />
      <h1 className="text-3xl md:text-4xl">{t("title")}</h1>
      <p className="mt-2 mb-6 text-warm-600">{t("subtitle")}</p>
      <Suspense fallback={<Skeleton className="h-96 w-full" />}>
        <Comparison locale={locale} searchParams={searchParams} />
      </Suspense>
    </div>
  );
}
