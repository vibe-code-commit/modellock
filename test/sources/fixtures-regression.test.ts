import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { modelsDevAdapter } from "../../src/sources/models-dev.js";
import { mergeSourceResults } from "../../src/sources/merge.js";
import { evaluatePolicy } from "../../src/policy/engine.js";
import { defaultConfig } from "../../src/config/load.js";
import type { Lockfile, RegistrySnapshot } from "../../src/types/schemas.js";

const fixtures = join(process.cwd(), "data", "fixtures");

function fact<T>(
  value: T,
  confidence:
    | "official-verified"
    | "multi-source-verified"
    | "single-source"
    | "conflicting"
    | "stale"
    | "unavailable" = "multi-source-verified",
) {
  return {
    value,
    sourceId: "test",
    sourceUrl: "https://example.com",
    fetchedAt: "2026-07-20T00:00:00.000Z",
    sourceDigest: "abc",
    parserVersion: "1",
    confidence,
  };
}

describe("fixture regressions", () => {
  it("detects capability removal and price/context changes from fixture", async () => {
    const removed = await modelsDevAdapter({
      timeoutMs: 1000,
      maxBytes: 1_000_000,
      fixtureBody: readFileSync(join(fixtures, "models-dev-capability-removal.json"), "utf8"),
    });
    const gpt = removed.models.find((m) => m.modelId === "gpt-4o");
    expect(gpt?.toolCalling).toBe(false);
    expect(gpt?.contextLimit).toBe(64000);
    expect(gpt?.inputPricePerMillion).toBe(5.0);
  });

  it("treats aliases as floating identifiers", async () => {
    const body = readFileSync(join(fixtures, "models-dev-valid.json"), "utf8");
    const result = await modelsDevAdapter({
      timeoutMs: 1000,
      maxBytes: 1_000_000,
      fixtureBody: body,
    });
    const floating = result.models.find((m) => m.modelId === "gpt-4o");
    const fixed = result.models.find((m) => m.modelId === "gpt-4o-2024-08-06");
    expect(floating?.identifierKind).toBe("floating");
    expect(fixed?.identifierKind).toBe("fixed");
  });

  it("unavailable sources freeze into empty adapter results without throwing", async () => {
    const fetchImpl = async () => {
      throw new Error("DNS failure");
    };
    const result = await modelsDevAdapter({
      timeoutMs: 100,
      maxBytes: 1000,
      fetchImpl,
    });
    expect(result.meta.ok).toBe(false);
    expect(result.models).toEqual([]);
    const merged = mergeSourceResults([result], { frozen: true, freezeReason: "outage" });
    expect(merged.frozen).toBe(true);
    expect(merged.warnings.length).toBeGreaterThan(0);
  });

  it("stale sources warn rather than invent values", () => {
    const lockfile: Lockfile = {
      lockfileVersion: 1,
      generatedAt: "2026-07-20T00:00:00.000Z",
      generatorVersion: "0.1.0",
      configDigest: "x",
      registryDigest: "y",
      dependencies: [
        {
          key: "openai:gpt-4o",
          provider: "openai",
          modelId: "gpt-4o",
          identifierKind: "fixed",
          discovery: {
            confidence: 1,
            lowConfidence: false,
            occurrences: [{ path: "a.ts", line: 1, confidence: 1, kind: "sdk" }],
          },
          facts: {
            provider: fact("openai"),
            requestedModelId: fact("gpt-4o"),
            identifierKind: fact<"floating" | "fixed">("fixed"),
            lifecycleStatus: fact<"active" | "deprecated" | "retired" | "unknown">("active"),
            retirementDate: fact<string | null>(null),
            inputPricePerMillion: fact(2.5),
            outputPricePerMillion: fact(10),
            contextLimit: fact(128000),
            maxOutputLimit: fact(16384),
            toolCalling: fact(true),
            structuredOutput: fact(true),
            vision: fact(true),
          },
          evidence: [],
        },
      ],
    };
    const registry: RegistrySnapshot = {
      schemaVersion: 1,
      generatedAt: "2026-01-01T00:00:00.000Z",
      generatorVersion: "0.1.0",
      frozen: true,
      freezeReason: "stale snapshot",
      warnings: ["stale"],
      models: [
        {
          key: "openai:gpt-4o",
          provider: "openai",
          modelId: "gpt-4o",
          facts: lockfile.dependencies[0]!.facts,
          evidence: [],
        },
      ],
    };
    const result = evaluatePolicy({ lockfile, registry, config: defaultConfig() });
    expect(result.findings.some((f) => f.code === "stale-source")).toBe(true);
    expect(result.exitCode).toBe(0);
  });
});
