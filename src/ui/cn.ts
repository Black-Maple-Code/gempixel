/**
 * cn — the zero-dependency class-name join helper (D-02, D-03).
 *
 * Filters falsy entries (`false | null | undefined | ''`) and joins the rest
 * with a single space. It ONLY concatenates — it does NOT resolve Tailwind
 * conflicts. When two utilities target the same CSS property, the winner is the
 * one generated LATER in Tailwind's stylesheet, NOT the one listed last here;
 * source order in the class attribute does not decide precedence. For a hard
 * per-instance override, a consumer should use the `!` important modifier
 * (e.g. `!bg-red-500`). tailwind-merge is deliberately NOT added (D-03).
 */
export function cn(...classes: Array<string | false | null | undefined>): string {
  return classes.filter(Boolean).join(' ');
}
