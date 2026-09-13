import { afterEach, describe, expect, it, vi } from "vitest";
import {
  coerceGeminiSubject,
  GEMINI_ENDPOINT,
  GEMINI_MODEL,
  structureRoadmap,
} from "./gemini";

/** A well-formed generateContent response carrying `payload` as its JSON text. */
function geminiResponse(payload: unknown, init: ResponseInit = {}) {
  return new Response(
    JSON.stringify({
      candidates: [
        { finishReason: "STOP", content: { parts: [{ text: JSON.stringify(payload) }] } },
      ],
    }),
    { status: 200, ...init },
  );
}

function mockFetch(response: Response) {
  const fetchMock = vi.fn((_url: string, _init: RequestInit) => Promise.resolve(response));
  vi.stubGlobal("fetch", fetchMock);
  return fetchMock;
}

/** Mocks a fetch that rejects, the way a dropped connection or an abort does. */
function mockFetchRejecting(error: unknown) {
  const fetchMock = vi.fn((_url: string, _init: RequestInit) => Promise.reject(error));
  vi.stubGlobal("fetch", fetchMock);
  return fetchMock;
}

const GOOD_PAYLOAD = {
  subject: {
    name: "Rust",
    topics: [
      { name: "Ownership", subtopics: [{ name: "Borrowing" }, { name: "Lifetimes" }] },
      { name: "Traits", subtopics: [] },
    ],
  },
};

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("the request", () => {
  it("posts to the configured model with the key in a header, not the URL", async () => {
    const fetchMock = mockFetch(geminiResponse(GOOD_PAYLOAD));
    await structureRoadmap("# Rust", "secret-key");

    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toBe(GEMINI_ENDPOINT);
    expect(url).toContain(GEMINI_MODEL);
    expect(url).not.toContain("secret-key");
    expect(init.method).toBe("POST");
    expect((init.headers as Record<string, string>)["x-goog-api-key"]).toBe("secret-key");
  });

  it("constrains the response with a schema and interpolates the roadmap", async () => {
    const fetchMock = mockFetch(geminiResponse(GOOD_PAYLOAD));
    await structureRoadmap("# Rust\n## Ownership", "key");

    const body = JSON.parse(fetchMock.mock.calls[0][1].body as string);
    expect(body.generationConfig.responseMimeType).toBe("application/json");
    expect(body.generationConfig.responseSchema.required).toEqual(["subject"]);

    const prompt = body.contents[0].parts[0].text;
    expect(prompt).toContain("# Rust\n## Ownership");
    expect(prompt).not.toContain("{{PASTED_ROADMAP}}");
    expect(prompt).toContain("Do not invent concepts");
  });

  it("does not call the network without a key", async () => {
    const fetchMock = mockFetch(geminiResponse(GOOD_PAYLOAD));
    const result = await structureRoadmap("# Rust", "   ");

    expect(fetchMock).not.toHaveBeenCalled();
    expect(result).toMatchObject({ ok: false, reason: "no-key" });
  });
});

describe("a good response", () => {
  it("returns the structured subject", async () => {
    mockFetch(geminiResponse(GOOD_PAYLOAD));
    const result = await structureRoadmap("# Rust", "key");

    expect(result).toEqual({
      ok: true,
      subject: {
        name: "Rust",
        topics: [
          { name: "Ownership", subtopics: [{ name: "Borrowing" }, { name: "Lifetimes" }] },
          { name: "Traits", subtopics: [] },
        ],
      },
    });
  });

  it("joins a response split across several parts", async () => {
    const text = JSON.stringify(GOOD_PAYLOAD);
    mockFetch(
      new Response(
        JSON.stringify({
          candidates: [
            {
              content: {
                parts: [{ text: text.slice(0, 20) }, { text: text.slice(20) }],
              },
            },
          ],
        }),
      ),
    );
    expect(await structureRoadmap("# Rust", "key")).toMatchObject({ ok: true });
  });
});

describe("failure paths", () => {
  it("reports an unreachable network", async () => {
    mockFetchRejecting(new TypeError("Failed to fetch"));
    expect(await structureRoadmap("# Rust", "key")).toMatchObject({
      ok: false,
      reason: "network",
    });
  });

  it("reports a rejected API key from a 400", async () => {
    mockFetch(
      new Response(JSON.stringify({ error: { message: "API key not valid." } }), {
        status: 400,
      }),
    );
    const result = await structureRoadmap("# Rust", "bad");
    expect(result).toMatchObject({ ok: false, reason: "auth" });
    expect((result as { message: string }).message).toContain("Settings");
  });

  it("reports a rejected API key from a 403", async () => {
    mockFetch(new Response(JSON.stringify({ error: { message: "Forbidden" } }), { status: 403 }));
    expect(await structureRoadmap("# Rust", "bad")).toMatchObject({
      ok: false,
      reason: "auth",
    });
  });

  it("distinguishes a rate limit from a server error", async () => {
    mockFetch(new Response("{}", { status: 429 }));
    expect(await structureRoadmap("# Rust", "key")).toMatchObject({ reason: "rate-limit" });

    mockFetch(new Response("{}", { status: 503 }));
    expect(await structureRoadmap("# Rust", "key")).toMatchObject({ reason: "server" });
  });

  it("survives an error body that isn't JSON", async () => {
    mockFetch(new Response("<html>502 Bad Gateway</html>", { status: 502 }));
    expect(await structureRoadmap("# Rust", "key")).toMatchObject({
      ok: false,
      reason: "server",
    });
  });

  it("reports blocked prompts", async () => {
    mockFetch(new Response(JSON.stringify({ promptFeedback: { blockReason: "SAFETY" } })));
    expect(await structureRoadmap("# Rust", "key")).toMatchObject({
      ok: false,
      reason: "blocked",
    });
  });

  it("reports a truncated response rather than parsing half of it", async () => {
    mockFetch(
      new Response(
        JSON.stringify({
          candidates: [{ finishReason: "MAX_TOKENS", content: { parts: [{ text: '{"subj' }] } }],
        }),
      ),
    );
    const result = await structureRoadmap("# Rust", "key");
    expect(result).toMatchObject({ ok: false, reason: "invalid-response" });
    expect((result as { message: string }).message).toContain("too long");
  });

  it("reports text that isn't valid JSON", async () => {
    mockFetch(
      new Response(
        JSON.stringify({ candidates: [{ content: { parts: [{ text: "Sure! Here you go:" }] } }] }),
      ),
    );
    expect(await structureRoadmap("# Rust", "key")).toMatchObject({
      ok: false,
      reason: "invalid-response",
    });
  });

  it("reports JSON that doesn't match the schema", async () => {
    mockFetch(geminiResponse({ topics: ["Ownership"] }));
    expect(await structureRoadmap("# Rust", "key")).toMatchObject({
      ok: false,
      reason: "invalid-response",
    });
  });

  it("reports a cancelled call distinctly, so it isn't shown as an error", async () => {
    const controller = new AbortController();
    controller.abort();
    mockFetchRejecting(new DOMException("Aborted", "AbortError"));
    expect(await structureRoadmap("# Rust", "key", controller.signal)).toMatchObject({
      ok: false,
      reason: "cancelled",
    });
  });

  it("reports an abort as cancelled even without the signal to hand", async () => {
    mockFetchRejecting({ name: "AbortError", message: "Aborted" });
    expect(await structureRoadmap("# Rust", "key")).toMatchObject({
      ok: false,
      reason: "cancelled",
    });
  });
});

describe("coerceGeminiSubject", () => {
  it("drops unusable rows instead of rejecting the whole response", () => {
    const subject = coerceGeminiSubject({
      subject: {
        name: "  Rust  ",
        topics: [
          { name: "  Ownership  ", subtopics: [{ name: " Borrowing " }, { name: "  " }, 42] },
          { name: "   " },
          "not a topic",
          { name: "Traits", subtopics: "not an array" },
        ],
      },
    });
    expect(subject).toEqual({
      name: "Rust",
      topics: [
        { name: "Ownership", subtopics: [{ name: "Borrowing" }] },
        { name: "Traits", subtopics: [] },
      ],
    });
  });

  it("rejects anything without usable topics", () => {
    expect(coerceGeminiSubject(null)).toBeNull();
    expect(coerceGeminiSubject({})).toBeNull();
    expect(coerceGeminiSubject({ subject: { name: "Rust" } })).toBeNull();
    expect(coerceGeminiSubject({ subject: { name: "Rust", topics: [] } })).toBeNull();
    expect(coerceGeminiSubject({ subject: { name: "Rust", topics: [{}] } })).toBeNull();
  });

  it("caps a runaway response", () => {
    const subject = coerceGeminiSubject({
      subject: {
        name: "Huge",
        topics: Array.from({ length: 500 }, (_, i) => ({
          name: `Topic ${i}`,
          subtopics: Array.from({ length: 500 }, (_, j) => ({ name: `Sub ${j}` })),
        })),
      },
    });
    expect(subject!.topics).toHaveLength(200);
    expect(subject!.topics[0].subtopics).toHaveLength(200);
  });
});
