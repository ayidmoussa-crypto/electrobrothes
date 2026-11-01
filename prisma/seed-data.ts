// Demo catalog for local development. Prices in MAD. Images are neutral placeholders:
// replace them with real photos from the admin before launch.

export const categories = [
  { slug: "headphones", nameAr: "سماعات", nameEn: "Headphones", image: "/placeholders/audio.svg" },
  { slug: "smartwatches", nameAr: "ساعات ذكية", nameEn: "Smartwatches", image: "/placeholders/smart.svg" },
  { slug: "chargers", nameAr: "شواحن", nameEn: "Chargers", image: "/placeholders/accessory.svg" },
  { slug: "power-banks", nameAr: "باوربانك", nameEn: "Power banks", image: "/placeholders/powerbank.svg" },
  { slug: "other-devices", nameAr: "أجهزة أخرى", nameEn: "Other devices", image: "/placeholders/other.svg" },
] as const;

export const brands = [
  { slug: "apple", name: "Apple" },
  { slug: "samsung", name: "Samsung" },
  { slug: "xiaomi", name: "Xiaomi" },
  { slug: "sony", name: "Sony" },
  { slug: "jbl", name: "JBL" },
  { slug: "anker", name: "Anker" },
  { slug: "baseus", name: "Baseus" },
] as const;

// Demo rows from earlier catalogs (phones, laptops, tablets). The seed deletes them so the shop only
// shows what is sold; order lines keep their name/price snapshot.
export const retired = {
  categories: ["phones", "laptops", "audio", "accessories", "smart-devices"],
  brands: ["honor", "hp", "lenovo", "asus", "dell"],
  products: [
    "iphone-15",
    "samsung-galaxy-s24",
    "samsung-galaxy-a55",
    "redmi-note-13-pro",
    "xiaomi-14t",
    "honor-magic6-lite",
    "macbook-air-13-m3",
    "hp-pavilion-15",
    "lenovo-ideapad-slim-5",
    "asus-vivobook-15",
    "dell-inspiron-15",
    "galaxy-tab-a9-plus",
  ],
};

type Slug<T extends readonly { slug: string }[]> = T[number]["slug"];

// [key, valueAr, valueEn, numericValue?]
type SpecRow = [string, string, string, number?];

export type SeedVariant = {
  sku: string;
  colorAr?: string;
  colorEn?: string;
  colorHex?: string;
  storage?: string;
  price: number;
  compareAtPrice?: number;
  stock: number;
};

export type SeedProduct = {
  slug: string;
  category: Slug<typeof categories>;
  brand: Slug<typeof brands>;
  nameAr: string;
  nameEn: string;
  descriptionAr: string;
  descriptionEn: string;
  warrantyMonths: number;
  isFeatured?: boolean;
  isBestSeller?: boolean;
  dealDays?: number;
  specs: SpecRow[];
  variants: SeedVariant[];
};

const black = { colorAr: "أسود", colorEn: "Black", colorHex: "#1C1B18" };
const white = { colorAr: "أبيض", colorEn: "White", colorHex: "#F2F0EB" };
const gray = { colorAr: "رمادي", colorEn: "Gray", colorHex: "#75716A" };
const blue = { colorAr: "أزرق", colorEn: "Blue", colorHex: "#3B5B7A" };

export const products: SeedProduct[] = [
  // ── Headphones ──
  {
    slug: "airpods-pro-2",
    category: "headphones",
    brand: "apple",
    nameAr: "إيربودز برو (الجيل الثاني)",
    nameEn: "AirPods Pro (2nd generation)",
    descriptionAr: "إلغاء ضوضاء نشط أقوى بمرتين، صوت مكاني وعلبة شحن USB-C.",
    descriptionEn: "Up to 2x more active noise cancellation, spatial audio and a USB-C charging case.",
    warrantyMonths: 12,
    isFeatured: true,
    isBestSeller: true,
    specs: [
      ["type", "سماعات داخل الأذن", "In-ear earbuds"],
      ["anc", "نعم", "Yes"],
      ["battery", "6 ساعات (30 مع العلبة)", "6 h (30 h with case)", 30],
      ["connectivity", "بلوتوث 5.3", "Bluetooth 5.3"],
    ],
    variants: [{ sku: "APP2-USBC", ...white, price: 2690, stock: 18 }],
  },
  {
    slug: "sony-wh-1000xm5",
    category: "headphones",
    brand: "sony",
    nameAr: "سوني WH-1000XM5",
    nameEn: "Sony WH-1000XM5",
    descriptionAr: "من أفضل سماعات إلغاء الضوضاء في العالم، بطارية 30 ساعة وصوت عالي الدقة.",
    descriptionEn: "Industry-leading noise cancellation, 30-hour battery and high-resolution audio.",
    warrantyMonths: 12,
    isFeatured: true,
    dealDays: 4,
    specs: [
      ["type", "سماعات فوق الأذن", "Over-ear headphones"],
      ["anc", "نعم", "Yes"],
      ["battery", "30 ساعة", "30 h", 30],
      ["connectivity", "بلوتوث 5.2", "Bluetooth 5.2"],
    ],
    variants: [
      { sku: "WH1000XM5-BK", ...black, price: 3290, compareAtPrice: 3990, stock: 7 },
      { sku: "WH1000XM5-SV", colorAr: "فضي", colorEn: "Silver", colorHex: "#C9C5BC", price: 3290, compareAtPrice: 3990, stock: 3 },
    ],
  },
  {
    slug: "jbl-tune-520bt",
    category: "headphones",
    brand: "jbl",
    nameAr: "جي بي إل تيون 520BT",
    nameEn: "JBL Tune 520BT",
    descriptionAr: "سماعات لاسلكية خفيفة بصوت JBL Pure Bass وبطارية تصل إلى 57 ساعة.",
    descriptionEn: "Lightweight wireless headphones with JBL Pure Bass sound and up to 57 hours of battery.",
    warrantyMonths: 12,
    isBestSeller: true,
    specs: [
      ["type", "سماعات على الأذن", "On-ear headphones"],
      ["anc", "لا", "No"],
      ["battery", "57 ساعة", "57 h", 57],
      ["connectivity", "بلوتوث 5.3", "Bluetooth 5.3"],
    ],
    variants: [
      { sku: "T520-BK", ...black, price: 499, stock: 30 },
      { sku: "T520-WH", ...white, price: 499, stock: 22 },
    ],
  },
  {
    slug: "galaxy-buds2-pro",
    category: "headphones",
    brand: "samsung",
    nameAr: "سامسونج جالاكسي بادز 2 برو",
    nameEn: "Samsung Galaxy Buds2 Pro",
    descriptionAr: "صوت Hi-Fi بدقة 24 بت، إلغاء ضوضاء ذكي وتصميم مريح.",
    descriptionEn: "24-bit Hi-Fi sound, intelligent noise cancellation and a comfortable fit.",
    warrantyMonths: 12,
    specs: [
      ["type", "سماعات داخل الأذن", "In-ear earbuds"],
      ["anc", "نعم", "Yes"],
      ["battery", "5 ساعات (18 مع العلبة)", "5 h (18 h with case)", 18],
      ["connectivity", "بلوتوث 5.3", "Bluetooth 5.3"],
    ],
    variants: [{ sku: "BUDS2PRO-GR", ...gray, price: 1490, stock: 10 }],
  },
  {
    slug: "redmi-buds-5",
    category: "headphones",
    brand: "xiaomi",
    nameAr: "شاومي ريدمي بادز 5",
    nameEn: "Xiaomi Redmi Buds 5",
    descriptionAr: "سماعات لاسلكية اقتصادية بإلغاء ضوضاء حتى 46 ديسيبل وبطارية 40 ساعة مع العلبة.",
    descriptionEn: "Budget wireless earbuds with up to 46 dB noise cancelling and 40 hours with the case.",
    warrantyMonths: 12,
    isBestSeller: true,
    specs: [
      ["type", "سماعات داخل الأذن", "In-ear earbuds"],
      ["anc", "نعم", "Yes"],
      ["battery", "10 ساعات (40 مع العلبة)", "10 h (40 h with case)", 40],
      ["connectivity", "بلوتوث 5.3", "Bluetooth 5.3"],
    ],
    variants: [
      { sku: "RBUDS5-BK", ...black, price: 349, stock: 35 },
      { sku: "RBUDS5-WH", ...white, price: 349, stock: 1 },
    ],
  },

  // ── Smartwatches ──
  {
    slug: "apple-watch-se",
    category: "smartwatches",
    brand: "apple",
    nameAr: "ساعة آبل SE (الجيل الثاني)",
    nameEn: "Apple Watch SE (2nd generation)",
    descriptionAr: "تتبع اللياقة والنوم، كشف السقوط وإشعارات آيفون على معصمك.",
    descriptionEn: "Fitness and sleep tracking, fall detection and iPhone notifications on your wrist.",
    warrantyMonths: 12,
    isFeatured: true,
    specs: [
      ["screen", "44 ملم", "44 mm", 44],
      ["battery", "18 ساعة", "18 h", 18],
      ["water", "مقاومة للماء 50 متر", "Water resistant 50 m"],
    ],
    variants: [{ sku: "AWSE2-44-MN", colorAr: "منتصف الليل", colorEn: "Midnight", colorHex: "#1C1B18", price: 2990, stock: 6 }],
  },
  {
    slug: "galaxy-watch6",
    category: "smartwatches",
    brand: "samsung",
    nameAr: "سامسونج جالاكسي ووتش 6",
    nameEn: "Samsung Galaxy Watch6",
    descriptionAr: "ساعة ذكية بشاشة Super AMOLED، تحليل تكوين الجسم ومتابعة النوم.",
    descriptionEn: "Smartwatch with Super AMOLED display, body composition analysis and sleep coaching.",
    warrantyMonths: 24,
    isFeatured: true,
    dealDays: 3,
    specs: [
      ["screen", "44 ملم", "44 mm", 44],
      ["battery", "40 ساعة", "40 h", 40],
      ["water", "مقاومة للماء 50 متر", "Water resistant 50 m"],
    ],
    variants: [{ sku: "GW6-44-GR", ...gray, price: 2190, compareAtPrice: 2690, stock: 4 }],
  },
  {
    slug: "redmi-watch-4",
    category: "smartwatches",
    brand: "xiaomi",
    nameAr: "شاومي ريدمي ووتش 4",
    nameEn: "Xiaomi Redmi Watch 4",
    descriptionAr: "شاشة AMOLED كبيرة، GPS مدمج وبطارية تدوم حتى 20 يوماً.",
    descriptionEn: "Large AMOLED display, built-in GPS and up to 20 days of battery.",
    warrantyMonths: 12,
    isBestSeller: true,
    specs: [
      ["screen", "1.97 إنش AMOLED", "1.97-inch AMOLED", 1.97],
      ["battery", "20 يوماً", "20 days", 480],
      ["water", "مقاومة للماء 5 ATM", "5 ATM water resistant"],
    ],
    variants: [{ sku: "RW4-BK", ...black, price: 899, stock: 17 }],
  },
  {
    slug: "xiaomi-smart-band-9",
    category: "smartwatches",
    brand: "xiaomi",
    nameAr: "شاومي سمارت باند 9",
    nameEn: "Xiaomi Smart Band 9",
    descriptionAr: "سوار ذكي خفيف لتتبع الخطوات والنوم ونبض القلب، بطارية حتى 21 يوماً.",
    descriptionEn: "Light smart band for steps, sleep and heart rate, with up to 21 days of battery.",
    warrantyMonths: 12,
    isBestSeller: true,
    specs: [
      ["screen", "1.62 إنش AMOLED", "1.62-inch AMOLED", 1.62],
      ["battery", "21 يوماً", "21 days", 504],
      ["water", "مقاومة للماء 5 ATM", "5 ATM water resistant"],
    ],
    variants: [
      { sku: "MSB9-BK", ...black, price: 399, stock: 40 },
      { sku: "MSB9-BL", ...blue, price: 399, stock: 12 },
    ],
  },

  // ── Chargers ──
  {
    slug: "anker-nano-20w",
    category: "chargers",
    brand: "anker",
    nameAr: "شاحن أنكر نانو 20 واط USB-C",
    nameEn: "Anker Nano 20W USB-C charger",
    descriptionAr: "شاحن صغير جداً بتقنية الشحن السريع PD، متوافق مع آيفون وأندرويد.",
    descriptionEn: "Ultra-compact PD fast charger for iPhone and Android.",
    warrantyMonths: 18,
    isBestSeller: true,
    specs: [
      ["power", "20 واط", "20 W", 20],
      ["port", "USB-C", "USB-C"],
    ],
    variants: [{ sku: "ANK-NANO20", ...white, price: 149, stock: 60 }],
  },
  {
    slug: "samsung-25w-charger",
    category: "chargers",
    brand: "samsung",
    nameAr: "شاحن سامسونج 25 واط الأصلي",
    nameEn: "Samsung 25W original charger",
    descriptionAr: "شاحن سريع أصلي من سامسونج مع كابل USB-C.",
    descriptionEn: "Original Samsung Super Fast Charging adapter with a USB-C cable.",
    warrantyMonths: 12,
    isBestSeller: true,
    specs: [
      ["power", "25 واط", "25 W", 25],
      ["port", "USB-C", "USB-C"],
    ],
    variants: [{ sku: "SAM-TA25-BK", ...black, price: 199, stock: 40 }],
  },
  {
    slug: "baseus-gan-65w",
    category: "chargers",
    brand: "baseus",
    nameAr: "شاحن باسيوس GaN بقوة 65 واط",
    nameEn: "Baseus GaN 65W charger",
    descriptionAr: "ثلاثة منافذ تشحن الهاتف والسماعات والحاسوب في نفس الوقت، بحجم صغير.",
    descriptionEn: "Three ports that charge your phone, earbuds and laptop at once, in a compact size.",
    warrantyMonths: 12,
    dealDays: 2,
    specs: [
      ["power", "65 واط", "65 W", 65],
      ["port", "2× USB-C + USB-A", "2× USB-C + USB-A"],
    ],
    variants: [{ sku: "BAS-GAN65", ...black, price: 299, compareAtPrice: 379, stock: 15 }],
  },
  {
    slug: "baseus-usb-c-cable-100w",
    category: "chargers",
    brand: "baseus",
    nameAr: "كابل باسيوس USB-C إلى USB-C بقوة 100 واط",
    nameEn: "Baseus USB-C to USB-C 100W cable",
    descriptionAr: "كابل مضفّر متين بطول 2 متر للشحن السريع.",
    descriptionEn: "Durable 2 m braided cable for fast charging.",
    warrantyMonths: 6,
    specs: [
      ["power", "100 واط", "100 W", 100],
      ["length", "2 متر", "2 m", 2],
    ],
    variants: [{ sku: "BAS-CC100-2M", ...black, price: 89, stock: 80 }],
  },

  // ── Power banks ──
  {
    slug: "anker-powercore-10000",
    category: "power-banks",
    brand: "anker",
    nameAr: "باوربانك أنكر 10000 ميلي أمبير",
    nameEn: "Anker PowerCore 10000 power bank",
    descriptionAr: "بطارية خارجية صغيرة تشحن هاتفك أكثر من مرتين.",
    descriptionEn: "Compact power bank that charges your phone more than twice.",
    warrantyMonths: 18,
    isBestSeller: true,
    dealDays: 3,
    specs: [
      ["capacity", "10000 ميلي أمبير", "10000 mAh", 10000],
      ["power", "20 واط", "20 W", 20],
      ["port", "USB-C + USB-A", "USB-C + USB-A"],
    ],
    variants: [{ sku: "ANK-PC10K", ...black, price: 249, compareAtPrice: 329, stock: 2 }],
  },
  {
    slug: "xiaomi-power-bank-20000",
    category: "power-banks",
    brand: "xiaomi",
    nameAr: "باوربانك شاومي 20000 ميلي أمبير",
    nameEn: "Xiaomi 20000 mAh power bank",
    descriptionAr: "سعة كبيرة تكفي لعدة أيام، شحن سريع 22.5 واط ومنفذان USB-A ومنفذ USB-C.",
    descriptionEn: "Large capacity for several days, 22.5W fast charging, two USB-A ports and one USB-C.",
    warrantyMonths: 12,
    isFeatured: true,
    specs: [
      ["capacity", "20000 ميلي أمبير", "20000 mAh", 20000],
      ["power", "22.5 واط", "22.5 W", 22.5],
      ["port", "USB-C + 2× USB-A", "USB-C + 2× USB-A"],
    ],
    variants: [{ sku: "XM-PB20K", ...black, price: 299, stock: 24 }],
  },
  {
    slug: "baseus-magnetic-10000",
    category: "power-banks",
    brand: "baseus",
    nameAr: "باوربانك مغناطيسي باسيوس 10000 ميلي أمبير",
    nameEn: "Baseus magnetic 10000 mAh power bank",
    descriptionAr: "يلتصق بظهر الآيفون ويشحنه لاسلكياً، مع منفذ USB-C للشحن السريع.",
    descriptionEn: "Snaps onto the back of your iPhone and charges it wirelessly, plus USB-C fast charging.",
    warrantyMonths: 12,
    specs: [
      ["capacity", "10000 ميلي أمبير", "10000 mAh", 10000],
      ["power", "20 واط", "20 W", 20],
      ["port", "USB-C + لاسلكي", "USB-C + wireless"],
    ],
    variants: [
      { sku: "BAS-MAG10K-WH", ...white, price: 349, stock: 9 },
      { sku: "BAS-MAG10K-BL", ...blue, price: 349, stock: 0 },
    ],
  },

  // ── Other devices ──
  {
    slug: "jbl-flip-6",
    category: "other-devices",
    brand: "jbl",
    nameAr: "مكبر صوت جي بي إل فليب 6",
    nameEn: "JBL Flip 6 speaker",
    descriptionAr: "مكبر صوت محمول مقاوم للماء والغبار IP67 بصوت قوي وبطارية 12 ساعة.",
    descriptionEn: "Portable IP67 waterproof and dustproof speaker with bold sound and 12-hour battery.",
    warrantyMonths: 12,
    isFeatured: true,
    specs: [
      ["type", "مكبر صوت محمول", "Portable speaker"],
      ["battery", "12 ساعة", "12 h", 12],
      ["connectivity", "بلوتوث 5.1", "Bluetooth 5.1"],
    ],
    variants: [
      { sku: "FLIP6-BK", ...black, price: 1190, stock: 9 },
      { sku: "FLIP6-BL", ...blue, price: 1190, stock: 0 },
    ],
  },
  {
    slug: "jbl-go-4",
    category: "other-devices",
    brand: "jbl",
    nameAr: "مكبر صوت جي بي إل غو 4",
    nameEn: "JBL Go 4 speaker",
    descriptionAr: "مكبر صوت صغير بحجم الجيب، مقاوم للماء IP67 وبطارية 7 ساعات.",
    descriptionEn: "Pocket-size speaker, IP67 waterproof, with a 7-hour battery.",
    warrantyMonths: 12,
    specs: [
      ["type", "مكبر صوت محمول", "Portable speaker"],
      ["battery", "7 ساعات", "7 h", 7],
      ["connectivity", "بلوتوث 5.3", "Bluetooth 5.3"],
    ],
    variants: [{ sku: "GO4-BK", ...black, price: 399, stock: 20 }],
  },
  {
    slug: "anker-car-charger-30w",
    category: "other-devices",
    brand: "anker",
    nameAr: "شاحن سيارة أنكر 30 واط",
    nameEn: "Anker 30W car charger",
    descriptionAr: "شاحن سيارة بمنفذين يشحن هاتفين معاً بسرعة أثناء التنقل.",
    descriptionEn: "Two-port car charger that fast-charges two phones on the road.",
    warrantyMonths: 18,
    specs: [
      ["power", "30 واط", "30 W", 30],
      ["port", "USB-C + USB-A", "USB-C + USB-A"],
    ],
    variants: [{ sku: "ANK-CAR30", ...black, price: 179, stock: 25 }],
  },
];

// [authorName, city, rating, comment]
type ReviewRow = [string, string, number, string];
export const reviews: Record<string, ReviewRow[]> = {
  "airpods-pro-2": [
    ["خديجة ل.", "مكناس", 5, "إلغاء الضوضاء ممتاز، والدفع عند الاستلام أعطاني ثقة."],
    ["Mehdi S.", "Oujda", 5, "Originales, vérifiées avec le numéro de série."],
    ["يوسف ب.", "الدار البيضاء", 5, "وصلتني في يومين، أصلية ومختومة. خدمة ممتازة."],
  ],
  "jbl-tune-520bt": [
    ["رضا ن.", "سلا", 4, "صوت جيد جداً بسعر مناسب."],
    ["Salma E.", "Rabat", 5, "Livraison rapide, j'ai payé à la réception. Parfait."],
  ],
  "redmi-buds-5": [["أنس م.", "أكادير", 5, "أفضل سماعات بهذا السعر، إلغاء الضوضاء مفاجئ."]],
  "redmi-watch-4": [["Karim A.", "Tétouan", 5, "Battery really lasts more than two weeks."]],
  "xiaomi-smart-band-9": [["فاطمة الزهراء", "مراكش", 4, "خفيف ومريح، والشاشة واضحة تحت الشمس."]],
  "anker-nano-20w": [["Nadia B.", "El Jadida", 5, "Small and fast, charges my iPhone quickly."]],
  "samsung-25w-charger": [["Hamza K.", "Tanger", 5, "Original Samsung, the team called me to confirm before shipping."]],
  "xiaomi-power-bank-20000": [
    ["محمد أ.", "فاس", 4, "سعة كبيرة تكفيني ثلاثة أيام، فقط ثقيلة قليلاً."],
    ["Imane R.", "Kénitra", 5, "Bon produit, emballage soigné."],
  ],
};

// Delivery covers every destination of the courier network (Ozon Express list, names only:
// prisma/cities-ozon.json). Pricing is our own: flat 20 DH in Casablanca, 30 DH anywhere else.
export const DELIVERY_DAYS = "1-3";
export const shippingFeeFor = (nameEn: string) => (/^casablanca\b|- casablanca$/i.test(nameEn) ? 20 : 30);

// Main cities: listed first in the city picker, with their Arabic name. The rest keep the courier's Latin name.
export const mainCitiesAr: Record<string, string> = {
  Casablanca: "الدار البيضاء",
  Rabat: "الرباط",
  Salé: "سلا",
  Temara: "تمارة",
  Mohammedia: "المحمدية",
  Marrakech: "مراكش",
  Fès: "فاس",
  Meknès: "مكناس",
  Tanger: "طنجة",
  Tetouan: "تطوان",
  Agadir: "أكادير",
  Kenitra: "القنيطرة",
  Oujda: "وجدة",
  "El Jadida": "الجديدة",
  Safi: "آسفي",
  "Beni Mellal": "بني ملال",
  Khouribga: "خريبكة",
  Settat: "سطات",
  Berrechid: "برشيد",
  Nador: "الناظور",
  "Al Hoceima": "الحسيمة",
  Larache: "العرائش",
  "Ksar El Kebir": "القصر الكبير",
  Taza: "تازة",
  Essaouira: "الصويرة",
  Ouarzazate: "ورزازات",
  Errachidia: "الرشيدية",
  Guelmim: "كلميم",
  Laayoune: "العيون",
  Dakhla: "الداخلة",
  Khemisset: "الخميسات",
  Tiznit: "تزنيت",
  Taroudant: "تارودانت",
  Inzegane: "إنزكان",
  "Ait Melloul": "أيت ملول",
  Sefrou: "صفرو",
  Ifrane: "إفران",
  Azrou: "أزرو",
  Khenifra: "خنيفرة",
  Berkane: "بركان",
  "Fquih Ben Salah": "الفقيه بن صالح",
  "Kelâa Des Sraghna": "قلعة السراغنة",
  "Sidi Kacem": "سيدي قاسم",
  "Sidi Sliman": "سيدي سليمان",
  Skhirat: "الصخيرات",
  Bouznika: "بوزنيقة",
  Benslimane: "بنسليمان",
  Martil: "مرتيل",
  Fnideq: "الفنيدق",
  "M Diq": "المضيق",
  Chefchaouen: "شفشاون",
  Ouazzane: "وزان",
  Tantan: "طانطان",
  Tinghir: "تنغير",
  Zagora: "زاكورة",
  Midelt: "ميدلت",
  Guercif: "جرسيف",
  Taourirt: "تاوريرت",
  Youssoufia: "اليوسفية",
  "Ben Guerir": "ابن جرير",
  "Oued Zem": "وادي زم",
  "Kasba Tadla": "قصبة تادلة",
  Azilal: "أزيلال",
  "Sidi Bennour": "سيدي بنور",
  Azemmour: "أزمور",
  Tiflet: "تيفلت",
  "Souk Larbaa": "سوق الأربعاء",
  Asilah: "أصيلة",
  Bouskoura: "بوسكورة",
  "Dar Bouazza": "دار بوعزة",
  "Had Soualem": "حد السوالم",
  Mediouna: "مديونة",
  Nouaceur: "النواصر",
  Tamesna: "تامسنا",
  "Ain Harouda": "عين حرودة",
  "Tit Mellil": "تيط مليل",
  "El Hajeb": "الحاجب",
  Jerada: "جرادة",
  "Sidi Ifni": "سيدي إفني",
  Tata: "طاطا",
  Boujdour: "بوجدور",
  Essemara: "السمارة",
  Chichaoua: "شيشاوة",
};

export const coupons = [
  { code: "BIENVENUE10", type: "PERCENT" as const, value: 10, minSubtotal: 300 },
  { code: "EB50", type: "FIXED" as const, value: 50, minSubtotal: 500 },
];
