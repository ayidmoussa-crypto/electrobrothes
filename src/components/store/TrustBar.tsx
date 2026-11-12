import { BadgeCheck, Banknote, ShieldCheck, Truck } from "lucide-react";
import { getTranslations } from "next-intl/server";

const items = [
  { icon: ShieldCheck, key: "warranty", mark: null },
  { icon: BadgeCheck, key: "genuine", mark: null },
  { icon: Truck, key: "delivery", mark: "orbit" },
  { icon: Banknote, key: "cod", mark: "swoosh" },
] as const;

/**
 * The four promises under the hero, each in a tall soft capsule with a black badge. Four across on every
 * screen: on phones they simply get narrower. Delivery has two arrows circling it, cash a little motion swoosh.
 */
export async function TrustBar() {
  const t = await getTranslations("trust");

  return (
    <section className="bg-warm-50">
      <ul className="mx-auto grid max-w-4xl grid-cols-4 gap-2 px-3 py-8 sm:gap-5 sm:px-4 md:py-10">
        {items.map(({ icon: Icon, key, mark }) => (
          <li
            key={key}
            className="flex min-h-44 flex-col items-center rounded-full border border-white bg-linear-to-b from-white to-warm-100 px-1.5 pt-5 pb-6 text-center shadow-lg shadow-ink/5 sm:min-h-56 sm:px-4 sm:pt-7"
          >
            <span className="relative grid size-12 shrink-0 place-items-center rounded-full bg-ink shadow-lg shadow-ink/30 sm:size-16">
              <Icon className="size-5 text-yellow-500 sm:size-7" strokeWidth={1.75} aria-hidden="true" />
              {mark === "orbit" ? <Orbit /> : mark === "swoosh" ? <Swoosh /> : null}
            </span>
            <span className="mt-4 text-[13px] leading-tight font-extrabold text-ink sm:mt-5 sm:text-lg">{t(`${key}Title`)}</span>
            <span className="mt-1.5 text-[11px] leading-snug text-warm-600 sm:text-sm">{t(`${key}Text`)}</span>
          </li>
        ))}
      </ul>
    </section>
  );
}

/** Two arrows chasing each other around the badge: on the way. Turns slowly, stays still for reduced motion. */
function Orbit() {
  const arrow = (
    <>
      <path d="M65.7 6.8A46 46 0 0 1 93.2 34.3" />
      <path d="M94.9 27.3 93.2 34.3 87.4 30" />
    </>
  );
  return (
    <svg
      viewBox="0 0 100 100"
      aria-hidden="true"
      className="absolute -start-2.5 -top-2.5 size-[calc(100%+1.25rem)] animate-[spin_9s_linear_infinite] fill-none stroke-warm-800 stroke-[3] [stroke-linecap:round] [stroke-linejoin:round] motion-reduce:animate-none sm:-start-3 sm:-top-3 sm:size-[calc(100%+1.5rem)]"
    >
      <g>{arrow}</g>
      <g transform="rotate(180 50 50)">{arrow}</g>
    </svg>
  );
}

/** Two short arcs off the badge's shoulder, like a coin flicked across: paid in hand. */
function Swoosh() {
  return (
    <svg
      viewBox="0 0 24 24"
      aria-hidden="true"
      className="absolute -top-2.5 -right-2.5 size-6 animate-pulse fill-none stroke-warm-800 stroke-2 [stroke-linecap:round] motion-reduce:animate-none sm:-top-3 sm:-right-3 sm:size-7"
    >
      <path d="M7 4a13 13 0 0 1 13 13" />
      <path d="M8 9a8 8 0 0 1 7 7" />
    </svg>
  );
}
