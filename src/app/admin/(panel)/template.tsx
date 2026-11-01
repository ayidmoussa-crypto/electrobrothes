import type { ReactNode } from "react";

/**
 * Each admin page rises in softly when you open it. Plain CSS (not framer-motion) so the page is
 * visible straight from the server HTML, before any JavaScript loads; reduced motion skips it.
 */
export default function PanelTemplate({ children }: { children: ReactNode }) {
  return <div className="animate-[tab-in_350ms_cubic-bezier(0.22,1,0.36,1)]">{children}</div>;
}
