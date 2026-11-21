import type { Metadata } from "next";
import type { ReactNode } from "react";
import { siteUrl } from "@/lib/seo";
import { fontClasses } from "../fonts";
import "../globals.css";

// The back office is Arabic-only and never indexed.
export const metadata: Metadata = {
  metadataBase: new URL(siteUrl()),
  title: { default: "ElectroBrothers Admin", template: "%s | ElectroBrothers" },
  robots: { index: false, follow: false },
};

export default function AdminRootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="ar" dir="rtl" className={`${fontClasses} h-full antialiased`}>
      <body className="min-h-full bg-warm-50">{children}</body>
    </html>
  );
}
