/** The panel's plain page colour (white, or ink at night), fixed behind everything. */
export function AdminBackdrop() {
  return <div aria-hidden="true" className="pointer-events-none fixed inset-0 -z-10 bg-(--admin-page-bg)" />;
}
