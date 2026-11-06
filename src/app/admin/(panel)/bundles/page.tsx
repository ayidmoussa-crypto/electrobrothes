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

const mad = (v: number) => formatMAD(v, "ar");

export default async function BundlesAdminPage() {
  await requireAdmin();
  const [bundles, sold] = await Promise.all([
    db.bundle.findMany({
      orderBy: [{ sortOrder: "asc" }, { createdAt: "desc" }],
      include: {
        items: {
          orderBy: { sortOrder: "asc" },
          select: {
            quantity: true,
            product: {
              select: { nameAr: true, isActive: true, images: { select: { url: true }, orderBy: { sortOrder: "asc" }, take: 1 }, variants: { select: { price: true, stock: true } } },
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
        title="الباكات"
        description={sold._count ? `${sold._count} طلب فيه باك، والزبناء وفّروا ${mad(sold._sum.bundleDiscount ?? 0)}.` : "منتجات كتباع مجموعة بثمن أقل. كتبان فالصفحة الرئيسية وفصفحة /bundles."}
        actions={
          <Link href="/admin/bundles/new" className={buttonClass()}>
            <Plus className="size-4" aria-hidden="true" />
            باك جديد
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
                      {b.nameAr}
                    </Link>
                    <p className="truncate text-sm text-warm-600">{lines.map((l) => `${l.quantity > 1 ? `${l.quantity}× ` : ""}${l.nameAr}`).join(" + ")}</p>
                  </div>
                </div>
                <p className="text-sm">
                  <b className="text-ink">{mad(b.price)}</b> <s className="text-warm-500">{mad(separate)}</s>{" "}
                  {separate > b.price ? <span className="font-semibold text-success">يوفر {mad(separate - b.price)}</span> : null}
                </p>
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <span className={`rounded-full px-3 py-1 text-xs font-bold ${live ? "bg-success-soft text-success" : "bg-warm-100 text-warm-600"}`}>
                    {live ? "ظاهر فالمتجر" : !b.isActive ? "مخبي" : problem ? `مخبي: ${problem.nameAr} ما متوفرش` : "مخبي: الثمن ماشي أقل"}
                  </span>
                  <form action={toggleBundle}>
                    <input type="hidden" name="id" value={b.id} />
                    <button type="submit" className={buttonClass({ variant: "outline" })}>
                      {b.isActive ? "خبيه" : "ظهّرو"}
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
            <p className="font-semibold text-ink">مازال ما درتي حتى باك.</p>
            <p className="max-w-md text-sm text-warm-600">مثلاً: سماعة + پوشيت، ولا جوج كابلات بثمن واحد. الباك كيبان فالصفحة الرئيسية ملي يكون عندو خصم ومنتجاتو متوفرة.</p>
            <Link href="/admin/bundles/new" className={buttonClass()}>
              <Plus className="size-4" aria-hidden="true" />
              دير أول باك
            </Link>
          </div>
        </Panel>
      )}
    </>
  );
}
