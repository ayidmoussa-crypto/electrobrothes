import { BadgeCheck, Banknote, ShieldCheck, Truck } from "lucide-react";
import { getTranslations } from "next-intl/server";

const items = [
  { icon: Banknote, key: "cod" },
  { icon: Truck, key: "delivery" },
  { icon: ShieldCheck, key: "warranty" },
  { icon: BadgeCheck, key: "genuine" },
] as const;

export async function TrustBar() {
  const t = await getTranslations("trust");

  return (
    <section className="border-y border-warm-200 bg-warm-50">
      <ul className="mx-auto grid max-w-7xl grid-cols-2 gap-4 px-4 py-6 md:grid-cols-4">
        {items.map(({ icon: Icon, key }) => (
          <li key={key} className="flex items-center gap-3">
            <span className="grid size-11 shrink-0 place-items-center rounded-full bg-ink">
              <Icon className="size-5 text-yellow-500" aria-hidden="true" />
            </span>
            <span>
              <span className="block text-sm font-bold text-ink">{t(`${key}Title`)}</span>
              <span className="block text-xs text-warm-600">{t(`${key}Text`)}</span>
            </span>
          </li>
        ))}
      </ul>
    </section>
  );
}
