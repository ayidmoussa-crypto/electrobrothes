/** Most pictures a category banner shows. */
export const BANNER_MAX = 3;

/**
 * The banner pictures typed in the admin, one per line: secure links or the shop's own files ("/banners/…"),
 * without repeats, at most three. Anything else is dropped rather than shown broken.
 */
export function bannerImageList(text: string) {
  const ok = (s: string) => /^https:\/\/\S+$/.test(s) || /^\/[\w./-]+$/.test(s);
  return [...new Set(text.split(/\r?\n/).map((s) => s.trim()).filter(ok))].slice(0, BANNER_MAX);
}
