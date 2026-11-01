import { Plus } from "lucide-react";
import Image from "next/image";
import Link from "next/link";
import { PageHeader, tdClass, thClass } from "@/components/admin/ui";
import { StockBadge, stockMessageKey } from "@/components/store/StockBadge";
import { Badge } from "@/components/ui/Badge";
import { buttonClass } from "@/components/ui/button";
import { requireAdmin } from "@/lib/admin";
import { db } from "@/lib/db";
import { formatMAD } from "@/lib/money";

const STOCK_LABEL = { inStock: "متوفر", lowStock: "مخزون منخفض", outOfStock: "نفد" } as const;

export default async function ProductsPage({ searchParams }: PageProps<"/admin/products">) {
  await requireAdmin();
  const sp = await searchParams;
  const q = (typeof sp.q === "string" ? sp.q : "").trim().slice(0, 80);
  const category = typeof sp.category === "string" ? sp.category : "";

  const [products, categories] = await Promise.all([
    db.product.findMany({
      where: {
        ...(category ? { categoryId: category } : {}),
        ...(q
          ? { OR: [{ nameAr: { contains: q, mode: "insensitive" } }, { nameEn: { contains: q, mode: "insensitive" } }, { variants: { some: { sku: { contains: q.toUpperCase() } } } }] }
          : {}),
      },
      include: {
        category: { select: { nameAr: true } },
        brand: { select: { name: true } },
        images: { take: 1, orderBy: { sortOrder: "asc" } },
        variants: { select: { price: true, stock: true } },
      },
      orderBy: { updatedAt: "desc" },
    }),
    db.category.findMany({ select: { id: true, nameAr: true }, orderBy: { sortOrder: "asc" } }),
  ]);
  const input = "min-h-11 rounded-lg border border-warm-200 bg-white px-3 text-sm text-warm-800";

  return (
    <>
      <PageHeader
        title="المنتجات"
        description={`${products.length} منتج`}
        actions={
          <Link href="/admin/products/new" className={buttonClass()}>
            <Plus className="size-4" aria-hidden="true" />
            منتج جديد
          </Link>
        }
      />
      <form method="get" className="mb-4 flex flex-wrap items-end gap-2 rounded-xl border border-warm-200 bg-white p-3">
        <label className="flex flex-col gap-1 text-xs text-warm-600">
          بحث
          <input name="q" defaultValue={q} placeholder="اسم أو SKU" className={`${input} w-56`} />
        </label>
        <label className="flex flex-col gap-1 text-xs text-warm-600">
          القسم
          <select name="category" defaultValue={category} className={input}>
            <option value="">كل الأقسام</option>
            {categories.map((c) => (
              <option key={c.id} value={c.id}>
                {c.nameAr}
              </option>
            ))}
          </select>
        </label>
        <button type="submit" className={buttonClass()}>
          تصفية
        </button>
      </form>

      <div className="overflow-x-auto rounded-xl border border-warm-200 bg-white">
        <table className="w-full min-w-[48rem]">
          <thead className="border-b border-warm-200 bg-warm-50">
            <tr>
              <th className={thClass}>المنتج</th>
              <th className={thClass}>القسم</th>
              <th className={thClass}>السعر</th>
              <th className={thClass}>المخزون</th>
              <th className={thClass}>الظهور</th>
            </tr>
          </thead>
          <tbody>
            {products.map((p) => {
              const prices = p.variants.map((v) => v.price);
              const stock = p.variants.reduce((s, v) => s + v.stock, 0);
              return (
                <tr key={p.id} className="border-b border-warm-200 last:border-0 hover:bg-warm-50">
                  <td className={tdClass}>
                    <Link href={`/admin/products/${p.id}`} className="flex items-center gap-3">
                      <span className="relative size-12 shrink-0 overflow-hidden rounded-md bg-warm-50">
                        {p.images[0] ? <Image src={p.images[0].url} alt="" fill sizes="48px" unoptimized className="object-contain p-1" /> : null}
                      </span>
                      <span>
                        <span className="block font-semibold text-ink underline-offset-4 hover:underline">{p.nameAr}</span>
                        <span className="text-xs text-warm-500" dir="ltr">
                          {p.brand.name}
                        </span>
                      </span>
                    </Link>
                  </td>
                  <td className={tdClass}>{p.category.nameAr}</td>
                  <td className={tdClass}>
                    {prices.length ? (Math.min(...prices) === Math.max(...prices) ? formatMAD(prices[0], "ar") : `${formatMAD(Math.min(...prices), "ar")} – ${formatMAD(Math.max(...prices), "ar")}`) : "—"}
                  </td>
                  <td className={tdClass}>
                    <span className="flex items-center gap-2">
                      <span className="font-bold text-ink">{stock}</span>
                      <StockBadge stock={stock} label={STOCK_LABEL[stockMessageKey(stock)]} />
                    </span>
                  </td>
                  <td className={tdClass}>{p.isActive ? <Badge tone="success">ظاهر</Badge> : <Badge>مخفي</Badge>}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </>
  );
}
