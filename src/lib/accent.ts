/**
 * Each subject gets a colour, so a list of them reads as distinct things at a
 * glance rather than as rows of identical grey.
 *
 * The colour follows the subject, not its position: it's derived from the
 * subject's own ID, so importing, deleting or reordering never repaints
 * everything. Three accents is few enough that two subjects can share one —
 * that's fine, because the colour is never the identifier. Every place an
 * accent appears, the subject's name appears with it.
 */
export type AccentName = "a" | "b" | "c";

export type Accent = {
  name: AccentName;
  /** Solid fill, for avatars and bars. */
  bg: string;
  /** Tinted surface, for soft backgrounds. */
  soft: string;
  /** Readable text on the tinted surface. */
  text: string;
  /** Border on the tinted surface. */
  border: string;
  /** Inline style value, for SVG strokes and small marks. */
  hex: string;
  /** Deep ink of the same hue, readable on the tinted surface. */
  deepHex: string;
  /** The tinted surface as a hex, for pairing with deepHex inline. */
  softHex: string;
  /**
   * The hero surface: the accent stays vibrant, and the text colour is chosen
   * per accent rather than assumed. White on the blue is 5.7:1, but only
   * 2.2:1 on the orange and 2.7:1 on the pink — those two carry ink instead
   * (6.9:1 and 5.8:1). Both gradient ends were measured too.
   */
  heroFrom: string;
  heroTo: string;
  heroText: string;
  /** True when the hero text is white, so overlays can pick a matching tone. */
  heroOnDark: boolean;
};

const ACCENTS: Record<AccentName, Accent> = {
  a: {
    name: "a",
    bg: "bg-accent-a",
    soft: "bg-accent-a-soft",
    text: "text-accent-a",
    border: "border-accent-a/25",
    hex: "#2e5fd0",
    deepHex: "#24479c",
    softHex: "#e9effc",
    heroFrom: "#2e5fd0",
    heroTo: "#2851b4",
    heroText: "#ffffff",
    heroOnDark: true,
  },
  b: {
    name: "b",
    bg: "bg-accent-b",
    soft: "bg-accent-b-soft",
    text: "text-accent-b",
    border: "border-accent-b/35",
    hex: "#f19a4c",
    deepHex: "#8a4b13",
    softHex: "#fdf0e1",
    heroFrom: "#f19a4c",
    heroTo: "#f7b877",
    heroText: "#1b2440",
    heroOnDark: false,
  },
  c: {
    name: "c",
    bg: "bg-accent-c",
    soft: "bg-accent-c-soft",
    text: "text-accent-c",
    border: "border-accent-c/35",
    hex: "#e87bb0",
    deepHex: "#8f2a5b",
    softHex: "#fcebf3",
    heroFrom: "#e87bb0",
    heroTo: "#f0a0c8",
    heroText: "#1b2440",
    heroOnDark: false,
  },
};

const ORDER: AccentName[] = ["a", "b", "c"];

/** A small, stable string hash — same ID always lands on the same accent. */
function hash(value: string): number {
  let h = 0;
  for (let i = 0; i < value.length; i++) {
    h = (h * 31 + value.charCodeAt(i)) | 0;
  }
  return Math.abs(h);
}

export function accentFor(id: string): Accent {
  return ACCENTS[ORDER[hash(id) % ORDER.length]];
}

/**
 * Inline styles for a letter avatar: a tint of the accent carrying its deep
 * ink. A solid chip in the base hue would need white text, which the lighter
 * two accents can't support (2.2:1 and 2.7:1).
 */
export function avatarStyle(accent: Accent): { backgroundColor: string; color: string } {
  return { backgroundColor: accent.softHex, color: accent.deepHex };
}

/** The first letter of a name, for the avatar chip. Falls back to "?". */
export function initialOf(name: string): string {
  const match = name.trim().match(/[\p{L}\p{N}]/u);
  return match ? match[0].toUpperCase() : "?";
}
