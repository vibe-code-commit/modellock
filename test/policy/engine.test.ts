import { describe, it, expect } from "vitest";
import { evaluatePolicy } from "../../src/policy/engine.js";
import { defaultConfig } from "../../src/config/load.js";
import type { Lockfile, RegistrySnapshot, NormalizedModelRecord } from "../../src/types/schemas.js";
import { ExitCode } from "../../src/types/schemas.js";

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

function makeDep(overrides: Partial<NormalizedModelRecord["facts"]> = {}): Lockfile {
  const facts = {
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
    ...overrides,
  };
  return {
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
          confidence: 0.9,
          lowConfidence: false,
          occurrences: [{ path: "src/app.ts", line: 10, confidence: 0.9, kind: "sdk" }],
        },
        facts,
        evidence: [],
      },
    ],
  };
}

function makeRegistry(facts: NormalizedModelRecord["facts"]): RegistrySnapshot {
  return {
    schemaVersion: 1,
    generatedAt: "2026-07-20T00:00:00.000Z",
    generatorVersion: "0.1.0",
    frozen: false,
    warnings: [],
    models: [
      {
        key: "openai:gpt-4o",
        provider: "openai",
        modelId: "gpt-4o",
        facts,
        evidence: [],
      },
    ],
  };
}

describe("policy engine", () => {
  it("fails on high-confidence input price increase beyond threshold", () => {
    const lockfile = makeDep();
    const registry = makeRegistry({
      ...lockfile.dependencies[0]!.facts,
      inputPricePerMillion: fact(5.0),
    });
    const result = evaluatePolicy({ lockfile, registry, config: defaultConfig() });
    expect(
      result.findings.some((f) => f.code === "input-price-increase" && f.severity === "fail"),
    ).toBe(true);
    expect(result.exitCode).toBe(ExitCode.PolicyFailure);
  });

  it("fails on context decrease", () => {
    const lockfile = makeDep();
    const registry = makeRegistry({
      ...lockfile.dependencies[0]!.facts,
      contextLimit: fact(64000),
    });
    const result = evaluatePolicy({ lockfile, registry, config: defaultConfig() });
    expect(result.findings.some((f) => f.code === "context-decrease")).toBe(true);
  });

  it("fails on tool-calling removal", () => {
    const lockfile = makeDep();
    const registry = makeRegistry({
      ...lockfile.dependencies[0]!.facts,
      toolCalling: fact(false),
    });
    const result = evaluatePolicy({ lockfile, registry, config: defaultConfig() });
    expect(result.findings.some((f) => f.code === "tool-calling-removal")).toBe(true);
  });

  it("fails on structured-output and vision removal", () => {
    const lockfile = makeDep();
    const registry = makeRegistry({
      ...lockfile.dependencies[0]!.facts,
      structuredOutput: fact(false),
      vision: fact(false),
    });
    const result = evaluatePolicy({ lockfile, registry, config: defaultConfig() });
    expect(result.findings.some((f) => f.code === "structured-output-removal")).toBe(true);
    expect(result.findings.some((f) => f.code === "vision-removal")).toBe(true);
  });

  it("does not block conflicting facts", () => {
    const lockfile = makeDep();
    const registry = makeRegistry({
      ...lockfile.dependencies[0]!.facts,
      inputPricePerMillion: fact(9.99, "conflicting"),
    });
    // Force conflicting by setting value null with conflicting confidence
    registry.models[0]!.facts.inputPricePerMillion = {
      ...fact(null, "conflicting"),
      value: null,
    };
    const result = evaluatePolicy({ lockfile, registry, config: defaultConfig() });
    const conflict = result.findings.find((f) => f.code === "conflicting-fact");
    expect(conflict?.severity).toBe("warn");
    expect(
      result.findings.some((f) => f.code === "input-price-increase" && f.severity === "fail"),
    ).toBe(false);
  });

  it("warns on floating aliases by default", () => {
    const lockfile = makeDep({ identifierKind: fact("floating") });
    lockfile.dependencies[0]!.identifierKind = "floating";
    const registry = makeRegistry(lockfile.dependencies[0]!.facts);
    const result = evaluatePolicy({ lockfile, registry, config: defaultConfig() });
    expect(result.findings.some((f) => f.code === "floating-alias" && f.severity === "warn")).toBe(
      true,
    );
  });

  it("warns on stale/frozen registry without false policy failure by default", () => {
    const lockfile = makeDep();
    const registry = makeRegistry(lockfile.dependencies[0]!.facts);
    registry.frozen = true;
    registry.freezeReason = "upstream outage";
    registry.warnings = ["upstream outage"];
    const result = evaluatePolicy({ lockfile, registry, config: defaultConfig() });
    expect(result.findings.some((f) => f.code === "stale-source" && f.severity === "warn")).toBe(
      true,
    );
    expect(result.exitCode).toBe(ExitCode.Success);
  });

  it("does not fail on single-source price drift by default", () => {
    const lockfile = makeDep();
    const registry = makeRegistry({
      ...lockfile.dependencies[0]!.facts,
      inputPricePerMillion: fact(5.0, "single-source"),
    });
    const result = evaluatePolicy({ lockfile, registry, config: defaultConfig() });
    const finding = result.findings.find((f) => f.code === "input-price-increase");
    expect(finding?.severity).toBe("warn");
    expect(result.exitCode).toBe(ExitCode.Success);
  });
});
