import { Banknote } from "lucide-react";
import { cacheLife } from "next/cache";
import { getTranslations } from "next-intl/server";
import { Logo } from "@/components/brand/Logo";
import { SocialIcon, type SocialNetwork } from "@/components/brand/SocialIcons";
import { Link } from "@/i18n/navigation";
import type { Locale } from "@/i18n/routing";
import { getCategories } from "@/lib/catalog";
import { getCheckoutConfig } from "@/lib/store-config";

// Cached so prerendering never reads the clock at request time.
async function currentYear() {
  "use cache";
  cacheLife("days");
  return new Date().getFullYear();
}

const linkClass = "inline-flex min-h-10 items-center text-sm text-warm-300 transition-colors hover:text-yellow-500";

function Column({ title, links }: { title: string; links: (readonly [string, string])[] }) {
  return (
    <nav aria-label={title}>
      <h2 className="text-base font-extrabold text-white">{title}</h2>
      {/* Short yellow bar: same marker as the active category in the header. */}
      <span aria-hidden="true" className="mt-2 block h-1 w-6 rounded-full bg-yellow-500" />
      <ul className="mt-3">
        {links.map(([href, label]) => (
          <li key={href}>
            <Link href={href} className={linkClass}>
              {label}
            </Link>
          </li>
        ))}
      </ul>
    </nav>
  );
}

export async function Footer({ locale }: { locale: Locale }) {
  const [t, tw, categories, year, config] = await Promise.all([
    getTranslations({ locale, namespace: "footer" }),
    getTranslations({ locale, namespace: "whatsapp" }),
    getCategories(),
    currentYear(),
    getCheckoutConfig(),
  ]);

  const shop = categories.map((c) => [`/category/${c.slug}`, locale === "ar" ? c.nameAr : c.nameEn] as const);
  const help = [
    ["/track", t("track")],
    ["/support", t("support")],
    ["/faq", t("faq")],
    ["/contact", t("contact")],
    ["/warranty", t("warranty")],
  ] as const;
  const company = [
    ["/about", t("about")],
    ["/compare", t("compare")],
  ] as const;

  // Only networks with a configured address are shown.
  const whatsapp = config.whatsappNumber.replace(/\D/g, "");
  const socials = (
    [
      ["instagram", "Instagram", process.env.INSTAGRAM_URL],
      ["facebook", "Facebook", process.env.FACEBOOK_URL],
      ["tiktok", "TikTok", process.env.TIKTOK_URL],
      ["whatsapp", tw("label"), whatsapp ? `https://wa.me/${whatsapp}` : ""],
    ] as [SocialNetwork, string, string | undefined][]
  ).filter(([, , url]) => url);

  return (
    <footer className="relative mt-auto overflow-hidden bg-ink pt-16 text-warm-300">
      {/* Floating card. A thin yellow light runs along its top edge. */}
      <div className="relative z-10 mx-4 rounded-[2rem] border border-warm-700 bg-warm-900 shadow-[0_24px_64px] shadow-ink lg:mx-auto lg:max-w-7xl">
        <span
          aria-hidden="true"
          className="pointer-events-none absolute inset-x-10 -top-px h-px bg-linear-to-r from-transparent via-yellow-500 to-transparent opacity-70"
        />
        {/* Phones: the link columns sit two by two, so the footer stays short. */}
        <div className="grid grid-cols-2 gap-x-6 gap-y-10 p-8 sm:grid-cols-3 sm:p-10 lg:grid-cols-[1.4fr_1fr_1fr_1fr] lg:gap-8">
          <div className="col-span-full lg:col-span-1">
            <Link href="/" aria-label={t("home")} className="inline-flex items-center gap-3 rounded-md text-white">
              <Logo className="h-10 w-auto" />
              <span className="text-xl font-extrabold" dir="ltr">
                ElectroBrothers
              </span>
            </Link>
            <p className="mt-4 max-w-sm text-sm leading-relaxed">{t("tagline")}</p>
            <p className="mt-5 inline-flex items-center gap-2 rounded-full border border-warm-700 px-4 py-2 text-sm font-semibold text-white">
              <Banknote className="size-5 text-yellow-500" aria-hidden="true" />
              {t("codOnly")}
            </p>
            {socials.length ? (
              <ul aria-label={t("followUs")} className="mt-6 flex gap-3">
                {socials.map(([network, label, url]) => (
                  <li key={network}>
                    <a
                      href={url}
                      target="_blank"
                      rel="noopener noreferrer"
                      aria-label={label}
                      className="grid size-11 place-items-center rounded-full border border-warm-700 text-white transition-colors hover:border-yellow-500 hover:bg-yellow-500 hover:text-ink"
                    >
                      <SocialIcon network={network} className="size-5" />
                    </a>
                  </li>
                ))}
              </ul>
            ) : null}
          </div>

          <Column title={t("shop")} links={shop} />
          <Column title={t("help")} links={[...help]} />
          <Column title={t("company")} links={[...company]} />
        </div>

        <div className="mx-8 flex flex-col gap-3 border-t border-warm-700 py-6 text-sm sm:mx-10 sm:flex-row sm:items-center sm:justify-between">
          <p>{t("rights", { brand: "ElectroBrothers", year })}</p>
          <ul className="flex flex-wrap gap-x-6 gap-y-2">
            {(
              [
                ["/privacy", t("privacy")],
                ["/terms", t("terms")],
                ["/faq", t("helpShort")],
              ] as const
            ).map(([href, label]) => (
              <li key={href}>
                <Link href={href} className="inline-flex min-h-11 items-center underline decoration-warm-700 underline-offset-4 transition-colors hover:text-white hover:decoration-yellow-500">
                  {label}
                </Link>
              </li>
            ))}
          </ul>
        </div>
      </div>

      {/*
        Giant wordmark tucked under the card, fading into the black. Hovering it sweeps a
        yellow current across the letters (the brand's "electric" idea).
      */}
      <p
        aria-hidden="true"
        dir="ltr"
        // ~11vw keeps the 15 letters within the viewport at any width (capped on very wide screens).
        className="-mt-[3vw] bg-[linear-gradient(100deg,var(--color-warm-700)_35%,var(--color-yellow-500)_50%,var(--color-warm-700)_65%)] bg-size-[300%_100%] bg-position-[100%_0] bg-clip-text text-center text-[min(11vw,11rem)] leading-[0.85] font-extrabold tracking-tighter text-transparent transition-[background-position] duration-[1600ms] ease-out select-none hover:bg-position-[0%_0] [mask-image:linear-gradient(to_bottom,black_55%,transparent)]"
      >
        ElectroBrothers
      </p>
    </footer>
  );
}
