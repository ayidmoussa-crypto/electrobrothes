import "server-only";
import nodemailer from "nodemailer";
import { db } from "./db";
import { renderOrderEmail } from "./order-email";

/** SMTP transport (Gmail app password, Brevo, Resend SMTP…), or null when not configured. */
function transport() {
  const { SMTP_HOST, SMTP_PORT, SMTP_USER, SMTP_PASS } = process.env;
  if (!SMTP_HOST || !SMTP_USER || !SMTP_PASS) return null;
  const port = Number(SMTP_PORT) || 587;
  return nodemailer.createTransport({ host: SMTP_HOST, port, secure: port === 465, auth: { user: SMTP_USER, pass: SMTP_PASS } });
}

/** A security warning to the shop's email (repeated failed logins...). Plain text, never a password. */
export async function notifySecurityAlert(subject: string, text: string) {
  const mailer = transport();
  const settings = await db.settings.findUnique({ where: { id: 1 }, select: { notifyEmail: true } });
  const to = settings?.notifyEmail || process.env.NOTIFY_EMAIL;
  if (!mailer || !to) return;
  try {
    await mailer.sendMail({ from: process.env.SMTP_FROM || process.env.SMTP_USER, to, subject: `[تنبيه أمني] ${subject}`.replace(/[\r\n]+/g, " "), text });
  } catch (error) {
    console.error("[notify] security alert: email failed", error instanceof Error ? error.message : "");
  }
}

/** Warns the shop about a 1 or 2 star review, so they can call the customer. Plain text: the comment is untrusted. */
export async function notifyNegativeReview(reviewId: string) {
  const mailer = transport();
  const [review, settings] = await Promise.all([
    db.review.findUnique({ where: { id: reviewId }, select: { rating: true, comment: true, authorName: true, product: { select: { nameAr: true } }, orderItem: { select: { order: { select: { number: true, phone: true } } } } } }),
    db.settings.findUnique({ where: { id: 1 } }),
  ]);
  const to = settings?.notifyEmail || process.env.NOTIFY_EMAIL;
  if (!review || !mailer || !to) return;
  const order = review.orderItem?.order;
  try {
    await mailer.sendMail({
      from: process.env.SMTP_FROM || process.env.SMTP_USER,
      to,
      subject: `تقييم سلبي (${review.rating}/5): ${review.product.nameAr}`.replace(/[\r\n]+/g, " "),
      text: `${review.authorName}${order ? ` · ${order.number} · ${order.phone}` : ""}\n\n${review.comment}\n\nاتصل بالزبون، وراجع التقييم من لوحة التحكم: /admin/reviews`,
    });
  } catch (error) {
    console.error("[notify] negative review: email failed", error);
  }
}

/** Tells the shop a support conversation needs them (likely defect, or the customer needs a human). Plain text. */
export async function notifySupportEscalated(ticketId: string) {
  const mailer = transport();
  const [ticket, settings] = await Promise.all([
    db.supportTicket.findUnique({ where: { id: ticketId }, select: { productName: true, verdict: true, summary: true, order: { select: { number: true, phone: true, customerName: true } } } }),
    db.settings.findUnique({ where: { id: 1 }, select: { notifyEmail: true } }),
  ]);
  const to = settings?.notifyEmail || process.env.NOTIFY_EMAIL;
  if (!ticket || !mailer || !to) return;
  try {
    await mailer.sendMail({
      from: process.env.SMTP_FROM || process.env.SMTP_USER,
      to,
      subject: `${ticket.verdict === "defect" ? "عطب محتمل" : ticket.verdict === "misuse" ? "عطب، السبب غالباً من الاستعمال" : "زبون محتاجك"}: ${ticket.productName}`.replace(/[\r\n]+/g, " "),
      text: `${ticket.order.customerName} · ${ticket.order.number} · ${ticket.order.phone}\n\n${ticket.summary ?? ""}\n\nشوف المحادثة فلوحة التحكم: /admin/support/${ticketId}`,
    });
  } catch (error) {
    console.error("[notify] support: email failed", error instanceof Error ? error.message : "");
  }
}

/**
 * Emails the shop about a new order. Runs after the response (next/server `after`), so a slow
 * or failing mail server never delays or breaks the customer's checkout.
 */
export async function notifyNewOrder(orderId: string) {
  const mailer = transport();
  const [order, settings] = await Promise.all([
    db.order.findUnique({ where: { id: orderId }, include: { items: true } }),
    db.settings.findUnique({ where: { id: 1 } }),
  ]);
  const to = settings?.notifyEmail || process.env.NOTIFY_EMAIL;
  if (!order) return;
  if (!mailer || !to) {
    console.info(`[notify] order ${order.number}: email skipped (${!mailer ? "SMTP not configured" : "no notification address"})`);
    return;
  }

  const siteUrl = (process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000").replace(/\/$/, "");
  const { subject, html, text } = renderOrderEmail(order, siteUrl);
  try {
    await mailer.sendMail({ from: process.env.SMTP_FROM || process.env.SMTP_USER, to, subject, html, text });
  } catch (error) {
    // The order is safe in the database and visible in the admin; only the email is lost.
    console.error(`[notify] order ${order.number}: email failed`, error);
  }
}
