import { jsonLd } from "@/lib/seo";

/** Schema.org structured data, rendered in the server HTML (visible to crawlers and shopping agents). */
export function JsonLd({ data }: { data: object }) {
  return <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: jsonLd(data) }} />;
}
