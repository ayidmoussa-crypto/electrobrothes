import { ExternalLink, PenLine } from "lucide-react";
import Image from "next/image";
import Link from "next/link";
import { PageHeader, Panel, tdClass, thClass } from "@/components/admin/ui";
import { buttonClass } from "@/components/ui/button";
import { requireAdmin } from "@/lib/admin";
import { adminTr } from "@/lib/admin-lang";
import { db } from "@/lib/db";
import { isTemplate, TEMPLATE_LABEL } from "@/lib/landing";

/** Every product with its landing page status: none yet, draft, or live. */
export default async function LandingPagesAdmin() {
  const [, { tr, lang }] = await Promise.all([requireAdmin(), adminTr()]);
  const rows = await db.product.findMany({
    where: { isActive: true },
    orderBy: { nameAr: "asc" },
    select: {
      id: true,
      slug: true,
      nameAr: true,
      nameEn: true,
      images: { select: { url: true }, orderBy: { sortOrder: "asc" }, take: 1 },
      landingPage: { select: { template: true, publishedAt: true, updatedAt: true } },
    },
  });
  // Pages being worked on first (newest change on top), then the products without one, by name.
  const products = rows.sort((a, b) => (b.landingPage?.updatedAt.getTime() ?? 0) - (a.landingPage?.updatedAt.getTime() ?? 0));

  return (
    <>
      <PageHeader
        title={tr("صفحات الهبوط", "Landing pages")}
        description={tr(
          "صفحة خاصة بكل منتج للإعلانات، فيها الثمن، زر الطلب واستمارة الدفع عند الاستلام. القالب ثابت، كتبدل غير النصوص، والثمن والستوك والصور كيتاخدو من المنتج.",
          "One page per product for ads, with the price, the order button and the cash-on-delivery form. The template is fixed: only the texts change; price, stock and photos come from the product.",
        )}
      />
      <Panel>
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b border-warm-200">
                <th className={thClass}>{tr("المنتج", "Product")}</th>
                <th className={thClass}>{tr("الحالة", "Status")}</th>
                <th className={thClass}>{tr("القالب", "Template")}</th>
                <th className={thClass}>
                  <span className="sr-only">{tr("إجراءات", "Actions")}</span>
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-warm-200">
              {products.map((p) => {
                const lp = p.landingPage;
                const status = lp?.publishedAt ? tr("منشورة", "Live") : lp ? tr("مسودة", "Draft") : tr("بلا صفحة", "No page");
                return (
                  <tr key={p.id}>
                    <td className={tdClass}>
                      <span className="flex items-center gap-3">
                        <span className="relative size-10 shrink-0 overflow-hidden rounded-lg bg-warm-50">
                          {p.images[0] ? <Image src={p.images[0].url} alt="" fill sizes="40px" unoptimized={p.images[0].url.endsWith(".svg")} className="object-contain p-1" /> : null}
                        </span>
                        <span className="font-semibold text-ink">{lang === "en" ? p.nameEn : p.nameAr}</span>
                      </span>
                    </td>
                    <td className={tdClass}>
                      <span className={`rounded-full px-2.5 py-0.5 text-xs font-bold ${lp?.publishedAt ? "bg-success-soft text-success" : lp ? "bg-yellow-100 text-yellow-900" : "bg-warm-100 text-warm-600"}`}>{status}</span>
                    </td>
                    <td className={tdClass}>{lp && isTemplate(lp.template) ? TEMPLATE_LABEL[lp.template][lang] : "—"}</td>
                    <td className={`${tdClass} whitespace-nowrap`}>
                      <span className="flex justify-end gap-2">
                        {lp?.publishedAt ? (
                          <a href={`/offers/${p.slug}`} target="_blank" rel="noopener noreferrer" className={buttonClass({ variant: "ghost", size: "icon" })} aria-label={tr("فتح الصفحة المنشورة", "Open the live page")}>
                            <ExternalLink className="size-4" aria-hidden="true" />
                          </a>
                        ) : null}
                        <Link href={`/admin/landing/${p.id}`} className={buttonClass({ variant: "outline" })}>
                          <PenLine className="size-4" aria-hidden="true" />
                          {lp ? tr("تعديل", "Edit") : tr("إنشاء", "Create")}
                        </Link>
                      </span>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </Panel>
    </>
  );
}
