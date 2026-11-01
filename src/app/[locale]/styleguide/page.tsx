import { PackageOpen } from "lucide-react";
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getTranslations, setRequestLocale } from "next-intl/server";
import type { ReactNode } from "react";
import { Suspense } from "react";
import { Price } from "@/components/store/Price";
import { ProductCard } from "@/components/store/ProductCard";
import { StockStatus } from "@/components/store/StockStatus";
import { Badge } from "@/components/ui/Badge";
import { buttonClass } from "@/components/ui/button";
import { Field, Input, Select, Textarea } from "@/components/ui/Field";
import { ProductGridSkeleton } from "@/components/ui/Skeleton";
import { StatePanel } from "@/components/ui/States";
import type { Locale } from "@/i18n/routing";
import { getProductCards } from "@/lib/catalog";

// Internal page to review every UI building block in both languages. Not linked, not indexed.
export const metadata: Metadata = { title: "Style guide", robots: { index: false, follow: false } };

function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="border-b border-warm-200 py-8">
      <h2 className="mb-4 text-xl">{title}</h2>
      {children}
    </section>
  );
}

async function Cards({ locale }: { locale: Locale }) {
  const products = await getProductCards({ take: 8 });
  return (
    <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 sm:gap-4 lg:grid-cols-4">
      {products.map((p, i) => (
        <ProductCard key={p.slug} product={p} locale={locale} priority={i < 2} />
      ))}
    </div>
  );
}

export default async function StyleGuide({ params }: PageProps<"/[locale]/styleguide">) {
  // Development tool only: a real 404 in production unless explicitly enabled.
  if (process.env.NODE_ENV === "production" && process.env.ENABLE_STYLEGUIDE !== "1") notFound();
  const locale = (await params).locale as Locale;
  setRequestLocale(locale);
  const [t, states] = await Promise.all([getTranslations("product"), getTranslations("states")]);

  return (
    <div className="mx-auto max-w-7xl px-4 pb-16">
      <h1 className="pt-8 text-3xl">Style guide</h1>

      <Section title="Buttons">
        <div className="flex flex-wrap items-center gap-3">
          <button type="button" className={buttonClass()}>Primary</button>
          <button type="button" className={buttonClass({ variant: "dark" })}>Dark</button>
          <button type="button" className={buttonClass({ variant: "outline" })}>Outline</button>
          <button type="button" className={buttonClass({ variant: "ghost" })}>Ghost</button>
          <button type="button" className={buttonClass({ size: "lg" })}>Large</button>
          <button type="button" className={buttonClass()} disabled>Disabled</button>
        </div>
      </Section>

      <Section title="Badges & stock">
        <div className="flex flex-wrap items-center gap-2">
          <Badge>Neutral</Badge>
          <Badge tone="accent">{t("bestSeller")}</Badge>
          <Badge tone="action">New</Badge>
          <Badge tone="ink">{t("outOfStock")}</Badge>
          <Badge tone="danger">
            <bdi dir="ltr">−30%</bdi>
          </Badge>
          <StockStatus stock={12} locale={locale} />
          <StockStatus stock={2} locale={locale} />
          <StockStatus stock={0} locale={locale} />
        </div>
      </Section>

      <Section title="Prices">
        <div className="flex flex-wrap gap-8">
          <Price price={2799} locale={locale} />
          <Price price={8490} compareAtPrice={9990} locale={locale} />
          <Price price={3999} from locale={locale} />
          <Price price={12990} compareAtPrice={14990} size="lg" locale={locale} />
        </div>
      </Section>

      <Section title="Form fields">
        <div className="grid max-w-xl gap-4">
          <Field id="sg-name" label="Full name" required>
            {(p) => <Input {...p} autoComplete="name" />}
          </Field>
          <Field id="sg-phone" label="Phone" hint="06 or 07, 10 digits" error="This phone number is not valid" required>
            {(p) => <Input {...p} type="tel" inputMode="tel" defaultValue="0812" />}
          </Field>
          <Field id="sg-city" label="City" required>
            {(p) => (
              <Select {...p} defaultValue="">
                <option value="" disabled>Choose…</option>
                <option>Casablanca</option>
              </Select>
            )}
          </Field>
          <Field id="sg-notes" label="Notes" optionalLabel="optional">
            {(p) => <Textarea {...p} />}
          </Field>
        </div>
      </Section>

      <Section title="Empty state">
        <StatePanel icon={PackageOpen} title={states("emptyTitle")} description={states("emptyText")} />
      </Section>

      <Section title="Loading skeleton">
        <ProductGridSkeleton count={4} label={t("loading")} />
      </Section>

      <Section title="Product cards (live data)">
        <Suspense fallback={<ProductGridSkeleton count={8} label={t("loading")} />}>
          <Cards locale={locale} />
        </Suspense>
      </Section>
    </div>
  );
}
