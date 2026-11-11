import Image from "next/image";

/** The company's logo in a small round tile; without one, its initials on black. */
export function CarrierLogo({ name, logoUrl, className = "size-8" }: { name: string; logoUrl: string | null; className?: string }) {
  const initials = name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((w) => w[0]!.toUpperCase())
    .join("");
  return (
    <span className={`relative grid shrink-0 place-items-center overflow-hidden rounded-full border border-warm-200 bg-white ${className}`}>
      {logoUrl ? (
        <Image src={logoUrl} alt="" fill sizes="40px" unoptimized className="object-contain p-0.5" />
      ) : (
        <span className="grid size-full place-items-center bg-ink text-[10px] font-extrabold text-yellow-500" dir="ltr">
          {initials}
        </span>
      )}
    </span>
  );
}
