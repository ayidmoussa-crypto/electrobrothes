import { BarChart3, ExternalLink, Images, LayoutTemplate, PenLine, PlusCircle, type LucideIcon } from "lucide-react";
import Image from "next/image";
import Link from "next/link";
import { OfferIdeas } from "@/components/admin/OfferIdeas";
import { PageHeader, Panel } from "@/components/admin/ui";
import { buttonClass } from "@/components/ui/button";
import { requireAdmin } from "@/lib/admin";
import { adminTr } from "@/lib/admin-lang";
import { campaignStats } from "@/lib/campaign-stats";
import { db } from "@/lib/db";
import { isLive, isOfferStyle, OFFER_STYLE_LABEL } from "@/lib/offers";
import { TIME_ZONE } from "@/lib/time";
import { adminTitle } from "@/lib/admin-title";

export const generateMetadata = () => adminTitle("استوديو العروض", "Campaign Studio");

function Tile({ href, icon: Icon, title, text }: { href: string; icon: LucideIcon; title: string; text: string }) {
  return (
    <Link href={href} className="admin-card flex flex-col gap-2 p-4 transition-colors hover:bg-warm-50 md:p-5">
      <span className="grid size-10 place-items-center rounded-full bg-ink text-yellow-500">
        <Icon className="size-5" aria-hidden="true" />
      </span>
      <b className="text-lg text-ink">{title}</b>
      <span className="text-sm text-warm-600">{text}</span>
    </Link>
  );
}

/** The offers with where each one stands right now (live, scheduled, ended, draft). */
async function loadOffers() {
  const rows = await db.offer.findMany({
    orderBy: [{ isPublished: "desc" }, { sortOrder: "asc" }, { updatedAt: "desc" }],
    select: {
      id: true,
      name: true,
      style: true,
      isPublished: true,
      startsAt: true,
      endsAt: true,
      image: true,
      product: { select: { nameAr: true, nameEn: true, images: { select: { url: true }, orderBy: { sortOrder: "asc" }, take: 1 } } },
    },
  });
  const now = Date.now();
  return rows.map((o) => ({ ...o, live: isLive(o, now), ended: !!o.endsAt && o.endsAt.getTime() <= now }));
}

/** Campaign Studio: the week's home offers and the offer pages, with their figures. */
export default async function CampaignStudio() {
  const [, { tr, lang }] = await Promise.all([requireAdmin(), adminTr()]);
  const [offers, pages, stats] = await Promise.all([
    loadOffers(),
    db.landingPage.findMany({ orderBy: { updatedAt: "desc" }, take: 8, select: { publishedAt: true, product: { select: { id: true, slug: true, nameAr: true, nameEn: true } } } }),
    campaignStats(30, lang),
  ]);
  const clicks = new Map(stats.offers.map((r) => [r.key, r]));
  const date = new Intl.DateTimeFormat(lang === "en" ? "en-GB" : "ar-MA", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit", timeZone: TIME_ZONE });

  return (
    <>
      <PageHeader title={tr("استوديو العروض", "Campaign Studio")} description={tr("عروض الأسبوع فالرئيسية وصفحات العروض ديال الإعلانات.", "The week's offers on the home page and the offer pages for ads.")} />

      <div className="mb-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <Tile href="/admin/campaigns/new" icon={PlusCircle} title={tr("إنشاء عرض", "New offer")} text={tr("عرض جديد فوق الرئيسية", "A new offer at the top of the home page")} />
        <Tile href="/admin/campaigns/templates" icon={LayoutTemplate} title={tr("القوالب", "Templates")} text={tr("أشكال العروض وقوالب الصفحات", "Offer looks and page templates")} />
        <Tile href="/admin/campaigns/images" icon={Images} title={tr("مكتبة الصور", "Photo library")} text={tr("صور المنتجات والعروض", "Product and offer photos")} />
        <Tile href="/admin/campaigns/performance" icon={BarChart3} title={tr("أداء الحملات", "Campaign results")} text={tr("النقرات والطلبات والتوصيل", "Clicks, orders and deliveries")} />
      </div>

      <OfferIdeas />

      <Panel title={tr("عروض الرئيسية", "Home offers")} className="mb-6">
        {offers.length ? (
          <ul className="divide-y divide-warm-200">
            {offers.map((o) => {
              const { live, ended } = o;
              const status = live ? tr("منشور", "Live") : o.isPublished ? (ended ? tr("سالا", "Ended") : tr("مبرمج", "Scheduled")) : tr("مسودة", "Draft");
              const img = o.image ?? o.product.images[0]?.url;
              const row = clicks.get(o.id);
              return (
                <li key={o.id} className="flex flex-wrap items-center gap-3 py-3">
                  <span className="relative size-12 shrink-0 overflow-hidden rounded-lg bg-warm-50">
                    {img ? <Image src={img} alt="" fill sizes="48px" unoptimized={img.endsWith(".svg")} className="object-contain p-1" /> : null}
                  </span>
                  <span className="min-w-0 flex-1">
                    <b className="block text-ink">{o.name}</b>
                    <span className="block text-sm text-warm-600">
                      {lang === "en" ? o.product.nameEn : o.product.nameAr} · {isOfferStyle(o.style) ? OFFER_STYLE_LABEL[o.style][lang] : o.style}
                      {o.endsAt ? ` · ${tr("كيسالي", "ends")} ${date.format(o.endsAt)}` : ""}
                    </span>
                  </span>
                  <span className="text-sm text-warm-600 tabular-nums">{tr(`${row?.clicks ?? 0} نقرة · ${row?.orders ?? 0} طلب`, `${row?.clicks ?? 0} clicks · ${row?.orders ?? 0} orders`)}</span>
                  <span className={`rounded-full px-2.5 py-0.5 text-xs font-bold ${live ? "bg-success-soft text-success" : o.isPublished ? "bg-yellow-100 text-yellow-900" : "bg-warm-100 text-warm-600"}`}>{status}</span>
                  <Link href={`/admin/campaigns/${o.id}`} className={buttonClass({ variant: "outline" })}>
                    <PenLine className="size-4" aria-hidden="true" />
                    {tr("تعديل", "Edit")}
                  </Link>
                </li>
              );
            })}
          </ul>
        ) : (
          <p className="text-sm text-warm-600">{tr("ما كاين حتى عرض. الرئيسية كتبين العنوان العام وزر «تصفّح الأقسام» حتى تنشر عرض.", "No offer yet. The home page shows the shop title and the browse button until you publish one.")}</p>
        )}
      </Panel>

      <Panel title={tr("صفحات العروض", "Offer pages")}>
        {pages.length ? (
          <ul className="mb-3 divide-y divide-warm-200">
            {pages.map((p) => (
              <li key={p.product.id} className="flex flex-wrap items-center gap-3 py-2.5">
                <span className="min-w-0 flex-1">
                  <b className="block text-ink">{lang === "en" ? p.product.nameEn : p.product.nameAr}</b>
                  <span dir="ltr" className="block text-start text-sm text-warm-600">/offers/{p.product.slug}</span>
                </span>
                <span className={`rounded-full px-2.5 py-0.5 text-xs font-bold ${p.publishedAt ? "bg-success-soft text-success" : "bg-warm-100 text-warm-600"}`}>{p.publishedAt ? tr("منشور", "Live") : tr("مسودة", "Draft")}</span>
                {p.publishedAt ? (
                  <a href={`/offers/${p.product.slug}`} target="_blank" rel="noopener noreferrer" aria-label={tr("فتح الصفحة", "Open the page")} className={buttonClass({ variant: "ghost", size: "icon" })}>
                    <ExternalLink className="size-4" aria-hidden="true" />
                  </a>
                ) : null}
                <Link href={`/admin/landing/${p.product.id}`} className={buttonClass({ variant: "outline" })}>
                  <PenLine className="size-4" aria-hidden="true" />
                  {tr("تعديل", "Edit")}
                </Link>
              </li>
            ))}
          </ul>
        ) : null}
        <Link href="/admin/landing" className={buttonClass({ variant: "outline" })}>
          {tr("كل المنتجات وصفحاتهم", "All products and their pages")}
        </Link>
      </Panel>
    </>
  );
}
