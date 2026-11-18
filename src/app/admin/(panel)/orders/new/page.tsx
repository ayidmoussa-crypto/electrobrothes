import { ArrowRight } from "lucide-react";
import Link from "next/link";
import { ManualOrderForm } from "@/components/admin/ManualOrderForm";
import { PageHeader } from "@/components/admin/ui";
import { requireStaff } from "@/lib/admin";
import { adminTr } from "@/lib/admin-lang";
import { db } from "@/lib/db";
import { formatMoroccanPhone, normalizeMoroccanPhone } from "@/lib/phone";
import { colorLabel } from "@/lib/stock";

export default async function NewOrderPage({ searchParams }: PageProps<"/admin/orders/new">) {
  // Agents type in orders that come by WhatsApp or phone too; the ones they confirm count for them.
  const [user, { tr, ar }] = await Promise.all([requireStaff(), adminTr()]);
  const q = await searchParams;
  const [variants, cities, settings] = await Promise.all([
    db.variant.findMany({
      where: { product: { isActive: true } },
      select: {
        id: true,
        sku: true,
        price: true,
        stock: true,
        colorAr: true,
        colorHex: true,
        storage: true,
        productId: true,
        product: { select: { nameAr: true, nameEn: true, images: { orderBy: { sortOrder: "asc" }, take: 1, select: { url: true } } } },
      },
      orderBy: [{ product: { nameAr: "asc" } }, { sortOrder: "asc" }],
    }),
    db.city.findMany({ where: { isActive: true }, orderBy: [{ sortOrder: "asc" }, { nameAr: "asc" }], select: { id: true, nameAr: true, nameEn: true, shippingFee: true } }),
    db.settings.findUnique({ where: { id: 1 }, select: { freeShippingThreshold: true } }),
  ]);

  // A link can bring the customer's number and name, already filled in.
  const phone = normalizeMoroccanPhone(typeof q.phone === "string" ? q.phone : "");
  const name = typeof q.name === "string" ? q.name.slice(0, 80) : "";

  return (
    <>
      <Link href="/admin/orders" className="mb-3 inline-flex min-h-11 items-center gap-1 text-sm text-warm-600 hover:text-ink">
        <ArrowRight className="size-4 ltr:rotate-180" aria-hidden="true" />
        {tr("كل الطلبات", "All orders")}
      </Link>
      <PageHeader title={tr("إضافة طلب", "New order")} description={tr("طلب جا من واتساب، مكالمة، ولا مواقع التواصل.", "An order from WhatsApp, a call or social media.")} />
      <ManualOrderForm
        variants={variants.map((v) => ({
          id: v.id,
          productId: v.productId,
          name: ar ? v.product.nameAr : v.product.nameEn,
          label: colorLabel(v),
          colorHex: v.colorHex,
          sku: v.sku,
          price: v.price,
          stock: v.stock,
          image: v.product.images[0]?.url ?? null,
        }))}
        cities={cities.map((c) => ({ id: c.id, name: ar ? c.nameAr : c.nameEn, fee: c.shippingFee }))}
        freeThreshold={settings?.freeShippingThreshold ?? 1000}
        defaults={{ name, phone: phone ? formatMoroccanPhone(phone) : "" }}
        agent={user.role === "AGENT"}
      />
    </>
  );
}
