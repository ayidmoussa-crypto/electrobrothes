// Content of the information pages, in both languages.
// ⚠️ Policies are a sensible starting point for a Moroccan COD shop (law 31-08 on consumer
// protection, law 09-08 on personal data / CNDP). Have them reviewed before launch and add
// your legal identity (company name, RC, ICE, address) where marked.

type Block = { h: string; p: string[] };
type Content = { title: string; description: string; blocks: Block[] };
export type StaticPage = { slug: StaticSlug; ar: Content; en: Content };

export const STATIC_SLUGS = ["about", "contact", "faq", "warranty", "privacy", "terms"] as const;
export type StaticSlug = (typeof STATIC_SLUGS)[number];

export const staticPages: Record<StaticSlug, Omit<StaticPage, "slug">> = {
  about: {
    ar: {
      title: "من نحن",
      description: "إلكترو براذرز متجر مغربي للإلكترونيات الأصلية مع الدفع عند الاستلام والتوصيل إلى جميع المدن.",
      blocks: [
        { h: "قصتنا", p: ["إلكترو براذرز متجر مغربي متخصص في السماعات والساعات الذكية والشواحن والباوربانك. هدفنا بسيط: أجهزة أصلية بضمان، بأسعار واضحة، وتجربة شراء مريحة لا تحتاج فيها إلى بطاقة بنكية."] },
        { h: "لماذا الدفع عند الاستلام؟", p: ["لأن الثقة تُبنى بالأفعال. تطلب من الموقع في دقيقة، نتصل بك لتأكيد الطلب، ثم تدفع نقداً لعامل التوصيل بعد استلام طلبك ومعاينته."] },
        { h: "التزاماتنا", p: ["منتجات أصلية.", "ضمان رسمي على جميع الأجهزة.", "توصيل سريع إلى جميع مدن المغرب."] },
      ],
    },
    en: {
      title: "About us",
      description: "ElectroBrothers is a Moroccan store for genuine electronics with cash on delivery to every city.",
      blocks: [
        { h: "Our story", p: ["ElectroBrothers is a Moroccan shop for headphones, smartwatches, chargers and power banks. Our goal is simple: genuine devices with warranty, clear prices, and an easy purchase that never needs a bank card."] },
        { h: "Why cash on delivery?", p: ["Because trust is earned. You order online in a minute, we call to confirm, and you pay the courier in cash once you have received and checked your order."] },
        { h: "Our commitments", p: ["Genuine products.", "Official warranty on every device.", "Fast delivery to every city in Morocco."] },
      ],
    },
  },
  contact: {
    ar: {
      title: "اتصل بنا",
      description: "تواصل مع فريق إلكترو براذرز عبر واتساب لأي سؤال عن منتج أو طلب.",
      blocks: [
        { h: "نحن هنا لمساعدتك", p: ["أسرع طريقة للتواصل معنا هي واتساب. نرد من الإثنين إلى السبت، من 9 صباحاً إلى 8 مساءً."] },
        { h: "سؤال عن طلب؟", p: ["جهّز رقم طلبك (مثال: EB-7KQ4ZP). يمكنك أيضاً متابعة حالة طلبك في أي وقت من صفحة «تتبع طلبك»."] },
      ],
    },
    en: {
      title: "Contact us",
      description: "Reach the ElectroBrothers team on WhatsApp for any question about a product or an order.",
      blocks: [
        { h: "We are here to help", p: ["The fastest way to reach us is WhatsApp. We reply Monday to Saturday, 9 am to 8 pm."] },
        { h: "A question about an order?", p: ["Have your order number ready (e.g. EB-7KQ4ZP). You can also follow your order at any time on the “Track your order” page."] },
      ],
    },
  },
  faq: {
    ar: {
      title: "الأسئلة الشائعة",
      description: "أجوبة عن الطلب والدفع عند الاستلام والتوصيل والضمان في إلكترو براذرز.",
      blocks: [
        { h: "كيف أطلب؟", p: ["اختر المنتج، اضغط «اطلب الآن»، واكتب اسمك ورقم هاتفك ومدينتك وعنوانك. لا حاجة لحساب ولا لبطاقة بنكية."] },
        { h: "متى أدفع؟", p: ["تدفع نقداً لعامل التوصيل عند استلام طلبك، بعد معاينته."] },
        { h: "كم تستغرق مدة التوصيل؟", p: ["{delivery}، في جميع المدن."] },
        { h: "كم ثمن التوصيل؟", p: ["20 درهماً داخل الدار البيضاء، و30 درهماً لأي مدينة أخرى. يظهر الثمن قبل تأكيد الطلب. التوصيل مجاني ابتداءً من 500 درهم."] },
        { h: "هل المنتجات أصلية؟", p: ["نعم، جميع منتجاتنا أصلية وتأتي مع ضمان رسمي."] },
        { h: "لماذا تتصلون بي بعد الطلب؟", p: ["لتأكيد طلبك وعنوانك قبل الشحن. هذا يضمن توصيلاً سريعاً ويحميك من الطلبات الخاطئة."] },
      ],
    },
    en: {
      title: "Frequently asked questions",
      description: "Answers about ordering, cash on delivery, shipping and warranty at ElectroBrothers.",
      blocks: [
        { h: "How do I order?", p: ["Choose a product, tap “Order now”, and enter your name, phone, city and address. No account and no bank card needed."] },
        { h: "When do I pay?", p: ["You pay the courier in cash when your order arrives, after checking it."] },
        { h: "How long does delivery take?", p: ["{delivery}, in every city."] },
        { h: "How much is delivery?", p: ["20 MAD in Casablanca and 30 MAD to any other city, shown before you confirm. Delivery is free from 500 MAD."] },
        { h: "Are the products genuine?", p: ["Yes. All our products are genuine and come with an official warranty."] },
        { h: "Why do you call me after I order?", p: ["To confirm your order and address before shipping. It keeps delivery fast and protects you from mistaken orders."] },
      ],
    },
  },
  warranty: {
    ar: {
      title: "سياسة الاستبدال والضمان",
      description: "سياسة الاستبدال ومدة الضمان في إلكترو براذرز.",
      blocks: [
        { h: "سياسة الاستبدال", p: ["{replacement}"] },
        { h: "مدة الضمان", p: ["مدة ضمان كل منتج مذكورة في صفحة المنتج."] },
        { h: "كيف تطلب الاستبدال؟", p: ["تواصل معنا عبر واتساب مع رقم الطلب ووصف المشكلة."] },
      ],
    },
    en: {
      title: "Replacement & warranty policy",
      description: "The replacement policy and warranty length at ElectroBrothers.",
      blocks: [
        { h: "Replacement policy", p: ["{replacement}"] },
        { h: "Warranty length", p: ["The warranty length of each product is shown on its product page."] },
        { h: "How to request a replacement", p: ["Contact us on WhatsApp with your order number and a description of the issue."] },
      ],
    },
  },
  privacy: {
    ar: {
      title: "سياسة الخصوصية",
      description: "كيف تجمع إلكترو براذرز معطياتك الشخصية وتستعملها وتحميها وفق القانون 09-08.",
      blocks: [
        { h: "المعطيات التي نجمعها", p: ["الاسم ورقم الهاتف والمدينة والعنوان والملاحظات التي تكتبها عند الطلب، فقط لتوصيل طلبك والتواصل معك بشأنه."] },
        { h: "استعمالها", p: ["تأكيد الطلب وتوصيله وخدمة ما بعد البيع. لا نبيع معطياتك ولا نشاركها إلا مع شركة التوصيل لغرض التوصيل."] },
        { h: "الإحصائيات والإعلانات", p: ["قد نستعمل أدوات قياس (Google Analytics وMeta وTikTok) لفهم استعمال الموقع وتحسين إعلاناتنا."] },
        { h: "حقوقك", p: ["وفقاً للقانون 09-08، يحق لك الاطلاع على معطياتك وتصحيحها وحذفها. تواصل معنا عبر واتساب لممارسة هذا الحق.", "[أضف هنا: اسم الشركة، العنوان، ورقم التصريح لدى اللجنة الوطنية لمراقبة حماية المعطيات CNDP]"] },
      ],
    },
    en: {
      title: "Privacy policy",
      description: "How ElectroBrothers collects, uses and protects your personal data under Moroccan law 09-08.",
      blocks: [
        { h: "Data we collect", p: ["The name, phone number, city, address and notes you enter when ordering, only to deliver your order and contact you about it."] },
        { h: "How we use it", p: ["To confirm, deliver and support your order. We never sell your data and only share it with the courier for delivery."] },
        { h: "Analytics and advertising", p: ["We may use measurement tools (Google Analytics, Meta, TikTok) to understand how the site is used and improve our ads."] },
        { h: "Your rights", p: ["Under law 09-08 you may access, correct and delete your data. Contact us on WhatsApp to exercise these rights.", "[Add here: company name, address and CNDP declaration number]"] },
      ],
    },
  },
  terms: {
    ar: {
      title: "الشروط والأحكام",
      description: "شروط البيع في إلكترو براذرز: الطلب، الأسعار، الدفع عند الاستلام، التوصيل والضمان.",
      blocks: [
        { h: "الطلب", p: ["يصبح الطلب نهائياً بعد تأكيده هاتفياً معك. يحق لنا إلغاء الطلبات غير المؤكدة أو ذات المعلومات غير الصحيحة."] },
        { h: "الأسعار", p: ["الأسعار بالدرهم المغربي وتشمل جميع الرسوم. رسوم التوصيل تظهر قبل تأكيد الطلب."] },
        { h: "الدفع", p: ["الدفع نقداً عند الاستلام فقط."] },
        { h: "الاستبدال والضمان", p: ["تخضع لسياسة الاستبدال والضمان المنشورة في هذا الموقع."] },
        { h: "هوية البائع", p: ["[أضف هنا: الاسم القانوني للشركة، السجل التجاري RC، التعريف الموحد ICE، والعنوان]"] },
      ],
    },
    en: {
      title: "Terms & conditions",
      description: "ElectroBrothers terms of sale: orders, prices, cash on delivery, delivery and warranty.",
      blocks: [
        { h: "Orders", p: ["An order is final once we have confirmed it with you by phone. We may cancel unconfirmed orders or orders with incorrect details."] },
        { h: "Prices", p: ["Prices are in Moroccan dirhams and include all taxes. The delivery fee is shown before you confirm."] },
        { h: "Payment", p: ["Cash on delivery only."] },
        { h: "Replacement and warranty", p: ["Governed by the replacement and warranty policy published on this site."] },
        { h: "Seller identity", p: ["[Add here: company legal name, RC, ICE and address]"] },
      ],
    },
  },
};
