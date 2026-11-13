import { TriangleAlert } from "lucide-react";
import Link from "next/link";
import { ReviewCard } from "@/components/admin/ReviewCard";
import { PageHeader, Panel } from "@/components/admin/ui";
import type { Prisma } from "@/generated/prisma/client";
import { requireAdmin } from "@/lib/admin";
import { adminTr } from "@/lib/admin-lang";
import { adminLocale } from "@/lib/admin-tr";
import { db } from "@/lib/db";
import { isNegativeReview, isStaleRating } from "@/lib/reviews/rules";
import { TIME_ZONE } from "@/lib/time";

const TABS = [
  { id: "pending", text: ["كيتسناو", "Waiting"] },
  { id: "approved", text: ["منشورين", "Published"] },
  { id: "rejected", text: ["مرفوضين", "Rejected"] },
] as const;
type Tab = (typeof TABS)[number]["id"];

// Reviews without an order are the demo data from the seed: they are never shown in the store.
const WHERE: Record<Tab, Prisma.ReviewWhereInput> = {
  pending: { verified: true, isApproved: false, rejectedAt: null },
  approved: { verified: true, isApproved: true },
  rejected: { verified: true, rejectedAt: { not: null }, isApproved: false },
};

export default async function ReviewsPage({ searchParams }: PageProps<"/admin/reviews">) {
  const [, { tr, lang, ar }] = await Promise.all([requireAdmin(), adminTr()]);
  const when = new Intl.DateTimeFormat(adminLocale(lang), { dateStyle: "medium", timeZone: TIME_ZONE });
  const raw = (await searchParams).tab;
  const tab: Tab = raw === "approved" || raw === "rejected" ? raw : "pending";
  const [rows, pending, externalApproved, externalPending] = await Promise.all([
    db.review.findMany({
      where: WHERE[tab],
      orderBy: [{ rating: "asc" }, { createdAt: "desc" }],
      take: 100,
      select: {
        id: true,
        productId: true,
        authorName: true,
        city: true,
        rating: true,
        comment: true,
        photoUrl: true,
        verified: true,
        isApproved: true,
        rejectedAt: true,
        createdAt: true,
        suggestedReply: true,
        replyText: true,
        product: { select: { nameAr: true, nameEn: true } },
        orderItem: { select: { order: { select: { id: true, number: true, phone: true, customerName: true } } } },
      },
    }),
    db.review.count({ where: WHERE.pending }),
    db.externalRating.findMany({ where: { status: "APPROVED" }, select: { id: true, source: true, lastCheckedAt: true, productId: true, product: { select: { nameAr: true, nameEn: true } } } }),
    db.externalRating.count({ where: { status: "PENDING" } }),
  ]);
  const stale = externalApproved.filter((r) => isStaleRating(r.lastCheckedAt));

  return (
    <>
      <PageHeader title={tr("التقييمات", "Reviews")} description={tr("ما كيبان حتى تقييم فالمتجر قبل موافقتك.", "No review shows in the shop before you approve it.")} />

      {/* Negative reviews waiting are in the notifications (the bell); the cards below still flag each one. */}
      {stale.length || externalPending ? (
        <Panel title={tr("تقييمات خارجية", "External ratings")} className="mb-3">
          {externalPending ? <p className="text-sm text-warm-800">{tr(`${externalPending} مصدر كيتسنى تأكيدك فصفحة المنتج.`, `${externalPending} sources wait for your check on the product page.`)}</p> : null}
          {stale.length ? (
            <ul className="mt-1 text-sm">
              {stale.map((r) => (
                <li key={r.id} className="flex flex-wrap items-center gap-2 py-1">
                  <TriangleAlert className="size-3.5 shrink-0 text-warning-text" aria-hidden="true" />
                  <Link href={`/admin/products/${r.productId}`} className="font-semibold text-ink underline underline-offset-2">
                    {ar ? r.product.nameAr : r.product.nameEn}
                  </Link>
                  <span className="text-warm-600">
                    {r.source}: {tr("آخر تحديث", "last updated")} {when.format(r.lastCheckedAt)}
                  </span>
                </li>
              ))}
            </ul>
          ) : null}
        </Panel>
      ) : null}

      <nav aria-label={tr("حالة التقييمات", "Review status")} className="mb-3 flex flex-wrap gap-1">
        {TABS.map((t) => (
          <Link key={t.id} href={t.id === "pending" ? "/admin/reviews" : `/admin/reviews?tab=${t.id}`} aria-current={tab === t.id ? "true" : undefined} className={`inline-flex min-h-10 items-center rounded-full px-3 text-xs font-semibold ${tab === t.id ? "bg-ink text-white" : "admin-card text-warm-800"}`}>
            {tr(t.text[0], t.text[1])}
            {t.id === "pending" ? ` (${pending})` : ""}
          </Link>
        ))}
      </nav>

      {rows.length ? (
        <div className="space-y-3">
          {rows.map((r) => (
            <ReviewCard
              key={r.id}
              review={{
                id: r.id,
                productId: r.productId,
                productName: ar ? r.product.nameAr : r.product.nameEn,
                author: r.authorName,
                city: r.city,
                rating: r.rating,
                comment: r.comment,
                photoUrl: r.photoUrl,
                verified: r.verified,
                negative: isNegativeReview(r.rating),
                state: r.isApproved ? "approved" : r.rejectedAt ? "rejected" : "pending",
                when: when.format(r.createdAt),
                suggestedReply: r.suggestedReply,
                replyText: r.replyText,
                order: r.orderItem?.order ?? null,
              }}
            />
          ))}
        </div>
      ) : (
        <Panel>
          <p className="text-sm text-warm-600">{tr("ما كاين حتى تقييم هنا. الزبون كيقيّم من الرابط الخاص بعد ما يتوصل بالطلب.", "No reviews here. A customer reviews from their own link once the order arrives.")}</p>
        </Panel>
      )}
    </>
  );
}
