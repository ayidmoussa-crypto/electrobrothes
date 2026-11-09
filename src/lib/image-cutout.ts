/**
 * The product photo with its white studio background made transparent, for showing it on black.
 * Cloudinary's make_transparent at a low tolerance takes the background only (a higher one eats silver and glass);
 * PNG keeps the transparency. Photos not on Cloudinary have no cutout: show them on their white tile instead.
 */
export function cutoutUrl(url: string): string | null {
  if (!url.startsWith("https://res.cloudinary.com/") || !url.includes("/image/upload/")) return null;
  return url.replace("/image/upload/", "/image/upload/co_white,e_make_transparent:10/f_png/");
}
