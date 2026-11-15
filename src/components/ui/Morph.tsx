import { cloneElement, isValidElement, type CSSProperties, type ReactElement } from "react";

/**
 * The same picture on two pages (a card and the page it opens): wrap both in a Morph with the same name, and
 * the picture flies from one place to the other when the link is followed, and back with the back button.
 *
 * The page it opens names its picture outright. A card in a list is only a `source`: it is marked, and
 * MorphOnClick names it when its link is clicked, so only that one card flies (the other cards, some of which
 * the next page may also show, simply fade with the page).
 *
 * The name is set on the element itself (CSS view-transition-name, class "morph"), not through React's
 * <ViewTransition name>: Next keeps the page you leave mounted but hidden, so React never sees the card leave and
 * never pairs it. The browser pairs any two visible elements with the same name in the transition React starts
 * for the navigation (the <ViewTransition> around each page). A name must be on screen only once per page.
 */
export function Morph({ name, source = false, children }: { name: string; source?: boolean; children: ReactElement<{ style?: CSSProperties }> }) {
  if (!isValidElement(children)) return children;
  if (source) return cloneElement(children, { "data-morph": name } as { style?: CSSProperties });
  return cloneElement(children, { style: { ...children.props.style, viewTransitionName: name, viewTransitionClass: "morph" } as CSSProperties });
}

/** The names, so a card and its page always agree. CSS idents: no spaces, no leading digit. */
export const morphName = {
  product: (slug: string) => `product-${slug}`,
  order: (id: string) => `order-${id}`,
  adminProduct: (id: string) => `admin-product-${id}`,
};
