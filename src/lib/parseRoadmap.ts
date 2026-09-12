import type { ParsedSubject, ParsedSubtopic, ParsedTopic } from "../types";
import { cleanName, hasContent, normalizeName } from "./normalize";

/**
 * A best-effort Markdown / plain-text roadmap parser.
 *
 * It does not need to be right every time: the user reviews and edits the
 * result before anything is saved, and ambiguous input can be handed to Gemini
 * instead. What it does need to be is predictable, and never to throw.
 *
 * The approach is two-stage. First every line becomes a token with a single
 * numeric `depth`, so that headings, pseudo-headings (a bare line acting as a
 * section label) and list items all sort against each other on one scale.
 * Then those tokens are folded into a tree and the tree is projected onto the
 * three levels the app actually stores.
 */

/** Headings occupy depths 1–6, matching their `#` count. */
const PSEUDO_HEADING_DEPTH = 50;
const ITEM_BASE = 100;

/** A topic with no subtopics is a weak result; too many of them means ask an LLM. */
export const AMBIGUITY_EMPTY_TOPIC_RATIO = 0.3;

/**
 * Thresholds past which a bare (non-list) line is commentary rather than a
 * section label. Hard-wrapped paragraphs are the awkward case, because their
 * lines break mid-sentence with no punctuation to go on, so length carries
 * that one. List items are never measured against these — an explicit bullet
 * is structure the user typed, and stays.
 */
const PROSE_MAX_CHARS = 160;
const PROSE_MAX_WORDS = 12;
/** Labels are short and rarely end in a full stop; sentences do both. */
const PROSE_SENTENCE_MIN_WORDS = 3;

const TAB_WIDTH = 4;

export type ParseResult = {
  subject: ParsedSubject;
  /** True when the caller should prefer the LLM path, if one is configured. */
  ambiguous: boolean;
  /** Human-readable explanations for `ambiguous`, for showing in the UI. */
  reasons: string[];
  /** Lines that didn't fit the three-level structure and were left out. */
  ignoredCount: number;
};

type Token = {
  depth: number;
  text: string;
  /** List items are explicit user structure, so they're never dropped as prose. */
  isList: boolean;
};

type Node = Token & { children: Node[] };

/* ------------------------------------------------------------------ *
 * Line classification
 * ------------------------------------------------------------------ */

type Line =
  | { kind: "heading"; level: number; text: string }
  | { kind: "item"; width: number; text: string }
  | { kind: "text"; width: number; text: string };

const HEADING_RE = /^ {0,3}(#{1,6})\s+(.+?)\s*#*\s*$/;
const BULLET_RE = /^(\s*)[-*+•·]\s+(.+)$/;
const NUMBERED_RE = /^(\s*)(?:\d{1,3}[.)]|\(\d{1,3}\))\s+(.+)$/;
const TEXT_RE = /^(\s*)(\S.*)$/;
const FENCE_RE = /^ {0,3}(```|~~~)/;
const HR_RE = /^ {0,3}([-*_])(?:\s*\1){2,}\s*$/;
const SETEXT_RE = /^ {0,3}(={2,}|-{3,})\s*$/;

function indentWidth(whitespace: string): number {
  let width = 0;
  for (const char of whitespace) {
    width += char === "\t" ? TAB_WIDTH : 1;
  }
  return width;
}

function looksLikeProse(text: string): boolean {
  if (text.length > PROSE_MAX_CHARS) return true;
  const words = text.split(/\s+/).length;
  if (words > PROSE_MAX_WORDS) return true;
  // A full stop mid-line means a second sentence has started. "Node.js" and
  // "v1.2" don't match — the space after the stop is what gives prose away.
  if (/\.\s+\S/.test(text)) return true;
  return words > PROSE_SENTENCE_MIN_WORDS && /[.!?]$/.test(text);
}

function classifyLines(input: string): { lines: Line[]; ignored: number } {
  const lines: Line[] = [];
  let ignored = 0;
  let inFence = false;

  const source = input.replace(/\r\n?/g, "\n").split("\n");

  for (let i = 0; i < source.length; i++) {
    const raw = source[i];

    if (FENCE_RE.test(raw)) {
      inFence = !inFence;
      continue;
    }
    if (inFence) {
      // Code samples describe a topic, they aren't topics themselves.
      if (raw.trim()) ignored++;
      continue;
    }
    if (!raw.trim()) continue;

    // A run of = or - can underline the previous line (a setext heading) or be
    // a horizontal rule. It's a heading only when it directly follows a plain
    // line of text, which is exactly what Markdown says.
    const setext = SETEXT_RE.exec(raw);
    if (setext) {
      const previous = lines[lines.length - 1];
      const followsText = previous?.kind === "text" && source[i - 1]?.trim();
      if (previous && previous.kind === "text" && followsText) {
        lines[lines.length - 1] = {
          kind: "heading",
          level: setext[1].startsWith("=") ? 1 : 2,
          text: previous.text,
        };
      }
      continue;
    }
    if (HR_RE.test(raw)) continue;

    const heading = HEADING_RE.exec(raw);
    if (heading) {
      // Strip any further "## " runs the text picked up, while leaving a bare
      // "#" alone — that one belongs to names like "C#".
      const text = heading[2].replace(/^(?:#+\s+)+/, "");
      lines.push({ kind: "heading", level: heading[1].length, text });
      continue;
    }

    const bullet = BULLET_RE.exec(raw);
    if (bullet) {
      lines.push({ kind: "item", width: indentWidth(bullet[1]), text: bullet[2] });
      continue;
    }

    const numbered = NUMBERED_RE.exec(raw);
    if (numbered) {
      lines.push({ kind: "item", width: indentWidth(numbered[1]), text: numbered[2] });
      continue;
    }

    const text = TEXT_RE.exec(raw);
    if (text) {
      lines.push({ kind: "text", width: indentWidth(text[1]), text: text[2] });
    }
  }

  return { lines, ignored };
}

/**
 * Maps raw indent widths onto levels. Widths within 2 columns of the one that
 * opened the cluster count as the same level, so a stray extra space doesn't
 * invent a level, while the "2+ spaces or a tab" rule still nests.
 */
function buildIndentRanks(widths: number[]): Map<number, number> {
  const distinct = [...new Set(widths)].sort((a, b) => a - b);
  const ranks = new Map<number, number>();
  let rank = 0;
  let clusterStart: number | null = null;

  for (const width of distinct) {
    if (clusterStart === null) {
      clusterStart = width;
    } else if (width - clusterStart >= 2) {
      rank++;
      clusterStart = width;
    }
    ranks.set(width, rank);
  }
  return ranks;
}

/* ------------------------------------------------------------------ *
 * Tokens and tree
 * ------------------------------------------------------------------ */

function tokenize(input: string): {
  tokens: Token[];
  sawHeading: boolean;
  sawListItem: boolean;
  ignored: number;
} {
  const { lines, ignored: fenceIgnored } = classifyLines(input);
  let ignored = fenceIgnored;

  const ranks = buildIndentRanks(
    lines.filter((line) => line.kind !== "heading").map((line) => line.width),
  );

  const tokens: Token[] = [];
  let sawHeading = false;
  let sawListItem = false;

  for (const line of lines) {
    const name = cleanName(line.text);
    if (!name || !hasContent(name)) {
      ignored++;
      continue;
    }

    if (line.kind === "heading") {
      sawHeading = true;
      tokens.push({ depth: line.level, text: name, isList: false });
      continue;
    }

    const rank = ranks.get(line.width) ?? 0;

    if (line.kind === "item") {
      sawListItem = true;
      tokens.push({ depth: ITEM_BASE + rank, text: name, isList: true });
      continue;
    }

    // A bare line of text. Prose is commentary and gets dropped; anything
    // short and label-like at the outermost level is treated as a section
    // heading, which is how "**Basics**" or an underline-free title behaves.
    if (looksLikeProse(name)) {
      ignored++;
      continue;
    }
    tokens.push({
      depth: rank === 0 ? PSEUDO_HEADING_DEPTH : ITEM_BASE + rank,
      text: name,
      isList: false,
    });
  }

  return { tokens, sawHeading, sawListItem, ignored };
}

function buildTree(tokens: Token[]): Node[] {
  const roots: Node[] = [];
  const stack: Node[] = [];

  for (const token of tokens) {
    const node: Node = { ...token, children: [] };
    while (stack.length > 0 && stack[stack.length - 1].depth >= node.depth) {
      stack.pop();
    }
    if (stack.length > 0) stack[stack.length - 1].children.push(node);
    else roots.push(node);
    stack.push(node);
  }

  return roots;
}

function countNodes(nodes: Node[]): number {
  return nodes.reduce((total, node) => total + 1 + countNodes(node.children), 0);
}

/* ------------------------------------------------------------------ *
 * Deduplication
 * ------------------------------------------------------------------ */

function dedupeSubtopics(subtopics: ParsedSubtopic[]): ParsedSubtopic[] {
  const seen = new Set<string>();
  const result: ParsedSubtopic[] = [];
  for (const subtopic of subtopics) {
    const key = normalizeName(subtopic.name);
    if (!key || seen.has(key)) continue;
    seen.add(key);
    result.push(subtopic);
  }
  return result;
}

/** Topics repeated under the same name are merged, keeping first-seen order. */
function mergeDuplicateTopics(topics: ParsedTopic[]): ParsedTopic[] {
  const byName = new Map<string, ParsedTopic>();
  const order: string[] = [];

  for (const topic of topics) {
    const key = normalizeName(topic.name);
    if (!key) continue;
    const existing = byName.get(key);
    if (existing) {
      existing.subtopics.push(...topic.subtopics);
    } else {
      byName.set(key, { name: topic.name, subtopics: [...topic.subtopics] });
      order.push(key);
    }
  }

  return order.map((key) => {
    const topic = byName.get(key)!;
    return { name: topic.name, subtopics: dedupeSubtopics(topic.subtopics) };
  });
}

/* ------------------------------------------------------------------ *
 * Entry point
 * ------------------------------------------------------------------ */

/**
 * Recognizes a bare title line sitting above sibling sections, e.g.
 *
 *     Learning Rust: A Structured Path
 *     **Phase 1**
 *       - ...
 *     **Phase 2**
 *       - ...
 *
 * The giveaway is that it has no content of its own while every section after
 * it does. Only a bare line qualifies: an empty `## Heading` among headings is
 * a genuinely empty topic, not a title.
 */
function isDocumentTitle(roots: Node[]): boolean {
  if (roots.length < 3) return false;
  const first = roots[0];
  if (first.isList || first.depth !== PSEUDO_HEADING_DEPTH) return false;
  if (first.children.length > 0) return false;
  return roots.slice(1).every((root) => root.children.length > 0);
}

export function parseRoadmap(input: string): ParseResult {
  const { tokens, sawHeading, sawListItem, ignored: tokenIgnored } = tokenize(input);
  let ignored = tokenIgnored;

  const roots = buildTree(tokens);

  // A single root that isn't a list item is the document's title, so it names
  // the subject and its children become the topics. A bullet is never a
  // subject — a one-bullet roadmap is a topic list, not a title.
  let subjectName = "";
  let topicNodes: Node[];
  if (roots.length === 1 && !roots[0].isList) {
    subjectName = roots[0].text;
    topicNodes = roots[0].children;
  } else if (isDocumentTitle(roots)) {
    subjectName = roots[0].text;
    topicNodes = roots.slice(1);
  } else {
    topicNodes = roots;
  }

  const topics = topicNodes.map((topicNode) => {
    for (const subtopicNode of topicNode.children) {
      // Anything below a subtopic is detail the three-level model can't hold.
      ignored += countNodes(subtopicNode.children);
    }
    return {
      name: topicNode.text,
      subtopics: topicNode.children.map((child) => ({ name: child.text })),
    };
  });

  const merged = mergeDuplicateTopics(topics);

  const reasons: string[] = [];
  if (!sawHeading && !sawListItem) {
    reasons.push("No headings or lists were found in the pasted text.");
  }
  if (merged.length === 0) {
    reasons.push("No topics could be identified.");
  } else {
    const empty = merged.filter((topic) => topic.subtopics.length === 0).length;
    if (empty / merged.length > AMBIGUITY_EMPTY_TOPIC_RATIO) {
      reasons.push(
        `${empty} of ${merged.length} topics came out with no subtopics, so the structure is unclear.`,
      );
    }
  }

  return {
    subject: { name: subjectName, topics: merged },
    ambiguous: reasons.length > 0,
    reasons,
    ignoredCount: ignored,
  };
}
