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
