// Kept apart from rules.ts because the proxy imports it: it must stay free of every other dependency.

export const isCleanSlug = (slug: string) => /^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(slug) && slug.length <= 80;

/** The new address of a moved product, in the visitor's language ("" = Arabic, "/en" = English). */
export const movedProductPath = (localePrefix: string, slug: string) => `${localePrefix}/products/${encodeURIComponent(slug)}`;

/** An address the [...rest] catch-all answers with a real 404, in the visitor's language. */
export const missingPagePath = (localePrefix: string) => `${localePrefix || "/ar"}/missing-page`;
