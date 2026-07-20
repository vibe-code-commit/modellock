import { readFileSync, writeFileSync, existsSync, mkdirSync } from "node:fs";
import { dirname, join } from "node:path";
import {
  LockfileSchema,
  type Lockfile,
  type LockDependency,
  type DetectedDependency,
  type NormalizedModelRecord,
  type Config,
} from "../types/schemas.js";
import { LOCKFILE_FILENAME, PACKAGE_VERSION, FLOATING_ALIASES } from "../types/constants.js";
import {
  canonicalize,
  digestJson,
  modelKey,
  nowIso,
  scrubSecrets,
  isFixedModelId,
  containsSecret,
} from "../util/canonical.js";
import { unavailableFact } from "../sources/types.js";
import type { RegistrySnapshot } from "../types/schemas.js";

export class LockfileValidationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "LockfileValidationError";
  }
}

export function readLockfile(path: string): Lockfile {
  if (!existsSync(path)) {
    throw new LockfileValidationError(`Lockfile not found: ${path}`);
  }
  const raw = readFileSync(path, "utf8");
  if (containsSecret(raw)) {
    throw new LockfileValidationError("Lockfile appears to contain secrets and was rejected");
  }
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch (err) {
    throw new LockfileValidationError(
      `Lockfile is not valid JSON: ${err instanceof Error ? err.message : String(err)}`,
    );
  }
  const result = LockfileSchema.safeParse(parsed);
  if (!result.success) {
    throw new LockfileValidationError(`Lockfile schema validation failed: ${result.error.message}`);
  }
  return result.data;
}

export function writeLockfile(path: string, lockfile: Lockfile): void {
  const validated = LockfileSchema.parse(lockfile);
  const scrubbed = scrubSecrets(validated) as Lockfile;
  const text = canonicalize(scrubbed);
  if (containsSecret(text)) {
    throw new LockfileValidationError("Refusing to write lockfile containing secrets");
  }
  mkdirSync(dirname(path), { recursive: true });
  writeFileSync(path, text, "utf8");
}

export function lockfilePath(rootDir: string): string {
  return join(rootDir, LOCKFILE_FILENAME);
}

function resolveIdentifierKind(
  modelId: string,
  detected?: DetectedDependency,
): "floating" | "fixed" {
  if (detected?.identifierKind) return detected.identifierKind;
  if (isFixedModelId(modelId)) return "fixed";
  if (FLOATING_ALIASES.has(modelId) || modelId.endsWith("-latest")) return "floating";
  return "floating";
}

function emptyFacts(fetchedAt: string): LockDependency["facts"] {
  const base = {
    sourceId: "unavailable",
    sourceUrl: "file:unavailable",
    fetchedAt,
    sourceDigest: "0",
    parserVersion: "0",
  };
  return {
    provider: unavailableFact(
      base.sourceId,
      base.sourceUrl,
      fetchedAt,
      base.sourceDigest,
      base.parserVersion,
    ),
    requestedModelId: unavailableFact(
      base.sourceId,
      base.sourceUrl,
      fetchedAt,
      base.sourceDigest,
      base.parserVersion,
    ),
    identifierKind: unavailableFact(
      base.sourceId,
      base.sourceUrl,
      fetchedAt,
      base.sourceDigest,
      base.parserVersion,
    ),
    lifecycleStatus: unavailableFact(
      base.sourceId,
      base.sourceUrl,
      fetchedAt,
      base.sourceDigest,
      base.parserVersion,
    ),
    retirementDate: unavailableFact(
      base.sourceId,
      base.sourceUrl,
      fetchedAt,
      base.sourceDigest,
      base.parserVersion,
    ),
    inputPricePerMillion: unavailableFact(
      base.sourceId,
      base.sourceUrl,
      fetchedAt,
      base.sourceDigest,
      base.parserVersion,
    ),
    outputPricePerMillion: unavailableFact(
      base.sourceId,
      base.sourceUrl,
      fetchedAt,
      base.sourceDigest,
      base.parserVersion,
    ),
    contextLimit: unavailableFact(
      base.sourceId,
      base.sourceUrl,
      fetchedAt,
      base.sourceDigest,
      base.parserVersion,
    ),
    maxOutputLimit: unavailableFact(
      base.sourceId,
      base.sourceUrl,
      fetchedAt,
      base.sourceDigest,
      base.parserVersion,
    ),
    toolCalling: unavailableFact(
      base.sourceId,
      base.sourceUrl,
      fetchedAt,
      base.sourceDigest,
      base.parserVersion,
    ),
    structuredOutput: unavailableFact(
      base.sourceId,
      base.sourceUrl,
      fetchedAt,
      base.sourceDigest,
      base.parserVersion,
    ),
    vision: unavailableFact(
      base.sourceId,
      base.sourceUrl,
      fetchedAt,
      base.sourceDigest,
      base.parserVersion,
    ),
  };
}

export function buildLockDependency(
  detected: DetectedDependency,
  registryModel: NormalizedModelRecord | undefined,
  fetchedAt: string,
): LockDependency {
  const key = modelKey(detected.provider, detected.modelId);
  const facts = registryModel?.facts ?? emptyFacts(fetchedAt);
  // Override identity facts from discovery
  facts.provider = {
    ...facts.provider,
    value: detected.provider,
    confidence:
      facts.provider.confidence === "unavailable" ? "single-source" : facts.provider.confidence,
  };
  facts.requestedModelId = {
    ...facts.requestedModelId,
    value: detected.modelId,
    confidence: "single-source",
  };
  const kind = resolveIdentifierKind(detected.modelId, detected);
  facts.identifierKind = {
    ...facts.identifierKind,
    value: kind,
    confidence:
      facts.identifierKind.confidence === "unavailable"
        ? "single-source"
        : facts.identifierKind.confidence,
  };

  return {
    key,
    provider: detected.provider,
    modelId: detected.modelId,
    identifierKind: kind,
    discovery: {
      confidence: detected.confidence,
      lowConfidence: detected.lowConfidence,
      occurrences: detected.occurrences,
    },
    facts,
    evidence: registryModel?.evidence ?? [],
  };
}

export function generateLockfile(opts: {
  detected: DetectedDependency[];
  registry: RegistrySnapshot;
  config: Config;
  configDigest: string;
  generatedAt?: string;
}): Lockfile {
  const generatedAt = opts.generatedAt ?? nowIso();
  const byKey = new Map(opts.registry.models.map((m) => [m.key, m]));

  // Merge pins from config
  const detectedMap = new Map<string, DetectedDependency>();
  for (const d of opts.detected) {
    const key = modelKey(d.provider, d.modelId);
    if (opts.config.exclude.includes(key)) continue;
    detectedMap.set(key, d);
  }
  for (const pin of opts.config.pins) {
    const key = modelKey(pin.provider, pin.modelId);
    if (!detectedMap.has(key)) {
      detectedMap.set(key, {
        provider: pin.provider,
        modelId: pin.modelId,
        identifierKind: resolveIdentifierKind(pin.modelId),
        confidence: 1,
        lowConfidence: false,
        occurrences: [
          {
            path: ".llm-lock.yml",
            line: 1,
            confidence: 1,
            kind: "override",
          },
        ],
      });
    }
  }
  for (const include of opts.config.include) {
    const idx = include.indexOf(":");
    if (idx <= 0) continue;
    const provider = include.slice(0, idx) as DetectedDependency["provider"];
    const modelId = include.slice(idx + 1);
    const key = include;
    if (!detectedMap.has(key)) {
      detectedMap.set(key, {
        provider,
        modelId,
        identifierKind: resolveIdentifierKind(modelId),
        confidence: 1,
        lowConfidence: false,
        occurrences: [
          {
            path: ".llm-lock.yml",
            line: 1,
            confidence: 1,
            kind: "override",
          },
        ],
      });
    }
  }

  const dependencies = [...detectedMap.values()]
    .map((d) => buildLockDependency(d, byKey.get(modelKey(d.provider, d.modelId)), generatedAt))
    .sort((a, b) => a.key.localeCompare(b.key));

  return {
    lockfileVersion: 1,
    generatedAt,
    generatorVersion: PACKAGE_VERSION,
    configDigest: opts.configDigest,
    registryDigest: digestJson(opts.registry.models),
    dependencies,
  };
}

export function proposeLockfileUpdate(current: Lockfile | null, next: Lockfile): Lockfile {
  // Preserve approved values unless generating a replacement proposal.
  // update always generates a full replacement proposal; write is explicit.
  void current;
  return LockfileSchema.parse(scrubSecrets(next));
}
