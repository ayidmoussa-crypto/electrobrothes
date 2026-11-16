import { Battery, Bluetooth, Cable, Droplets, Gauge, Headphones, Heart, Mic, Plug, ShieldCheck, Smartphone, Sparkles, Sun, Timer, Volume2, Watch, Wifi, Zap, type LucideIcon } from "lucide-react";
import type { LandingIcon } from "@/lib/landing";

const ICONS: Record<LandingIcon, LucideIcon> = {
  battery: Battery,
  zap: Zap,
  bluetooth: Bluetooth,
  wifi: Wifi,
  headphones: Headphones,
  volume: Volume2,
  mic: Mic,
  watch: Watch,
  smartphone: Smartphone,
  shield: ShieldCheck,
  droplets: Droplets,
  timer: Timer,
  sparkles: Sparkles,
  gauge: Gauge,
  plug: Plug,
  cable: Cable,
  heart: Heart,
  sun: Sun,
};

export function FeatureIcon({ name, className }: { name: LandingIcon; className?: string }) {
  const Icon = ICONS[name] ?? Sparkles;
  return <Icon className={className} aria-hidden="true" />;
}
