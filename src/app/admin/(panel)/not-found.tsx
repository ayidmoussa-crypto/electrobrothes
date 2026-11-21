import { SearchX } from "lucide-react";
import Link from "next/link";
import { buttonClass } from "@/components/ui/button";
import { StatePanel } from "@/components/ui/States";
import { adminTr } from "@/lib/admin-lang";

/** An admin page, order, product... that does not exist (shown inside the panel, menu kept). */
export default async function PanelNotFound() {
  const { tr } = await adminTr();
  return (
    <div className="py-6">
      <StatePanel
        icon={SearchX}
        title={tr("ما لقينا هاد الصفحة", "Page not found")}
        description={tr("يمكن تمسحات ولا تنقلات. رجع للإحصائيات.", "It may have been deleted or moved. Head back to the overview.")}
        action={
          <Link href="/admin" className={buttonClass()}>
            {tr("الإحصائيات", "Overview")}
          </Link>
        }
      />
    </div>
  );
}
