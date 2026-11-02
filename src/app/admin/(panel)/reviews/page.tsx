import { TriangleAlert } from "lucide-react";
import Link from "next/link";
import { ReviewCard } from "@/components/admin/ReviewCard";
import { PageHeader, Panel } from "@/components/admin/ui";
import type { Prisma } from "@/generated/prisma/client";
import { requireAdmin } from "@/lib/admin";
import { db } from "@/lib/db";
import { isNegativeReview, isStaleRating } from "@/lib/reviews/rules";
import { TIME_ZONE } from "@/lib/time";

const when = new Intl.DateTimeFormat("ar-MA", { dateStyle: "medium", timeZone: TIME_ZONE });
const TABS = [
  { id: "pending", text: "كيتسناو" },
  { id: "approved", text: "منشورين" },
  { id: "rejected", text: "مرفوضين" },
] as const;
type Tab = (typeof TABS)[number]["id"];

// Reviews without an order are the demo data from the seed: they are never shown in the store.
const WHERE: Record<Tab, Prisma.ReviewWhereInput> = {
  pending: { verified: true, isApproved: false, rejectedAt: null },
  approved: { verified: true, isApproved: true },
  rejected: { verified: true, rejectedAt: { not: null }, isApproved: false },
};

export default async function ReviewsPage({ searchParams }: PageProps<"/admin/reviews">) {
  await requireAdmin();
  const raw = (await searchParams).tab;
  const tab: Tab = raw === "approved" || raw === "rejected" ? raw : "pending";
  const [rows, pending, negative, externalApproved, externalPending] = await Promise.all([
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
        product: { select: { nameAr: true } },
        orderItem: { select: { order: { select: { id: true, number: true, phone: true, customerName: true } } } },
      },
    }),
    db.review.count({ where: WHERE.pending }),
    db.review.count({ where: { ...WHERE.pending, rating: { lte: 2 } } }),
    db.externalRating.findMany({ where: { status: "APPROVED" }, select: { id: true, source: true, lastCheckedAt: true, productId: true, product: { select: { nameAr: true } } } }),
    db.externalRating.count({ where: { status: "PENDING" } }),
  ]);
  const stale = externalApproved.filter((r) => isStaleRating(r.lastCheckedAt));

  return (
    <>
      <PageHeader title="التقييمات" description="ما كيبان حتى تقييم فالمتجر قبل موافقتك." />

      {negative ? (
        <p role="alert" className="mb-3 flex items-center gap-2 rounded-xl bg-warning-soft p-3 text-sm font-bold text-warning-text">
          <TriangleAlert className="size-4 shrink-0" aria-hidden="true" />
          {negative} تقييم سلبي كيتسنى: اتصل بالزبون قبل ما تقرر.
        </p>
      ) : null}

      {stale.length || externalPending ? (
        <Panel title="تقييمات خارجية" className="mb-3">
          {externalPending ? <p className="text-sm text-warm-800">{externalPending} مصدر كيتسنى تأكيدك فصفحة المنتج.</p> : null}
          {stale.length ? (
            <ul className="mt-1 text-sm">
              {stale.map((r) => (
                <li key={r.id} className="flex flex-wrap items-center gap-2 py-1">
                  <TriangleAlert className="size-3.5 shrink-0 text-warning-text" aria-hidden="true" />
                  <Link href={`/admin/products/${r.productId}`} className="font-semibold text-ink underline underline-offset-2">
                    {r.product.nameAr}
                  </Link>
                  <span className="text-warm-600">
                    {r.source}: آخر تحديث {when.format(r.lastCheckedAt)}
                  </span>
                </li>
              ))}
            </ul>
          ) : null}
        </Panel>
      ) : null}

      <nav aria-label="حالة التقييمات" className="mb-3 flex flex-wrap gap-1">
        {TABS.map((t) => (
          <Link key={t.id} href={t.id === "pending" ? "/admin/reviews" : `/admin/reviews?tab=${t.id}`} aria-current={tab === t.id ? "true" : undefined} className={`inline-flex min-h-10 items-center rounded-full px-3 text-xs font-semibold ${tab === t.id ? "bg-ink text-white" : "admin-card text-warm-800"}`}>
            {t.text}
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
                productName: r.product.nameAr,
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
          <p className="text-sm text-warm-600">ما كاين حتى تقييم هنا. الزبون كيقيّم من الرابط الخاص بعد ما يتوصل بالطلب.</p>
        </Panel>
      )}
    </>
  );
}
