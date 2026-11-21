import "server-only";
import { revalidateTag } from "next/cache";

// The admin's cached figures (dashboard, finance) share one tag. Whatever changes the orders, the stock or the money
// calls expireAdminStats() once the change is saved, so the next page view recomputes at once instead of waiting for
// the cache's minute to pass. Safe in server actions and route handlers.
export const ADMIN_STATS_TAG = "admin-stats";

export function expireAdminStats() {
  revalidateTag(ADMIN_STATS_TAG, { expire: 0 });
}
