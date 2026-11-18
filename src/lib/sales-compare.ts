// Online orders against sales at the shop's counter, for one period. Pure, so every figure is tested.
import { isShopSale } from "./attribution";
import { computeProfit, type FinanceOrder } from "./finance";

export type CompareOrder = FinanceOrder & { channel: string | null };

function sideFigures(delivered: CompareOrder[], returned: CompareOrder[]) {
  const p = computeProfit({ delivered, returned, expenses: [], stockAdjustmentValue: 0 });
  const outcomes = delivered.length + returned.length;
  return {
    revenue: p.revenue,
    sales: delivered.length,
    units: delivered.reduce((s, o) => s + o.items.reduce((n, i) => n + i.quantity, 0), 0),
    average: delivered.length ? Math.round(p.revenue / delivered.length) : null,
    /** After the goods and the delivery, before the shop's general expenses. */
    profit: p.netProfit,
    margin: p.margin,
    returned: returned.length,
    refusalRate: outcomes ? Math.round((returned.length / outcomes) * 100) : null,
    unitsWithoutCost: p.gaps.unitsWithoutCost,
  };
}

/** A sale counts on the day it was delivered or handed over, a return on the day it came back. */
export function compareSales(delivered: CompareOrder[], returned: CompareOrder[]) {
  const online = sideFigures(delivered.filter((o) => !isShopSale(o)), returned.filter((o) => !isShopSale(o)));
  const shop = sideFigures(delivered.filter(isShopSale), returned.filter(isShopSale));
  const total = online.revenue + shop.revenue;
  const shopShare = total ? Math.round((shop.revenue / total) * 100) : null;
  return { online, shop, total, shopShare, onlineShare: shopShare === null ? null : 100 - shopShare };
}
