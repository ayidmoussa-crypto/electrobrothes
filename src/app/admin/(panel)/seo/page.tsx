import { parseSeoQuery, SeoPage } from "@/components/admin/SeoPage";
import { requireAdmin } from "@/lib/admin";

export default async function SeoAdminPage({ searchParams }: PageProps<"/admin/seo">) {
  await requireAdmin();
  return <SeoPage query={parseSeoQuery(await searchParams)} />;
}
