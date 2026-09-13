import type { ParsedSubject, ParsedSubtopic, ParsedTopic } from "../types";

/**
 * The one place the model name appears. Google renames and retires Gemini
 * models often, so changing model should stay a one-line edit.
 */
export const GEMINI_MODEL = "gemini-2.5-flash";

export const GEMINI_ENDPOINT = `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent`;

/** Guards against a runaway response turning into thousands of rows to review. */
const MAX_TOPICS = 200;
const MAX_SUBTOPICS_PER_TOPIC = 200;

const PROMPT_TEMPLATE = `Convert the learning roadmap below into the required JSON structure.

Rules:
- Infer a single overall subject name from the roadmap. If the roadmap
  genuinely covers more than one unrelated subject, pick the most prominent
  one and ignore the rest — this tool imports one subject at a time.
- Convert major sections into topics.
- Convert nested items into subtopics.
- If the hierarchy is unclear, make the most reasonable grouping rather than
  leaving anything out.
- Do not invent concepts that are not present in the roadmap.
- Remove exact duplicate topics and subtopics.
- Preserve the original wording of topic/subtopic names where possible.

Roadmap:
{{PASTED_ROADMAP}}`;

/**
 * Constrains the model to the exact shape we need, rather than trusting the
 * prompt alone. The type names are the Schema enum's own spelling.
 */
const RESPONSE_SCHEMA = {
  type: "OBJECT",
  properties: {
    subject: {
      type: "OBJECT",
      properties: {
        name: { type: "STRING" },
        topics: {
          type: "ARRAY",
          items: {
            type: "OBJECT",
            properties: {
              name: { type: "STRING" },
              subtopics: {
                type: "ARRAY",
                items: {
                  type: "OBJECT",
                  properties: { name: { type: "STRING" } },
                  required: ["name"],
                },
              },
            },
            required: ["name", "subtopics"],
          },
        },
      },
      required: ["name", "topics"],
    },
  },
  required: ["subject"],
} as const;

export type GeminiFailureReason =
  | "no-key"
  | "cancelled"
  | "network"
  | "auth"
  | "rate-limit"
  | "server"
  | "blocked"
  | "invalid-response";

export type GeminiResult =
  | { ok: true; subject: ParsedSubject }
  | { ok: false; reason: GeminiFailureReason; message: string };

function failure(reason: GeminiFailureReason, message: string): GeminiResult {
  return { ok: false, reason, message };
}

/* ------------------------------------------------------------------ *
 * Response validation
 *
 * responseSchema constrains the model, it doesn't guarantee the bytes that
 * come back. Everything is re-checked here before it reaches the app.
 * ------------------------------------------------------------------ */

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function cleanNames(values: unknown, limit: number): string[] {
  if (!Array.isArray(values)) return [];
  const names: string[] = [];
  for (const value of values) {
    if (names.length >= limit) break;
    if (!isRecord(value)) continue;
    const name = typeof value.name === "string" ? value.name.trim() : "";
    if (name) names.push(name);
  }
  return names;
}

export function coerceGeminiSubject(value: unknown): ParsedSubject | null {
  if (!isRecord(value) || !isRecord(value.subject)) return null;
  const subject = value.subject;

  const name = typeof subject.name === "string" ? subject.name.trim() : "";
  if (!Array.isArray(subject.topics)) return null;

  const topics: ParsedTopic[] = [];
  for (const rawTopic of subject.topics) {
    if (topics.length >= MAX_TOPICS) break;
    if (!isRecord(rawTopic)) continue;
    const topicName = typeof rawTopic.name === "string" ? rawTopic.name.trim() : "";
    if (!topicName) continue;
    const subtopics: ParsedSubtopic[] = cleanNames(
      rawTopic.subtopics,
      MAX_SUBTOPICS_PER_TOPIC,
    ).map((subtopicName) => ({ name: subtopicName }));
    topics.push({ name: topicName, subtopics });
  }

  if (topics.length === 0) return null;
  return { name, topics };
}

/** Pulls the model's text out of a generateContent response. */
function extractText(body: unknown): { text: string } | GeminiResult {
  if (!isRecord(body)) return failure("invalid-response", "Gemini sent back an unreadable response.");

  const feedback = isRecord(body.promptFeedback) ? body.promptFeedback : null;
  if (feedback && typeof feedback.blockReason === "string") {
    return failure(
      "blocked",
      `Gemini declined to process this text (${feedback.blockReason}).`,
    );
  }

  const candidates = Array.isArray(body.candidates) ? body.candidates : [];
  const candidate = candidates[0];
  if (!isRecord(candidate)) {
    return failure("invalid-response", "Gemini sent back no candidates.");
  }

  const finishReason = candidate.finishReason;
  if (typeof finishReason === "string" && finishReason !== "STOP") {
    return failure(
      finishReason === "MAX_TOKENS" ? "invalid-response" : "blocked",
      finishReason === "MAX_TOKENS"
        ? "The roadmap was too long for Gemini to structure in one go."
        : `Gemini stopped early (${finishReason}).`,
    );
  }

  const content = isRecord(candidate.content) ? candidate.content : null;
  const parts = content && Array.isArray(content.parts) ? content.parts : [];
  const text = parts
    .map((part) => (isRecord(part) && typeof part.text === "string" ? part.text : ""))
    .join("");

  if (!text.trim()) return failure("invalid-response", "Gemini sent back an empty response.");
  return { text };
}

function describeHttpError(status: number, body: unknown): GeminiResult {
  const apiMessage =
    isRecord(body) && isRecord(body.error) && typeof body.error.message === "string"
      ? body.error.message
      : "";

  if (status === 400 && /api[_ ]?key/i.test(apiMessage)) {
    return failure("auth", "Gemini rejected the API key. Check it in Settings.");
  }
  if (status === 401 || status === 403) {
    return failure(
      "auth",
      apiMessage || "Gemini rejected the API key. Check it in Settings.",
    );
  }
  if (status === 429) {
    return failure("rate-limit", "Gemini's rate limit was hit. Try again in a moment.");
  }
  if (status >= 500) {
    return failure("server", `Gemini is having trouble (HTTP ${status}).`);
  }
  return failure("server", apiMessage || `Gemini returned HTTP ${status}.`);
}

/* ------------------------------------------------------------------ *
 * The call
 * ------------------------------------------------------------------ */

/**
 * Asks Gemini to structure a roadmap. Never throws: every failure path — no
 * key, offline, bad key, rate limit, a response that doesn't match the schema
 * — comes back as a result the caller can show while falling back to the local
 * parser.
 */
export async function structureRoadmap(
  roadmap: string,
  apiKey: string,
  signal?: AbortSignal,
): Promise<GeminiResult> {
  if (!apiKey.trim()) {
    return failure("no-key", "No Gemini API key is configured.");
  }

  const requestBody = {
    contents: [
      { parts: [{ text: PROMPT_TEMPLATE.replace("{{PASTED_ROADMAP}}", roadmap) }] },
    ],
    generationConfig: {
      responseMimeType: "application/json",
      responseSchema: RESPONSE_SCHEMA,
    },
  };

  let response: Response;
  try {
    response = await fetch(GEMINI_ENDPOINT, {
      method: "POST",
      headers: {
        "x-goog-api-key": apiKey.trim(),
        "Content-Type": "application/json",
      },
      body: JSON.stringify(requestBody),
      signal,
    });
  } catch (err) {
    // Matched by name rather than `instanceof DOMException`: the identity of
    // built-ins isn't reliable across realms, and a missed match here would
    // show a cancellation to the user as a network error.
    const name = typeof err === "object" && err !== null ? (err as { name?: unknown }).name : undefined;
    if (signal?.aborted || name === "AbortError") {
      return failure("cancelled", "Cancelled.");
    }
    return failure("network", "Couldn't reach Gemini. Check your connection.");
  }

  let body: unknown = null;
  try {
    body = await response.json();
  } catch {
    // Leave body null; the status still tells us most of what we need.
  }

  if (!response.ok) return describeHttpError(response.status, body);

  const extracted = extractText(body);
  if ("ok" in extracted) return extracted;

  let parsed: unknown;
  try {
    parsed = JSON.parse(extracted.text);
  } catch {
    return failure("invalid-response", "Gemini's response wasn't valid JSON.");
  }

  const subject = coerceGeminiSubject(parsed);
  if (!subject) {
    return failure("invalid-response", "Gemini's response didn't match the expected shape.");
  }

  return { ok: true, subject };
}
