"use client";

import { BadgeCheck, LoaderCircle, MessageCircle, Phone, Brain, Star, TriangleAlert } from "lucide-react";
import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { approveReview, rejectReview, suggestReviewReply, type ReviewActionState } from "@/app/actions/admin-reviews";
import { Badge } from "@/components/ui/Badge";
import { buttonClass } from "@/components/ui/button";
import { useAdminTr } from "./AdminLang";
import { FormMessage, inputClass } from "./ui";

export type ReviewRow = {
  id: string;
  productId: string;
  productName: string;
  author: string;
  city: string | null;
  rating: number;
  comment: string;
  photoUrl: string | null;
  verified: boolean;
  negative: boolean;
  state: "pending" | "approved" | "rejected";
  when: string;
  suggestedReply: string | null;
  replyText: string | null;
  order: { id: string; number: string; phone: string; customerName: string } | null;
};

const STATE = {
  pending: { text: ["كيتسنى موافقتك", "Awaiting approval"], tone: "warning" },
  approved: { text: ["منشور", "Published"], tone: "success" },
  rejected: { text: ["مرفوض", "Rejected"], tone: "neutral" },
} as const;

export function ReviewCard({ review }: { review: ReviewRow }) {
  const [reply, setReply] = useState(review.replyText ?? review.suggestedReply ?? "");
  const [state, setState] = useState<ReviewActionState>({});
  const [pending, start] = useTransition();
  const router = useRouter();
  const { tr } = useAdminTr();
  const run = (task: () => Promise<ReviewActionState & { reply?: string }>) =>
    start(async () => {
      setState({});
      try {
        const result = await task();
        if (result.reply) setReply(result.reply);
        setState(result.ok && !result.reply ? {} : result.reply ? {} : result);
        router.refresh();
      } catch {
        setState({ ok: false, message: tr("ما قدرناش نوصلو للسيرفر. عاود جرب.", "Could not reach the server. Try again.") });
      }
    });

  return (
    <article className={`admin-card p-3 md:p-4 ${review.negative && review.state === "pending" ? "ring-2 ring-warning" : ""}`}>
      <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
        <span className="flex" role="img" aria-label={tr(`${review.rating} من 5`, `${review.rating} of 5`)}>
          {Array.from({ length: 5 }, (_, i) => (
            <Star key={i} className={`size-4 ${i < review.rating ? "fill-yellow-500 text-yellow-700" : "fill-warm-200 text-warm-300"}`} aria-hidden="true" />
          ))}
        </span>
        <Link href={`/admin/products/${review.productId}`} className="text-sm font-bold text-ink underline-offset-2 hover:underline">
          {review.productName}
        </Link>
        <Badge tone={STATE[review.state].tone}>{tr(STATE[review.state].text[0], STATE[review.state].text[1])}</Badge>
        {review.verified ? (
          <span className="flex items-center gap-1 text-xs font-semibold text-success">
            <BadgeCheck className="size-3.5" aria-hidden="true" />
            {tr("شراء مؤكد", "Verified purchase")}
          </span>
        ) : (
          <span className="text-xs font-semibold text-warm-600">{tr("تجريبي: ما كيبانش فالمتجر", "Test: not shown in the shop")}</span>
        )}
      </div>
      <p className="mt-1 text-xs text-warm-600">
        {review.author}
        {review.city ? ` · ${review.city}` : ""} · {review.when}
      </p>
      <div className="mt-2 flex gap-3">
        {review.photoUrl ? (
          <a href={review.photoUrl} target="_blank" rel="noopener noreferrer" className="relative size-20 shrink-0 overflow-hidden rounded-lg bg-warm-100">
            <Image src={review.photoUrl} alt={tr("صورة من الزبون", "Photo from the customer")} fill sizes="80px" className="object-cover" />
          </a>
        ) : null}
        <p className="min-w-0 whitespace-pre-wrap break-words text-sm text-warm-800" dir="auto">
          {review.comment}
        </p>
      </div>

      {review.negative && review.order ? (
        <div role="alert" className="mt-3 rounded-lg bg-warning-soft p-3">
          <p className="flex items-center gap-1.5 text-sm font-bold text-warning-text">
            <TriangleAlert className="size-4 shrink-0" aria-hidden="true" />
            {tr("تقييم سلبي: اتصل بالزبون قبل ما تقرر.", "Negative review: call the customer before you decide.")}
          </p>
          <div className="mt-2 flex flex-wrap items-center gap-2">
            <a href={`tel:${review.order.phone}`} className="inline-flex min-h-10 items-center gap-1.5 rounded-lg bg-ink px-3 text-sm font-semibold text-white hover:bg-warm-900">
              <Phone className="size-4" aria-hidden="true" />
              {tr("اتصال", "Call")}
            </a>
            <a href={`https://wa.me/${review.order.phone.replace("+", "")}`} target="_blank" rel="noopener noreferrer" className="inline-flex min-h-10 items-center gap-1.5 rounded-lg bg-whatsapp px-3 text-sm font-semibold text-ink hover:opacity-90">
              <MessageCircle className="size-4" aria-hidden="true" />
              {tr("واتساب", "WhatsApp")}
            </a>
            <Link href={`/admin/orders/${review.order.id}`} className="text-xs font-semibold text-warning-text underline underline-offset-2">
              {tr("الطلب", "Order")} {review.order.number}
            </Link>
          </div>
        </div>
      ) : null}

      {review.verified ? (
        <>
          <label className="mt-3 flex flex-col gap-1 text-xs font-semibold text-warm-600">
            {tr("الرد العلني (اختياري، راجعو قبل النشر)", "Public reply (optional, check it before publishing)")}
            <textarea value={reply} onChange={(e) => setReply(e.target.value)} rows={2} maxLength={1000} dir="auto" className={`${inputClass} py-2`} />
          </label>
          <div className="mt-2 flex flex-wrap items-center gap-2">
            <button type="button" disabled={pending} onClick={() => run(() => approveReview(review.id, reply))} className={buttonClass({ className: "!min-h-10 !px-4 !text-sm" })}>
              {pending ? <LoaderCircle className="size-4 animate-spin" aria-hidden="true" /> : null}
              {review.state === "approved" ? tr("حفظ الرد", "Save reply") : reply.trim() ? tr("موافقة ونشر الرد", "Approve and publish reply") : tr("موافقة بلا رد", "Approve without reply")}
            </button>
            {review.state !== "rejected" ? (
              <button type="button" disabled={pending} onClick={() => run(() => rejectReview(review.id))} className={buttonClass({ variant: "outline", className: "!min-h-10 !px-3 !text-sm" })}>
                {tr("رفض", "Reject")}
              </button>
            ) : null}
            <button type="button" disabled={pending} onClick={() => run(() => suggestReviewReply(review.id))} className={buttonClass({ variant: "ghost", className: "!min-h-10 !px-3 !text-sm" })}>
              <Brain className="size-4" aria-hidden="true" />
              {tr("اقترح رد", "Suggest a reply")}
            </button>
            <FormMessage state={state} />
          </div>
        </>
      ) : null}
    </article>
  );
}
