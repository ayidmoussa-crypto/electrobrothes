import "server-only";
import { cacheLife, cacheTag } from "next/cache";
import { db } from "./db";

/** Cities, delivery fees and shop settings needed by the cart and the order form. */
export async function getCheckoutConfig() {
  "use cache";
  cacheLife("hours");
  cacheTag("settings");
  const [cities, settings] = await Promise.all([
    db.city.findMany({
      where: { isActive: true },
      select: { id: true, nameAr: true, nameEn: true, shippingFee: true, deliveryDays: true },
      orderBy: { sortOrder: "asc" },
    }),
    db.settings.findUnique({ where: { id: 1 } }),
  ]);
  return {
    cities,
    freeShippingThreshold: settings?.freeShippingThreshold ?? 1000,
    whatsappNumber: settings?.whatsappNumber ?? "",
  };
}

export type CheckoutConfig = Awaited<ReturnType<typeof getCheckoutConfig>>;
