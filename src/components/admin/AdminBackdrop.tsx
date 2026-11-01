/**
 * Fixed warm backdrop behind the admin's frosted cards: soft brand-yellow and ink light blobs,
 * blurred, on warm-50. Purely decorative; smaller blur on phones keeps scrolling cheap.
 */
export function AdminBackdrop() {
  return (
    <div aria-hidden="true" className="pointer-events-none fixed inset-0 -z-10 overflow-hidden bg-warm-50">
      <div className="absolute -top-40 -start-32 size-[34rem] rounded-full bg-yellow-300/40 blur-[110px] max-md:size-80 max-md:blur-[60px]" />
      <div className="absolute top-1/3 -end-40 size-[30rem] rounded-full bg-yellow-500/20 blur-[120px] max-md:size-72 max-md:blur-[60px]" />
      <div className="absolute -bottom-48 start-1/4 size-[32rem] rounded-full bg-warm-300/40 blur-[110px] max-md:size-80 max-md:blur-[60px]" />
    </div>
  );
}
