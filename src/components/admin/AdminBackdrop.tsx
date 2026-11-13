/**
 * Warm white page with two soft, pale-yellow lights (fixed, behind everything) so the dashboard's glass
 * cards have something gentle to frost over, the same idea as the shop's own glass surfaces.
 */
export function AdminBackdrop() {
  return (
    <div aria-hidden="true" className="pointer-events-none fixed inset-0 -z-10 overflow-hidden bg-white">
      <div className="absolute -top-32 start-1/4 size-[36rem] rounded-full bg-yellow-200/40 blur-[110px]" />
      <div className="absolute top-1/3 end-0 size-[30rem] rounded-full bg-yellow-100/50 blur-[110px]" />
    </div>
  );
}
