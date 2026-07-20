import {
  readFileSync,
  writeFileSync,
  existsSync,
  mkdirSync,
  readdirSync,
  copyFileSync,
} from "node:fs";
import { join } from "node:path";
import { RegistrySnapshotSchema, type RegistrySnapshot, type Config } from "../types/schemas.js";
import { PACKAGE_VERSION } from "../types/constants.js";
import { canonicalize, digestJson, nowIso } from "../util/canonical.js";
import { modelsDevAdapter } from "../sources/models-dev.js";
import { deprecationsInfoAdapter } from "../sources/deprecations-info.js";
import { officialProviderAdapter } from "../sources/official-provider.js";
import { mergeSourceResults } from "../sources/merge.js";
import type { FetchLike } from "../network/fetch.js";
import { omitUndefined } from "../util/omit-undefined.js";

export function packageDataDir(from: string): string {
  return from;
}

export function latestRegistryPath(dataDir: string): string {
  return join(dataDir, "registry", "latest.json");
}

export function loadRegistrySnapshot(dataDir: string): RegistrySnapshot {
  const path = latestRegistryPath(dataDir);
  if (!existsSync(path)) {
    return {
      schemaVersion: 1,
      generatedAt: nowIso(),
      generatorVersion: PACKAGE_VERSION,
      frozen: true,
      freezeReason: "No registry snapshot present",
      warnings: ["No registry snapshot present; using empty frozen registry"],
      models: [],
    };
  }
  const raw = JSON.parse(readFileSync(path, "utf8")) as unknown;
  return RegistrySnapshotSchema.parse(raw);
}

export function writeRegistrySnapshot(
  dataDir: string,
  snapshot: RegistrySnapshot,
  dated = true,
): string {
  const dir = join(dataDir, "registry");
  mkdirSync(dir, { recursive: true });
  const validated = RegistrySnapshotSchema.parse(snapshot);
  const text = canonicalize(validated);
  const latest = join(dir, "latest.json");
  writeFileSync(latest, text, "utf8");
  if (dated) {
    const day = validated.generatedAt.slice(0, 10);
    const datedPath = join(dir, `${day}.json`);
    writeFileSync(datedPath, text, "utf8");
    return datedPath;
  }
  return latest;
}

export interface LoadRegistryOptions {
  dataDir: string;
  config: Config;
  fetchImpl?: FetchLike | undefined;
  allowNetwork?: boolean | undefined;
}

/**
 * Load current normalized registry data.
 * Network refresh is optional; on source failure freeze LKG and warn.
 */
export async function loadCurrentRegistry(opts: LoadRegistryOptions): Promise<{
  registry: RegistrySnapshot;
  warnings: string[];
  fromNetwork: boolean;
}> {
  const lkg = loadRegistrySnapshot(opts.dataDir);
  const allowNetwork = opts.allowNetwork ?? opts.config.sources.allowNetwork;

  if (!allowNetwork) {
    return {
      registry: { ...lkg, frozen: lkg.frozen, warnings: [...lkg.warnings] },
      warnings: lkg.warnings,
      fromNetwork: false,
    };
  }

  const ctx = omitUndefined({
    timeoutMs: opts.config.sources.timeoutMs,
    maxBytes: opts.config.sources.maxBytes,
    fetchImpl: opts.fetchImpl,
    dataDir: opts.dataDir,
  });

  const results = await Promise.all([
    modelsDevAdapter(ctx),
    deprecationsInfoAdapter(ctx),
    officialProviderAdapter(ctx),
  ]);

  const anyOk = results.some((r) => r.meta.ok);
  if (!anyOk) {
    const warnings = [
      ...results.map((r) => r.meta.warning).filter((w): w is string => Boolean(w)),
      "All sources failed; freezing last-known-good registry",
    ];
    return {
      registry: {
        ...lkg,
        frozen: true,
        freezeReason: "All upstream sources failed",
        warnings: [...lkg.warnings, ...warnings],
      },
      warnings,
      fromNetwork: false,
    };
  }

  const merged = mergeSourceResults(results, {
    staleAfterDays: opts.config.sources.staleAfterDays,
    generatorVersion: PACKAGE_VERSION,
    frozen: false,
  });

  // If some sources failed, keep LKG models for keys missing from merged? Prefer merged + warnings.
  const warnings = [...merged.warnings];
  const failed = results.filter((r) => !r.meta.ok);
  if (failed.length > 0) {
    warnings.push(
      `Partial source failure (${failed.map((f) => f.meta.sourceId).join(", ")}); merged available sources and retained warnings`,
    );
  }

  return {
    registry: { ...merged, warnings },
    warnings,
    fromNetwork: true,
  };
}

export function listDatedSnapshots(dataDir: string): string[] {
  const dir = join(dataDir, "registry");
  if (!existsSync(dir)) return [];
  return readdirSync(dir)
    .filter((f) => /^\d{4}-\d{2}-\d{2}\.json$/.test(f))
    .sort();
}

export function preservePreviousSnapshot(dataDir: string): void {
  const latest = latestRegistryPath(dataDir);
  if (!existsSync(latest)) return;
  const bak = join(dataDir, "registry", `previous.json`);
  copyFileSync(latest, bak);
}

export function registryDigest(snapshot: RegistrySnapshot): string {
  return digestJson(snapshot.models);
}
