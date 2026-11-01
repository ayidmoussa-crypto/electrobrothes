import Image from "next/image";
// The store photo pre-blurred and warmed (960 × 540, ~5 KB): gives the frosted cards something to frost.
import backdropPhoto from "@/assets/admin-backdrop.jpg";

/**
 * Fixed warm backdrop behind the admin's frosted cards: a softly blurred warm photo plus brand-yellow
 * light blobs on warm-50. Purely decorative; fainter and less blurred on phones to keep scrolling cheap.
 */
export function AdminBackdrop() {
  return (
    <div aria-hidden="true" className="pointer-events-none fixed inset-0 -z-10 overflow-hidden bg-warm-50">
      <Image src={backdropPhoto} alt="" fill sizes="100vw" priority className="object-cover opacity-30 md:opacity-50" />
      {/* Cream veil keeps the photo a texture, never a picture. */}
      <div className="absolute inset-0 bg-linear-to-b from-warm-50/40 via-warm-50/20 to-warm-50/60" />
      <div className="absolute -top-40 -start-32 size-[34rem] rounded-full bg-yellow-300/40 blur-[110px] max-md:size-80 max-md:blur-[60px]" />
      <div className="absolute top-1/3 -end-40 size-[30rem] rounded-full bg-yellow-500/20 blur-[120px] max-md:size-72 max-md:blur-[60px]" />
      <div className="absolute -bottom-48 start-1/4 size-[32rem] rounded-full bg-warm-300/40 blur-[110px] max-md:size-80 max-md:blur-[60px]" />
    </div>
  );
}
