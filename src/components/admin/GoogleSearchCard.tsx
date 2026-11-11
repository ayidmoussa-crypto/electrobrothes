import { ArrowDown, ArrowUp, Unplug } from "lucide-react";
import { adminTr } from "@/lib/admin-lang";
import { adminLocale } from "@/lib/admin-tr";
import { searchConsole } from "@/lib/gsc";
import { gscChange, GSC_DAYS } from "@/lib/gsc-rules";

/** Up or down against the 28 days before; for position, lower is better. */
function Change({ now, before, lowerIsBetter = false }: { now: number; before: number; lowerIsBetter?: boolean }) {
  const pct = gscChange(now, before);
  if (pct === null || pct === 0) return null;
  const good = lowerIsBetter ? pct < 0 : pct > 0;
  const Icon = pct > 0 ? ArrowUp : ArrowDown;
  return (
    <span className={`mt-0.5 inline-flex items-center gap-0.5 text-xs font-bold ${good ? "text-success" : "text-danger"}`} dir="ltr">
      <Icon className="size-3" aria-hidden="true" />
      {Math.abs(pct)}%
    </span>
  );
}

/**
 * The SEO page's Google card: Search Console clicks, impressions and position over the last 28 days, then the
 * searches and pages that bring the most. Until the link is set it says so, with the steps.
 */
export async function GoogleSearchCard() {
  const [{ tr, lang }, result] = await Promise.all([adminTr(), searchConsole()]);
  const num = new Intl.NumberFormat(adminLocale(lang), { maximumFractionDigits: 1 });
  const shell = (children: React.ReactNode) => (
    <div className="admin-card min-w-0 p-3">
      <h2 className="mb-2 text-sm font-extrabold text-ink">{tr("بيانات Google", "Google data")}</h2>
      {children}
    </div>
  );

  if (result.status !== "ok") {
    const why =
      result.status === "off"
        ? tr("Search Console مازال ما مربوطش.", "Search Console is not connected yet.")
        : result.kind === "auth"
          ? tr("Google رفض المفتاح: تحقق من GSC_CLIENT_EMAIL وGSC_PRIVATE_KEY.", "Google refused the key: check GSC_CLIENT_EMAIL and GSC_PRIVATE_KEY.")
          : result.kind === "access"
            ? tr("الحساب ما عندوش الحق فهاد الموقع: زيدو كمستعمل فـ Search Console، وتأكد من GSC_SITE.", "The account cannot read this site: add it as a user in Search Console and check GSC_SITE.")
            : tr("ما قدرناش نجيبو البيانات دابا. عاود من بعد.", "Could not fetch the data now. Try again later.");
    return shell(
      <>
        <p className="flex items-start gap-2 rounded-lg bg-warning-soft p-2.5 text-xs font-semibold text-warning-text">
          <Unplug className="mt-0.5 size-4 shrink-0" aria-hidden="true" />
          {why}
        </p>
        {result.status === "off" ? (
          <ol className="mt-2 list-decimal space-y-1 ps-5 text-xs text-warm-600">
            <li>{tr("أكّد الموقع ديالك فـ Google Search Console.", "Verify your site in Google Search Console.")}</li>
            <li>{tr("دير service account فـ Google Cloud وشغّل Search Console API.", "Create a service account in Google Cloud and enable the Search Console API.")}</li>
            <li>{tr("زيد الإيميل ديالو كمستعمل للموقع فـ Search Console.", "Add its email as a user of the site in Search Console.")}</li>
            <li>
              {tr("حط فـ Vercel:", "Set in Vercel:")} <span dir="ltr" className="font-mono">GSC_CLIENT_EMAIL, GSC_PRIVATE_KEY, GSC_SITE</span>
            </li>
          </ol>
        ) : null}
      </>,
    );
  }

  const { totals, previous, queries, pages, period } = result.report;
  const stats = [
    { label: tr("النقرات", "Clicks"), value: num.format(totals.clicks), change: <Change now={totals.clicks} before={previous.clicks} /> },
    { label: tr("الظهور", "Impressions"), value: num.format(totals.impressions), change: <Change now={totals.impressions} before={previous.impressions} /> },
    {
      label: tr("الترتيب", "Position"),
      value: totals.position === null ? "—" : num.format(totals.position),
      change: totals.position !== null && previous.position !== null ? <Change now={totals.position} before={previous.position} lowerIsBetter /> : null,
    },
  ];
  const path = (url: string) => {
    try {
      return decodeURIComponent(new URL(url).pathname) || "/";
    } catch {
      return url;
    }
  };
  const list = (title: string, rows: { key: string; clicks: number; impressions: number }[], show: (k: string) => string) =>
    rows.length ? (
      <div className="mt-3">
        <h3 className="mb-1 text-xs font-bold text-warm-600">{title}</h3>
        <ul className="divide-y divide-warm-200/60 text-sm">
          {rows.map((r) => (
            <li key={r.key} className="flex items-center justify-between gap-2 py-1">
              <bdi className="min-w-0 truncate text-ink" title={r.key}>
                {show(r.key)}
              </bdi>
              <span className="shrink-0 text-xs text-warm-600 tabular-nums">
                {num.format(r.clicks)} · {num.format(r.impressions)}
              </span>
            </li>
          ))}
        </ul>
      </div>
    ) : null;

  return shell(
    <>
      <p className="-mt-1 mb-2 text-xs text-warm-600" dir="ltr">
        {tr(`آخر ${GSC_DAYS} يوم`, `Last ${GSC_DAYS} days`)} · {period.startDate} → {period.endDate}
      </p>
      <dl className="grid grid-cols-3 gap-2 text-center">
        {stats.map((s) => (
          <div key={s.label} className="rounded-lg bg-white/50 p-2">
            <dt className="text-xs text-warm-600">{s.label}</dt>
            <dd className="mt-0.5 text-xl font-extrabold text-ink tabular-nums">{s.value}</dd>
            {s.change}
          </div>
        ))}
      </dl>
      {totals.impressions ? (
        <>
          {list(tr("أكثر الكلمات اللي جابت الزوار", "Top searches"), queries, (k) => k)}
          {list(tr("أكثر الصفحات", "Top pages"), pages, path)}
          <p className="mt-2 text-xs text-warm-500">{tr("الأرقام: النقرات · الظهور", "Figures: clicks · impressions")}</p>
        </>
      ) : (
        <p className="mt-2 text-xs text-warm-600">{tr("مازال Google ما بيّن الموقع فحتى بحث فهاد المدة. الأرقام كتبدا تبان من بعد الأرشفة.", "Google has not shown the site in any search over this period yet. Figures appear after indexing.")}</p>
      )}
    </>,
  );
}

export function GoogleSearchCardSkeleton() {
  return <div className="admin-card min-h-40 animate-pulse p-3" aria-hidden="true" />;
}
