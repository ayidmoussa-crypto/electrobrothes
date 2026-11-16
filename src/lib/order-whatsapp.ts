// The WhatsApp message the owner sends by hand to confirm a new order. Pure: shared by the orders
// list and the order page, so both open WhatsApp with the same text.

export function confirmationText(o: { customerName: string; number: string; total: number; address: string; cityName: string; prepaid: boolean }) {
  const amount = o.prepaid ? "المدفوع مسبقاً" : `بمبلغ ${o.total} درهم عند الاستلام`;
  return `السلام عليكم ${o.customerName}، معك ElectroBrothers بخصوص طلبك ${o.number} ${amount}. هل تؤكد الطلب والعنوان: ${o.address}، ${o.cityName}؟`;
}

/** What a shopper sends the shop from a "واتساب" order button (home hero, landing pages). Price in whole dirhams. */
export const orderRequestText = (productName: string, price: number) => `السلام عليكم، بغيت نطلب: ${productName} - ${price} درهم`;

export const whatsappLink =(phone: string, text: string) => `https://wa.me/${phone.replace("+", "")}?text=${encodeURIComponent(text)}`;
