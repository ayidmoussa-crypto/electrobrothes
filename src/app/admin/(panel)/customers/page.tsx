import { MessageCircle, Search, Trash2 } from "lucide-react";
import Link from "next/link";
import { removeSubscriber } from "@/app/actions/admin-customers";
import { PageHeader, tdClass, thClass } from "@/components/admin/ui";
import { requireAdmin } from "@/lib/admin";
import { adminTr } from "@/lib/admin-lang";
import { adminLocale } from "@/lib/admin-tr";
import { db } from "@/lib/db";
import { formatMAD } from "@/lib/money";
import { formatMoroccanPhone } from "@/lib/phone";
import { TIME_ZONE } from "@/lib/time";

const LIMIT = 200;

type Buyer = {
  phone: string;
  name: string;
  city: string;
  address: string;
  orders: number;
  delivered: number;
  returned: number;
  spent: number;
  last: Date;
};

export default async function CustomersPage({ searchParams }: PageProps<"/admin/customers">) {
  const [, { tr, lang }] = await Promise.all([requireAdmin(), adminTr()]);
  const dateFmt = new Intl.DateTimeFormat(adminLocale(lang), { dateStyle: "medium", timeStyle: "short", timeZone: TIME_ZONE });
  const dayFmt = new Intl.DateTimeFormat(adminLocale(lang), { dateStyle: "medium", timeZone: TIME_ZONE });
  const raw = (await searchParams).q;
  const q = (typeof raw === "string" ? raw : "").trim().slice(0, 60);
  const like = `%${q}%`;

  // One row per phone number: a buyer is whoever ordered with it. Name, city and address are the latest ones they gave.
  const [buyers, emails] = await Promise.all([
    db.$queryRaw<Buyer[]>`
      SELECT o."phone",
        (array_agg(o."customerName" ORDER BY o."createdAt" DESC))[1] AS name,
        (array_agg(o."cityName" ORDER BY o."createdAt" DESC))[1] AS city,
        (array_agg(o."address" ORDER BY o."createdAt" DESC))[1] AS address,
        count(*)::int AS orders,
        count(*) FILTER (WHERE o."status" = 'DELIVERED')::int AS delivered,
        count(*) FILTER (WHERE o."status" IN ('RETURNING', 'RETURNED'))::int AS returned,
        COALESCE(sum(o."total") FILTER (WHERE o."status" = 'DELIVERED'), 0)::int AS spent,
        max(o."createdAt") AS last
      FROM "Order" o
      GROUP BY o."phone"
      HAVING ${q} = '' OR bool_or(o."customerName" ILIKE ${like} OR o."phone" ILIKE ${like} OR o."cityName" ILIKE ${like} OR o."address" ILIKE ${like})
      ORDER BY delivered DESC, last DESC
      LIMIT ${LIMIT}`,
    db.emailSubscriber.findMany({ orderBy: { createdAt: "desc" } }),
  ]);

  const repeat = buyers.filter((b) => b.delivered >= 2).length;

  return (
    <>
      <PageHeader title={tr("الزبناء", "Customers")} description={tr("كل من طلب من عندك، مجموعين برقم الهاتف، مع البريد اللي تخلّى فالصفحة الرئيسية.", "Everyone who ordered from you, grouped by phone number, plus the emails left on the home page.")} />

      <dl className="mb-5 grid grid-cols-3 gap-3">
        {[
          [tr("زبون", "Customers"), buyers.length >= LIMIT ? `+${LIMIT}` : String(buyers.length)],
          [tr("شراو أكثر من مرة", "Bought more than once"), String(repeat)],
          [tr("بريد إلكتروني", "Emails"), String(emails.length)],
        ].map(([label, value]) => (
          <div key={label} className="admin-card p-4">
            <dt className="text-xs font-semibold text-warm-600">{label}</dt>
            <dd className="mt-1 text-2xl font-extrabold text-ink tabular-nums">{value}</dd>
          </div>
        ))}
      </dl>

      <section aria-labelledby="buyers" className="mb-8">
        <div className="mb-3 flex flex-wrap items-end justify-between gap-3">
          <h2 id="buyers" className="text-lg">
            {tr("المشترين", "Buyers")}
          </h2>
          <form method="get" className="flex w-full max-w-sm gap-2">
            <label className="relative flex-1">
              <span className="sr-only">{tr("ابحث عن زبون", "Search for a customer")}</span>
              <Search className="pointer-events-none absolute start-3 top-3.5 size-4 text-warm-500" aria-hidden="true" />
              <input name="q" defaultValue={q} placeholder={tr("الاسم، الهاتف، المدينة ولا الحي", "Name, phone, city or area")} className="min-h-11 w-full rounded-lg border border-warm-200 bg-white ps-9 pe-3 text-sm" />
            </label>
            <button type="submit" className="min-h-11 cursor-pointer rounded-lg bg-ink px-4 text-sm font-semibold text-white hover:bg-warm-900">
              {tr("بحث", "Search")}
            </button>
          </form>
        </div>

        <div className="admin-card overflow-x-auto">
          <table className="w-full min-w-[52rem]">
            <thead className="border-b border-warm-200">
              <tr>
                <th className={thClass}>{tr("الزبون", "Customer")}</th>
                <th className={thClass}>{tr("المدينة والحي", "City & area")}</th>
                <th className={thClass}>{tr("شرا من عندنا", "Bought")}</th>
                <th className={thClass}>{tr("صرف", "Spent")}</th>
                <th className={thClass}>{tr("آخر طلب", "Last order")}</th>
                <th className={thClass}>
                  <span className="sr-only">{tr("تواصل", "Contact")}</span>
                </th>
              </tr>
            </thead>
            <tbody>
              {buyers.map((b) => (
                <tr key={b.phone} className="border-b border-warm-200/60 transition-colors last:border-0 hover:bg-white">
                  <td className={tdClass}>
                    <Link href={`/admin/orders?q=${encodeURIComponent(b.phone)}`} className="font-bold text-ink underline-offset-4 hover:underline">
                      {b.name}
                    </Link>
                    <span className="block text-xs text-warm-600" dir="ltr">
                      {formatMoroccanPhone(b.phone)}
                    </span>
                  </td>
                  <td className={tdClass}>
                    <span className="block font-semibold text-ink">{b.city}</span>
                    <span className="block max-w-64 truncate text-xs text-warm-600" title={b.address}>
                      {b.address}
                    </span>
                  </td>
                  <td className={tdClass}>
                    <span className="flex flex-wrap items-center gap-1.5">
                      <b className="text-lg text-ink tabular-nums">{b.delivered}</b>
                      <span className="text-xs text-warm-600">{b.delivered === 1 ? tr("مرة", "time") : tr("مرات", "times")}</span>
                      {b.delivered >= 2 ? <span className="rounded-full bg-yellow-100 px-2 py-0.5 text-xs font-bold text-yellow-900">{tr("وفي", "Loyal")}</span> : null}
                      {b.returned ? <span className="rounded-full bg-danger-soft px-2 py-0.5 text-xs font-bold text-danger">{tr(`رجّع ${b.returned}`, `Returned ${b.returned}`)}</span> : null}
                    </span>
                    <span className="block text-xs text-warm-500">{tr(`من ${b.orders} طلب`, `of ${b.orders} orders`)}</span>
                  </td>
                  <td className={`${tdClass} font-semibold text-ink tabular-nums`}>{b.spent ? formatMAD(b.spent, lang) : "—"}</td>
                  <td className={`${tdClass} text-sm`}>{dayFmt.format(b.last)}</td>
                  <td className={tdClass}>
                    <a
                      href={`https://wa.me/${b.phone.replace(/\D/g, "")}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      aria-label={tr(`واتساب ${b.name}`, `WhatsApp ${b.name}`)}
                      title={tr("واتساب", "WhatsApp")}
                      className="grid size-9 place-items-center rounded-full bg-whatsapp text-ink transition-opacity hover:opacity-85"
                    >
                      <MessageCircle className="size-4" aria-hidden="true" />
                    </a>
                  </td>
                </tr>
              ))}
              {!buyers.length ? (
                <tr>
                  <td colSpan={6} className="px-3 py-8 text-center text-warm-600">
                    {q ? tr("ما كاين حتى زبون بهاد البحث.", "No customer matches this search.") : tr("ما كاين حتى زبون مازال. أول طلب غادي يبان هنا.", "No customers yet. The first order will show here.")}
                  </td>
                </tr>
              ) : null}
            </tbody>
          </table>
        </div>
        {buyers.length >= LIMIT ? <p className="mt-2 text-xs text-warm-600">{tr(`كيبانو ${LIMIT} الأوائل. استعمل البحث باش تلقى زبون معيّن.`, `The first ${LIMIT} show. Use search to find a given customer.`)}</p> : null}
      </section>

      <section aria-labelledby="emails">
        <h2 id="emails" className="mb-1 text-lg">
          {tr("البريد الإلكتروني", "Email")}
        </h2>
        <p className="mb-3 text-sm text-warm-600">{tr("عناوين البريد اللي تركها الزوار فالصفحة الرئيسية.", "Email addresses visitors left on the home page.")}</p>
        <div className="admin-card overflow-x-auto">
          <table className="w-full">
            <thead className="border-b border-warm-200">
              <tr>
                <th className={thClass}>{tr("البريد الإلكتروني", "Email")}</th>
                <th className={thClass}>{tr("اللغة", "Language")}</th>
                <th className={thClass}>{tr("التاريخ", "Date")}</th>
                <th className={thClass}>
                  <span className="sr-only">{tr("إجراء", "Action")}</span>
                </th>
              </tr>
            </thead>
            <tbody>
              {emails.map((e) => (
                <tr key={e.id} className="border-b border-warm-200/60 last:border-0">
                  <td className={`${tdClass} font-semibold text-ink`} dir="ltr">
                    <a href={`mailto:${e.email}`} className="underline-offset-4 hover:underline">
                      {e.email}
                    </a>
                  </td>
                  <td className={tdClass}>{e.locale === "en" ? tr("الإنجليزية", "English") : tr("العربية", "Arabic")}</td>
                  <td className={tdClass}>{dateFmt.format(e.createdAt)}</td>
                  <td className={tdClass}>
                    <form action={removeSubscriber}>
                      <input type="hidden" name="id" value={e.id} />
                      <button type="submit" className="grid size-10 cursor-pointer place-items-center rounded-lg text-warm-600 hover:bg-white hover:text-danger" aria-label={tr(`حذف ${e.email}`, `Delete ${e.email}`)}>
                        <Trash2 className="size-4" aria-hidden="true" />
                      </button>
                    </form>
                  </td>
                </tr>
              ))}
              {!emails.length ? (
                <tr>
                  <td colSpan={4} className="px-3 py-8 text-center text-warm-600">
                    {tr("لا يوجد أي بريد بعد.", "No emails yet.")}
                  </td>
                </tr>
              ) : null}
            </tbody>
          </table>
        </div>
      </section>
    </>
  );
}
