import { notFound } from "next/navigation";

/** Any address under /admin that has no page lands here, so the unknown-page screen shows inside the panel. */
export default function UnknownAdminPage() {
  notFound();
}
