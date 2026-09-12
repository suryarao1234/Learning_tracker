/**
 * Stable-enough unique IDs without pulling in a uuid dependency.
 * crypto.randomUUID is available in every browser this app targets, but a
 * counter-based fallback keeps non-secure-context and old-browser cases alive.
 */
let counter = 0;

export function newId(prefix: string): string {
  const uuid =
    typeof crypto !== "undefined" && typeof crypto.randomUUID === "function"
      ? crypto.randomUUID()
      : `${Date.now().toString(36)}-${(counter++).toString(36)}-${Math.random()
          .toString(36)
          .slice(2, 10)}`;
  return `${prefix}_${uuid}`;
}
