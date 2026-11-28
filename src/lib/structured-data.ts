import type { Locale } from "@/i18n/routing";
import { absoluteUrl, SITE_NAME, siteUrl } from "./seo";

// Schema.org builders. They only describe what the page visibly shows (price, stock, reviews).

// The ways people type the name, so a search for any of them is matched to this site.
const BRAND_ALIASES = ["إلكترو براذرز", "Electro Brothers", "electrobrothers.com"];

const abs = (url: string) => (url.startsWith("http") ? url : `${siteUrl()}${url}`);

export function organizationLd(locale: Locale) {
  return {
    "@context": "https://schema.org",
    "@graph": [
      {
        "@type": "OnlineStore",
        "@id": `${siteUrl()}/#store`,
        name: SITE_NAME,
        alternateName: BRAND_ALIASES,
        url: absoluteUrl(locale, "/"),
        logo: `${siteUrl()}/brand/logo.svg`,
        areaServed: { "@type": "Country", name: "Morocco" },
        currenciesAccepted: "MAD",
        paymentAccepted: "Cash on delivery",
      },
      {
        "@type": "WebSite",
        "@id": `${siteUrl()}/#website`,
        name: SITE_NAME,
        alternateName: BRAND_ALIASES,
        publisher: { "@id": `${siteUrl()}/#store` },
        url: absoluteUrl(locale, "/"),
        inLanguage: locale === "ar" ? "ar-MA" : "en",
        potentialAction: {
          "@type": "SearchAction",
          target: { "@type": "EntryPoint", urlTemplate: `${absoluteUrl(locale, "/search")}?q={search_term_string}` },
          "query-input": "required name=search_term_string",
        },
      },
    ],
  };
}

export function breadcrumbLd(locale: Locale, items: { name: string; path?: string }[]) {
  return {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: items.map((item, i) => ({
      "@type": "ListItem",
      position: i + 1,
      name: item.name,
      ...(item.path ? { item: absoluteUrl(locale, item.path) } : {}),
    })),
  };
}

export function faqLd(faqs: { question: string; answer: string }[]) {
  return {
    "@context": "https://schema.org",
    "@type": "FAQPage",
    mainEntity: faqs.map((f) => ({ "@type": "Question", name: f.question, acceptedAnswer: { "@type": "Answer", text: f.answer } })),
  };
}

type LdProduct = {
  slug: string;
  name: string;
  description: string;
  brand: string;
  images: string[];
  variants: { sku: string; price: number; stock: number }[];
  rating: number | null;
  reviews: { authorName: string; rating: number; comment: string; createdAt: Date }[];
};

export function productLd(locale: Locale, p: LdProduct) {
  const url = absoluteUrl(locale, `/products/${p.slug}`);
  const prices = p.variants.map((v) => v.price);
  const inStock = p.variants.some((v) => v.stock > 0);
  const availability = `https://schema.org/${inStock ? "InStock" : "OutOfStock"}`;
  const seller = { "@type": "Organization", name: SITE_NAME };

  const offers =
    new Set(prices).size > 1
      ? {
          "@type": "AggregateOffer",
          priceCurrency: "MAD",
          lowPrice: Math.min(...prices),
          highPrice: Math.max(...prices),
          offerCount: p.variants.length,
          availability,
          url,
          seller,
        }
      : {
          "@type": "Offer",
          priceCurrency: "MAD",
          price: prices[0],
          availability,
          itemCondition: "https://schema.org/NewCondition",
          url,
          seller,
        };

  return {
    "@context": "https://schema.org",
    "@type": "Product",
    name: p.name,
    description: p.description,
    sku: p.variants[0]?.sku,
    url,
    image: p.images.map(abs),
    brand: { "@type": "Brand", name: p.brand },
    offers,
    ...(p.rating !== null && p.reviews.length
      ? {
          aggregateRating: { "@type": "AggregateRating", ratingValue: Number(p.rating.toFixed(1)), reviewCount: p.reviews.length, bestRating: 5, worstRating: 1 },
          review: p.reviews.slice(0, 5).map((r) => ({
            "@type": "Review",
            author: { "@type": "Person", name: r.authorName },
            datePublished: r.createdAt.toISOString().slice(0, 10),
            reviewBody: r.comment,
            reviewRating: { "@type": "Rating", ratingValue: r.rating, bestRating: 5, worstRating: 1 },
          })),
        }
      : {}),
  };
}
