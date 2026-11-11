import { ArrowLeft, ArrowRight, Gift, Hourglass, Radio, Trophy, Users } from "lucide-react";
import Image from "next/image";
import { SocialIcon, type SocialNetwork } from "@/components/brand/SocialIcons";
import { getTranslations } from "next-intl/server";
import { buttonClass } from "@/components/ui/button";
import { Link } from "@/i18n/navigation";
import type { Locale } from "@/i18n/routing";
import { getShowcaseGiveaway, type PublicGiveaway } from "@/lib/giveaways";
import { formatMAD } from "@/lib/money";
import { TIME_ZONE } from "@/lib/time";
import { Countdown } from "./Countdown";
import { GiveawayForm } from "./GiveawayForm";

export function drawDate(iso: string, locale: Locale) {
  return new Intl.DateTimeFormat(locale === "ar" ? "ar-MA" : "en-GB", {
    weekday: "long",
    day: "numeric",
    month: "long",
    hour: "2-digit",
    minute: "2-digit",
    timeZone: TIME_ZONE,
  }).format(new Date(iso));
}

/**
 * The giveaway as one card: the prize on ink, turning in yellow rays, with the countdown to the live draw;
 * the entry form (or the winners once drawn) on white. On its own page the rules sit under it.
 */
export async function GiveawayCard({ g, locale, onHome = false }: { g: PublicGiveaway; locale: Locale; onHome?: boolean }) {
  const t = await getTranslations("giveaway");
  const ar = locale === "ar";
  const title = ar ? g.titleAr : g.titleEn;
  const prize = ar ? g.prizeAr : g.prizeEn;
  const date = drawDate(g.drawAt, locale);
  const Arrow = ar ? ArrowLeft : ArrowRight;
  const Heading = onHome ? "h2" : "h1";

  return (
    <div className="grid overflow-hidden rounded-[2rem] border border-warm-200 bg-white shadow-xl shadow-ink/10 md:grid-cols-2">
      {/* Prize side */}
      <div className="relative isolate flex flex-col gap-5 overflow-hidden bg-ink p-6 text-white sm:p-8">
        <div aria-hidden="true" className="pointer-events-none absolute -end-24 -top-24 -z-10 size-72 rounded-full bg-yellow-500/15 blur-3xl" />
        <div className="flex flex-wrap items-center gap-2">
          <span className="inline-flex items-center gap-1.5 rounded-full bg-yellow-500 px-3 py-1 text-xs font-extrabold text-ink">
            <Gift className="size-3.5" aria-hidden="true" />
            {t("eyebrow")}
          </span>
          <span className="inline-flex items-center gap-2 rounded-full border border-white/15 px-3 py-1 text-xs font-semibold text-warm-300">
            <span aria-hidden="true" className="gw-pulse size-2 rounded-full bg-yellow-500" />
            {t("eyebrowLive")}
          </span>
        </div>
        <Heading className="text-3xl text-white md:text-4xl">{title}</Heading>

        <div className="relative mx-auto grid aspect-square w-full max-w-56 place-items-center sm:max-w-72">
          <div aria-hidden="true" className="gw-rays" />
          {/* Product photos have white backgrounds: they sit on a white disc ringed in yellow, not in a white box. */}
          <div className="gw-float relative grid size-[70%] place-items-center rounded-full bg-white shadow-[0_0_0_6px_var(--color-yellow-500),0_0_60px_10px_color-mix(in_srgb,var(--color-yellow-500)_35%,transparent)]">
            {g.image ? (
              <Image src={g.image} alt={prize} fill sizes="(min-width: 768px) 200px, 50vw" unoptimized={g.image.endsWith(".svg")} className="rounded-full object-contain p-[14%]" />
            ) : (
              <Gift className="size-20 text-ink" aria-hidden="true" />
            )}
          </div>
        </div>

        <div>
          <p className="text-sm text-warm-300">{t("prize")}</p>
          <p className="text-xl font-extrabold">{prize}</p>
          {g.prizeValue ? <p className="mt-0.5 text-sm font-semibold text-yellow-500">{t("worth", { value: formatMAD(g.prizeValue, locale) })}</p> : null}
        </div>

        {g.phase === "open" ? (
          <div className="flex flex-col gap-2">
            <span className="text-sm font-semibold text-warm-300">{t("drawIn")}</span>
            <Countdown endsAt={g.drawAt} tone="glass" />
          </div>
        ) : null}

        <div className="mt-auto flex flex-wrap items-center gap-x-4 gap-y-2 border-t border-white/10 pt-4 text-sm text-warm-300">
          <span className="inline-flex items-center gap-1.5">
            <Users className="size-4 text-yellow-500" aria-hidden="true" />
            {t("entries", { count: g.entries })}
          </span>
          {g.productSlug ? (
            <Link href={`/products/${g.productSlug}`} className="inline-flex min-h-11 items-center gap-1 font-semibold text-white underline-offset-4 hover:underline">
              {t("seePrize")}
              <Arrow className="size-4" aria-hidden="true" />
            </Link>
          ) : null}
        </div>
      </div>

      {/* Entry side */}
      <div className="flex flex-col justify-center gap-4 p-6 sm:p-8">
        <p className="flex items-center gap-2 text-sm font-semibold text-warm-600">
          <Radio className="size-4 shrink-0 text-ink" aria-hidden="true" />
          {t("drawOn", { date })}
        </p>

        {g.phase === "open" ? (
          <GiveawayForm giveawayId={g.id} slug={g.slug} drawLabel={date} />
        ) : g.phase === "closed" ? (
          <div className="flex flex-col items-start gap-3">
            <span className="grid size-14 place-items-center rounded-full bg-yellow-100 text-yellow-900">
              <Hourglass className="size-7" aria-hidden="true" />
            </span>
            <h3 className="text-2xl">{t("closedTitle")}</h3>
            <p className="text-warm-600">{t("closedText")}</p>
          </div>
        ) : (
          <div className="flex flex-col gap-4">
            <h3 className="flex items-center gap-2 text-2xl">
              <Trophy className="size-6 text-yellow-700" aria-hidden="true" />
              {t("winnerTitle")}
            </h3>
            <ol className="flex flex-col gap-2">
              {g.winners.map((w) => (
                <li
                  key={w.rank}
                  className={`flex items-center justify-between gap-3 rounded-xl px-4 ${w.rank === 1 ? "min-h-16 bg-yellow-500 text-ink" : "min-h-12 bg-warm-100 text-warm-800"}`}
                >
                  <bdi className={w.rank === 1 ? "text-2xl font-extrabold" : "font-semibold"}>{w.name}</bdi>
                  <span className="text-sm font-semibold">{w.rank === 1 ? t("winner") : t("backup", { n: w.rank - 1 })}</span>
                </li>
              ))}
            </ol>
            <p className="text-sm text-warm-600">{t("winnersText")}</p>
          </div>
        )}

        <div className="flex flex-wrap items-center gap-3 border-t border-warm-200 pt-4">
          {g.liveUrl && g.phase !== "drawn" ? (
            <a href={g.liveUrl} target="_blank" rel="noopener noreferrer" className={buttonClass({ variant: "dark" })}>
              <Radio className="size-4" aria-hidden="true" />
              {t("watchLive")}
            </a>
          ) : null}
          {onHome ? (
            <Link href={`/giveaway/${g.slug}#rules`} className="inline-flex min-h-11 items-center font-semibold text-warm-600 underline-offset-4 hover:text-ink hover:underline">
              {t("details")}
            </Link>
          ) : null}
        </div>
      </div>
    </div>
  );
}

/** Between giveaways: how it works, and where to follow for the next one. */
async function GiveawayTeaser() {
  const t = await getTranslations("giveaway");
  const socials = (
    [
      ["instagram", "Instagram", process.env.INSTAGRAM_URL],
      ["tiktok", "TikTok", process.env.TIKTOK_URL],
    ] as [SocialNetwork, string, string | undefined][]
  ).filter(([, , url]) => url);
  const steps = [t("step1"), t("step2"), t("step3")];

  return (
    <div className="relative isolate grid items-center gap-8 overflow-hidden rounded-[2rem] bg-ink p-6 text-white shadow-xl shadow-ink/10 sm:p-8 md:grid-cols-[auto_1fr] md:gap-10 lg:p-10">
      <div aria-hidden="true" className="pointer-events-none absolute -end-24 -top-24 -z-10 size-72 rounded-full bg-yellow-500/15 blur-3xl" />
      <div aria-hidden="true" className="relative mx-auto grid size-40 place-items-center sm:size-48">
        <div className="gw-rays" />
        <div className="gw-float relative grid size-[70%] place-items-center rounded-full bg-yellow-500 text-ink shadow-[0_0_60px_10px_color-mix(in_srgb,var(--color-yellow-500)_35%,transparent)]">
          <Gift className="size-14" />
        </div>
      </div>

      <div className="flex flex-col gap-5">
        <div className="flex flex-col gap-3">
          <span className="inline-flex w-fit items-center gap-1.5 rounded-full bg-yellow-500 px-3 py-1 text-xs font-extrabold text-ink">
            <Gift className="size-3.5" aria-hidden="true" />
            {t("eyebrow")}
          </span>
          <h2 className="text-3xl text-white md:text-4xl">{t("soonTitle")}</h2>
          <p className="max-w-2xl text-warm-300">{t("soonText")}</p>
        </div>

        <ol className="grid gap-2 sm:grid-cols-3">
          {steps.map((s, i) => (
            <li key={s} className="flex items-center gap-3 rounded-xl border border-white/10 px-4 py-3 text-sm font-semibold">
              <span className="grid size-7 shrink-0 place-items-center rounded-full bg-yellow-500 text-sm font-extrabold text-ink">{i + 1}</span>
              {s}
            </li>
          ))}
        </ol>

        {socials.length ? (
          <div className="flex flex-wrap items-center gap-3 border-t border-white/10 pt-4">
            <span className="text-sm text-warm-300">{t("soonFollow")}</span>
            {socials.map(([network, label, url]) => (
              <a
                key={network}
                href={url}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex min-h-11 items-center gap-2 rounded-full border border-warm-700 px-4 text-sm font-semibold text-white transition-colors hover:border-yellow-500 hover:bg-yellow-500 hover:text-ink"
              >
                <SocialIcon network={network} className="size-4" />
                {label}
              </a>
            ))}
          </div>
        ) : (
          <p className="border-t border-white/10 pt-4 text-sm text-warm-300">{t("soonFollow")}</p>
        )}
      </div>
    </div>
  );
}

/** The home page's giveaway band: the running (or just drawn) giveaway, otherwise a "next one soon" card. */
export async function GiveawaySection({ locale }: { locale: Locale }) {
  const g = await getShowcaseGiveaway();
  return (
    <section className="mx-auto max-w-7xl px-4 py-12">
      {g ? <GiveawayCard g={g} locale={locale} onHome /> : <GiveawayTeaser />}
    </section>
  );
}
