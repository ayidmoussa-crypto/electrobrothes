import { AlertTriangle, Banknote, Landmark, PiggyBank, ShoppingBag, Trash2, TrendingDown, TrendingUp, Undo2, Wallet } from "lucide-react";
import Link from "next/link";
import { addCapital, addExpense, deleteCapital, deleteExpense, markCodReceived } from "@/app/actions/admin-finance";
import { ActionForm } from "@/components/admin/ActionForm";
import { inputClass, L, PageHeader, Panel, Stat, tdClass, thClass } from "@/components/admin/ui";
import { buttonClass } from "@/components/ui/button";
import { requireAdmin } from "@/lib/admin";
import { db } from "@/lib/db";
import { BUSINESS_CATEGORIES, categoryLabel, expectedFromCarrier, PERSONAL_CATEGORIES } from "@/lib/finance";
import { loadCapital, loadProfit } from "@/lib/finance-data";
import { formatMAD } from "@/lib/money";
import { daysAgo } from "@/lib/stats";
import { TIME_ZONE, toMoroccanInput } from "@/lib/time";

const RANGES = [7, 30, 90, 365] as const;
const dayFmt = new Intl.DateTimeFormat("ar-MA", { dateStyle: "medium", timeZone: TIME_ZONE });
const mad = (v: number) => formatMAD(v, "ar");
const tone = (v: number) => (v < 0 ? ("danger" as const) : v > 0 ? ("success" as const) : undefined);

function Row({ label, value, minus, strong, hint }: { label: string; value: number; minus?: boolean; strong?: boolean; hint?: string }) {
  return (
    // Totals sit in a black box so they stand apart from the lines that make them up.
    <div className={`flex items-baseline justify-between gap-3 ${strong ? "my-2 rounded-xl bg-ink px-4 py-3 text-base font-extrabold text-white" : "border-t border-warm-200/60 py-2"}`}>
      <dt className={strong ? "" : "text-warm-600"}>
        {label}
        {hint ? <span className={`block text-xs font-normal ${strong ? "text-warm-300" : "text-warm-500"}`}>{hint}</span> : null}
      </dt>
      <dd className={`shrink-0 ${strong ? "text-white" : "text-warm-800"}`}>
        {minus && value ? "− " : ""}
        {mad(value)}
      </dd>
    </div>
  );
}

function BoxTitle({ children }: { children: string }) {
  return <h2 className="mb-3 rounded-xl bg-ink px-4 py-3 text-base text-white">{children}</h2>;
}

function DeleteButton({ action, id, label }: { action: (fd: FormData) => Promise<void>; id: string; label: string }) {
  return (
    <form action={action}>
      <input type="hidden" name="id" value={id} />
      <button type="submit" aria-label={label} className={buttonClass({ variant: "ghost", size: "icon" })}>
        <Trash2 className="size-4" aria-hidden="true" />
      </button>
    </form>
  );
}

export default async function FinancePage({ searchParams }: PageProps<"/admin/finance">) {
  await requireAdmin();
  const raw = Number((await searchParams).days);
  const days = (RANGES as readonly number[]).includes(raw) ? raw : 30;

  const [p, c, settings, uncollected, expenses, capitalEntries] = await Promise.all([
    loadProfit(daysAgo(days)),
    loadCapital(),
    db.settings.findUnique({ where: { id: 1 }, select: { defaultDeliveryCost: true } }),
    db.order.findMany({
      where: { status: "DELIVERED", codReceivedAt: null },
      orderBy: { deliveredAt: "asc" },
      take: 100,
      select: { id: true, number: true, customerName: true, total: true, carrierFee: true, deliveredAt: true },
    }),
    db.expense.findMany({ orderBy: { spentOn: "desc" }, take: 40 }),
    db.capitalEntry.findMany({ orderBy: { occurredOn: "desc" }, take: 20 }),
  ]);

  const today = toMoroccanInput(new Date(), 10);
  const gaps = [
    p.gaps.unitsWithoutCost ? `${p.gaps.unitsWithoutCost} قطعة مبيوعة بلا ثمن شراء: الربح الحقيقي أقل من الرقم اللي هنا. زيد ثمن الشراء فصفحة المنتج.` : null,
    p.gaps.deliveredWithoutFee ? `${p.gaps.deliveredWithoutFee} طلب مسلَّم بلا رسوم توصيل. حدد الرسوم فالإعدادات ولا فالطلب.` : null,
    p.gaps.returnedWithoutFee ? `${p.gaps.returnedWithoutFee} طلب راجع بلا رسوم. حدد رسوم الإرجاع فالإعدادات ولا فالطلب.` : null,
    c.gaps.unitsWithoutCost ? `${c.gaps.unitsWithoutCost} قطعة فالمخزون بلا ثمن شراء: قيمة المخزون ناقصة.` : null,
    c.gaps.movesWithoutCost ? `${c.gaps.movesWithoutCost} قطعة دخلات للمخزون بلا ثمن شراء: الكاش ورأس المال ما كيحسبوش ثمنها.` : null,
  ].filter(Boolean);

  return (
    <>
      <PageHeader
        title="المالية"
        description={`آخر ${days} يوم`}
        actions={RANGES.map((r) => (
          <Link
            key={r}
            href={`/admin/finance?days=${r}`}
            aria-current={r === days ? "page" : undefined}
            className={`inline-flex min-h-11 items-center rounded-full px-4 text-sm font-semibold transition-colors ${r === days ? "bg-ink text-white shadow-lg shadow-ink/20" : "admin-field text-ink hover:bg-white"}`}
          >
            {r} يوم
          </Link>
        ))}
      />

      {gaps.length ? (
        <section aria-label="أرقام ناقصة" className="mb-6 rounded-2xl border border-warning/40 bg-warning-soft/85 p-4 text-sm text-warning-text">
          <p className="flex items-center gap-2 font-bold">
            <AlertTriangle className="size-5 shrink-0" aria-hidden="true" />
            أرقام ناقصة كتأثر على الحساب
          </p>
          <ul className="mt-2 list-inside list-disc">
            {gaps.map((g) => (
              <li key={g}>{g}</li>
            ))}
          </ul>
        </section>
      ) : null}
      {c.hiddenUnits ? (
        <p className="mb-6 text-sm text-warm-600">
          {c.hiddenUnits} قطعة ديال منتجات مخبية من المتجر ما داخلاش فالحساب. إلا كان شي منتج مخبي وشريتيه بصح، ظهّرو باش يتحسب.
        </p>
      ) : null}

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Stat icon={p.netProfit < 0 ? TrendingDown : TrendingUp} label="صافي الربح" value={mad(p.netProfit)} tone={tone(p.netProfit)} hint={p.margin === null ? "ما كاين حتى بيع" : p.gaps.unitsWithoutCost ? `الهامش ${p.margin}% بلا ثمن شراء ${p.gaps.unitsWithoutCost} قطعة` : `الهامش ${p.margin}%`} />
        <Stat icon={ShoppingBag} label="المبيعات المسلَّمة" value={mad(p.revenue)} hint={`${p.deliveredCount} طلب`} />
        <Stat icon={Undo2} label="خسائر الإرجاع" value={mad(p.returnsCost)} hint={`${p.returnedCount} طلب راجع`} />
        <Stat icon={Wallet} label="بعد مصاريفك الشخصية" value={mad(p.afterPersonal)} tone={tone(p.afterPersonal)} hint={`مصاريف شخصية ${mad(p.personalExpenses)}`} />
      </div>

      <div className="mt-6 grid gap-6 lg:grid-cols-2">
        <Panel>
          <BoxTitle>حساب الربح</BoxTitle>
          <dl className="text-sm">
            <Row label="المبيعات المسلَّمة" value={p.revenue} />
            <Row label="تكلفة السلعة" value={p.cogs} minus />
            <Row label="رسوم التوصيل" value={p.deliveryCost} minus />
            <Row label="الربح الخام" value={p.grossProfit} strong />
            <Row label="رسوم الطرود الراجعة" value={p.returnsCost} minus hint="السلعة الراجعة كترجع للمخزون، فالخسارة هي الرسوم." />
            <Row label="مصاريف المشروع" value={p.businessExpenses} minus />
            <Row label="نقص فالمخزون" value={p.stockLoss} minus hint="التعديلات بالناقص من صفحة المنتج." />
            <Row label="صافي الربح" value={p.netProfit} strong />
          </dl>
          {p.costPerDelivered !== null ? <p className="mt-3 text-sm text-warm-600">تكلفة الإعلانات لكل طلب مسلَّم: <b className="text-ink">{mad(p.costPerDelivered)}</b></p> : null}
          {p.perOrder !== null ? <p className="mt-1 text-sm text-warm-600">متوسط الصافي لكل طلب: <b className="text-ink">{mad(p.perOrder)}</b></p> : null}
        </Panel>

        <Panel>
          <BoxTitle>رأس المال: فين كاينين الفلوس (من البداية)</BoxTitle>
          <dl className="text-sm">
            <Row label="الكاش" value={c.cash} hint="اللي دخلتي + تحويلات التوصيل − المشتريات − كل المصاريف" />
            <Row label="السلعة فالمخزون" value={c.inventoryValue} hint="بثمن الشراء" />
            <Row label="سلعة فالطريق" value={c.goodsInTransit} hint="طلبات مأكدة ولا فالشحن، مازال ما توصلوش. بثمن الشراء." />
            <Row label="فلوس عند شركة التوصيل" value={c.owedByCarrier} hint="طلبات تسلمات للزبون، والفلوس مازال ما حولتهاش ليك الشركة. بثمن البيع ناقص الرسوم." />
            <Row label="المجموع اليوم" value={c.position} strong />
            <Row label="اللي استثمرتي" value={c.invested} hint={`دخلتي ${mad(c.injections)} + سلعة البداية ${mad(c.openingStockValue)} − سحبتي ${mad(c.withdrawals)}`} />
            <Row label={c.result < 0 ? "الخسارة منذ البداية" : "الربح منذ البداية"} value={c.result} strong hint={c.resultPct === null ? undefined : `${c.resultPct}% من اللي استثمرتي، والمصاريف الشخصية محسوبة`} />
          </dl>
        </Panel>
      </div>

      <Panel title={`عند شركة التوصيل (${uncollected.length})`} className="mt-6">
        {uncollected.length ? (
          <ActionForm action={markCodReceived} submitLabel="توصلت بالطلبات المحددة" className="flex flex-col gap-3">
            <div className="overflow-x-auto">
              <table className="w-full min-w-[36rem]">
                <thead>
                  <tr>
                    <th className={thClass}>
                      <span className="sr-only">اختيار</span>
                    </th>
                    <th className={thClass}>الطلب</th>
                    <th className={thClass}>الزبون</th>
                    <th className={thClass}>تسلّم</th>
                    <th className={thClass}>المنتظر</th>
                  </tr>
                </thead>
                <tbody>
                  {uncollected.map((o) => (
                    <tr key={o.id} className="border-t border-warm-200/60">
                      <td className={tdClass}>
                        <input type="checkbox" name="orderId" value={o.id} aria-label={`اختيار ${o.number}`} className="size-5 accent-ink" />
                      </td>
                      <td className={tdClass}>
                        <Link href={`/admin/orders/${o.id}`} className="font-mono font-bold text-ink underline-offset-4 hover:underline" dir="ltr">
                          {o.number}
                        </Link>
                      </td>
                      <td className={tdClass}>{o.customerName}</td>
                      <td className={tdClass}>{o.deliveredAt ? dayFmt.format(o.deliveredAt) : "—"}</td>
                      <td className={`${tdClass} font-bold text-ink`}>{mad(expectedFromCarrier(o.total, o.carrierFee, settings?.defaultDeliveryCost ?? 0))}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <p className="text-xs text-warm-600">المنتظر هو المبلغ ناقص رسوم التوصيل. إلا توصلتي بمبلغ آخر، سجلو من صفحة الطلب.</p>
          </ActionForm>
        ) : (
          <p className="text-sm text-warm-600">ما كاين حتى طلب مسلَّم كيتسنى التحويل.</p>
        )}
      </Panel>

      <div className="mt-6 grid gap-6 lg:grid-cols-3">
        <Panel title="مصروف ديال المشروع">
          <ActionForm action={addExpense} submitLabel="إضافة" variant="dark">
            <input type="hidden" name="scope" value="BUSINESS" />
            <L label="النوع">
              <select name="category" className={inputClass}>
                {Object.entries(BUSINESS_CATEGORIES).map(([k, label]) => (
                  <option key={k} value={k}>
                    {label}
                  </option>
                ))}
              </select>
            </L>
            <L label="المبلغ (درهم)">
              <input name="amount" type="number" min={1} required className={inputClass} />
            </L>
            <L label="التاريخ">
              <input name="spentOn" type="date" required defaultValue={today} className={inputClass} />
            </L>
            <L label="ملاحظة">
              <input name="note" maxLength={200} className={inputClass} />
            </L>
          </ActionForm>
        </Panel>

        <Panel title="مصروف ولا خسارة شخصية">
          <ActionForm action={addExpense} submitLabel="إضافة" variant="dark">
            <input type="hidden" name="scope" value="PERSONAL" />
            <L label="النوع">
              <select name="category" className={inputClass}>
                {Object.entries(PERSONAL_CATEGORIES).map(([k, label]) => (
                  <option key={k} value={k}>
                    {label}
                  </option>
                ))}
              </select>
            </L>
            <L label="المبلغ (درهم)">
              <input name="amount" type="number" min={1} required className={inputClass} />
            </L>
            <L label="التاريخ">
              <input name="spentOn" type="date" required defaultValue={today} className={inputClass} />
            </L>
            <L label="ملاحظة">
              <input name="note" maxLength={200} className={inputClass} />
            </L>
          </ActionForm>
          <p className="mt-3 text-xs text-warm-600">ما كيدخلش فربح المشروع، ولكن كينقص من الكاش ومن نتيجة رأس المال.</p>
        </Panel>

        <Panel title="حركة رأس المال">
          <ActionForm action={addCapital} submitLabel="إضافة" variant="dark">
            <L label="النوع">
              <select name="type" className={inputClass}>
                <option value="INJECTION">دخلت فلوس للمشروع</option>
                <option value="WITHDRAWAL">سحبت فلوس من المشروع</option>
              </select>
            </L>
            <L label="المبلغ (درهم)">
              <input name="amount" type="number" min={1} required className={inputClass} />
            </L>
            <L label="التاريخ">
              <input name="occurredOn" type="date" required defaultValue={today} className={inputClass} />
            </L>
            <L label="ملاحظة">
              <input name="note" maxLength={200} className={inputClass} />
            </L>
          </ActionForm>
        </Panel>
      </div>

      <div className="mt-6 grid gap-6 lg:grid-cols-2">
        <Panel title="آخر المصاريف">
          {expenses.length ? (
            <ul className="flex flex-col divide-y divide-warm-200/60 text-sm">
              {expenses.map((e) => (
                <li key={e.id} className="flex items-center justify-between gap-3 py-1.5">
                  <span className="min-w-0">
                    <span className="flex items-center gap-1.5 font-semibold text-ink">
                      {e.scope === "PERSONAL" ? <PiggyBank className="size-4 shrink-0 text-warm-500" aria-label="شخصي" /> : <Banknote className="size-4 shrink-0 text-warm-500" aria-label="المشروع" />}
                      {categoryLabel(e.scope, e.category)}
                    </span>
                    <span className="block truncate text-xs text-warm-600">
                      {dayFmt.format(e.spentOn)}
                      {e.note ? ` · ${e.note}` : ""}
                    </span>
                  </span>
                  <span className="flex shrink-0 items-center gap-1">
                    <b className="text-ink">{mad(e.amount)}</b>
                    <DeleteButton action={deleteExpense} id={e.id} label="حذف المصروف" />
                  </span>
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-sm text-warm-600">مازال ما تسجل حتى مصروف.</p>
          )}
        </Panel>

        <Panel title="حركات رأس المال">
          {capitalEntries.length ? (
            <ul className="flex flex-col divide-y divide-warm-200/60 text-sm">
              {capitalEntries.map((e) => (
                <li key={e.id} className="flex items-center justify-between gap-3 py-1.5">
                  <span className="min-w-0">
                    <span className="flex items-center gap-1.5 font-semibold text-ink">
                      <Landmark className="size-4 shrink-0 text-warm-500" aria-hidden="true" />
                      {e.type === "INJECTION" ? "دخلت فلوس" : "سحبت فلوس"}
                    </span>
                    <span className="block truncate text-xs text-warm-600">
                      {dayFmt.format(e.occurredOn)}
                      {e.note ? ` · ${e.note}` : ""}
                    </span>
                  </span>
                  <span className="flex shrink-0 items-center gap-1">
                    <b className={e.type === "INJECTION" ? "text-success" : "text-danger"}>{mad(e.amount)}</b>
                    <DeleteButton action={deleteCapital} id={e.id} label="حذف الحركة" />
                  </span>
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-sm text-warm-600">سجل شحال دخلتي فالمشروع باش يتحسب رأس المال بالصح.</p>
          )}
        </Panel>
      </div>
    </>
  );
}
