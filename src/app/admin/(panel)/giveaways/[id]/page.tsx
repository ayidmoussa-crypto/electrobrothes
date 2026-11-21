import { Download, ExternalLink, MessageCircle, Radio, Trash2, Trophy, Users } from "lucide-react";
import Link from "next/link";
import { notFound } from "next/navigation";
import { deleteGiveaway, removeEntry } from "@/app/actions/admin-giveaways";
import { ActionForm } from "@/components/admin/ActionForm";
import { GiveawayEditor } from "@/components/admin/GiveawayEditor";
import { PageHeader, Panel, Stat, tdClass, thClass } from "@/components/admin/ui";
import { Badge } from "@/components/ui/Badge";
import { buttonClass } from "@/components/ui/button";
import { requireAdmin } from "@/lib/admin";
import { uploadsEnabled } from "@/lib/admin-bundles";
import { giveawayProductOptions } from "@/lib/admin-giveaways";
import { adminLocale } from "@/lib/admin-tr";
import { adminTr } from "@/lib/admin-lang";
import { db } from "@/lib/db";
import { giveawayPhase } from "@/lib/giveaway-rules";
import { formatMoroccanPhone, whatsappDigits } from "@/lib/phone";
import { TIME_ZONE, toMoroccanInput } from "@/lib/time";
import { adminTitle } from "@/lib/admin-title";

export const generateMetadata = () => adminTitle("تعديل السحب", "Edit giveaway");

const SHOWN = 300;

export default async function EditGiveawayPage({ params, searchParams }: PageProps<"/admin/giveaways/[id]">) {
  const [, { tr, lang, ar }] = await Promise.all([requireAdmin(), adminTr()]);
  const [{ id }, sp] = await Promise.all([params, searchParams]);
  const [g, products, marketing] = await Promise.all([
    db.giveaway.findUnique({
      where: { id },
      include: {
        _count: { select: { entries: true } },
        entries: { orderBy: [{ winnerRank: { sort: "asc", nulls: "last" } }, { createdAt: "desc" }], take: SHOWN },
      },
    }),
    giveawayProductOptions(),
    db.giveawayEntry.count({ where: { giveawayId: id, marketing: true } }),
  ]);
  if (!g) notFound();
  const phase = giveawayPhase(g);
  const date = new Intl.DateTimeFormat(adminLocale(lang), { dateStyle: "medium", timeStyle: "short", timeZone: TIME_ZONE });
  const winners = g.entries.filter((e) => e.winnerRank !== null);

  return (
    <>
      <PageHeader
        title={ar ? g.titleAr : g.titleEn}
        description={sp.saved ? tr("تطلق السحب. شارك الرابط ديالو فإنستغرام وتيك توك.", "Giveaway launched. Share its link on Instagram and TikTok.") : date.format(g.drawAt)}
        actions={
          <>
            <a href={`/admin/live/${g.id}`} target="_blank" rel="noreferrer" className={buttonClass({ variant: "dark" })}>
              <Radio className="size-4" aria-hidden="true" />
              {tr("شاشة السحب المباشر", "Live draw screen")}
            </a>
            <a href={`/giveaway/${g.slug}`} target="_blank" rel="noreferrer" className={buttonClass({ variant: "outline" })}>
              <ExternalLink className="size-4" aria-hidden="true" />
              {tr("شوفو فالمتجر", "See it in the shop")}
            </a>
          </>
        }
      />

      <div className="mb-6 grid gap-3 sm:grid-cols-3">
        <Stat label={tr("المشاركين", "Entries")} value={String(g._count.entries)} icon={Users} hint={phase === "open" ? tr("التسجيل مازال مفتوح", "Entries still open") : tr("التسجيل تسد", "Entries closed")} />
        <Stat label={tr("بغاو العروض فواتساب", "Want WhatsApp offers")} value={String(marketing)} icon={MessageCircle} hint={tr("زبناء جداد تقدر تتواصل معاهم", "New customers you may contact")} />
        <Stat
          label={tr("الرابح", "Winner")}
          value={winners[0] ? `${winners[0].firstName} ${winners[0].lastName}` : tr("مازال ما تسحبش", "Not drawn yet")}
          empty={!winners[0]}
          icon={Trophy}
          hint={winners.length > 1 ? tr(`+ ${winners.length - 1} احتياطي`, `+ ${winners.length - 1} backup`) : undefined}
        />
      </div>

      <GiveawayEditor
        products={products}
        uploadsEnabled={uploadsEnabled()}
        initial={{
          id: g.id,
          titleAr: g.titleAr,
          titleEn: g.titleEn,
          prizeAr: g.prizeAr,
          prizeEn: g.prizeEn,
          detailsAr: g.detailsAr ?? "",
          detailsEn: g.detailsEn ?? "",
          image: g.image ?? "",
          liveUrl: g.liveUrl ?? "",
          productId: g.productId ?? "",
          prizeValue: g.prizeValue ?? "",
          drawAt: toMoroccanInput(g.drawAt, 16),
          isPublished: g.isPublished,
          drawn: !!g.drawnAt,
        }}
      />

      <Panel className="mt-6" title={tr("المشاركين", "Entries")}>
        {g.entries.length ? (
          <>
            <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
              <p className="text-sm text-warm-600">
                {g._count.entries > SHOWN ? tr(`كيبانو الرابحين وآخر ${SHOWN} مشارك.`, `Winners and the latest ${SHOWN} entries.`) : tr("الرابحين الفوق، ومن بعد الأحدث.", "Winners first, then the newest.")}
              </p>
              <a href={`/api/admin/giveaways/${g.id}/entries`} className={buttonClass({ variant: "outline" })}>
                <Download className="size-4" aria-hidden="true" />
                {tr("تحميل Excel", "Download Excel")}
              </a>
            </div>
            <div className="-mx-4 overflow-x-auto md:mx-0">
              <table className="w-full min-w-[40rem]">
                <thead>
                  <tr className="border-b border-warm-200">
                    <th className={thClass}>{tr("الاسم", "Name")}</th>
                    <th className={thClass}>{tr("الهاتف", "Phone")}</th>
                    <th className={thClass}>{tr("التاريخ", "Date")}</th>
                    <th className={thClass}>{tr("العروض", "Offers")}</th>
                    <th className={thClass}>
                      <span className="sr-only">{tr("إجراءات", "Actions")}</span>
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-warm-200/60">
                  {g.entries.map((e) => {
                    const wa = whatsappDigits(e.phone);
                    return (
                      <tr key={e.id} className={e.winnerRank === 1 ? "bg-yellow-100" : undefined}>
                        <td className={tdClass}>
                          <span className="font-semibold text-ink">
                            {e.firstName} {e.lastName}
                          </span>
                          {e.winnerRank ? (
                            <Badge tone={e.winnerRank === 1 ? "action" : "neutral"} className="ms-2">
                              {e.winnerRank === 1 ? tr("الرابح", "Winner") : tr(`احتياطي ${e.winnerRank - 1}`, `Backup ${e.winnerRank - 1}`)}
                            </Badge>
                          ) : null}
                        </td>
                        <td className={tdClass}>
                          <span dir="ltr">{formatMoroccanPhone(e.phone)}</span>
                          {wa && e.winnerRank ? (
                            <a href={`https://wa.me/${wa}`} target="_blank" rel="noopener noreferrer" className="ms-2 font-semibold text-ink underline underline-offset-4">
                              {tr("واتساب", "WhatsApp")}
                            </a>
                          ) : null}
                        </td>
                        <td className={tdClass}>{date.format(e.createdAt)}</td>
                        <td className={tdClass}>{e.marketing ? tr("نعم", "Yes") : "—"}</td>
                        <td className={`${tdClass} text-end`}>
                          {e.winnerRank === null && !g.drawnAt ? (
                            <form action={removeEntry}>
                              <input type="hidden" name="id" value={e.id} />
                              <button type="submit" aria-label={tr(`حيد ${e.firstName}`, `Remove ${e.firstName}`)} title={tr("حيد مشاركة مزورة", "Remove a fake entry")} className={buttonClass({ variant: "ghost", size: "icon" })}>
                                <Trash2 className="size-4" aria-hidden="true" />
                              </button>
                            </form>
                          ) : null}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </>
        ) : (
          <p className="text-sm text-warm-600">
            {tr("مازال حتى واحد ما شارك. شارك رابط السحب فالستوري:", "Nobody has entered yet. Share the giveaway link in your stories:")}{" "}
            <Link href={`/giveaway/${g.slug}`} target="_blank" className="font-semibold text-ink underline underline-offset-4" dir="ltr">
              /giveaway/{g.slug}
            </Link>
          </p>
        )}
      </Panel>

      <ActionForm
        action={deleteGiveaway}
        submitLabel={tr("حذف السحب", "Delete giveaway")}
        variant="ghost"
        className="mt-6"
        confirm={tr(`حذف «${g.titleAr}» مع ${g._count.entries} مشارك؟ ما يمكنش ترجعو.`, `Delete “${g.titleEn}” with its ${g._count.entries} entries? This cannot be undone.`)}
      >
        <input type="hidden" name="id" value={g.id} />
      </ActionForm>
    </>
  );
}
