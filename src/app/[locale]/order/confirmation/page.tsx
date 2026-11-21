import { Banknote, CircleCheck, MessageCircle, PackageSearch, Truck } from "lucide-react";
import type { Metadata } from "next";
import { cookies } from "next/headers";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { Suspense, type ReactNode } from "react";
import { TrackOnce } from "@/components/analytics/TrackOnce";
import { ClearCartOnce } from "@/components/store/ClearCartOnce";
import { buttonClass } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/Skeleton";
import { StatePanel } from "@/components/ui/States";
import { Link } from "@/i18n/navigation";
import type { Locale } from "@/i18n/routing";
import { db } from "@/lib/db";
import { formatMAD } from "@/lib/money";
import { ORDER_COOKIE } from "@/lib/orders";
import { formatMoroccanPhone } from "@/lib/phone";
import { getCheckoutConfig } from "@/lib/store-config";

export const metadata: Metadata = { robots: { index: false, follow: false } };

/** Reads the httpOnly cookie set by the order action: only the buyer's browser sees the details. */
async function Confirmation({ locale }: { locale: Locale }) {
  const orderId = (await cookies()).get(ORDER_COOKIE)?.value;
  const [t, config] = await Promise.all([getTranslations({ locale, namespace: "order" }), getCheckoutConfig()]);
  const order = orderId
    ? await db.order.findUnique({ where: { id: orderId }, include: { items: true, city: { select: { nameAr: true, nameEn: true, deliveryDays: true } } } })
    : null;

  if (!order) {
    return (
      <StatePanel
        icon={PackageSearch}
        title={t("missingTitle")}
        description={t("missingText")}
        action={
          <Link href="/track" className={buttonClass()}>
            {t("track")}
          </Link>
        }
      />
    );
  }

  const ar = locale === "ar";
  const whatsapp = config.whatsappNumber.replace(/\D/g, "");
  const waText = encodeURIComponent(t("whatsappMessage", { number: order.number }));
  const strong = (chunks: ReactNode) => <b className="font-bold text-ink">{chunks}</b>;
  const steps = [
    {
      Icon: MessageCircle,
      title: t("step1"),
      // The number reads left to right inside the Arabic sentence, so its groups keep their order.
      text: t.rich("next1", {
        phone: formatMoroccanPhone(order.phone),
        b: (chunks) => (
          <bdi dir="ltr" className="font-bold whitespace-nowrap text-ink">
            {chunks}
          </bdi>
        ),
      }),
    },
    { Icon: Truck, title: t("step2"), text: t.rich("next2", { days: order.city.deliveryDays, b: strong }) },
    { Icon: Banknote, title: t("step3"), text: t.rich("next3", { total: formatMAD(order.total, locale), b: strong }) },
  ];

  return (
    <div className="mx-auto max-w-2xl">
      <ClearCartOnce />
      <TrackOnce
        onceKey={`eb_purchase_${order.number}`}
        event={{
          name: "Purchase",
          orderNumber: order.number,
          value: order.total,
          items: order.items.map((i) => ({ id: i.variantId ?? i.sku, name: i.nameEn, price: i.unitPrice, quantity: i.quantity })),
        }}
      />
      <div className="flex flex-col items-center text-center">
        <span className="grid size-16 place-items-center rounded-full bg-success-soft text-success">
          <CircleCheck className="size-9" aria-hidden="true" />
        </span>
        <h1 className="mt-4 text-3xl">{t("thanksTitle")}</h1>
        <p className="mt-3 text-warm-600">{t("number")}</p>
        <p className="mt-1 rounded-lg bg-yellow-100 px-4 py-2 font-mono text-2xl font-extrabold tracking-wider text-yellow-900" dir="ltr">
          {order.number}
        </p>
      </div>

      <section className="mt-8 rounded-2xl border border-warm-200 bg-white p-5 sm:p-6">
        <h2 className="text-lg">{t("nextTitle")}</h2>
        {/* A short timeline: what happens, in order, each step with its own icon. */}
        <ol className="mt-5 flex flex-col">
          {steps.map(({ Icon, title, text }, i) => (
            <li key={title} className="relative flex gap-4 pb-6 last:pb-0">
              {i < steps.length - 1 ? <span aria-hidden="true" className="absolute start-5 top-11 bottom-1 w-px bg-warm-200" /> : null}
              <span className="grid size-10 shrink-0 place-items-center rounded-full bg-ink text-yellow-500">
                <Icon className="size-5" aria-hidden="true" />
              </span>
              <div className="pt-1">
                <p className="text-xs font-bold text-warm-600">
                  {i + 1}. {title}
                </p>
                <p className="mt-0.5 text-warm-800">{text}</p>
              </div>
            </li>
          ))}
        </ol>
        <div className="mt-6 flex flex-col gap-3 border-t border-warm-200 pt-5 sm:flex-row">
          {whatsapp ? (
            <a
              href={`https://wa.me/${whatsapp}?text=${waText}`}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex min-h-12 items-center justify-center gap-2 rounded-lg bg-whatsapp px-5 font-bold whitespace-nowrap text-white transition-opacity hover:opacity-90 sm:flex-1"
            >
              <MessageCircle className="size-5" aria-hidden="true" />
              {t("whatsapp")}
            </a>
          ) : null}
          <Link href="/track" className={buttonClass({ variant: "outline", className: "min-h-12 sm:flex-1" })}>
            {t("track")}
          </Link>
        </div>
      </section>

      <section className="mt-6 rounded-xl border border-warm-200 bg-warm-50 p-5 text-sm">
        <h2 className="text-lg">{t("items")}</h2>
        <ul className="mt-3 flex flex-col gap-2">
          {order.items.map((i) => (
            <li key={i.id} className="flex justify-between gap-3">
              <span>
                {ar ? i.nameAr : i.nameEn}
                {i.variantLabel ? <span className="text-warm-600"> · {i.variantLabel}</span> : null} × {i.quantity}
              </span>
              <span className="shrink-0 font-semibold whitespace-nowrap text-ink">{formatMAD(i.unitPrice * i.quantity, locale)}</span>
            </li>
          ))}
        </ul>
        <p className="mt-4 border-t border-warm-200 pt-3 text-warm-600">
          {t("deliverTo")}: <span className="text-ink">{ar ? order.city.nameAr : order.city.nameEn}</span>
        </p>
      </section>
    </div>
  );
}

export default async function ConfirmationPage({ params }: PageProps<"/[locale]/order/confirmation">) {
  const locale = (await params).locale as Locale;
  setRequestLocale(locale);
  return (
    <div className="px-4 py-10 pb-16">
      <Suspense fallback={<Skeleton className="mx-auto h-96 max-w-2xl" />}>
        <Confirmation locale={locale} />
      </Suspense>
    </div>
  );
}
