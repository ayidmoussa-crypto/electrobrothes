import { MessageCircle, PackageSearch } from "lucide-react";
import type { Metadata } from "next";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { buttonClass } from "@/components/ui/button";
import { Link } from "@/i18n/navigation";
import type { Locale } from "@/i18n/routing";
import { pageMetadata } from "@/lib/seo";
import { staticPages, type StaticSlug } from "@/lib/static-pages";
import { getCheckoutConfig } from "@/lib/store-config";
import { Breadcrumbs } from "./Breadcrumbs";

export async function infoMetadata(slug: StaticSlug, params: Promise<{ locale: string }>): Promise<Metadata> {
  const locale = (await params).locale as Locale;
  const c = staticPages[slug][locale];
  return pageMetadata({ locale, path: `/${slug}`, title: c.title, description: c.description });
}

/** About / contact / FAQ / policies: same calm reading layout, content from lib/static-pages. */
export async function InfoPage({ slug, params }: { slug: StaticSlug; params: Promise<{ locale: string }> }) {
  const locale = (await params).locale as Locale;
  setRequestLocale(locale);
  const c = staticPages[slug][locale];
  const [t, config] = await Promise.all([getTranslations({ locale, namespace: "whatsapp" }), getCheckoutConfig()]);
  const whatsapp = config.whatsappNumber.replace(/\D/g, "");
  const tf = await getTranslations({ locale, namespace: "footer" });
  // Promises kept in the settings, so every page says the same thing.
  const fill = (text: string) => text.replace("{delivery}", config.deliveryTime[locale]).replace("{replacement}", config.replacementPolicy[locale]);

  return (
    <div className="mx-auto max-w-3xl px-4 pb-16">
      <Breadcrumbs locale={locale} items={[{ label: c.title }]} />
      <h1 className="text-3xl md:text-4xl">{c.title}</h1>
      <p className="mt-3 text-lg text-warm-600">{c.description}</p>

      {slug === "faq" ? (
        <div className="mt-8 flex flex-col gap-3">
          {c.blocks.map((b) => (
            <details key={b.h} className="group rounded-xl border border-warm-200 bg-white p-4 open:bg-warm-50">
              <summary className="flex min-h-8 cursor-pointer list-none items-center justify-between gap-3 font-bold text-ink [&::-webkit-details-marker]:hidden">
                {b.h}
                <span aria-hidden="true" className="text-xl text-warm-500 transition-transform group-open:rotate-45">
                  +
                </span>
              </summary>
              {b.p.map((p) => (
                <p key={p} className="mt-3 leading-relaxed text-warm-800">
                  {fill(p)}
                </p>
              ))}
            </details>
          ))}
        </div>
      ) : (
        <div className="mt-8 flex flex-col gap-8">
          {c.blocks.map((b) => (
            <section key={b.h}>
              <h2 className="text-xl">{b.h}</h2>
              {b.p.map((p) => (
                <p key={p} className="mt-3 leading-relaxed text-warm-800">
                  {fill(p)}
                </p>
              ))}
            </section>
          ))}
        </div>
      )}

      {slug === "contact" || slug === "faq" || slug === "warranty" ? (
        <div className="mt-10 flex flex-wrap gap-3 rounded-xl bg-warm-50 p-5">
          {whatsapp ? (
            <a
              href={`https://wa.me/${whatsapp}?text=${encodeURIComponent(t("message"))}`}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex min-h-11 items-center gap-2 rounded-lg bg-whatsapp px-5 font-semibold text-ink hover:opacity-90"
            >
              <MessageCircle className="size-5" aria-hidden="true" />
              {t("label")}
            </a>
          ) : null}
          <Link href="/track" className={buttonClass({ variant: "outline" })}>
            <PackageSearch className="size-5" aria-hidden="true" />
            {tf("track")}
          </Link>
        </div>
      ) : null}
    </div>
  );
}
