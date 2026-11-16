import { Eye } from "lucide-react";
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { Suspense } from "react";
import { LandingView } from "@/components/landing/LandingView";
import { getAdmin } from "@/lib/admin";
import { draftForView, getLandingProduct } from "@/lib/landing-data";
import { getCheckoutConfig } from "@/lib/store-config";

export const metadata: Metadata = { robots: { index: false, follow: false } };

export async function generateStaticParams() {
  return [{ slug: "none" }];
}

/** The owner's draft, shown exactly as the page will look. Staff only; everyone else gets a 404. */
async function Preview({ slug }: { slug: string }) {
  const admin = await getAdmin();
  if (admin?.role !== "OWNER") notFound();
  const [p, config, t] = await Promise.all([getLandingProduct(slug), getCheckoutConfig(), getTranslations({ locale: "ar", namespace: "landing" })]);
  if (!p) notFound();
  return (
    <>
      <p role="status" className="relative z-50 flex items-center justify-center gap-2 bg-yellow-100 px-4 py-2 text-center text-sm font-semibold text-yellow-900">
        <Eye className="size-4 shrink-0" aria-hidden="true" />
        {t("previewBanner")}
      </p>
      <LandingView product={p} page={draftForView(p)} config={config} />
    </>
  );
}

export default async function OfferPreviewPage({ params }: PageProps<"/[locale]/offers/[slug]/preview">) {
  const { slug } = await params;
  setRequestLocale("ar");
  return (
    <Suspense fallback={null}>
      <Preview slug={slug} />
    </Suspense>
  );
}
