import { Package, Plus } from "lucide-react";
import Image from "next/image";
import Link from "next/link";
import { toggleBundle } from "@/app/actions/admin-bundles";
import { PageHeader, Panel } from "@/components/admin/ui";
import { buttonClass } from "@/components/ui/button";
import { requireAdmin } from "@/lib/admin";
import { separatePrice } from "@/lib/bundles";
import { db } from "@/lib/db";
import { formatMAD } from "@/lib/money";
import { adminTr } from "@/lib/admin-lang";
import { adminTitle } from "@/lib/admin-title";

export const generateMetadata = () => adminTitle("الباكات", "Bundles");


export default async function BundlesAdminPage() {
  const [, { tr, lang, ar }] = await Promise.all([requireAdmin(), adminTr()]);
  const mad = (v: number) => formatMAD(v, lang);
  const [bundles, sold] = await Promise.all([
    db.bundle.findMany({
      orderBy: [{ sortOrder: "asc" }, { createdAt: "desc" }],
      include: {
        items: {
          orderBy: { sortOrder: "asc" },
          select: {
            quantity: true,
            product: {
              select: { nameAr: true, nameEn: true, isActive: true, images: { select: { url: true }, orderBy: { sortOrder: "asc" }, take: 1 }, variants: { select: { price: true, stock: true } } },
            },
          },
        },
      },
    }),
    db.order.aggregate({ where: { bundleDiscount: { gt: 0 }, status: { notIn: ["CANCELLED"] } }, _count: true, _sum: { bundleDiscount: true } }),
  ]);

  return (
    <>
      <PageHeader
        title={tr("الباكات", "Bundles")}
        description={
          sold._count
            ? tr(`${sold._count} طلب فيه باك، والزبناء وفّروا ${mad(sold._sum.bundleDiscount ?? 0)}.`, `${sold._count} orders with a bundle; customers saved ${mad(sold._sum.bundleDiscount ?? 0)}.`)
            : tr("منتجات كتباع مجموعة بثمن أقل. كتبان فالصفحة الرئيسية وفصفحة /bundles.", "Products sold together for less. Shown on the home page and on /bundles.")
        }
        actions={
          <Link href="/admin/bundles/new" className={buttonClass()}>
            <Plus className="size-4" aria-hidden="true" />
            {tr("باك جديد", "New bundle")}
          </Link>
        }
      />

      {bundles.length ? (
        <ul className="grid gap-4 md:grid-cols-2">
          {bundles.map((b) => {
            const lines = b.items.map((i) => {
              const inStock = i.product.variants.filter((v) => v.stock > 0);
              return {
                quantity: i.quantity,
                minPrice: Math.min(...(inStock.length ? inStock : i.product.variants).map((v) => v.price)),
                ok: i.product.isActive && inStock.reduce((s, v) => s + v.stock, 0) >= i.quantity,
                ...i.product,
              };
            });
            const separate = separatePrice(lines);
            const problem = lines.find((l) => !l.ok);
            const live = b.isActive && !problem && separate > b.price;
            return (
              <li key={b.id} className="admin-card flex flex-col gap-3 p-4">
                <div className="flex items-start gap-3">
                  <div className="flex -space-x-3 rtl:space-x-reverse">
                    {lines.slice(0, 3).map((l, n) => (
                      <div key={n} className="relative size-12 overflow-hidden rounded-lg border-2 border-white bg-white">
                        {l.images[0] ? <Image src={l.images[0].url} alt="" fill sizes="48px" unoptimized={l.images[0].url.endsWith(".svg")} className="object-contain p-1" /> : null}
                      </div>
                    ))}
                  </div>
                  <div className="min-w-0 flex-1">
                    <Link href={`/admin/bundles/${b.id}`} className="font-bold text-ink underline-offset-4 hover:underline">
                      {ar ? b.nameAr : b.nameEn}
                    </Link>
                    <p className="truncate text-sm text-warm-600">{lines.map((l) => `${l.quantity > 1 ? `${l.quantity}× ` : ""}${ar ? l.nameAr : l.nameEn}`).join(" + ")}</p>
                  </div>
                </div>
                <p className="text-sm">
                  <b className="text-ink">{mad(b.price)}</b> <s className="text-warm-500">{mad(separate)}</s>{" "}
                  {separate > b.price ? <span className="font-semibold text-success">{tr(`يوفر ${mad(separate - b.price)}`, `Saves ${mad(separate - b.price)}`)}</span> : null}
                </p>
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <span className={`rounded-full px-3 py-1 text-xs font-bold ${live ? "bg-success-soft text-success" : "bg-warm-100 text-warm-600"}`}>
                    {live
                      ? tr("ظاهر فالمتجر", "Live in the shop")
                      : !b.isActive
                        ? tr("مخبي", "Hidden")
                        : problem
                          ? tr(`مخبي: ${problem.nameAr} ما متوفرش`, `Hidden: ${problem.nameEn} is out of stock`)
                          : tr("مخبي: الثمن ماشي أقل", "Hidden: the price is not lower")}
                  </span>
                  <form action={toggleBundle}>
                    <input type="hidden" name="id" value={b.id} />
                    <button type="submit" className={buttonClass({ variant: "outline" })}>
                      {b.isActive ? tr("خبيه", "Hide") : tr("ظهّرو", "Show")}
                    </button>
                  </form>
                </div>
              </li>
            );
          })}
        </ul>
      ) : (
        <Panel>
          <div className="flex flex-col items-center gap-3 py-8 text-center">
            <Package className="size-10 text-warm-400" aria-hidden="true" />
            <p className="font-semibold text-ink">{tr("مازال ما درتي حتى باك.", "No bundles yet.")}</p>
            <p className="max-w-md text-sm text-warm-600">{tr("مثلاً: سماعة + پوشيت، ولا جوج كابلات بثمن واحد. الباك كيبان فالصفحة الرئيسية ملي يكون عندو خصم ومنتجاتو متوفرة.", "For example: earbuds + a case, or two cables for one price. A bundle shows on the home page when it has a discount and its products are in stock.")}</p>
            <Link href="/admin/bundles/new" className={buttonClass()}>
              <Plus className="size-4" aria-hidden="true" />
              {tr("دير أول باك", "Create the first bundle")}
            </Link>
          </div>
        </Panel>
      )}
    </>
  );
}
