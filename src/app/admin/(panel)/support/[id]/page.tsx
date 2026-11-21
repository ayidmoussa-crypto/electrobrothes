import { ChevronLeft, CircleCheck, Droplets, MessageCircle, RefreshCw, RotateCcw, SendHorizontal, XCircle } from "lucide-react";
import Link from "next/link";
import { notFound } from "next/navigation";
import { addSupportLesson, decideSupport, reopenSupport, replySupport } from "@/app/actions/admin-support";
import { ActionForm } from "@/components/admin/ActionForm";
import { PageHeader, Panel } from "@/components/admin/ui";
import { Badge } from "@/components/ui/Badge";
import { buttonClass } from "@/components/ui/button";
import { requireAdmin } from "@/lib/admin";
import { adminTr } from "@/lib/admin-lang";
import { db } from "@/lib/db";
import { whatsappLink } from "@/lib/order-whatsapp";
import { isActive, PROBLEM_CATEGORIES, STATUS_LABEL, STATUS_TONE, SUPPORT_LESSON_MAX, warrantyState, type ProblemCategory } from "@/lib/support/rules";
import { adminTitle } from "@/lib/admin-title";

export const generateMetadata = () => adminTitle("تذكرة الدعم", "Support ticket");

export default async function SupportTicketPage({ params }: PageProps<"/admin/support/[id]">) {
  const [, { tr, lang }] = await Promise.all([requireAdmin(), adminTr()]);
  const ar = lang === "ar";
  const { id } = await params;
  const ticket = await db.supportTicket.findUnique({
    where: { id },
    include: {
      messages: { orderBy: { createdAt: "asc" } },
      order: { select: { id: true, number: true, customerName: true, phone: true, cityName: true, deliveredAt: true, createdAt: true } },
    },
  });
  if (!ticket) notFound();
  const product = ticket.productId ? await db.product.findUnique({ where: { id: ticket.productId }, select: { id: true, warrantyMonths: true, supportGuide: true } }) : null;
  const warranty = product ? warrantyState(ticket.order.deliveredAt ?? ticket.order.createdAt, product.warrantyMonths) : null;
  const date = new Intl.DateTimeFormat(ar ? "ar-MA" : "en-GB", { dateStyle: "medium", timeStyle: "short", timeZone: "Africa/Casablanca" });
  const day = new Intl.DateTimeFormat(ar ? "ar-MA" : "en-GB", { dateStyle: "medium", timeZone: "Africa/Casablanca" });
  const first = ticket.order.customerName.trim().split(/\s+/)[0];
  const active = isActive(ticket.status);
  const roleLabel = { customer: ticket.order.customerName, ai: tr("المساعد", "Assistant"), owner: tr("نتا", "You") } as Record<string, string>;

  return (
    <div>
      <Link href="/admin/support" className="mb-2 inline-flex min-h-11 items-center gap-1 text-sm font-semibold text-warm-600 hover:text-ink">
        <ChevronLeft className="size-4 rotate-180 ltr:rotate-0" aria-hidden="true" />
        {tr("الدعم التقني", "Technical support")}
      </Link>
      <PageHeader
        title={ticket.productName}
        description={`${ticket.order.customerName} · ${ticket.order.number} · ${date.format(ticket.createdAt)}`}
        actions={
          <a href={whatsappLink(ticket.order.phone, `السلام عليكم ${first}، معك ElectroBrothers بخصوص المشكل ديال ${ticket.productName}.`)} target="_blank" rel="noreferrer" className={buttonClass({ variant: "outline" })}>
            <MessageCircle className="size-4 text-whatsapp" aria-hidden="true" />
            {tr("واتساب الزبون", "WhatsApp the customer")}
          </a>
        }
      />

      <div className="grid grid-cols-1 gap-3 lg:grid-cols-[1fr_20rem]">
        <Panel title={tr("المحادثة", "Conversation")} className="min-w-0">
          <ol className="flex flex-col gap-4">
            {ticket.messages.map((m) => {
              const mine = m.role === "owner";
              const tone = m.role === "customer" ? "bg-warm-100 text-warm-800" : m.role === "owner" ? "on-yellow bg-yellow-500 text-ink" : "bg-white text-warm-800 ring-1 ring-warm-200";
              return (
                <li key={m.id} className={`flex flex-col gap-1 ${mine ? "items-end" : "items-start"}`}>
                  <span className="px-1 text-xs text-warm-600">
                    <span className="font-semibold">{roleLabel[m.role] ?? m.role}</span> · {date.format(m.createdAt)}
                  </span>
                  <p className={`max-w-[85%] rounded-2xl px-4 py-2.5 text-sm leading-relaxed whitespace-pre-line ${tone}`}>{m.text}</p>
                </li>
              );
            })}
          </ol>
          {active ? (
            <form action={replySupport} className="mt-4 flex items-end gap-2 border-t border-warm-200 pt-4">
              <input type="hidden" name="id" value={ticket.id} />
              <label htmlFor="reply" className="sr-only">
                {tr("ردك على الزبون", "Your reply")}
              </label>
              <textarea id="reply" name="text" rows={2} required maxLength={1600} placeholder={tr("كتب رد للزبون (كيبان ليه فالشات)...", "Write to the customer (shown in their chat)...")} className="admin-field min-h-12 flex-1 resize-none rounded-lg px-3 py-2.5 text-base text-warm-800" />
              <button type="submit" className={buttonClass({ size: "icon" })} aria-label={tr("صيفط", "Send")} title={tr("صيفط", "Send")}>
                <SendHorizontal className="size-5 rtl:-scale-x-100" aria-hidden="true" />
              </button>
            </form>
          ) : null}
          {active ? <p className="mt-2 text-xs text-warm-500">{tr("ملي ترد، المساعد كيوقف والمحادثة كتولي عندك. الزبون كيشوف ردك ملي يرجع للرابط ديالو، صيفط ليه كلمة فواتساب.", "Once you reply the assistant stops and the conversation is yours. The customer sees it when they reopen their link: send them a word on WhatsApp.")}</p> : null}
        </Panel>

        <div className="flex flex-col gap-3">
          <Panel title={tr("الحالة", "Status")}>
            <div className="flex flex-wrap gap-1.5">
              <Badge tone={STATUS_TONE[ticket.status]}>{STATUS_LABEL[ticket.status][lang]}</Badge>
              {ticket.verdict === "defect" ? (
                <Badge tone="danger">{tr("عطب محتمل من المعمل", "Likely factory defect")}</Badge>
              ) : ticket.verdict === "misuse" ? (
                <Badge tone="warning">{ticket.status === "UNSOLVED" ? tr("السبب من الزبون", "Caused by the customer") : tr("السبب غالباً من الاستعمال", "Likely caused by use")}</Badge>
              ) : ticket.verdict === "help" ? (
                <Badge tone="neutral">{tr("محتاج تدخل", "Needs a person")}</Badge>
              ) : null}
              {ticket.solvedByAi ? <Badge tone="accent">{tr("حلها المساعد", "Assistant fixed it")}</Badge> : null}
            </div>
            <dl className="mt-3 flex flex-col gap-2 text-sm">
              <div>
                <dt className="text-xs text-warm-600">{tr("نوع المشكل", "Kind of problem")}</dt>
                <dd className="font-semibold text-ink">{ticket.category && ticket.category in PROBLEM_CATEGORIES ? PROBLEM_CATEGORIES[ticket.category as ProblemCategory][lang] : tr("مازال ما تعرف", "Not known yet")}</dd>
              </div>
              {ticket.summary ? (
                <div>
                  <dt className="text-xs text-warm-600">{tr("ملخص المساعد", "Assistant's summary")}</dt>
                  <dd className="text-warm-800">{ticket.summary}</dd>
                </div>
              ) : null}
              {warranty ? (
                <div>
                  <dt className="text-xs text-warm-600">{tr("الضمانة", "Warranty")}</dt>
                  <dd className={`font-semibold ${warranty.covered ? "text-success" : "text-danger"}`}>
                    {warranty.covered ? tr(`سارية حتى ${day.format(warranty.endsAt)}`, `Covered until ${day.format(warranty.endsAt)}`) : tr(`سالات ف ${day.format(warranty.endsAt)}`, `Ended on ${day.format(warranty.endsAt)}`)}
                  </dd>
                </div>
              ) : null}
              <div>
                <dt className="text-xs text-warm-600">{tr("الطلب", "Order")}</dt>
                <dd>
                  <Link href={`/admin/orders/${ticket.order.id}`} className="font-semibold text-ink underline underline-offset-4" dir="ltr">
                    {ticket.order.number}
                  </Link>
                  <span className="text-warm-600"> · {ticket.order.cityName}</span>
                </dd>
              </div>
            </dl>
          </Panel>

          <Panel title={active ? tr("القرار ديالك", "Your decision") : tr("تسدات", "Closed")}>
            {active ? (
              <div className="flex flex-col gap-2">
                {(
                  [
                    ["SOLVED", CircleCheck, tr("تحل المشكل", "Problem solved"), "text-success"],
                    ["REPLACED", RefreshCw, tr("عطب من المعمل: تبدل المنتوج", "Factory defect: product replaced"), "text-ink"],
                    ["CUSTOMER", Droplets, tr("السبب من الزبون (ماء، شاحن قوي، طيحة...): ما تبدلش", "Caused by the customer (water, strong charger, fall...): not replaced"), "text-warning"],
                    ["UNSOLVED", XCircle, tr("ما تحلش (خارج الضمانة، ما جاوبش...)", "Not solved (out of warranty, no answer...)"), "text-danger"],
                  ] as const
                ).map(([outcome, Icon, label, color]) => (
                  <form key={outcome} action={decideSupport}>
                    <input type="hidden" name="id" value={ticket.id} />
                    <button type="submit" name="outcome" value={outcome} className={buttonClass({ variant: "outline", className: "w-full justify-start" })}>
                      <Icon className={`size-4 ${color}`} aria-hidden="true" />
                      {label}
                    </button>
                  </form>
                ))}
              </div>
            ) : (
              <form action={reopenSupport} className="flex flex-col gap-2">
                <p className="text-sm text-warm-600">
                  {ticket.closedAt ? date.format(ticket.closedAt) : ""} · {ticket.closedBy === "customer" ? tr("الزبون أكد بلي تحل", "The customer confirmed it works") : ticket.closedBy}
                </p>
                {ticket.rewardCode ? (
                  <p className="text-sm text-warm-800">
                    {tr("كود الشكر:", "Thank-you code:")}{" "}
                    <span className="font-mono font-bold text-ink" dir="ltr">
                      {ticket.rewardCode}
                    </span>
                  </p>
                ) : null}
                <input type="hidden" name="id" value={ticket.id} />
                <button type="submit" className={buttonClass({ variant: "outline" })}>
                  <RotateCcw className="size-4" aria-hidden="true" />
                  {tr("عاود حلها", "Reopen")}
                </button>
              </form>
            )}
          </Panel>

          <Panel title={tr("صحح المساعد", "Correct the assistant")}>
            <p className="mb-3 text-sm text-warm-600">{tr("غلط فشي جواب؟ كتب الصحيح، وغادي يتبعو فالمحادثات الجاية.", "Got an answer wrong? Write what is right, and it follows it in the next conversations.")}</p>
            <ActionForm action={addSupportLesson} submitLabel={tr("حفظ التصحيح", "Save correction")} variant="dark">
              <input type="hidden" name="ticketId" value={ticket.id} />
              {product ? <input type="hidden" name="productId" value={product.id} /> : null}
              <label htmlFor="lesson" className="sr-only">
                {tr("التصحيح", "Correction")}
              </label>
              <textarea
                id="lesson"
                name="text"
                rows={4}
                required
                maxLength={SUPPORT_LESSON_MAX}
                placeholder={tr("مثلا: هاد البوشيط ما فيهش بلوتوث، ما تسولش على الربط.", "e.g. This case has no Bluetooth: don't ask about pairing.")}
                className="admin-field w-full rounded-lg px-3 py-2.5 text-base text-warm-800"
              />
              {product ? (
                <label className="flex cursor-pointer items-center gap-2 text-sm text-warm-800">
                  <input type="checkbox" name="onlyProduct" defaultChecked className="size-4 accent-ink" />
                  {tr(`غير لهاد المنتوج (${ticket.productName})`, `Only for this product (${ticket.productName})`)}
                </label>
              ) : null}
            </ActionForm>
            <Link href="/admin/support/lessons" className="mt-3 inline-flex min-h-11 items-center text-sm font-semibold text-ink underline underline-offset-4">
              {tr("كل التصحيحات", "All corrections")}
            </Link>
          </Panel>

          {product ? (
            <Panel title={tr("دليل الأعطاب ديال المنتوج", "Product troubleshooting notes")}>
              <p className="text-sm text-warm-600">
                {product.supportGuide
                  ? tr("المساعد كيقدم الملاحظات ديالك على المعرفة ديالو فهاد المنتوج.", "The assistant puts your notes first for this product.")
                  : tr("اختياري: المساعد كيعتمد على المعرفة التقنية ديالو. إلا عندك تجربة خاصة مع هاد المنتوج، زيدها هنا.", "Optional: the assistant uses its own technical knowledge. Add your own experience with this product here if you have some.")}
              </p>
              <Link href={`/admin/products/${product.id}#support-guide`} className="mt-2 inline-flex min-h-11 items-center text-sm font-semibold text-ink underline underline-offset-4">
                {product.supportGuide ? tr("بدل الملاحظات", "Edit notes") : tr("زيد ملاحظات", "Add notes")}
              </Link>
            </Panel>
          ) : null}
        </div>
      </div>
    </div>
  );
}
