import { Package } from "lucide-react";
import Image from "next/image";

// Real products cut out of their background by scripts/category-images.mjs.
// A category added later from the admin has no photo yet and falls back to a parcel icon.
const PHOTOS = new Set(["headphones", "smartwatches", "chargers", "power-banks", "other-devices", "phone-cases"]);

/** The product inside a round category. It sizes itself to the disc, whose .cat-disc class moves it on hover. */
export function CategoryIcon({ slug }: { slug: string }) {
  return (
    <span className="cat-product">
      {PHOTOS.has(slug) ? (
        <Image src={`/categories/${slug}.webp`} alt="" fill sizes="200px" className="object-contain" />
      ) : (
        <Package aria-hidden="true" strokeWidth={1.5} className="size-full text-warm-500" />
      )}
    </span>
  );
}
