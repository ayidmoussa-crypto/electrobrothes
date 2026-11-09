import { ArrowRight } from "lucide-react";
import Link from "next/link";
import { ManualOrderForm } from "@/components/admin/ManualOrderForm";
import { PageHeader } from "@/components/admin/ui";
import { requireAdmin } from "@/lib/admin";
import { db } from "@/lib/db";
import { formatMoroccanPhone, normalizeMoroccanPhone } from "@/lib/phone";
import { colorLabel } from "@/lib/stock";

export default async function NewOrderPage({ searchParams }: PageProps<"/admin/orders/new">) {
  await requireAdmin();
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
        product: { select: { nameAr: true, images: { orderBy: { sortOrder: "asc" }, take: 1, select: { url: true } } } },
      },
      orderBy: [{ product: { nameAr: "asc" } }, { sortOrder: "asc" }],
    }),
    db.city.findMany({ where: { isActive: true }, orderBy: [{ sortOrder: "asc" }, { nameAr: "asc" }], select: { id: true, nameAr: true, shippingFee: true } }),
    db.settings.findUnique({ where: { id: 1 }, select: { freeShippingThreshold: true } }),
  ]);

  // Arriving from a WhatsApp conversation: the customer's number and name are already filled in.
  const phone = normalizeMoroccanPhone(typeof q.phone === "string" ? q.phone : "");
  const name = typeof q.name === "string" ? q.name.slice(0, 80) : "";

  return (
    <>
      <Link href="/admin/orders" className="mb-3 inline-flex min-h-11 items-center gap-1 text-sm text-warm-600 hover:text-ink">
        <ArrowRight className="size-4" aria-hidden="true" />
        كل الطلبات
      </Link>
      <PageHeader title="إضافة طلب" description="طلب جا من واتساب، مكالمة، ولا مواقع التواصل." />
      <ManualOrderForm
        variants={variants.map((v) => ({
          id: v.id,
          productId: v.productId,
          name: v.product.nameAr,
          label: colorLabel(v),
          colorHex: v.colorHex,
          sku: v.sku,
          price: v.price,
          stock: v.stock,
          image: v.product.images[0]?.url ?? null,
        }))}
        cities={cities.map((c) => ({ id: c.id, name: c.nameAr, fee: c.shippingFee }))}
        freeThreshold={settings?.freeShippingThreshold ?? 1000}
        defaults={{ name, phone: phone ? formatMoroccanPhone(phone) : "" }}
      />
    </>
  );
}
