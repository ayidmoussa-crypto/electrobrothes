"use client";

import { useTranslations } from "next-intl";
import logos from "@/data/brand-logos.json";
import { Link } from "@/i18n/navigation";

type Brand = { slug: string; name: string };
const LOGOS = logos as Record<string, { ratio: number; ext?: string }>;

/**
 * Thin, self-scrolling strip of real brand logos. Grey by default, brand colour on hover,
 * keyboard focus or touch. Pauses on hover/focus and stands still as a wrapped row for
 * people who ask for reduced motion. (The owner chose no visible pause button.)
 */
export function BrandStrip({ brands }: { brands: Brand[] }) {
  const t = useTranslations("brands");
  const labels = { brand: (name: string) => t("brand", { name }) };

  const item = (b: Brand, hidden: boolean) => {
    const logo = LOGOS[b.slug];
    // Optical sizing: wide wordmarks get less height than square marks so they look equally heavy.
    const height = !logo ? 0 : logo.ratio >= 3 ? 18 : logo.ratio >= 1.5 ? 24 : 32;
    return (
      <li key={`${b.slug}-${hidden ? "copy" : "main"}`} aria-hidden={hidden || undefined} className={`shrink-0 ${hidden ? "motion-reduce:hidden" : ""}`}>
        <Link
          href={`/search?q=${encodeURIComponent(b.name)}`}
          tabIndex={hidden ? -1 : undefined}
          aria-label={labels.brand(b.name)}
          className="group/logo flex h-14 items-center justify-center rounded-lg px-4"
        >
          {logo ? (
            // eslint-disable-next-line @next/next/no-img-element -- tiny static logos; next/image adds nothing here
            <img
              src={`/brands/${b.slug}.${logo.ext ?? "svg"}`}
              alt=""
              loading="lazy"
              height={height}
              width={Math.round(height * logo.ratio)}
              style={{ height }}
              className="w-auto opacity-50 grayscale transition duration-300 group-hover/logo:opacity-100 group-hover/logo:grayscale-0 group-focus-visible/logo:opacity-100 group-focus-visible/logo:grayscale-0 group-active/logo:opacity-100 group-active/logo:grayscale-0"
            />
          ) : (
            <span className="text-lg font-extrabold tracking-tight text-warm-500 transition-colors group-hover/logo:text-ink group-active/logo:text-ink">{b.name}</span>
          )}
        </Link>
      </li>
    );
  };

  return (
    <div className="group">
      {/* Soft fade at both edges so logos glide in and out. */}
      <div className="overflow-hidden [mask-image:linear-gradient(to_right,transparent,black_8%,black_92%,transparent)]" dir="ltr">
        <ul className="flex w-max animate-marquee items-center gap-6 group-focus-within:[animation-play-state:paused] group-hover:[animation-play-state:paused] motion-reduce:w-full motion-reduce:animate-none motion-reduce:flex-wrap motion-reduce:justify-center">
          {brands.map((b) => item(b, false))}
          {brands.map((b) => item(b, true))}
        </ul>
      </div>
    </div>
  );
}
