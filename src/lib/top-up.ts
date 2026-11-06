/**
 * Best suggestions to reach the free delivery goal: first what closes the gap for the least money,
 * then the products that come closest to it.
 */
export function rankTopUp<T extends { price: number }>(products: T[], missing: number, take: number): T[] {
  const closes = products.filter((p) => p.price >= missing).sort((a, b) => a.price - b.price);
  const closer = products.filter((p) => p.price < missing).sort((a, b) => b.price - a.price);
  return [...closes, ...closer].slice(0, take);
}
