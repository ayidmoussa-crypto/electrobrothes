import type { MetadataRoute } from "next";
import { siteUrl } from "@/lib/seo";

// Crawlers and AI shopping agents are welcome on the catalog; private and transactional areas are not indexed.
export default function robots(): MetadataRoute.Robots {
  return {
    rules: [
      {
        userAgent: "*",
        allow: "/",
        disallow: ["/admin", "/api/", "/cart", "/checkout", "/order/", "/review/", "/en/cart", "/en/checkout", "/en/order/", "/en/review/", "/styleguide", "/en/styleguide"],
      },
    ],
    sitemap: `${siteUrl()}/sitemap.xml`,
  };
}
