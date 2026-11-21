import { Search, Zap } from "lucide-react";
import { getLocale, getTranslations } from "next-intl/server";
import { buttonClass } from "@/components/ui/button";
import { getPathname, Link } from "@/i18n/navigation";
import { getCategories } from "@/lib/catalog";

/** The lost-page screen: an ink card, a bolt for the zero of 404, a search and the shop's categories as a way back in. */
export default async function NotFound() {
  const [t, locale, categories] = await Promise.all([getTranslations("states"), getLocale(), getCategories()]);

  return (
    <div className="mx-auto max-w-3xl px-4 py-10 md:py-16">
      <section className="relative overflow-hidden rounded-[2rem] bg-ink px-6 py-12 text-center text-white md:px-12 md:py-16">
        {/* A soft yellow glow behind the number. */}
        <div aria-hidden="true" className="pointer-events-none absolute -top-24 start-1/2 size-80 -translate-x-1/2 rounded-full bg-yellow-500/15 blur-3xl" />

        <p aria-hidden="true" dir="ltr" className="relative flex items-center justify-center gap-2 text-8xl leading-none font-extrabold tracking-tight md:gap-4 md:text-9xl">
          <span>4</span>
          <span className="grid size-24 place-items-center rounded-full bg-yellow-500 text-ink md:size-32">
            <Zap className="size-12 fill-ink md:size-16" />
          </span>
          <span>4</span>
        </p>

        <h1 className="relative mt-8 text-3xl text-white md:text-4xl">{t("notFoundTitle")}</h1>
        <p className="relative mx-auto mt-3 max-w-md text-warm-300">{t("notFoundText")}</p>

        {/* A plain GET form to /search: works without JavaScript. */}
        <form action={getPathname({ href: "/search", locale })} method="get" role="search" className="relative mx-auto mt-8 flex max-w-md gap-2">
          <label className="relative flex-1">
            <span className="sr-only">{t("notFoundSearchLabel")}</span>
            <Search className="pointer-events-none absolute start-4 top-1/2 size-5 -translate-y-1/2 text-warm-500" aria-hidden="true" />
            <input
              name="q"
              type="search"
              autoComplete="off"
              placeholder={t("notFoundSearchPlaceholder")}
              className="min-h-12 w-full rounded-full border border-warm-200 bg-white ps-12 pe-4 text-base text-ink placeholder:text-warm-500 focus-visible:outline-none focus-visible:ring-3 focus-visible:ring-yellow-300"
            />
          </label>
          <button type="submit" className={buttonClass({ className: "shrink-0" })}>
            {t("notFoundSearch")}
          </button>
        </form>

        <div className="relative mt-6 flex justify-center">
          <Link href="/" className="inline-flex min-h-11 items-center rounded-full px-4 text-sm font-semibold text-yellow-500 underline-offset-4 hover:underline focus-visible:outline-none focus-visible:ring-3 focus-visible:ring-yellow-300">
            {t("backHome")}
          </Link>
        </div>
      </section>

      {categories.length ? (
        <nav aria-label={t("notFoundPopular")} className="mt-8 text-center">
          <p className="text-sm font-semibold text-warm-600">{t("notFoundPopular")}</p>
          <ul className="mt-3 flex flex-wrap justify-center gap-2">
            {categories.slice(0, 8).map((c) => (
              <li key={c.slug}>
                <Link href={`/category/${c.slug}`} className="inline-flex min-h-10 items-center rounded-full border border-warm-200 bg-white px-4 text-sm font-semibold text-ink transition-colors hover:border-yellow-500 hover:bg-yellow-100 focus-visible:outline-none focus-visible:ring-3 focus-visible:ring-yellow-300">
                  {locale === "ar" ? c.nameAr : c.nameEn}
                </Link>
              </li>
            ))}
          </ul>
        </nav>
      ) : null}
    </div>
  );
}
