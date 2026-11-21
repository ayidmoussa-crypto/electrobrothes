import { parseSeoQuery, SeoPage } from "@/components/admin/SeoPage";
import { requireAdmin } from "@/lib/admin";
import { adminTitle } from "@/lib/admin-title";

export const generateMetadata = () => adminTitle("السيو", "SEO");

export default async function SeoAdminPage({ searchParams }: PageProps<"/admin/seo">) {
  await requireAdmin();
  return <SeoPage query={parseSeoQuery(await searchParams)} />;
}
