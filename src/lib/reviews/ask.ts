// When to ask a customer for a review (pure, no imports: the admin's client buttons use it too).

/** After this many days from delivery a review request is no longer worth sending: the order leaves the to-do list. */
export const REVIEW_ASK_DAYS = 30;

/** The green WhatsApp button of an order: the review request once it is delivered, the confirmation otherwise. */
export const whatsappKind = (status: string): "confirm" | "review" => (status === "DELIVERED" ? "review" : "confirm");

/** The oldest delivery still worth a review request, for the database filter. */
export const reviewAskSince = (now: Date) => new Date(now.getTime() - REVIEW_ASK_DAYS * 86_400_000);

/** A delivered order whose review request is still to send: not asked yet, nothing reviewed, delivered recently. */
export function awaitsReviewAsk(o: { status: string; deliveredAt: Date | null; reviewAskedAt: Date | null; reviewed: boolean }, now: Date) {
  return o.status === "DELIVERED" && !o.reviewAskedAt && !o.reviewed && !!o.deliveredAt && o.deliveredAt >= reviewAskSince(now);
}
