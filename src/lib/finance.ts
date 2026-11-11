// The owner's real numbers. Pure, so every line can be tested; whole MAD. A figure that rests on a missing
// purchase price or carrier fee is never silently treated as free: it is counted and reported in `gaps`.

export const BUSINESS_CATEGORIES = {
  ADS: "إعلانات",
  STOCK_EXTRA: "مصاريف الشراء (نقل، جمارك)",
  PACKAGING: "تغليف",
  SALARY: "أجور",
  RENT: "كراء",
  TOOLS: "اشتراكات وأدوات",
  DAMAGE: "سلعة خاسرة",
  OTHER: "أخرى",
} as const;

export const PERSONAL_CATEGORIES = {
  LIVING: "مصروف شخصي",
  FAMILY: "العائلة",
  TRANSPORT: "نقل",
  DEBT: "ديون",
  LOSS: "خسارة شخصية",
  OTHER: "أخرى",
} as const;

/** The same categories for the panel in English. */
export const BUSINESS_CATEGORIES_EN: Record<keyof typeof BUSINESS_CATEGORIES, string> = {
  ADS: "Ads",
  STOCK_EXTRA: "Purchase costs (transport, customs)",
  PACKAGING: "Packaging",
  SALARY: "Wages",
  RENT: "Rent",
  TOOLS: "Subscriptions & tools",
  DAMAGE: "Lost goods",
  OTHER: "Other",
};

export const PERSONAL_CATEGORIES_EN: Record<keyof typeof PERSONAL_CATEGORIES, string> = {
  LIVING: "Personal spending",
  FAMILY: "Family",
  TRANSPORT: "Transport",
  DEBT: "Debts",
  LOSS: "Personal loss",
  OTHER: "Other",
};

export const categoryLabel = (scope: "BUSINESS" | "PERSONAL", key: string, lang: "ar" | "en" = "ar") =>
  ((scope === "BUSINESS" ? (lang === "en" ? BUSINESS_CATEGORIES_EN : BUSINESS_CATEGORIES) : lang === "en" ? PERSONAL_CATEGORIES_EN : PERSONAL_CATEGORIES) as Record<string, string>)[key] ?? key;

/** What decides the carrier's cut on one parcel. */
export type FeeOrder = {
  total: number;
  /** What the carrier really charged, typed on the order. Wins over everything else. */
  carrierFee: number | null;
  /** Delivery the customer paid; 0 when the order passed the free-delivery threshold. */
  shippingFee: number;
  /** The city's delivery price today. */
  cityFee: number;
  /** Paid to the shop before shipping: the carrier collected nothing. */
  prepaid?: boolean;
};

export type FinanceOrder = FeeOrder & { items: { unitCost: number | null; quantity: number }[] };

/**
 * The carrier charges the city's price on every delivered parcel. Under the free-delivery threshold the
 * customer paid it inside the total; above it the shop pays it. Either way the carrier keeps it from the cash.
 */
export const deliveryFee = (o: FeeOrder) => o.carrierFee ?? (o.shippingFee || o.cityFee);

/** A refused parcel costs the shop nothing, unless a fee was typed on the order. */
export const returnFee = (o: Pick<FeeOrder, "carrierFee">) => o.carrierFee ?? 0;

export type ProfitInput = {
  delivered: FinanceOrder[];
  returned: FinanceOrder[];
  expenses: { scope: "BUSINESS" | "PERSONAL"; category: string; amount: number }[];
  /** Net value of stock corrected by hand in the period (quantity × cost; negative = goods lost). */
  stockAdjustmentValue: number;
};

export function computeProfit(i: ProfitInput) {
  let revenue = 0;
  let cogs = 0;
  let deliveryCost = 0;
  let unitsWithoutCost = 0;
  let deliveredWithoutFee = 0;
  for (const o of i.delivered) {
    revenue += o.total;
    for (const line of o.items) {
      if (line.unitCost === null) unitsWithoutCost += line.quantity;
      else cogs += line.unitCost * line.quantity;
    }
    const fee = deliveryFee(o);
    // A fee of 0 typed on the order is known (handed over by the owner); only a missing city price is a gap.
    if (!fee && o.carrierFee === null) deliveredWithoutFee++;
    deliveryCost += fee;
  }

  // A returned parcel earns nothing and its goods come back to stock: the loss is what the carrier charged.
  const returnsCost = i.returned.reduce((s, o) => s + returnFee(o), 0);

  const business = i.expenses.filter((e) => e.scope === "BUSINESS");
  const personal = i.expenses.filter((e) => e.scope === "PERSONAL");
  const businessExpenses = business.reduce((s, e) => s + e.amount, 0);
  const personalExpenses = personal.reduce((s, e) => s + e.amount, 0);
  const adSpend = business.filter((e) => e.category === "ADS").reduce((s, e) => s + e.amount, 0);
  const stockLoss = Math.max(0, -i.stockAdjustmentValue);

  const grossProfit = revenue - cogs - deliveryCost;
  const netProfit = grossProfit - returnsCost - businessExpenses - stockLoss;
  const outcomes = i.delivered.length + i.returned.length;

  return {
    revenue,
    cogs,
    deliveryCost,
    grossProfit,
    returnsCost,
    businessExpenses,
    adSpend,
    stockLoss,
    netProfit,
    personalExpenses,
    /** What is left of the shop's profit once the owner's own spending is taken out. */
    afterPersonal: netProfit - personalExpenses,
    /** Net profit as a share of revenue; null with no sales. */
    margin: revenue > 0 ? Math.round((netProfit / revenue) * 100) : null,
    /** Average net result per order that reached an outcome; null with none. */
    perOrder: outcomes > 0 ? Math.round(netProfit / outcomes) : null,
    /** Ad cost per delivered order; null with no delivery or no ad spend. */
    costPerDelivered: i.delivered.length && adSpend ? Math.round(adSpend / i.delivered.length) : null,
    gaps: { unitsWithoutCost, deliveredWithoutFee },
    deliveredCount: i.delivered.length,
    returnedCount: i.returned.length,
    expensesByCategory: [...new Set(i.expenses.map((e) => `${e.scope}:${e.category}`))].map((k) => {
      const [scope, category] = k.split(":") as ["BUSINESS" | "PERSONAL", string];
      return { scope, category, amount: i.expenses.filter((e) => e.scope === scope && e.category === category).reduce((s, e) => s + e.amount, 0) };
    }),
  };
}

const DAY = 24 * 3600 * 1000;
/** Midnight of the shop's day (the shop keeps its dates in UTC, lib/time.ts). */
const dayStart = (d: Date) => Date.parse(d.toISOString().slice(0, 10));
const ym = (ms: number) => new Date(ms).getUTCFullYear() * 12 + new Date(ms).getUTCMonth();
const two = (n: number) => String(n).padStart(2, "0");

/**
 * Time slots for the finance chart, oldest first: days up to a month, weeks up to a quarter, then months.
 * `indexOf` gives -1 for a date outside the slots.
 */
export function trendBuckets(days: number, now = new Date()) {
  const today = dayStart(now);
  const ago = (d: Date) => Math.round((today - dayStart(d)) / DAY);
  const inRange = (i: number, n: number) => (i >= 0 && i < n ? i : -1);
  const dm = (ms: number) => `${two(new Date(ms).getUTCDate())}/${two(new Date(ms).getUTCMonth() + 1)}`;
  if (days <= 31) {
    return { count: days, indexOf: (d: Date) => inRange(days - 1 - ago(d), days), labelOf: (i: number) => dm(today - (days - 1 - i) * DAY) };
  }
  if (days <= 120) {
    const n = Math.ceil(days / 7);
    // Each slot is 7 days ending on its own last day; the label is the slot's first day.
    return { count: n, indexOf: (d: Date) => inRange(n - 1 - Math.floor(ago(d) / 7), n), labelOf: (i: number) => dm(today - ((n - 1 - i) * 7 + 6) * DAY) };
  }
  const n = Math.ceil(days / 30.5) + 1;
  return {
    count: n,
    indexOf: (d: Date) => inRange(n - 1 - (ym(today) - ym(dayStart(d))), n),
    labelOf: (i: number) => {
      const m = ym(today) - (n - 1 - i);
      return `${two((m % 12) + 1)}/${String(Math.floor(m / 12)).slice(2)}`;
    },
  };
}

type Dated<T> = T & { at: Date };

/** Sales and net profit per time slot, each slot computed exactly like the whole period. */
export function profitTrend(
  b: ReturnType<typeof trendBuckets>,
  i: { delivered: Dated<FinanceOrder>[]; returned: Dated<FinanceOrder>[]; expenses: Dated<ProfitInput["expenses"][number]>[]; adjustments: Dated<{ value: number }>[] },
) {
  const slot = <T extends { at: Date }>(list: T[], n: number) => list.filter((x) => b.indexOf(x.at) === n);
  return Array.from({ length: b.count }, (_, n) => {
    const p = computeProfit({
      delivered: slot(i.delivered, n),
      returned: slot(i.returned, n),
      expenses: slot(i.expenses, n),
      stockAdjustmentValue: slot(i.adjustments, n).reduce((s, a) => s + a.value, 0),
    });
    return { label: b.labelOf(n), revenue: p.revenue, net: p.netProfit, orders: p.deliveredCount };
  });
}

/** Change from the previous period in whole percent; null when there is nothing to compare with. */
export const changePct = (now: number, before: number) => (before > 0 ? Math.round(((now - before) / before) * 100) : null);

export type CapitalInput = {
  injections: number;
  withdrawals: number;
  /** Value of the stock that existed before the log started: capital brought in as goods. */
  openingStockValue: number;
  /** Stock bought since (quantity × cost). */
  purchases: number;
  /** Cash the carrier really paid. */
  codReceived: number;
  /** Paid to the shop directly before shipping. */
  prepaidReceived?: number;
  businessExpenses: number;
  personalExpenses: number;
  /** Stock on the shelf now, at cost. */
  inventoryValue: number;
  /** Goods on their way to customers, at cost. */
  goodsInTransit: number;
  /** Delivered orders the carrier has not paid for yet. */
  owedByCarrier: number;
};

/**
 * Where the money is. `invested` is what the owner put in; `position` is what exists today (cash, goods,
 * money owed). The difference is the real result of the whole business since the start, personal spending included.
 */
export function computeCapital(i: CapitalInput) {
  const cash = i.injections - i.withdrawals + i.codReceived + (i.prepaidReceived ?? 0) - i.purchases - i.businessExpenses - i.personalExpenses;
  const position = cash + i.inventoryValue + i.goodsInTransit + i.owedByCarrier;
  const invested = i.injections - i.withdrawals + i.openingStockValue;
  const result = position - invested;
  return { cash, position, invested, result, resultPct: invested > 0 ? Math.round((result / invested) * 100) : null };
}

/**
 * What the carrier should hand over for an order: the cash collected, minus its fee. A prepaid parcel
 * collects nothing, so its fee comes off the transfer (a negative amount).
 */
export const expectedFromCarrier = (o: FeeOrder) => (o.prepaid ? 0 : o.total) - deliveryFee(o);
