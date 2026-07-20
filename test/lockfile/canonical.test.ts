import { describe, it, expect } from "vitest";
import fc from "fast-check";
import {
  canonicalize,
  digestJson,
  scrubSecrets,
  containsSecret,
} from "../../src/util/canonical.js";
import { generateLockfile, writeLockfile, readLockfile } from "../../src/lockfile/io.js";
import { defaultConfig } from "../../src/config/load.js";
import { digestJson as dig } from "../../src/util/canonical.js";
import type { DetectedDependency, RegistrySnapshot } from "../../src/types/schemas.js";
import { mkdtempSync, rmSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";

describe("canonical JSON", () => {
  it("is stable under key reordering", () => {
    const a = { b: 1, a: 2, c: { z: 1, y: 2 } };
    const b = { c: { y: 2, z: 1 }, a: 2, b: 1 };
    expect(canonicalize(a)).toBe(canonicalize(b));
    expect(digestJson(a)).toBe(digestJson(b));
  });

  it("property: digest invariant under key shuffle for flat records", () => {
    fc.assert(
      fc.property(fc.dictionary(fc.string(), fc.integer()), (dict) => {
        const keys = Object.keys(dict);
        const shuffled: Record<string, number> = {};
        for (const k of [...keys].reverse()) {
          const v = dict[k];
          if (v !== undefined) shuffled[k] = v;
        }
        expect(digestJson(dict)).toBe(digestJson(shuffled));
      }),
      { numRuns: 50 },
    );
  });
});

describe("lockfile secrets", () => {
  it("detects and scrubs secrets", () => {
    expect(containsSecret("sk-abcdefghijklmnopqrstuvwxyz123456")).toBe(true);
    const scrubbed = scrubSecrets({ key: "sk-abcdefghijklmnopqrstuvwxyz123456" }) as {
      key: string;
    };
    expect(scrubbed.key).toBe("[REDACTED]");
  });

  it("deterministic regeneration", () => {
    const detected: DetectedDependency[] = [
      {
        provider: "openai",
        modelId: "gpt-4o-2024-08-06",
        identifierKind: "fixed",
        confidence: 0.9,
        lowConfidence: false,
        occurrences: [{ path: "a.ts", line: 1, confidence: 0.9, kind: "sdk" }],
      },
    ];
    const registry: RegistrySnapshot = {
      schemaVersion: 1,
      generatedAt: "2026-07-20T00:00:00.000Z",
      generatorVersion: "0.1.0",
      frozen: false,
      warnings: [],
      models: [],
    };
    const config = defaultConfig();
    const a = generateLockfile({
      detected,
      registry,
      config,
      configDigest: dig(config),
      generatedAt: "2026-07-20T00:00:00.000Z",
    });
    const b = generateLockfile({
      detected,
      registry,
      config,
      configDigest: dig(config),
      generatedAt: "2026-07-20T00:00:00.000Z",
    });
    expect(canonicalize(a)).toBe(canonicalize(b));
    expect(a.configDigest).toBe(b.configDigest);

    const dir = mkdtempSync(join(tmpdir(), "modellock-"));
    try {
      const path = join(dir, "llm.lock.json");
      const stable = { ...a, generatedAt: "2026-07-20T00:00:00.000Z" };
      writeLockfile(path, stable);
      const round = readLockfile(path);
      expect(round.dependencies).toEqual(stable.dependencies);
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });
});
