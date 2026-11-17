import "server-only";
import { confirmationText, whatsappLink } from "./order-whatsapp";
import { reviewLink } from "./reviews/customer";
import { whatsappKind } from "./reviews/ask";
import { reviewWhatsappMessage } from "./reviews/rules";

type WaOrder = {
  id: string;
  phone: string;
  status: string;
  customerName: string;
  number: string;
  total: number;
  address: string;
  cityName: string;
  prepaidAt: Date | null;
  items: { nameAr: string }[];
};

/**
 * The green WhatsApp button's link for an order: the review request with its private link once delivered, the
 * confirmation message otherwise. Server only: the review link is signed with the session secret.
 */
export function orderWhatsappHref(o: WaOrder) {
  return whatsappKind(o.status) === "review"
    ? whatsappLink(o.phone, reviewWhatsappMessage(o.customerName, o.items.map((i) => i.nameAr), reviewLink(o.id)))
    : whatsappLink(o.phone, confirmationText({ ...o, prepaid: o.prepaidAt !== null }));
}
