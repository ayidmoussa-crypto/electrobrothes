import { CircleCheck, CircleX, TriangleAlert } from "lucide-react";
import { Badge } from "@/components/ui/Badge";

// Shared by server and client components: no server-only imports here.

export const LOW_STOCK = 3;

export const stockMessageKey = (stock: number) => (stock <= 0 ? "outOfStock" : stock <= LOW_STOCK ? "lowStock" : "inStock");

/** Icon + words, never colour alone. */
export function StockBadge({ stock, label }: { stock: number; label: string }) {
  const icon = "size-3.5";
  if (stock <= 0) {
    return (
      <Badge tone="danger" icon={<CircleX className={icon} aria-hidden="true" />}>
        {label}
      </Badge>
    );
  }
  if (stock <= LOW_STOCK) {
    return (
      <Badge tone="warning" icon={<TriangleAlert className={icon} aria-hidden="true" />}>
        {label}
      </Badge>
    );
  }
  return (
    <Badge tone="success" icon={<CircleCheck className={icon} aria-hidden="true" />}>
      {label}
    </Badge>
  );
}
