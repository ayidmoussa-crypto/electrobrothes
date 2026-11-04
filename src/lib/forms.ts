import { startTransition, type FormEvent } from "react";

/**
 * React empties a form after its action runs, even when the action failed, so a shopper or the owner
 * would lose what they typed (and a select would silently go blank). Dispatching by hand skips that reset.
 * Keep `action={...}` on the form too: it is what runs before hydration and without JavaScript.
 */
export function submitKeepingValues(e: FormEvent<HTMLFormElement>, action: (fd: FormData) => void) {
  e.preventDefault();
  const fd = new FormData(e.currentTarget);
  startTransition(() => action(fd));
}
