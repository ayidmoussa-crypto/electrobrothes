import { Banknote, BadgeCheck, PhoneCall, ShieldCheck, ShoppingCart, Star, Truck } from "lucide-react";
import Image from "next/image";
import { getTranslations } from "next-intl/server";
import type { ReactNode } from "react";
import { CampaignTracker } from "@/components/analytics/CampaignTracker";
import { NightSky } from "@/components/store/NightSky";
import { PriceView } from "@/components/store/PriceView";
import { WhatsAppGlyph } from "@/components/store/WhatsAppButton";
import type { LandingTemplate, MiddleSection, PublishedLanding } from "@/lib/landing";
import type { LandingProduct } from "@/lib/landing-data";
import { cutoutUrl } from "@/lib/image-cutout";
import { formatMAD } from "@/lib/money";
import { orderRequestText, whatsappLink } from "@/lib/order-whatsapp";
import type { CheckoutConfig } from "@/lib/store-config";
import { TIME_ZONE } from "@/lib/time";
import { FeatureIcon } from "./FeatureIcon";
import { LandingOrderForm, type LandingVariant } from "./LandingOrderForm";

/** How each template looks. The structure (and every required piece) is the same; only the surfaces change. */
const THEME: Record<LandingTemplate, { hero: string; dark: boolean; muted: string; band: string; card: string; disc: string; layout: "split" | "center" | "editorial" }> = {
  dark_premium: { hero: "bg-ink", dark: true, muted: "text-warm-300", band: "bg-warm-50", card: "rounded-2xl border border-warm-200 bg-white", disc: "bg-ink text-yellow-500", layout: "split" },
  product_spotlight: { hero: "bg-yellow-50", dark: false, muted: "text-warm-600", band: "bg-yellow-50", card: "rounded-3xl bg-white shadow-sm shadow-ink/5", disc: "bg-yellow-500 text-ink", layout: "center" },
  comparison: { hero: "bg-warm-100", dark: false, muted: "text-warm-600", band: "bg-white", card: "rounded-2xl border border-warm-200 bg-warm-50", disc: "bg-ink text-yellow-500", layout: "split" },
  editorial: { hero: "bg-warm-50", dark: false, muted: "text-warm-600", band: "bg-white", card: "border-t-2 border-ink pt-4", disc: "bg-warm-100 text-ink", layout: "editorial" },
};

const variantLabel = (v: { colorAr: string | null; storage: string | null }) => [v.colorAr, v.storage].filter(Boolean).join(" · ");

/**
 * A product's landing page, from a fixed template. Every template has: the price and "اطلب الآن" inside the hero, the
 * shop's promises, the order form at the end (every button scrolls to it) and, on phones, a bar fixed at the bottom
 * with the price, "اطلب الآن" and WhatsApp. Static: no animation. Prices, stock, photos, dates and reviews come from
 * the product; only the texts come from the page.
 */
export async function LandingView({ product: p, page, config, tracking = true }: { product: LandingProduct; page: PublishedLanding; config: CheckoutConfig; tracking?: boolean }) {
  const t = await getTranslations({ locale: "ar", namespace: "landing" });
  // Clicks counted for Campaign Studio (the owner's previews are not counted).
  const trackAttrs = (type: "hero_cta_click" | "whatsapp_click") => (tracking ? { "data-track": type, "data-product": p.id, "data-template": page.template } : {});
  const theme = THEME[page.template];
  const c = page.content;

  const inStock = p.variants.filter((v) => v.stock > 0);
  const shown = inStock.find((v) => v.isDefault) ?? [...inStock].sort((a, b) => a.price - b.price)[0] ?? p.variants[0];
  const compareAt = shown.compareAtPrice && shown.compareAtPrice > shown.price ? shown.compareAtPrice : null;
  const soldOut = inStock.length === 0;
  const variants: LandingVariant[] = p.variants.map((v) => ({ id: v.id, label: variantLabel(v) || p.nameAr, price: v.price, stock: v.stock, colorHex: v.colorHex }));
  const whatsapp = config.whatsappNumber.replace(/\D/g, "");
  const waHref = whatsapp ? whatsappLink(whatsapp, orderRequestText(p.nameAr, shown.price)) : null;
  const image = p.images[0];
  const cut = cutoutUrl(image.url);
  const endDate = p.dealEndsAt ? new Intl.DateTimeFormat("ar-MA", { day: "numeric", month: "long", timeZone: TIME_ZONE }).format(p.dealEndsAt) : null;
  const trust = [t("trustCod"), p.warrantyMonths > 0 && t("trustWarranty"), config.deliveryTime.ar && t("trustDelivery", { time: config.deliveryTime.ar }), t("trustCall")].filter(Boolean) as string[];

  const orderButton = (extra = "") => (
    <a href="#order" {...trackAttrs("hero_cta_click")} className={`inline-flex min-h-12 items-center justify-center gap-2 rounded-full bg-yellow-500 px-7 text-lg font-extrabold text-ink transition-colors hover:bg-yellow-600 active:bg-yellow-700 ${extra}`}>
      <ShoppingCart className="size-5" aria-hidden="true" />
      {t("orderNow")}
    </a>
  );
  const waButton = waHref ? (
    <a
      href={waHref}
      {...trackAttrs("whatsapp_click")}
      target="_blank"
      rel="noopener noreferrer"
      aria-label={t("whatsappLabel", { name: p.nameAr })}
      className={`inline-flex min-h-12 items-center justify-center gap-2 rounded-full border px-5 font-bold transition-colors ${theme.dark ? "border-warm-700 text-white hover:bg-white/5" : "border-warm-300 bg-white text-ink hover:bg-warm-50"}`}
    >
      <WhatsAppGlyph className="size-5 text-whatsapp" />
      {t("whatsapp")}
    </a>
  ) : null;

  const pill =
    endDate || compareAt ? (
      <p className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-sm font-bold ${theme.dark ? "bg-yellow-500 text-ink" : "bg-ink text-white"}`}>
        {t("offer")}
        {endDate && p.dealEndsAt ? (
          <>
            <span aria-hidden="true">·</span>
            <time dateTime={p.dealEndsAt.toISOString()}>{t("ends", { date: endDate })}</time>
          </>
        ) : null}
      </p>
    ) : null;

  const photo = (box: string, sizes: string) => (
    <div className={`relative isolate flex justify-center ${box}`}>
      <span aria-hidden="true" className={`product-disc ${theme.dark ? "product-disc-dark" : ""}`} />
      <Image
        src={cut ?? image.url}
        alt={image.altAr || p.nameAr}
        width={640}
        height={640}
        sizes={sizes}
        preload
        fetchPriority="high"
        loading="eager"
        unoptimized={image.url.endsWith(".svg")}
        className={`h-full w-auto max-w-full object-contain ${cut ? (theme.dark ? "drop-shadow-[0_18px_30px_rgb(0_0_0/0.5)]" : "drop-shadow-[0_18px_22px_rgb(17_17_17/0.18)]") : "rounded-3xl bg-white p-4"}`}
      />
    </div>
  );

  const priceBlock = (
    <div className="flex flex-col gap-1">
      <PriceView price={shown.price} compareAtPrice={compareAt} locale="ar" size="lg" tone={theme.dark ? "onDark" : "default"} labels={{ from: "", originalPrice: t("originalPrice") }} />
      {soldOut ? <p className="text-sm font-bold text-danger">{t("soldOut")}</p> : null}
    </div>
  );

  const trustLine = (
    <ul className={`flex flex-wrap gap-x-2 gap-y-1 text-sm ${theme.muted} ${theme.layout === "center" ? "justify-center" : ""}`}>
      {trust.map((item, i) => (
        <li key={item} className="flex items-center gap-2">
          {i ? <span aria-hidden="true">·</span> : null}
          {item}
        </li>
      ))}
    </ul>
  );

  const titleBlock = (big: string) => (
    <>
      <h1 className={`${big} ${theme.dark ? "text-white" : "text-ink"}`}>{c.headline || p.nameAr}</h1>
      {c.subline ? <p className={`mt-2 text-lg ${theme.muted}`}>{c.subline}</p> : null}
      <p className={`mt-2 flex flex-wrap items-center gap-2 text-sm font-semibold ${theme.dark ? "text-white" : "text-ink"}`}>
        {c.headline && c.headline !== p.nameAr ? <span className={theme.muted}>{p.nameAr}</span> : null}
        <span className={`inline-flex items-center gap-1 rounded-full border px-2.5 py-0.5 ${theme.dark ? "border-warm-700" : "border-warm-300"}`}>
          <BadgeCheck className={`size-4 ${theme.dark ? "text-yellow-500" : "text-ink"}`} aria-hidden="true" />
          {t("genuine")}
        </span>
      </p>
    </>
  );

  // Comparison template: the options, side by side with their prices, right in the hero.
  const optionChips =
    page.template === "comparison" && p.variants.length > 1 ? (
      <ul className="flex flex-wrap gap-2" aria-label={t("optionsTitle")}>
        {p.variants.map((v) => (
          <li key={v.id} className={`rounded-xl border border-warm-200 bg-white px-3 py-1.5 text-sm ${v.stock <= 0 ? "text-warm-500 line-through" : "text-ink"}`}>
            <span className="font-semibold">{variantLabel(v) || p.nameAr}</span> · {formatMAD(v.price, "ar")}
          </li>
        ))}
      </ul>
    ) : null;

  const hero =
    theme.layout === "center" ? (
      <div className="mx-auto flex max-w-3xl flex-col items-center gap-3 px-4 pt-5 pb-8 text-center md:pt-10">
        {pill}
        {photo("h-60 w-full md:h-96", "(min-width: 768px) 32rem, 80vw")}
        <div>{titleBlock("text-3xl md:text-5xl")}</div>
        {priceBlock}
        <div className="flex w-full flex-wrap justify-center gap-3">
          {orderButton("flex-1 sm:flex-none")}
          {waButton}
        </div>
        {trustLine}
      </div>
    ) : theme.layout === "editorial" ? (
      <div className="mx-auto max-w-5xl px-4 pt-6 pb-8 md:pt-14">
        {pill}
        <div className="mt-3">{titleBlock("text-4xl leading-tight md:text-6xl")}</div>
        <div className="mt-4 flex flex-wrap items-center gap-x-5 gap-y-3">
          {priceBlock}
          <div className="flex flex-1 flex-wrap gap-3">
            {orderButton("flex-1 sm:flex-none")}
            {waButton}
          </div>
        </div>
        <div className="mt-4">{trustLine}</div>
        {photo("mt-6 h-64 w-full rounded-3xl bg-warm-50 py-4 md:h-[28rem]", "(min-width: 1024px) 64rem, 100vw")}
      </div>
    ) : (
      <div className="mx-auto grid max-w-7xl gap-x-12 px-4 pt-4 pb-8 [grid-template-areas:'img'_'info'] md:grid-cols-2 md:items-center md:py-12 md:[grid-template-areas:'info_img']">
        {photo("h-56 [grid-area:img] md:h-[26rem]", "(min-width: 768px) 28rem, 75vw")}
        <div className="flex flex-col gap-3 [grid-area:info]">
          {pill ? <div>{pill}</div> : null}
          <div>{titleBlock("text-3xl md:text-5xl")}</div>
          {optionChips}
          {priceBlock}
          <div className="flex gap-3">
            {orderButton("flex-1 sm:flex-none")}
            {waButton}
          </div>
          {trustLine}
        </div>
      </div>
    );

  const sectionTitle = (text: string) => <h2 className={`mb-5 text-2xl md:text-3xl ${page.template === "product_spotlight" ? "text-center" : ""}`}>{text}</h2>;
  const wrap = (key: string, title: string, body: ReactNode, i: number) => (
    <section key={key} aria-label={title} className={i % 2 === 0 ? theme.band : "bg-white"}>
      <div className="mx-auto max-w-5xl px-4 py-10 md:py-14">
        {sectionTitle(title)}
        {body}
      </div>
    </section>
  );

  const comparisonRows = c.comparison.filter((r) => r.label && r.values.some(Boolean));
  const middle: Record<MiddleSection, () => ReactNode> = {
    features: () =>
      c.features.length ? (
        <ul className={`grid gap-4 ${c.features.length > 3 ? "sm:grid-cols-2 lg:grid-cols-3" : "sm:grid-cols-3"}`}>
          {c.features.map((f) => (
            <li key={f.title} className={`flex gap-3 p-4 ${theme.card}`}>
              <span className={`grid size-11 shrink-0 place-items-center rounded-full ${theme.disc}`}>
                <FeatureIcon name={f.icon} className="size-5" />
              </span>
              <span>
                <b className="block text-ink">{f.title}</b>
                <span className="text-sm text-warm-700">{f.text}</span>
              </span>
            </li>
          ))}
        </ul>
      ) : null,
    comparison: () =>
      p.variants.length > 1 || comparisonRows.length ? (
        <div className="flex flex-col gap-6">
          {p.variants.length > 1 ? (
            <div className="overflow-x-auto rounded-2xl border border-warm-200 bg-white">
              <table className="w-full text-sm">
                <caption className="sr-only">{t("optionsTitle")}</caption>
                <thead className="bg-warm-100 text-start">
                  <tr>
                    <th scope="col" className="px-4 py-3 text-start font-semibold">{t("option")}</th>
                    <th scope="col" className="px-4 py-3 text-start font-semibold">{t("price")}</th>
                    <th scope="col" className="px-4 py-3 text-start font-semibold">{t("availability")}</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-warm-200">
                  {p.variants.map((v) => (
                    <tr key={v.id}>
                      <th scope="row" className="px-4 py-3 text-start font-semibold text-ink">{variantLabel(v) || p.nameAr}</th>
                      <td className="px-4 py-3 font-bold tabular-nums">{formatMAD(v.price, "ar")}</td>
                      <td className={`px-4 py-3 font-semibold ${v.stock > 0 ? "text-success" : "text-danger"}`}>{v.stock > 0 ? t("inStock") : t("soldOut")}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : null}
          {comparisonRows.length ? (
            <dl className="divide-y divide-warm-200 overflow-hidden rounded-2xl border border-warm-200 bg-white">
              {comparisonRows.map((r) => (
                <div key={r.label} className="grid grid-cols-[minmax(0,2fr)_minmax(0,3fr)] gap-3 px-4 py-3 text-sm">
                  <dt className="font-semibold text-warm-600">{r.label}</dt>
                  <dd className="font-semibold text-ink">{r.values.filter(Boolean).join(" · ")}</dd>
                </div>
              ))}
            </dl>
          ) : null}
        </div>
      ) : null,
    warranty: () => (
      <div className="flex flex-col gap-6">
        <ul className="grid gap-3 sm:grid-cols-2">
          {[
            { Icon: Banknote, text: t("cod") },
            p.warrantyMonths > 0 ? { Icon: ShieldCheck, text: t("warrantyMonths", { months: p.warrantyMonths }) } : null,
            config.deliveryTime.ar ? { Icon: Truck, text: t("delivery", { time: config.deliveryTime.ar }) } : null,
            { Icon: PhoneCall, text: t("call") },
          ]
            .filter((x) => x !== null)
            .map(({ Icon, text }) => (
              <li key={text} className={`flex items-center gap-3 p-4 ${theme.card}`}>
                <span className={`grid size-10 shrink-0 place-items-center rounded-full ${theme.disc}`}>
                  <Icon className="size-5" aria-hidden="true" />
                </span>
                <span className="font-semibold text-ink">{text}</span>
              </li>
            ))}
        </ul>
        {config.replacementPolicy.ar ? <p className="text-warm-700">{config.replacementPolicy.ar}</p> : null}
        {c.faq.length ? (
          <div>
            <h3 className="mb-3 text-xl">{t("faqTitle")}</h3>
            <div className="flex flex-col gap-2">
              {c.faq.map((f) => (
                <details key={f.q} className="group rounded-xl border border-warm-200 bg-white">
                  <summary className="flex min-h-12 cursor-pointer list-none items-center justify-between gap-3 px-4 font-semibold text-ink [&::-webkit-details-marker]:hidden">
                    {f.q}
                    <span aria-hidden="true" className="text-xl text-warm-500 group-open:rotate-45">+</span>
                  </summary>
                  <p className="px-4 pb-4 text-warm-700">{f.a}</p>
                </details>
              ))}
            </div>
          </div>
        ) : null}
      </div>
    ),
    reviews: () =>
      p.reviews.length ? (
        <ul className="grid gap-4 md:grid-cols-3">
          {p.reviews.map((r) => (
            <li key={r.id}>
              <figure className="flex h-full flex-col rounded-xl border border-warm-200 bg-white p-5">
                <span className="flex items-center gap-1" role="img" aria-label={t("stars", { rating: r.rating })}>
                  {Array.from({ length: r.rating }, (_, i) => (
                    <Star key={i} className="size-4 fill-yellow-500 text-yellow-700" aria-hidden="true" />
                  ))}
                </span>
                <blockquote className="mt-2 flex-1 text-warm-800">{r.comment}</blockquote>
                <figcaption className="mt-3 border-t border-warm-200 pt-3 text-sm">
                  <b className="text-ink">{r.authorName}</b>
                  {r.city ? <span className="text-warm-600"> · {r.city}</span> : null}
                  <span className="mt-0.5 flex items-center gap-1 text-xs font-semibold text-success">
                    <BadgeCheck className="size-3.5" aria-hidden="true" />
                    {t("verified")}
                  </span>
                </figcaption>
              </figure>
            </li>
          ))}
        </ul>
      ) : null,
  };
  const titles: Record<MiddleSection, string> = { features: t("featuresTitle"), comparison: t("comparisonTitle"), warranty: t("warrantyTitle"), reviews: t("reviewsTitle") };

  // Sections with nothing real to show (no reviews, nothing to compare) are left out, whatever the setting.
  const sections = page.sections
    .filter((s) => !s.hidden)
    .map((s) => ({ key: s.key, body: middle[s.key]() }))
    .filter((s) => s.body !== null);

  return (
    // Bottom padding on phones: room for the fixed order bar.
    <div className="pb-24 md:pb-0">
      {tracking ? <CampaignTracker source="page" /> : null}
      <section className={`relative isolate -mt-20 overflow-hidden pt-20 md:-mt-[141px] md:pt-[141px] xl:-mt-20 xl:pt-20 ${theme.hero}`}>
        {theme.dark ? <NightSky /> : null}
        {hero}
      </section>

      {sections.map((s, i) => wrap(s.key, titles[s.key], s.body, i))}

      <section id="order" aria-labelledby="order-title" className="scroll-mt-28 bg-ink">
        <div className="mx-auto max-w-xl px-4 py-10 md:py-14">
          <h2 id="order-title" className="text-2xl text-white md:text-3xl">
            {t("orderTitle")}
          </h2>
          <p className="mt-1 mb-5 text-warm-300">{t("orderSubtitle")}</p>
          <div className="rounded-3xl bg-white p-4 sm:p-6">
            {soldOut ? (
              <p className="text-center font-bold text-danger">{t("soldOut")}</p>
            ) : (
              <LandingOrderForm productId={p.id} productName={p.nameAr} variants={variants} defaultVariantId={shown.id} config={config} template={page.template} />
            )}
          </div>
        </div>
      </section>

      {/* Phones: always one tap from ordering. */}
      <div className="fixed inset-x-0 bottom-0 z-40 border-t border-warm-700 bg-ink px-4 py-2.5 md:hidden">
        <div className="flex items-center gap-2">
          <span className="min-w-0 flex-1 leading-tight">
            <span className="block text-lg font-extrabold text-white tabular-nums">{formatMAD(shown.price, "ar")}</span>
            {compareAt ? <s className="text-xs text-warm-300">{formatMAD(compareAt, "ar")}</s> : null}
          </span>
          <a href="#order" {...trackAttrs("hero_cta_click")} className="inline-flex min-h-12 items-center justify-center gap-2 rounded-full bg-yellow-500 px-5 font-extrabold text-ink hover:bg-yellow-600 active:bg-yellow-700">
            <ShoppingCart className="size-5" aria-hidden="true" />
            {t("orderNow")}
          </a>
          {waHref ? (
            <a href={waHref} {...trackAttrs("whatsapp_click")} target="_blank" rel="noopener noreferrer" aria-label={t("whatsappLabel", { name: p.nameAr })} className="grid size-12 shrink-0 place-items-center rounded-full bg-whatsapp text-ink">
              <WhatsAppGlyph className="size-6" />
            </a>
          ) : null}
        </div>
      </div>
    </div>
  );
}
