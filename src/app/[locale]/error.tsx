"use client";

import { TriangleAlert } from "lucide-react";
import { useTranslations } from "next-intl";
import { useEffect } from "react";
import { buttonClass } from "@/components/ui/button";
import { StatePanel } from "@/components/ui/States";
import { Link } from "@/i18n/navigation";

export default function ErrorPage({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  const t = useTranslations("states");

  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <StatePanel
      role="alert"
      tone="danger"
      icon={TriangleAlert}
      title={t("errorTitle")}
      description={t("errorText")}
      action={
        <>
          <button type="button" onClick={reset} className={buttonClass()}>
            {t("retry")}
          </button>
          <Link href="/" className={buttonClass({ variant: "outline" })}>
            {t("backHome")}
          </Link>
        </>
      }
    />
  );
}
