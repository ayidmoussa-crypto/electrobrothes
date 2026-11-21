import { CampaignAnalysis } from "@/components/admin/CampaignAnalysis";
import { PageHeader, Panel, tdClass, thClass } from "@/components/admin/ui";
import { requireAdmin } from "@/lib/admin";
import { adminTr } from "@/lib/admin-lang";
import { campaignStats, type CampaignRow } from "@/lib/campaign-stats";
import { formatMAD } from "@/lib/money";
import { campaignRates } from "@/lib/offers";
import { adminTitle } from "@/lib/admin-title";

export const generateMetadata = () => adminTitle("أداء العروض", "Campaign performance");

/** Clicks and orders per home offer and per offer page template, last 30 days. Delivered orders are the main figure. */
export default async function CampaignPerformance() {
  const [, { tr, lang }] = await Promise.all([requireAdmin(), adminTr()]);
  const stats = await campaignStats(30, lang);
  const pct = (v: number | null) => (v === null ? "—" : `${v}%`);

  const table = (rows: CampaignRow[], first: string) =>
    rows.length ? (
      <div className="overflow-x-auto">
        <table className="w-full">
          <thead>
            <tr className="border-b border-warm-200">
              <th className={thClass}>{first}</th>
              <th className={thClass}>{tr("نقرات «تسوّق/اطلب»", "Shop/order clicks")}</th>
              <th className={thClass}>{tr("نقرات واتساب", "WhatsApp clicks")}</th>
              <th className={thClass}>{tr("طلبات", "Orders")}</th>
              <th className={thClass}>{tr("مؤكدة", "Confirmed")}</th>
              <th className={thClass}>{tr("موصلة", "Delivered")}</th>
              <th className={thClass}>{tr("مرفوضة", "Refused")}</th>
              <th className={thClass}>{tr("مداخيل الموصلة", "Delivered revenue")}</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-warm-200">
            {rows.map((r) => {
              const rate = campaignRates(r);
              return (
                <tr key={r.key}>
                  <th scope="row" className={`${tdClass} text-start font-semibold text-ink`}>{r.label}</th>
                  <td className={`${tdClass} tabular-nums`}>{r.clicks}</td>
                  <td className={`${tdClass} tabular-nums`}>{r.whatsapp}</td>
                  <td className={`${tdClass} tabular-nums`}>
                    {r.orders} <span className="text-xs text-warm-500">({pct(rate.orderRate)})</span>
                  </td>
                  <td className={`${tdClass} tabular-nums`}>
                    {r.confirmed} <span className="text-xs text-warm-500">({pct(rate.confirmRate)})</span>
                  </td>
                  <td className={`${tdClass} font-bold text-success tabular-nums`}>
                    {r.delivered} <span className="text-xs font-normal text-warm-500">({pct(rate.deliveryRate)})</span>
                  </td>
                  <td className={`${tdClass} text-danger tabular-nums`}>{r.refused}</td>
                  <td className={`${tdClass} tabular-nums`}>{formatMAD(r.revenueDelivered, lang)}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    ) : (
      <p className="text-sm text-warm-600">{tr("ما كاين حتى رقم دابا.", "No figures yet.")}</p>
    );

  return (
    <>
      <PageHeader
        title={tr("أداء الحملات", "Campaign results")}
        description={tr("آخر 30 يوم. الطلب كيتحسب للعرض إلا الزبون ضغط عليه فـ 7 أيام قبل. الطلبات الموصلة هوما المقياس الأساسي.", "Last 30 days. An order counts for an offer when the shopper clicked it in the 7 days before. Delivered orders are the main measure.")}
      />
      <Panel title={tr("عروض الرئيسية", "Home offers")} className="mb-6">
        {table(stats.offers, tr("العرض", "Offer"))}
      </Panel>
      <Panel title={tr("صفحات العروض حسب القالب", "Offer pages by template")} className="mb-6">
        {table(stats.templates, tr("القالب", "Template"))}
      </Panel>
      <CampaignAnalysis />
    </>
  );
}
