import { EMPTY_GIVEAWAY, GiveawayEditor } from "@/components/admin/GiveawayEditor";
import { PageHeader } from "@/components/admin/ui";
import { requireAdmin } from "@/lib/admin";
import { uploadsEnabled } from "@/lib/admin-bundles";
import { giveawayProductOptions } from "@/lib/admin-giveaways";
import { adminTr } from "@/lib/admin-lang";

export default async function NewGiveawayPage() {
  const [, { tr }] = await Promise.all([requireAdmin(), adminTr()]);
  const products = await giveawayProductOptions();
  return (
    <>
      <PageHeader title={tr("سحب جديد", "New giveaway")} description={tr("اختار الجائزة ووقت السحب. الناس كيشاركو من الموقع، ونتا كتسحب مباشرة من هنا.", "Pick the prize and the draw time. People enter on the shop; you draw live from here.")} />
      <GiveawayEditor initial={EMPTY_GIVEAWAY} products={products} uploadsEnabled={uploadsEnabled()} />
    </>
  );
}
