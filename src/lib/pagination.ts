// Paging for the admin lists. Pure, so it is tested. The page number lives in the address (?page=2).

/** The page asked for in the address: a whole number from 1, anything else is page 1. */
export function parsePage(raw: unknown) {
  const n = Number(typeof raw === "string" ? raw : "");
  return Number.isInteger(n) && n >= 1 ? Math.min(n, 100_000) : 1;
}

export const pageCount = (total: number, size: number) => Math.max(1, Math.ceil(total / size));

/** A page past the end (a deleted row, an old link) shows the last page instead of an empty one. */
export const clampPage = (page: number, total: number, size: number) => Math.min(page, pageCount(total, size));

/** What to put in the numbered row: the first and last page, the ones around the current one, "gap" for the rest. */
export function pageItems(page: number, pages: number): (number | "gap")[] {
  const keep = new Set([1, pages, page - 1, page, page + 1]);
  const out: (number | "gap")[] = [];
  let last = 0;
  for (const n of [...keep].filter((n) => n >= 1 && n <= pages).sort((a, b) => a - b)) {
    if (n - last === 2) out.push(last + 1);
    else if (n - last > 2) out.push("gap");
    out.push(n);
    last = n;
  }
  return out;
}

/** "26–50" of a page: the first and last row numbers it shows. */
export const pageRange = (page: number, size: number, total: number) => ({ from: total ? (page - 1) * size + 1 : 0, to: Math.min(page * size, total) });
