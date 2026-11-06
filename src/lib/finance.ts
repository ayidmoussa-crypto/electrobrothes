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

export const categoryLabel = (scope: "BUSINESS" | "PERSONAL", key: string) =>
  ((scope === "BUSINESS" ? BUSINESS_CATEGORIES : PERSONAL_CATEGORIES) as Record<string, string>)[key] ?? key;

export type FinanceOrder = {
  total: number;
  carrierFee: number | null;
  items: { unitCost: number | null; quantity: number }[];
};

export type ProfitInput = {
  delivered: FinanceOrder[];
  returned: FinanceOrder[];
  expenses: { scope: "BUSINESS" | "PERSONAL"; category: string; amount: number }[];
  /** Net value of stock corrected by hand in the period (quantity × cost; negative = goods lost). */
  stockAdjustmentValue: number;
  defaultDeliveryCost: number;
  defaultReturnCost: number;
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
    const fee = o.carrierFee ?? i.defaultDeliveryCost;
    if (!fee) deliveredWithoutFee++;
    deliveryCost += fee;
  }

  // A returned parcel earns nothing and its goods come back to stock: the loss is what the carrier charged.
  let returnsCost = 0;
  let returnedWithoutFee = 0;
  for (const o of i.returned) {
    const fee = o.carrierFee ?? i.defaultReturnCost;
    if (!fee) returnedWithoutFee++;
    returnsCost += fee;
  }

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
    gaps: { unitsWithoutCost, deliveredWithoutFee, returnedWithoutFee },
    deliveredCount: i.delivered.length,
    returnedCount: i.returned.length,
    expensesByCategory: [...new Set(i.expenses.map((e) => `${e.scope}:${e.category}`))].map((k) => {
      const [scope, category] = k.split(":") as ["BUSINESS" | "PERSONAL", string];
      return { scope, category, amount: i.expenses.filter((e) => e.scope === scope && e.category === category).reduce((s, e) => s + e.amount, 0) };
    }),
  };
}

export type CapitalInput = {
  injections: number;
  withdrawals: number;
  /** Value of the stock that existed before the log started: capital brought in as goods. */
  openingStockValue: number;
  /** Stock bought since (quantity × cost). */
  purchases: number;
  /** Cash the carrier really paid. */
  codReceived: number;
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
  const cash = i.injections - i.withdrawals + i.codReceived - i.purchases - i.businessExpenses - i.personalExpenses;
  const position = cash + i.inventoryValue + i.goodsInTransit + i.owedByCarrier;
  const invested = i.injections - i.withdrawals + i.openingStockValue;
  const result = position - invested;
  return { cash, position, invested, result, resultPct: invested > 0 ? Math.round((result / invested) * 100) : null };
}

/** What the carrier should hand over for an order: the cash collected, minus its fee. */
export const expectedFromCarrier = (total: number, carrierFee: number | null, defaultDeliveryCost: number) => total - (carrierFee ?? defaultDeliveryCost);
