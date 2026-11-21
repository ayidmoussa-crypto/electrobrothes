import { Select } from "@/components/ui/Select";
import { Plus } from "lucide-react";
import Image from "next/image";
import Link from "next/link";
import { Pagination, pageHref } from "@/components/admin/Pagination";
import { ScoreBadge } from "@/components/admin/SeoSuggestions";
import { PageHeader, tdClass, thClass } from "@/components/admin/ui";
import { StockBadge, stockMessageKey } from "@/components/store/StockBadge";
import { Badge } from "@/components/ui/Badge";
import { buttonClass } from "@/components/ui/button";
import { requireAdmin } from "@/lib/admin";
import { adminTr } from "@/lib/admin-lang";
import { db } from "@/lib/db";
import { formatMAD } from "@/lib/money";
import { clampPage, parsePage } from "@/lib/pagination";
import { WEAK_SCORE } from "@/lib/seo-content/rules";
import { ensureScored } from "@/lib/seo-content/score";
import { adminTitle } from "@/lib/admin-title";

export const generateMetadata = () => adminTitle("المنتجات", "Products");

const PAGE = 20;

export default async function ProductsPage({ searchParams }: PageProps<"/admin/products">) {
  const [, { tr, lang, ar }] = await Promise.all([requireAdmin(), adminTr()]);
  const STOCK_LABEL = { inStock: tr("متوفر", "In stock"), lowStock: tr("مخزون منخفض", "Low stock"), outOfStock: tr("نفد", "Sold out") };
  const mad = (v: number) => formatMAD(v, lang);
  const sp = await searchParams;
  const q = (typeof sp.q === "string" ? sp.q : "").trim().slice(0, 80);
  const category = typeof sp.category === "string" ? sp.category : "";
  const weakOnly = sp.weak === "1";

  await ensureScored();
  const where = {
    ...(weakOnly ? { seoScore: { lt: WEAK_SCORE } } : {}),
    ...(category ? { categoryId: category } : {}),
    ...(q
      ? { OR: [{ nameAr: { contains: q, mode: "insensitive" as const } }, { nameEn: { contains: q, mode: "insensitive" as const } }, { variants: { some: { sku: { contains: q.toUpperCase() } } } }] }
      : {}),
  };
  const total = await db.product.count({ where });
  const page = clampPage(parsePage(sp.page), total, PAGE);
  const [products, categories] = await Promise.all([
    db.product.findMany({
      where,
      include: {
        category: { select: { nameAr: true, nameEn: true } },
        brand: { select: { name: true } },
        images: { take: 1, orderBy: { sortOrder: "asc" } },
        variants: { select: { price: true, stock: true } },
      },
      // The id breaks ties, so a product never shows on two pages or none.
      orderBy: [weakOnly ? { seoScore: "asc" } : { updatedAt: "desc" }, { id: "asc" }],
      skip: (page - 1) * PAGE,
      take: PAGE,
    }),
    db.category.findMany({ select: { id: true, nameAr: true, nameEn: true }, orderBy: { sortOrder: "asc" } }),
  ]);
  const input ="min-h-11 admin-field rounded-lg px-3 text-sm text-warm-800";

  return (
    <>
      <PageHeader
        title={tr("المنتجات", "Products")}
        description={tr(`${total} منتج`, `${total} products`)}
        actions={
          <Link href="/admin/products/new" className={buttonClass()}>
            <Plus className="size-4" aria-hidden="true" />
            {tr("منتج جديد", "New product")}
          </Link>
        }
      />
      <form method="get" className="mb-4 flex flex-wrap items-end gap-2 admin-card p-3">
        <label className="flex flex-col gap-1 text-xs text-warm-600">
          {tr("بحث", "Search")}
          <input name="q" defaultValue={q} placeholder={tr("اسم أو SKU", "Name or SKU")} className={`${input} w-56`} />
        </label>
        <label className="flex flex-col gap-1 text-xs text-warm-600">
          {tr("القسم", "Category")}
          <Select name="category" defaultValue={category} className={input}>
            <option value="">{tr("كل الأقسام", "All categories")}</option>
            {categories.map((c) => (
              <option key={c.id} value={c.id}>
                {ar ? c.nameAr : c.nameEn}
              </option>
            ))}
          </Select>
        </label>
        <label className="flex min-h-11 cursor-pointer items-center gap-2 text-sm font-semibold text-warm-800">
          <input type="checkbox" name="weak" value="1" defaultChecked={weakOnly} className="size-4" />
          {tr(`المنتجات الضعيفة (أقل من ${WEAK_SCORE})`, `Weak products (under ${WEAK_SCORE})`)}
        </label>
        <button type="submit" className={buttonClass()}>
          {tr("تصفية", "Filter")}
        </button>
      </form>

      <div className="overflow-x-auto admin-card">
        <table className="w-full min-w-[48rem]">
          <thead className="border-b border-white/70 bg-white/45">
            <tr>
              <th className={thClass}>{tr("المنتج", "Product")}</th>
              <th className={thClass}>{tr("القسم", "Category")}</th>
              <th className={thClass}>{tr("السعر", "Price")}</th>
              <th className={thClass}>{tr("المخزون", "Stock")}</th>
              <th className={thClass}>{tr("الظهور", "Visibility")}</th>
              <th className={thClass}>{tr("السيو", "SEO")}</th>
            </tr>
          </thead>
          <tbody>
            {products.map((p) => {
              const prices = p.variants.map((v) => v.price);
              const stock = p.variants.reduce((s, v) => s + v.stock, 0);
              return (
                <tr key={p.id} className="border-b border-warm-200/60 last:border-0 transition-colors hover:bg-white/60">
                  <td className={tdClass}>
                    <Link href={`/admin/products/${p.id}`} className="flex items-center gap-3">
                      <span className="relative size-12 shrink-0 overflow-hidden rounded-md bg-warm-50">
                        {p.images[0] ? <Image src={p.images[0].url} alt="" fill sizes="48px" unoptimized className="object-contain p-1" /> : null}
                      </span>
                      <span>
                        <span className="block font-semibold text-ink underline-offset-4 hover:underline">{ar ? p.nameAr : p.nameEn}</span>
                        <span className="text-xs text-warm-500" dir="ltr">
                          {p.brand.name}
                        </span>
                      </span>
                    </Link>
                  </td>
                  <td className={tdClass}>{ar ? p.category.nameAr : p.category.nameEn}</td>
                  <td className={tdClass}>
                    {prices.length ? (Math.min(...prices) === Math.max(...prices) ? mad(prices[0]) : `${mad(Math.min(...prices))} – ${mad(Math.max(...prices))}`) : "—"}
                  </td>
                  <td className={tdClass}>
                    <span className="flex items-center gap-2">
                      <span className="font-bold text-ink">{stock}</span>
                      <StockBadge stock={stock} label={STOCK_LABEL[stockMessageKey(stock)]} />
                    </span>
                  </td>
                  <td className={tdClass}>{p.isActive ? <Badge tone="success">{tr("ظاهر", "Visible")}</Badge> : <Badge>{tr("مخفي", "Hidden")}</Badge>}</td>
                  <td className={tdClass}>
                    <Link href={`/admin/products/${p.id}`} title={p.seoProblems ? tr(`${p.seoProblems} مشكل`, `${p.seoProblems} issues`) : tr("كلشي كامل", "All complete")}>
                      <ScoreBadge score={p.seoScore} />
                    </Link>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      <Pagination page={page} total={total} size={PAGE} href={(n) => pageHref("/admin/products", { q, category, weak: weakOnly ? "1" : undefined }, n)} tr={tr} />
    </>
  );
}
