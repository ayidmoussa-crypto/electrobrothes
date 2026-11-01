import { getTranslations } from "next-intl/server";
import type { Locale } from "@/i18n/routing";
import { StockBadge, stockMessageKey } from "./StockBadge";

export async function StockStatus({ stock, locale }: { stock: number; locale: Locale }) {
  const t = await getTranslations({ locale, namespace: "product" });
  return <StockBadge stock={stock} label={t(stockMessageKey(stock), { count: stock })} />;
}
