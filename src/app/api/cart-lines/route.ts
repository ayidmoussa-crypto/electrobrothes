import { getCartLines } from "@/app/actions/cart";

/**
 * Fresh price, stock and name for the variants in a browser cart (?ids=a,b,c). A plain GET rather than calling
 * the server action from the page: an action posts to the current address, and one fired while a page is
 * opening could cancel the navigation and turn it into a full reload.
 */
export async function GET(request: Request) {
  const ids = new URL(request.url).searchParams.get("ids");
  const data = await getCartLines(ids ? ids.split(",").slice(0, 20) : []);
  return Response.json(data, { headers: { "Cache-Control": "no-store" } });
}
