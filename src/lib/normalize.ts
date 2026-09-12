/**
 * The key used to decide whether two names refer to the same thing — by the
 * importer when deduplicating, and by the re-import merge when matching a new
 * tree against an existing one.
 */
export function normalizeName(name: string): string {
  return name.trim().toLowerCase().replace(/\s+/g, " ");
}

/** True if a name has at least one letter or digit — i.e. isn't stray punctuation. */
export function hasContent(name: string): boolean {
  return /[\p{L}\p{N}]/u.test(name);
}

/**
 * Strips the markup around a name while leaving its wording alone.
 *
 * Underscores are deliberately left in place: `_italic_` is rare in generated
 * roadmaps, but `__init__` and `snake_case` are not, and mangling those is the
 * worse failure.
 */
export function cleanName(raw: string): string {
  let s = raw.trim();

  // Task-list checkbox: "- [ ] Learn X" arrives here as "[ ] Learn X".
  s = s.replace(/^\[[ xX]\]\s*/, "");

  // Links and images keep their text, drop their target.
  s = s.replace(/!?\[([^\]]*)\]\([^)]*\)/g, "$1");
  s = s.replace(/^<((?:https?|mailto):[^>]+)>$/, "$1");

  // Paired emphasis and inline code.
  s = s.replace(/\*\*\*([^*]+)\*\*\*/g, "$1");
  s = s.replace(/\*\*([^*]+)\*\*/g, "$1");
  s = s.replace(/\*([^*]+)\*/g, "$1");
  s = s.replace(/~~([^~]+)~~/g, "$1");
  s = s.replace(/`([^`]+)`/g, "$1");

  // Trailing colon left over from "Basics:" style section labels.
  s = s.replace(/\s*:+\s*$/, "");

  return s.replace(/\s+/g, " ").trim();
}
