import { notFound } from "next/navigation";

// Unknown URLs under a locale render the localized 404 (real 404 status, no soft redirect).
export default function CatchAll() {
  notFound();
}
