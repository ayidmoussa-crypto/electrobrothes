import { ArrowRight, Check, CheckCheck, CircleAlert, Clock, MessagesSquare, Plus, Unplug } from "lucide-react";
import Link from "next/link";
import { sendReply, sendTemplate } from "@/app/actions/admin-inbox";
import { ActionForm } from "@/components/admin/ActionForm";
import { AutoRefresh } from "@/components/admin/AutoRefresh";
import { inputClass, L, PageHeader, Panel, StatusBadge } from "@/components/admin/ui";
import { buttonClass } from "@/components/ui/button";
import { requireStaff } from "@/lib/admin";
import { adminTr, type Tr } from "@/lib/admin-lang";
import { adminLocale } from "@/lib/admin-tr";
import { db } from "@/lib/db";
import { formatMAD } from "@/lib/money";
import { formatMoroccanPhone, normalizeMoroccanPhone } from "@/lib/phone";
import { TIME_ZONE } from "@/lib/time";
import { waConfig } from "@/lib/whatsapp/client";
import { WINDOW_MS, windowOpen } from "@/lib/whatsapp/rules";

const showPhone = (p: string) => (p.startsWith("+212") ? formatMoroccanPhone(p) : p);
const hoursLeft = (from: Date) => Math.max(1, Math.ceil((WINDOW_MS - (Date.now() - from.getTime())) / 3600_000));

function Ticks({ status, tr }: { status: string | null; tr: Tr }) {
  if (status === "failed") return <CircleAlert className="size-3.5 text-danger" aria-label={tr("فشل", "Failed")} />;
  if (status === "read") return <CheckCheck className="size-3.5 text-yellow-800" aria-label={tr("تقرات", "Read")} />;
  if (status === "delivered") return <CheckCheck className="size-3.5 text-warm-600" aria-label={tr("توصلات", "Delivered")} />;
  return <Check className="size-3.5 text-warm-600" aria-label={tr("تصيفطات", "Sent")} />;
}

export default async function InboxPage({ searchParams }: PageProps<"/admin/inbox">) {
  const [, { tr, lang }] = await Promise.all([requireStaff(), adminTr()]);
  const timeFmt = new Intl.DateTimeFormat(adminLocale(lang), { dateStyle: "short", timeStyle: "short", timeZone: TIME_ZONE });
  const q = await searchParams;
  const selectedId = typeof q.c === "string" ? q.c : null;
  const phoneParam = typeof q.phone === "string" && /^\+\d{8,15}$/.test(q.phone) ? q.phone : null;
  const connected = !!waConfig();

  const conversations = await db.waConversation.findMany({ orderBy: { lastMessageAt: "desc" }, take: 100 });
  const current = selectedId ? conversations.find((c) => c.id === selectedId) ?? (await db.waConversation.findUnique({ where: { id: selectedId } })) : phoneParam ? await db.waConversation.findUnique({ where: { phone: phoneParam } }) : null;
  // Opened from an order with no conversation yet: only a template can start it.
  const phone = current?.phone ?? phoneParam;

  const [messages, orders] = await Promise.all([
    current ? db.waMessage.findMany({ where: { conversationId: current.id }, orderBy: { createdAt: "desc" }, take: 100 }) : [],
    phone ? db.order.findMany({ where: { phone }, orderBy: { createdAt: "desc" }, take: 5, select: { id: true, number: true, status: true, total: true } }) : [],
  ]);
  if (current?.unread) await db.waConversation.update({ where: { id: current.id }, data: { unread: 0 } });

  const open = windowOpen(current?.lastInboundAt ?? null);
  const moroccan = phone ? normalizeMoroccanPhone(phone) : null;
  const inThread = !!phone;

  return (
    <>
      <AutoRefresh seconds={10} />
      <PageHeader title={tr("المحادثات", "Conversations")} description={tr("رسائل واتساب ديال الزبناء فبلاصة وحدة.", "Customers' WhatsApp messages in one place.")} />

      {!connected ? (
        <div className="mb-4 flex items-start gap-3 rounded-2xl border border-warning/40 bg-warning-soft/85 p-4 text-sm text-warning-text">
          <Unplug className="mt-0.5 size-5 shrink-0" aria-hidden="true" />
          <div>
            <p className="font-bold">{tr("واتساب مازال ما مربوطش.", "WhatsApp is not connected yet.")}</p>
            <p className="mt-1">
              {tr("خاص هادو فـ", "These are needed in")} <span dir="ltr">.env</span>: <span dir="ltr">WHATSAPP_TOKEN, WHATSAPP_PHONE_NUMBER_ID, WHATSAPP_APP_SECRET, WHATSAPP_VERIFY_TOKEN</span>.{" "}
              {tr("ورابط الـ webhook فـ Meta هو", "The webhook link in Meta is")} <span dir="ltr">/api/webhooks/whatsapp</span> {tr("على الدومين ديال الموقع.", "on the site's domain.")}
            </p>
          </div>
        </div>
      ) : null}

      <div className="grid gap-4 lg:grid-cols-[20rem_1fr]">
        {/* Phones show one side at a time: the list, or the open conversation. */}
        <section aria-label={tr("لائحة المحادثات", "Conversation list")} className={`admin-card overflow-hidden ${inThread ? "max-lg:hidden" : ""}`}>
          {conversations.length ? (
            <ul className="max-h-[70vh] overflow-y-auto">
              {conversations.map((c) => (
                <li key={c.id}>
                  <Link
                    href={`/admin/inbox?c=${c.id}`}
                    aria-current={c.id === current?.id ? "true" : undefined}
                    className={`flex items-start gap-3 border-b border-warm-200/60 p-3 transition-colors hover:bg-white/60 ${c.id === current?.id ? "bg-yellow-100" : ""}`}
                  >
                    <span className="grid size-10 shrink-0 place-items-center rounded-full bg-ink font-bold text-yellow-500">{(c.name ?? "#").slice(0, 1)}</span>
                    <span className="min-w-0 flex-1">
                      <span className="flex items-baseline justify-between gap-2">
                        <bdi className="truncate font-semibold text-ink">{c.name ?? showPhone(c.phone)}</bdi>
                        <span className="shrink-0 text-xs text-warm-500">{timeFmt.format(c.lastMessageAt)}</span>
                      </span>
                      <span className="flex items-center justify-between gap-2">
                        <span className="truncate text-sm text-warm-600">{c.lastPreview}</span>
                        {c.unread && c.id !== current?.id ? <span className="grid min-w-5 shrink-0 place-items-center rounded-full bg-yellow-500 px-1 text-xs font-bold text-ink">{c.unread}</span> : null}
                      </span>
                    </span>
                  </Link>
                </li>
              ))}
            </ul>
          ) : (
            <p className="p-6 text-center text-sm text-warm-600">{tr("مازال ما كاين حتى محادثة.", "No conversations yet.")}</p>
          )}
        </section>

        <div className={inThread ? "min-w-0" : "max-lg:hidden"}>
          {phone ? (
            <div className="flex flex-col gap-4">
              <section className="admin-card flex flex-col overflow-hidden">
                <header className="flex flex-wrap items-center justify-between gap-2 border-b border-warm-200/60 p-3">
                  <div className="flex items-center gap-2">
                    <Link href="/admin/inbox" aria-label={tr("رجوع للمحادثات", "Back to conversations")} className={buttonClass({ variant: "ghost", size: "icon", className: "lg:hidden" })}>
                      <ArrowRight className="size-5 ltr:rotate-180" aria-hidden="true" />
                    </Link>
                    <div>
                      <h2 className="text-base">
                        <bdi>{current?.name ?? showPhone(phone)}</bdi>
                      </h2>
                      <p className="text-xs text-warm-600" dir="ltr">
                        {showPhone(phone)}
                      </p>
                    </div>
                  </div>
                  {moroccan ? (
                    <Link href={`/admin/orders/new?phone=${encodeURIComponent(moroccan)}&name=${encodeURIComponent(current?.name ?? "")}`} className={buttonClass({ className: "min-h-10 px-3 text-sm" })}>
                      <Plus className="size-4" aria-hidden="true" />
                      {tr("سجّل طلب", "Record order")}
                    </Link>
                  ) : null}
                </header>

                {/* Newest at the bottom, and the browser keeps the scroll there because the list is reversed. */}
                <ol className="flex max-h-[55vh] min-h-48 flex-col-reverse gap-2 overflow-y-auto p-3">
                  {messages.map((m) => (
                    <li key={m.id} className={`max-w-[85%] rounded-2xl px-3 py-2 text-sm ${m.direction === "IN" ? "self-start bg-white text-warm-800" : "self-end bg-yellow-100 text-ink"}`}>
                      <p className="break-words whitespace-pre-wrap">{m.body}</p>
                      <p className="mt-1 flex items-center justify-end gap-1 text-xs text-warm-600">
                        {m.actor === "automation" ? <span>{tr("تلقائي ·", "Automatic ·")}</span> : null}
                        <time dateTime={m.createdAt.toISOString()}>{timeFmt.format(m.createdAt)}</time>
                        {m.direction === "OUT" ? <Ticks status={m.status} tr={tr} /> : null}
                      </p>
                      {m.error ? <p className="mt-1 text-xs font-medium text-danger">{m.error}</p> : null}
                    </li>
                  ))}
                  {!messages.length ? <li className="m-auto text-sm text-warm-600">{tr("ما كاين حتى رسالة فهاد المحادثة.", "No messages in this conversation.")}</li> : null}
                </ol>

                <div className="border-t border-warm-200/60 p-3">
                  {open ? (
                    <>
                      <ActionForm action={sendReply} submitLabel={tr("إرسال", "Send")} className="flex flex-col gap-2">
                        <input type="hidden" name="phone" value={phone} />
                        <textarea name="text" rows={2} required maxLength={4096} aria-label={tr("الرسالة", "Message")} placeholder={tr("اكتب ردك", "Type your reply")} className={`${inputClass} py-2`} />
                      </ActionForm>
                      <p className="mt-2 flex items-center gap-1 text-xs text-warm-600">
                        <Clock className="size-3.5" aria-hidden="true" />
                        {tr(`بقات ${hoursLeft(current!.lastInboundAt!)} ساعة باش تجاوب برسالة عادية.`, `${hoursLeft(current!.lastInboundAt!)} hours left to reply with a normal message.`)}
                      </p>
                    </>
                  ) : (
                    <>
                      <p className="mb-2 text-sm font-semibold text-warning-text">{tr("فاتت 24 ساعة من آخر رسالة ديال الزبون، فغير القوالب المعتمدة من Meta كتتصيفط.", "24 hours have passed since the customer's last message, so only Meta-approved templates can be sent.")}</p>
                      <ActionForm action={sendTemplate} submitLabel={tr("إرسال القالب", "Send template")} variant="dark" className="grid gap-2 sm:grid-cols-[2fr_1fr]">
                        <input type="hidden" name="phone" value={phone} />
                        <L label={tr("اسم القالب", "Template name")}>
                          <input name="name" required dir="ltr" className={`${inputClass} text-start`} />
                        </L>
                        <L label={tr("اللغة", "Language")}>
                          <input name="language" required dir="ltr" defaultValue="ar" className={`${inputClass} text-start`} />
                        </L>
                        <L label={tr("القيم بالترتيب، كل قيمة فسطر", "Values in order, one per line")} className="sm:col-span-2">
                          <textarea name="params" rows={2} className={`${inputClass} py-2`} />
                        </L>
                      </ActionForm>
                    </>
                  )}
                </div>
              </section>

              {orders.length ? (
                <Panel title={tr("طلبات هاد الزبون", "This customer's orders")}>
                  <ul className="flex flex-col gap-2 text-sm">
                    {orders.map((o) => (
                      <li key={o.id} className="flex flex-wrap items-center justify-between gap-2">
                        <Link href={`/admin/orders/${o.id}`} className="font-mono font-bold text-ink underline-offset-4 hover:underline" dir="ltr">
                          {o.number}
                        </Link>
                        <span className="flex items-center gap-2">
                          <span className="font-semibold text-ink">{formatMAD(o.total, lang)}</span>
                          <StatusBadge status={o.status} lang={lang} />
                        </span>
                      </li>
                    ))}
                  </ul>
                </Panel>
              ) : null}
            </div>
          ) : (
            <div className="admin-card grid min-h-80 place-items-center p-8 text-center text-warm-600">
              <div>
                <MessagesSquare className="mx-auto size-8 text-warm-400" aria-hidden="true" />
                <p className="mt-2">{tr("اختار محادثة من اللائحة.", "Pick a conversation from the list.")}</p>
              </div>
            </div>
          )}
        </div>
      </div>
    </>
  );
}
