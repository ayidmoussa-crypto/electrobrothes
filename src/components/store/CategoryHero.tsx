import { BadgeCheck, Banknote, ShieldCheck, Truck } from "lucide-react";
import Image from "next/image";
import { getTranslations } from "next-intl/server";
import { cutoutUrl } from "@/lib/image-cutout";

const PROMISES = [
  { icon: ShieldCheck, key: "warranty" },
  { icon: BadgeCheck, key: "genuine" },
  { icon: Banknote, key: "cod" },
  { icon: Truck, key: "delivery" },
] as const;

/**
 * Where the pictures stand, by how many there are. One: alone and large in the middle. Two: side by side, slightly
 * turned. Three: the middle one in front and larger, the others set back and tilted.
 */
const SPOTS: Record<number, string[]> = {
  1: ["inset-x-[18%] bottom-[2%] h-[96%]"],
  2: ["start-[8%] bottom-[4%] h-[86%] w-[44%] -rotate-3", "end-[8%] bottom-[4%] z-10 h-[86%] w-[44%] rotate-3"],
  3: ["start-[4%] bottom-[6%] h-[70%] w-[38%] -rotate-6", "inset-x-[24%] bottom-[2%] z-10 h-[94%]", "end-[4%] bottom-[8%] h-[66%] w-[36%] rotate-6"],
};

/**
 * The top of a category page: its name and what it holds on a soft light band, up to three pictures standing on
 * the side (chosen in the admin, or its own products), and the shop's four promises in a strip underneath.
 */
export async function CategoryHero({ name, description, count, images }: { name: string; description: string; count: string; images: string[] }) {
  const t = await getTranslations("trust");

  return (
    <section className="mb-8 overflow-hidden rounded-3xl border border-warm-200 bg-linear-to-br from-warm-50 via-white to-yellow-50">
      <div className="grid items-center gap-2 px-5 pt-6 md:grid-cols-[minmax(0,1.1fr)_minmax(0,1fr)] md:gap-6 md:px-10 md:pt-10">
        <div className="md:pb-10">
          <h1 className="text-3xl md:text-5xl">{name}</h1>
          <p className="mt-3 max-w-xl leading-relaxed text-warm-700 md:text-lg">{description}</p>
          <p className="mt-4 inline-flex items-center gap-2 rounded-full bg-ink px-3 py-1 text-sm font-bold text-white">
            <span className="size-2 rounded-full bg-yellow-500" aria-hidden="true" />
            {count}
          </p>
        </div>
        {images.length ? (
          <div aria-hidden="true" className="relative h-44 md:h-72">
            {/* A soft shadow on the "floor" the products stand on. */}
            <span className="absolute inset-x-[10%] bottom-0 h-6 rounded-[50%] bg-ink/10 blur-xl" />
            {images.slice(0, 3).map((src, i, shown) => {
              const cut = cutoutUrl(src);
              return (
                <span key={src} className={`absolute ${SPOTS[shown.length][i]}`}>
                  <Image
                    src={cut ?? src}
                    alt=""
                    fill
                    sizes="(min-width: 768px) 24rem, 60vw"
                    unoptimized={src.endsWith(".svg")}
                    // A cut-out floats with its shadow; a photo on white melts its white into the light band instead.
                    className={`object-contain ${cut ? "drop-shadow-[0_18px_22px_rgb(17_17_17/0.18)]" : "mix-blend-multiply"}`}
                  />
                </span>
              );
            })}
          </div>
        ) : null}
      </div>

      <ul className="grid grid-cols-2 border-t border-warm-200 bg-white/70 md:grid-cols-4">
        {PROMISES.map(({ icon: Icon, key }) => (
          <li key={key} className="flex items-center gap-2.5 px-4 py-3.5 max-md:odd:border-e max-md:[&:nth-child(-n+2)]:border-b max-md:border-warm-200 md:justify-center">
            <span className="grid size-8 shrink-0 place-items-center rounded-full bg-ink">
              <Icon className="size-4 text-yellow-500" strokeWidth={2} aria-hidden="true" />
            </span>
            <span className="text-sm leading-tight font-bold text-ink">{t(`${key}Title`)}</span>
          </li>
        ))}
      </ul>
    </section>
  );
}
