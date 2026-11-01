/* eslint-disable no-restricted-syntax -- email clients ignore CSS variables, so this template inlines HEX copies of the brand tokens (globals.css). */
import { formatMAD } from "./money";
import { formatMoroccanPhone } from "./phone";

const C = { ink: "#111111", yellow: "#FFD000", warm50: "#FAF9F6", warm200: "#E4E1DA", warm600: "#57544D", warningText: "#A34E00", warningSoft: "#FDF0E4" };

const esc = (s: string) =>
  s.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]!);

export type EmailOrder = {
  id: string;
  number: string;
  customerName: string;
  phone: string;
  cityName: string;
  address: string;
  notes: string | null;
  subtotal: number;
  shippingFee: number;
  discount: number;
  total: number;
  couponCode: string | null;
  riskScore: number;
  riskFlags: string[];
  items: { nameAr: string; variantLabel: string | null; quantity: number; unitPrice: number }[];
};

const RISK: Record<string, string> = {
  blacklisted: "في القائمة السوداء",
  bot_honeypot: "روبوت محتمل",
  duplicate_phone: "طلب متكرر بنفس الرقم",
  too_fast: "ملء سريع جداً",
  many_from_ip: "طلبات كثيرة من نفس الجهاز",
  high_value: "قيمة مرتفعة",
};

/** Admin "new order" email. Every customer-typed value is HTML-escaped. */
export function renderOrderEmail(o: EmailOrder, adminUrl: string) {
  const mad = (n: number) => formatMAD(n, "ar");
  const rows = o.items
    .map(
      (i) => `<tr>
        <td style="padding:8px 0;border-bottom:1px solid ${C.warm200}">${esc(i.nameAr)}${i.variantLabel ? ` <span style="color:${C.warm600}">· ${esc(i.variantLabel)}</span>` : ""} × ${i.quantity}</td>
        <td style="padding:8px 0;border-bottom:1px solid ${C.warm200};text-align:left;white-space:nowrap">${mad(i.unitPrice * i.quantity)}</td>
      </tr>`,
    )
    .join("");
  const risk = o.riskScore
    ? `<p style="margin:16px 0;padding:12px;border-radius:8px;background:${C.warningSoft};color:${C.warningText}"><b>تنبيه: درجة الخطورة ${o.riskScore}/100</b><br>${o.riskFlags.map((f) => esc(RISK[f] ?? f)).join("، ")}</p>`
    : "";

  const html = `<!doctype html><html lang="ar" dir="rtl"><body style="margin:0;background:${C.warm50};font-family:Tahoma,Arial,sans-serif;color:${C.ink}">
  <div style="max-width:560px;margin:0 auto;padding:24px">
    <div style="background:${C.ink};color:#FFFFFF;padding:16px 20px;border-radius:12px 12px 0 0">
      <b style="font-size:18px">⚡ طلب جديد ${esc(o.number)}</b>
    </div>
    <div style="background:#FFFFFF;padding:20px;border:1px solid ${C.warm200};border-top:0;border-radius:0 0 12px 12px">
      ${risk}
      <p style="margin:0 0 4px"><b>${esc(o.customerName)}</b> — <span dir="ltr">${esc(formatMoroccanPhone(o.phone))}</span></p>
      <p style="margin:0 0 16px;color:${C.warm600}">${esc(o.address)}، ${esc(o.cityName)}</p>
      ${o.notes ? `<p style="margin:0 0 16px">ملاحظات: ${esc(o.notes)}</p>` : ""}
      <table style="width:100%;border-collapse:collapse;font-size:14px">${rows}</table>
      <p style="margin:12px 0 0;color:${C.warm600};font-size:14px">التوصيل: ${o.shippingFee ? mad(o.shippingFee) : "مجاني"}${o.discount ? ` · الخصم: −${mad(o.discount)}${o.couponCode ? ` (${esc(o.couponCode)})` : ""}` : ""}</p>
      <p style="margin:8px 0 20px;font-size:20px"><b>المبلغ عند الاستلام: ${mad(o.total)}</b></p>
      <a href="${esc(adminUrl)}/admin/orders/${esc(o.id)}" style="display:inline-block;background:${C.yellow};color:${C.ink};padding:12px 20px;border-radius:8px;font-weight:bold;text-decoration:none">فتح الطلب في لوحة التحكم</a>
    </div>
  </div></body></html>`;

  const text = [
    `طلب جديد ${o.number}`,
    o.riskScore ? `تنبيه خطورة ${o.riskScore}/100: ${o.riskFlags.map((f) => RISK[f] ?? f).join("، ")}` : "",
    `${o.customerName} — ${formatMoroccanPhone(o.phone)}`,
    `${o.address}، ${o.cityName}`,
    ...o.items.map((i) => `- ${i.nameAr}${i.variantLabel ? ` (${i.variantLabel})` : ""} × ${i.quantity}`),
    `المبلغ عند الاستلام: ${mad(o.total)}`,
    `${adminUrl}/admin/orders/${o.id}`,
  ]
    .filter(Boolean)
    .join("\n");

  const subject = `${o.riskScore >= 30 ? "⚠️ " : ""}طلب جديد ${o.number} — ${mad(o.total)} — ${o.cityName}`;
  return { subject, html, text };
}
