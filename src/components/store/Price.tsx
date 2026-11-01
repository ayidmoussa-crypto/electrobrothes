import { getTranslations } from "next-intl/server";
import { PriceView, type PriceProps } from "./PriceView";

export { discountPercent } from "./PriceView";

export async function Price(props: PriceProps) {
  const t = await getTranslations({ locale: props.locale, namespace: "product" });
  return <PriceView {...props} labels={{ from: t("from"), originalPrice: t("originalPrice") }} />;
}
