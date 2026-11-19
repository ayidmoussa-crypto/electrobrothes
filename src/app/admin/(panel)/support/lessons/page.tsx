import { ChevronLeft, Trash2 } from "lucide-react";
import Link from "next/link";
import { addSupportLesson, updateSupportLesson } from "@/app/actions/admin-support";
import { ActionForm } from "@/components/admin/ActionForm";
import { PageHeader, Panel } from "@/components/admin/ui";
import { Badge } from "@/components/ui/Badge";
import { requireAdmin } from "@/lib/admin";
import { adminTr } from "@/lib/admin-lang";
import { db } from "@/lib/db";
import { SUPPORT_LESSON_MAX } from "@/lib/support/rules";

/** What the owner taught the support assistant: rules it follows in every conversation, or for one product. */
export default async function SupportLessonsPage() {
  const [, { tr, lang }] = await Promise.all([requireAdmin(), adminTr()]);
  const ar = lang === "ar";
  const lessons = await db.supportLesson.findMany({
    orderBy: [{ isActive: "desc" }, { createdAt: "desc" }],
    select: { id: true, text: true, isActive: true, ticketId: true, createdAt: true, product: { select: { nameAr: true, nameEn: true } } },
  });
  const date = new Intl.DateTimeFormat(ar ? "ar-MA" : "en-GB", { dateStyle: "medium", timeZone: "Africa/Casablanca" });
  const small = "inline-flex min-h-9 cursor-pointer items-center gap-1 rounded-lg px-3 text-sm font-semibold text-warm-800 hover:bg-warm-100";

  return (
    <div>
      <Link href="/admin/support" className="mb-2 inline-flex min-h-11 items-center gap-1 text-sm font-semibold text-warm-600 hover:text-ink">
        <ChevronLeft className="size-4 rotate-180 ltr:rotate-0" aria-hidden="true" />
        {tr("الدعم التقني", "Technical support")}
      </Link>
      <PageHeader
        title={tr("تعليم المساعد", "Teach the assistant")}
        description={tr("ملي يغلط المساعد مع شي زبون، كتب هنا الصحيح. كيتبعو فكل محادثة جاية، قبل المعرفة ديالو.", "When the assistant gets something wrong with a customer, write the right answer here. It follows it in every next conversation, before its own knowledge.")}
      />

      <div className="grid grid-cols-1 items-start gap-3 lg:grid-cols-[1fr_24rem]">
        <Panel title={tr(`التصحيحات (${lessons.length})`, `Corrections (${lessons.length})`)} className="min-w-0">
          {lessons.length ? (
            <ul>
              {lessons.map((l) => (
                <li key={l.id} className={`flex flex-col gap-2 border-t border-warm-200 py-3 md:flex-row md:items-start md:justify-between ${l.isActive ? "" : "opacity-60"}`}>
                  <div className="min-w-0">
                    <p className="text-sm whitespace-pre-line text-warm-800">{l.text}</p>
                    <p className="mt-1 flex flex-wrap items-center gap-1.5 text-xs text-warm-600">
                      <Badge tone={l.product ? "accent" : "neutral"}>{l.product ? (ar ? l.product.nameAr : l.product.nameEn) : tr("كل المنتوجات", "Every product")}</Badge>
                      {date.format(l.createdAt)}
                      {l.ticketId ? (
                        <Link href={`/admin/support/${l.ticketId}`} className="underline underline-offset-2 hover:text-ink">
                          {tr("المحادثة", "Conversation")}
                        </Link>
                      ) : null}
                      {l.isActive ? null : <Badge tone="neutral">{tr("موقوف", "Off")}</Badge>}
                    </p>
                  </div>
                  <form action={updateSupportLesson} className="flex shrink-0 gap-1">
                    <input type="hidden" name="id" value={l.id} />
                    <button type="submit" name="op" value={l.isActive ? "off" : "on"} className={small}>
                      {l.isActive ? tr("وقف", "Turn off") : tr("شعل", "Turn on")}
                    </button>
                    <button type="submit" name="op" value="delete" className={`${small} text-danger`} aria-label={tr("مسح", "Delete")} title={tr("مسح", "Delete")}>
                      <Trash2 className="size-4" aria-hidden="true" />
                    </button>
                  </form>
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-sm text-warm-600">{tr("مازال ما كتبتي حتى تصحيح.", "No corrections yet.")}</p>
          )}
        </Panel>

        <Panel title={tr("تصحيح جديد", "New correction")}>
          <ActionForm action={addSupportLesson} submitLabel={tr("زيد التصحيح", "Add correction")}>
            <label htmlFor="lesson-text" className="sr-only">
              {tr("التصحيح", "Correction")}
            </label>
            <textarea
              id="lesson-text"
              name="text"
              rows={5}
              required
              maxLength={SUPPORT_LESSON_MAX}
              placeholder={tr("مثلا: البوشيطات ما فيهمش بلوتوث، ما تسولش الزبون على الربط.", "e.g. Phone cases have no Bluetooth: never ask the customer about pairing.")}
              className="admin-field w-full rounded-lg px-3 py-2.5 text-base text-warm-800"
            />
          </ActionForm>
          <p className="mt-3 text-xs text-warm-600">
            {tr(
              "التصحيح ديال منتوج واحد كتزيدو من داخل المحادثة ديالو. كتب جملة واضحة: شنو ما خاصوش يدير، وشنو الصحيح.",
              "A correction for one product is added from inside its conversation. Write one clear sentence: what not to do, and what is right.",
            )}
          </p>
        </Panel>
      </div>
    </div>
  );
}
