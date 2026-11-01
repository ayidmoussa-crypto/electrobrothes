import { SearchX } from "lucide-react";
import { getTranslations } from "next-intl/server";
import { buttonClass } from "@/components/ui/button";
import { StatePanel } from "@/components/ui/States";
import { Link } from "@/i18n/navigation";

export default async function NotFound() {
  const t = await getTranslations("states");
  return (
    <StatePanel
      icon={SearchX}
      title={t("notFoundTitle")}
      description={t("notFoundText")}
      action={
        <Link href="/" className={buttonClass()}>
          {t("backHome")}
        </Link>
      }
    />
  );
}
