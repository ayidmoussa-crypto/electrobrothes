import { buttonClass } from "@/components/ui/button";
import { Bot, CheckCircle2, ChevronLeft, Droplets, GraduationCap, LifeBuoy, RefreshCw, UserRound } from "lucide-react";
import Link from "next/link";
import { PeriodPicker } from "@/components/admin/PeriodPicker";
import { PageHeader, Panel, Stat, tdClass, thClass } from "@/components/admin/ui";
import { Badge } from "@/components/ui/Badge";
import { requireAdmin } from "@/lib/admin";
import { adminTr } from "@/lib/admin-lang";
import { db } from "@/lib/db";
import { periodLabel, resolvePeriod } from "@/lib/period";
import { PROBLEM_CATEGORIES, STATUS_LABEL, STATUS_TONE, supportStats, type ProblemCategory, type SupportStatusKey } from "@/lib/support/rules";
import { toMoroccanInput } from "@/lib/time";

const FILTERS: (SupportStatusKey | "all")[] = ["all", "ESCALATED", "OPEN", "SOLVED", "REPLACED", "UNSOLVED"];

export default async function SupportAdminPage({ searchParams }: PageProps<"/admin/support">) {
  const [, { tr, lang }] = await Promise.all([requireAdmin(), adminTr()]);
  const ar = lang === "ar";
  const params = await searchParams;
  const period = resolvePeriod(params);
  const span = periodLabel(period, lang);
  const raw = Array.isArray(params.status) ? params.status[0] : params.status;
  const filter = FILTERS.includes(raw as SupportStatusKey) ? (raw as SupportStatusKey) : "all";
  const inPeriod = { createdAt: { gte: period.from, lte: period.until } };

  const [rows, waiting, tickets, lessonCount] = await Promise.all([
    db.supportTicket.findMany({ where: inPeriod, select: { status: true, solvedByAi: true, verdict: true, category: true, productId: true, productName: true } }),
    // Whatever the period: these need the owner now.
    db.supportTicket.count({ where: { status: "ESCALATED" } }),
    db.supportTicket.findMany({
      where: filter === "all" ? inPeriod : filter === "ESCALATED" ? { status: "ESCALATED" } : { ...inPeriod, status: filter },
      orderBy: [{ updatedAt: "desc" }],
      take: 100,
      select: { id: true, status: true, verdict: true, category: true, productName: true, summary: true, solvedByAi: true, updatedAt: true, order: { select: { number: true, customerName: true } }, _count: { select: { messages: true } } },
    }),
    db.supportLesson.count({ where: { isActive: true } }),
  ]);
  const stats = supportStats(rows);
  const t = stats.totals;
  const cat = (k: string | null) => (k && k in PROBLEM_CATEGORIES ? PROBLEM_CATEGORIES[k as ProblemCategory][lang] : tr("مازال ما تعرف", "Not known yet"));
  const date = new Intl.DateTimeFormat(ar ? "ar-MA" : "en-GB", { dateStyle: "medium", timeStyle: "short", timeZone: "Africa/Casablanca" });
  const link = (status: string) => `/admin/support?${new URLSearchParams({ ...Object.fromEntries(new URLSearchParams(period.query)), ...(status === "all" ? {} : { status }) })}`;

  return (
    <div>
      <PageHeader
        title={tr("الدعم التقني", "Technical support")}
        description={tr(`مشاكل الزبناء مع المنتوجات · ${span}`, `Customers' product problems · ${span}`)}
        actions={
          <Link href="/admin/support/lessons" className={buttonClass({ variant: "outline" })}>
            <GraduationCap className="size-4" aria-hidden="true" />
            {tr(`تعليم المساعد (${lessonCount})`, `Teach the assistant (${lessonCount})`)}
          </Link>
        }
      />
      <div className="mb-4">
        <PeriodPicker key={period.query} basePath="/admin/support" preset={period.preset} firstDay={period.firstDay} lastDay={period.lastDay} today={toMoroccanInput(new Date(), 10)} lang={lang} label={tr("الفترة", "Period")} />
      </div>

      {waiting ? (
        <Link href={link("ESCALATED")} className="mb-3 flex items-center justify-between gap-3 rounded-2xl bg-warning-soft p-4 text-sm font-semibold text-warning-text">
          <span className="flex items-center gap-2">
            <UserRound className="size-5 shrink-0" aria-hidden="true" />
            {tr(`${waiting} مشكل كيتسنى قرارك`, `${waiting} problems waiting for you`)}
          </span>
          <ChevronLeft className="size-4 ltr:rotate-180" aria-hidden="true" />
        </Link>
      ) : null}

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-5">
        <Stat label={tr("المشاكل اللي ظهرات", "Problems reported")} value={String(t.total)} icon={LifeBuoy} hint={tr(`${t.open} مازال مع المساعد`, `${t.open} still with the assistant`)} />
        <Stat label={tr("حلها المساعد بوحدو", "Solved by the assistant")} value={String(t.solvedByAi)} icon={Bot} hint={stats.aiRate === null ? undefined : tr(`${stats.aiRate}% من المشاكل المسدودة`, `${stats.aiRate}% of closed problems`)} />
        <Stat label={tr("تحلات معاك", "Solved with you")} value={String(t.solvedByOwner)} icon={CheckCircle2} hint={tr(`${t.unsolved} ما تحلاتش`, `${t.unsolved} not solved`)} />
        <Stat label={tr("عطب من المعمل وتبدل", "Factory defect, replaced")} value={String(t.replaced)} icon={RefreshCw} hint={tr(`${t.waiting} كيتسنى قرارك`, `${t.waiting} waiting for you`)} />
        <Stat label={tr("السبب من الزبون", "Caused by the customer")} value={String(t.customerCause)} icon={Droplets} hint={tr("ماء، شاحن قوي، طيحة...: ما تبدلش", "Water, strong charger, fall...: not replaced")} />
      </div>

      <div className="mt-3 grid grid-cols-1 gap-3 lg:grid-cols-2">
        <Panel title={tr("حسب المنتوج", "By product")} className="min-w-0">
          {stats.products.length ? (
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr>
                    <th scope="col" className={thClass}>{tr("المنتوج", "Product")}</th>
                    <th scope="col" className={thClass}>{tr("المشاكل", "Problems")}</th>
                    <th scope="col" className={thClass}>{tr("المساعد", "Assistant")}</th>
                    <th scope="col" className={thClass}>{tr("تبدل", "Replaced")}</th>
                    <th scope="col" className={thClass}>{tr("من الزبون", "Customer")}</th>
                    <th scope="col" className={thClass}>{tr("ما تحلش", "Not solved")}</th>
                  </tr>
                </thead>
                <tbody>
                  {stats.products.slice(0, 15).map((p) => (
                    <tr key={p.id} className="border-t border-warm-200">
                      <th scope="row" className={`${tdClass} max-w-56 truncate text-start font-semibold text-ink`}>{p.name}</th>
                      <td className={`${tdClass} font-bold text-ink`}>{p.total}</td>
                      <td className={tdClass}>{p.solvedByAi}</td>
                      <td className={tdClass}>{p.replaced}</td>
                      <td className={tdClass}>{p.customerCause}</td>
                      <td className={tdClass}>{p.unsolved}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <p className="text-sm text-warm-600">{tr("ما كاين حتى مشكل فهاد الفترة.", "No problems in this period.")}</p>
          )}
        </Panel>

        <Panel title={tr("حسب نوع المشكل", "By kind of problem")} className="min-w-0">
          {stats.categories.length ? (
            <ul className="flex flex-col gap-3">
              {stats.categories.map((c) => (
                <li key={c.key}>
                  <div className="flex justify-between gap-3 text-sm">
                    <span className="font-semibold text-ink">{PROBLEM_CATEGORIES[c.key][lang]}</span>
                    <span className="text-warm-600">
                      {c.total} · {tr(`المساعد ${c.solvedByAi} · تبدل ${c.replaced} · من الزبون ${c.customerCause}`, `assistant ${c.solvedByAi} · replaced ${c.replaced} · customer ${c.customerCause}`)}
                    </span>
                  </div>
                  <div className="mt-1.5 h-2 overflow-hidden rounded-full bg-warm-100" aria-hidden="true">
                    <div className="h-full rounded-full bg-ink" style={{ width: `${Math.round((c.total / stats.categories[0].total) * 100)}%` }} />
                  </div>
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-sm text-warm-600">{tr("ما كاين حتى مشكل فهاد الفترة.", "No problems in this period.")}</p>
          )}
        </Panel>
      </div>

      <Panel title={tr("المحادثات", "Conversations")} className="mt-3">
        <nav aria-label={tr("الحالة", "Status")} className="mb-3 flex flex-wrap gap-2">
          {FILTERS.map((f) => (
            <Link
              key={f}
              href={link(f)}
              aria-current={filter === f ? "page" : undefined}
              className={`inline-flex min-h-9 items-center rounded-full px-3.5 text-sm font-semibold transition-colors ${filter === f ? "on-yellow bg-yellow-500 text-ink" : "bg-warm-100 text-warm-800 hover:bg-warm-200"}`}
            >
              {f === "all" ? tr("الكل", "All") : STATUS_LABEL[f][lang]}
            </Link>
          ))}
        </nav>
        {tickets.length ? (
          <ul>
            {tickets.map((tk) => (
              <li key={tk.id} className="border-t border-warm-200">
                <Link href={`/admin/support/${tk.id}`} className="flex flex-col gap-1 rounded-lg px-1 py-3 hover:bg-warm-100 md:flex-row md:items-center md:justify-between md:gap-4">
                  <span className="min-w-0">
                    <span className="block truncate text-sm font-semibold text-ink">
                      {tk.productName} · <span className="font-normal text-warm-600">{cat(tk.category)}</span>
                    </span>
                    <span className="block truncate text-xs text-warm-600">
                      {tk.order.customerName} · <span dir="ltr">{tk.order.number}</span> · {date.format(tk.updatedAt)}
                    </span>
                    {tk.summary ? <span className="mt-1 line-clamp-2 block text-sm text-warm-800">{tk.summary}</span> : null}
                  </span>
                  <span className="flex shrink-0 flex-wrap items-center gap-1.5">
                    {tk.verdict === "defect" && tk.status === "ESCALATED" ? <Badge tone="danger">{tr("عطب محتمل من المعمل", "Likely factory defect")}</Badge> : null}
                    {tk.verdict === "misuse" ? <Badge tone="warning">{tk.status === "UNSOLVED" ? tr("السبب من الزبون", "Caused by the customer") : tr("السبب غالباً من الاستعمال", "Likely caused by use")}</Badge> : null}
                    {tk.solvedByAi ? <Badge tone="accent">{tr("حلها المساعد", "Assistant fixed it")}</Badge> : null}
                    <Badge tone={STATUS_TONE[tk.status]}>{STATUS_LABEL[tk.status][lang]}</Badge>
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        ) : (
          <p className="text-sm text-warm-600">{tr("ما كاينة حتى محادثة هنا.", "No conversations here.")}</p>
        )}
        <p className="mt-4 text-xs text-warm-500">
          {tr(
            "الزبون كيدخل من رابط خاص (زر «رابط الدعم» فصفحة الطلب) ولا من صفحة «الدعم التقني» فالمتجر برقم الطلب والهاتف. غير الطلبات اللي وصلات.",
            "Customers come in from their private link (the “Support link” button on the order page) or from the shop's “Technical support” page with their order number and phone. Delivered orders only.",
          )}
        </p>
      </Panel>
    </div>
  );
}
