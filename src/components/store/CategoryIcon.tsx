import { BatteryCharging, Headphones, Package, PlugZap, Speaker, Watch, type LucideIcon } from "lucide-react";

// Line icon that reads as the product itself; categories added later from the admin fall back to a parcel.
const ICONS: Record<string, LucideIcon> = {
  headphones: Headphones,
  smartwatches: Watch,
  chargers: PlugZap,
  "power-banks": BatteryCharging,
  "other-devices": Speaker,
};

export function CategoryIcon({ slug, className }: { slug: string; className?: string }) {
  const Icon = ICONS[slug] ?? Package;
  return <Icon aria-hidden="true" strokeWidth={1.5} className={className} />;
}
