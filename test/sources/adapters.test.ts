import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { modelsDevAdapter, _internal as modelsDevInternal } from "../../src/sources/models-dev.js";
import { deprecationsInfoAdapter } from "../../src/sources/deprecations-info.js";
import { officialProviderAdapter } from "../../src/sources/official-provider.js";
import { mergeSourceResults } from "../../src/sources/merge.js";
import { NetworkError, limitedFetch, parseJsonBody } from "../../src/network/fetch.js";
import { sanitizeForPrint } from "../../src/sanitize/index.js";

const fixtures = join(process.cwd(), "data", "fixtures");
const dataDir = join(process.cwd(), "data");

describe("models.dev adapter", () => {
  it("parses valid provider data", async () => {
    const body = readFileSync(join(fixtures, "models-dev-valid.json"), "utf8");
    const result = await modelsDevAdapter({
      timeoutMs: 1000,
      maxBytes: 1_000_000,
      fixtureBody: body,
    });
    expect(result.meta.ok).toBe(true);
    expect(result.models.length).toBeGreaterThan(0);
    const gpt = result.models.find((m) => m.modelId === "gpt-4o");
    expect(gpt?.toolCalling).toBe(true);
    expect(gpt?.inputPricePerMillion).toBe(2.5);
  });

  it("handles missing fields without inventing values", async () => {
    const body = readFileSync(join(fixtures, "models-dev-missing-fields.json"), "utf8");
    const result = await modelsDevAdapter({
      timeoutMs: 1000,
      maxBytes: 1_000_000,
      fixtureBody: body,
    });
    const gpt = result.models.find((m) => m.modelId === "gpt-4o");
    expect(gpt?.structuredOutput ?? null).toBeNull();
    expect(gpt?.vision).toBeNull();
  });

  it("rejects malformed JSON via fixture parse", async () => {
    const body = readFileSync(join(fixtures, "malformed.json"), "utf8");
    const result = await modelsDevAdapter({
      timeoutMs: 1000,
      maxBytes: 1_000_000,
      fixtureBody: body,
    });
    expect(result.meta.ok).toBe(false);
    expect(result.models).toEqual([]);
  });
});

describe("deprecations.info adapter", () => {
  it("parses structured deprecation feed", async () => {
    const body = readFileSync(join(fixtures, "deprecations-valid.json"), "utf8");
    const result = await deprecationsInfoAdapter({
      timeoutMs: 1000,
      maxBytes: 1_000_000,
      fixtureBody: body,
    });
    expect(result.meta.ok).toBe(true);
    expect(result.models[0]?.retirementDate).toBe("2026-09-01");
    expect(result.models[0]?.lifecycleStatus).toBe("deprecated");
  });
});

describe("official-provider adapter", () => {
  it("loads curated pack", async () => {
    const result = await officialProviderAdapter({
      timeoutMs: 1000,
      maxBytes: 1_000_000,
      dataDir,
    });
    expect(result.meta.ok).toBe(true);
    expect(result.models.some((m) => m.provider === "xai")).toBe(true);
  });
});

describe("merge confidence", () => {
  it("marks conflicting pricing as conflicting and never blocking", async () => {
    const modelsDev = await modelsDevAdapter({
      timeoutMs: 1000,
      maxBytes: 1_000_000,
      fixtureBody: readFileSync(join(fixtures, "models-dev-valid.json"), "utf8"),
    });
    const official = await officialProviderAdapter({
      timeoutMs: 1000,
      maxBytes: 1_000_000,
      fixtureBody: readFileSync(join(fixtures, "official-conflicting-price.json"), "utf8"),
    });
    const snapshot = mergeSourceResults([modelsDev, official]);
    const gpt = snapshot.models.find((m) => m.key === "openai:gpt-4o");
    expect(gpt?.facts.inputPricePerMillion.confidence).toBe("conflicting");
    expect(gpt?.facts.inputPricePerMillion.value).toBeNull();
  });

  it("marks conflicting retirement dates as conflicting", async () => {
    const depA = await deprecationsInfoAdapter({
      timeoutMs: 1000,
      maxBytes: 1_000_000,
      fixtureBody: readFileSync(join(fixtures, "deprecations-valid.json"), "utf8"),
    });
    const depB = await deprecationsInfoAdapter({
      timeoutMs: 1000,
      maxBytes: 1_000_000,
      fixtureBody: readFileSync(join(fixtures, "deprecations-conflicting-date.json"), "utf8"),
    });
    // Simulate two sources with different dates by renaming source ids
    depB.meta = { ...depB.meta, sourceId: "deprecations.info-b", ok: true };
    const snapshot = mergeSourceResults([depA, depB]);
    const model = snapshot.models.find((m) => m.key === "openai:gpt-3.5-turbo");
    expect(model?.facts.retirementDate.confidence).toBe("conflicting");
    expect(model?.facts.retirementDate.value).toBeNull();
  });

  it("raises multi-source-verified when sources agree", async () => {
    const modelsDev = await modelsDevAdapter({
      timeoutMs: 1000,
      maxBytes: 1_000_000,
      fixtureBody: readFileSync(join(fixtures, "models-dev-valid.json"), "utf8"),
    });
    const official = await officialProviderAdapter({
      timeoutMs: 1000,
      maxBytes: 1_000_000,
      dataDir,
    });
    const snapshot = mergeSourceResults([modelsDev, official]);
    const fixed = snapshot.models.find((m) => m.key === "openai:gpt-4o-2024-08-06");
    expect(fixed?.facts.inputPricePerMillion.confidence).toMatch(
      /official-verified|multi-source-verified/,
    );
  });
});

describe("network limits", () => {
  it("enforces oversized responses", async () => {
    const fetchImpl = async () =>
      new Response("x".repeat(100), {
        status: 200,
        headers: { "content-length": "100" },
      });
    await expect(
      limitedFetch({
        url: "https://models.dev/api.json",
        timeoutMs: 1000,
        maxBytes: 10,
        fetchImpl,
      }),
    ).rejects.toBeInstanceOf(NetworkError);
  });

  it("enforces timeouts", async () => {
    const fetchImpl = async (_url: string | URL, init?: RequestInit) => {
      await new Promise((resolve, reject) => {
        const t = setTimeout(resolve, 500);
        init?.signal?.addEventListener("abort", () => {
          clearTimeout(t);
          reject(Object.assign(new Error("aborted"), { name: "AbortError" }));
        });
      });
      return new Response("{}");
    };
    await expect(
      limitedFetch({
        url: "https://models.dev/api.json",
        timeoutMs: 50,
        maxBytes: 1000,
        fetchImpl,
      }),
    ).rejects.toMatchObject({ code: "timeout" });
  });

  it("rejects malformed JSON bodies", () => {
    expect(() => parseJsonBody("{", "https://models.dev/api.json")).toThrow(NetworkError);
  });
});

describe("sanitize", () => {
  it("strips malicious HTML before print", () => {
    const raw = readFileSync(join(fixtures, "malicious-strings.txt"), "utf8");
    const clean = sanitizeForPrint(raw);
    expect(clean).not.toMatch(/<script/i);
    expect(clean).not.toMatch(/<b>/i);
    expect(clean).toContain("gpt-4o");
  });
});

describe("models.dev internals", () => {
  it("maps deprecated status", () => {
    expect(modelsDevInternal.mapLifecycle("deprecated")).toBe("deprecated");
    expect(modelsDevInternal.mapLifecycle(undefined)).toBe("unknown");
  });
});
