import type { Metadata } from "next";
import { adminTr } from "./admin-lang";

/** A page's tab title in the panel's current language: export const generateMetadata = () => adminTitle("الطلبات", "Orders"). */
export async function adminTitle(ar: string, en: string): Promise<Metadata> {
  const { tr } = await adminTr();
  return { title: tr(ar, en) };
}
