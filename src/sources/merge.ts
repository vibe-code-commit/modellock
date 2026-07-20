import type {
  Confidence,
  EvidenceRef,
  FactEnvelope,
  NormalizedModelFacts,
  NormalizedModelRecord,
  ProviderId,
  RegistrySnapshot,
} from "../types/schemas.js";
import { PACKAGE_VERSION, SOURCE_IDS } from "../types/constants.js";
import { modelKey, nowIso, sha256 } from "../util/canonical.js";
import type { MaterialField, SourceModelFactSet, SourceResult } from "./types.js";
import { normalizeProvider } from "./types.js";

const MATERIAL_FIELDS: MaterialField[] = [
  "lifecycleStatus",
  "retirementDate",
  "inputPricePerMillion",
  "outputPricePerMillion",
  "contextLimit",
  "maxOutputLimit",
  "toolCalling",
  "structuredOutput",
  "vision",
  "identifierKind",
];

interface FieldObservation {
  value: unknown;
  sourceId: string;
  sourceUrl: string;
  fetchedAt: string;
  sourceDigest: string;
  parserVersion: string;
}

function valuesEqual(a: unknown, b: unknown): boolean {
  if (a === b) return true;
  if (typeof a === "number" && typeof b === "number") {
    return Math.abs(a - b) < 1e-9;
  }
  return JSON.stringify(a) === JSON.stringify(b);
}

function classifyConfidence(
  observations: FieldObservation[],
  staleAfterDays: number,
  now: Date,
): { confidence: Confidence; value: unknown; primary: FieldObservation | null } {
  const present = observations.filter((o) => o.value !== null && o.value !== undefined);
  if (present.length === 0) {
    return {
      confidence: "unavailable",
      value: null,
      primary: observations[0] ?? null,
    };
  }

  const staleCutoff = now.getTime() - staleAfterDays * 24 * 60 * 60 * 1000;
  const fresh = present.filter((o) => Date.parse(o.fetchedAt) >= staleCutoff);
  const pool = fresh.length > 0 ? fresh : present;
  const allStale = fresh.length === 0;

  // Detect conflicts among non-null values
  const unique: FieldObservation[] = [];
  for (const obs of pool) {
    if (!unique.some((u) => valuesEqual(u.value, obs.value))) {
      unique.push(obs);
    }
  }

  if (unique.length > 1) {
    return { confidence: "conflicting", value: null, primary: unique[0]! };
  }

  const agreed = unique[0]!;
  if (allStale) {
    return { confidence: "stale", value: agreed.value, primary: agreed };
  }

  const hasOfficial = pool.some((o) => o.sourceId === SOURCE_IDS.officialProvider);
  const distinctSources = new Set(pool.map((o) => o.sourceId));

  if (hasOfficial && distinctSources.size >= 1) {
    // Official agreement with itself, or with others
    const officialObs = pool.filter((o) => o.sourceId === SOURCE_IDS.officialProvider);
    const othersAgree = pool
      .filter((o) => o.sourceId !== SOURCE_IDS.officialProvider)
      .every((o) => valuesEqual(o.value, agreed.value));
    if (officialObs.length > 0 && (distinctSources.size === 1 || othersAgree)) {
      return { confidence: "official-verified", value: agreed.value, primary: agreed };
    }
  }

  if (distinctSources.size >= 2) {
    return { confidence: "multi-source-verified", value: agreed.value, primary: agreed };
  }

  return { confidence: "single-source", value: agreed.value, primary: agreed };
}

function buildEnvelope<T>(
  field: MaterialField,
  bySource: Map<string, { model: SourceModelFactSet; meta: SourceResult["meta"] }>,
  staleAfterDays: number,
  now: Date,
): FactEnvelope<T> {
  const observations: FieldObservation[] = [];
  for (const [, { model, meta }] of bySource) {
    const raw = (model as Record<string, unknown>)[field];
    observations.push({
      value: raw === undefined ? null : raw,
      sourceId: meta.sourceId,
      sourceUrl: meta.sourceUrl,
      fetchedAt: meta.fetchedAt,
      sourceDigest: meta.sourceDigest,
      parserVersion: meta.parserVersion,
    });
  }

  const { confidence, value, primary } = classifyConfidence(observations, staleAfterDays, now);
  const candidates =
    confidence === "conflicting"
      ? observations
          .filter((o) => o.value !== null && o.value !== undefined)
          .map((o) => ({
            value: o.value,
            sourceId: o.sourceId,
            sourceUrl: o.sourceUrl,
            fetchedAt: o.fetchedAt,
            sourceDigest: o.sourceDigest,
            parserVersion: o.parserVersion,
          }))
      : undefined;

  const base = primary ?? observations[0];
  return {
    value: (value as T | null) ?? null,
    sourceId: base?.sourceId ?? SOURCE_IDS.frozenRegistry,
    sourceUrl: base?.sourceUrl ?? "file:unavailable",
    fetchedAt: base?.fetchedAt ?? nowIso(),
    sourceDigest: base?.sourceDigest ?? sha256(""),
    parserVersion: base?.parserVersion ?? "0",
    confidence,
    ...(candidates ? { candidates } : {}),
  };
}

function groupKey(provider: string, modelId: string): string {
  return modelKey(normalizeProvider(provider), modelId);
}

/**
 * Merge independent SourceResults into a normalized registry snapshot.
 * Conflicting values never become blocking facts (confidence = conflicting, value = null).
 */
export function mergeSourceResults(
  results: SourceResult[],
  options: {
    staleAfterDays?: number;
    generatorVersion?: string;
    frozen?: boolean;
    freezeReason?: string;
  } = {},
): RegistrySnapshot {
  const staleAfterDays = options.staleAfterDays ?? 7;
  const now = new Date();
  const warnings: string[] = [];

  for (const r of results) {
    if (!r.meta.ok && r.meta.warning) {
      warnings.push(r.meta.warning);
    }
  }

  // key -> sourceId -> {model, meta}
  const grouped = new Map<
    string,
    Map<string, { model: SourceModelFactSet; meta: SourceResult["meta"] }>
  >();

  for (const result of results) {
    for (const model of result.models) {
      const key = groupKey(model.provider, model.modelId);
      let bySource = grouped.get(key);
      if (!bySource) {
        bySource = new Map();
        grouped.set(key, bySource);
      }
      bySource.set(result.meta.sourceId, { model, meta: result.meta });
    }
  }

  const models: NormalizedModelRecord[] = [];

  for (const [key, bySource] of [...grouped.entries()].sort(([a], [b]) => a.localeCompare(b))) {
    const first = [...bySource.values()][0]!;
    const provider = normalizeProvider(first.model.provider) as ProviderId;
    const modelId = first.model.modelId;

    const facts: NormalizedModelFacts = {
      provider: {
        value: provider,
        sourceId: first.meta.sourceId,
        sourceUrl: first.meta.sourceUrl,
        fetchedAt: first.meta.fetchedAt,
        sourceDigest: first.meta.sourceDigest,
        parserVersion: first.meta.parserVersion,
        confidence: bySource.size >= 2 ? "multi-source-verified" : "single-source",
      },
      requestedModelId: {
        value: modelId,
        sourceId: first.meta.sourceId,
        sourceUrl: first.meta.sourceUrl,
        fetchedAt: first.meta.fetchedAt,
        sourceDigest: first.meta.sourceDigest,
        parserVersion: first.meta.parserVersion,
        confidence: "single-source",
      },
      identifierKind: buildEnvelope("identifierKind", bySource, staleAfterDays, now),
      lifecycleStatus: buildEnvelope("lifecycleStatus", bySource, staleAfterDays, now),
      retirementDate: buildEnvelope("retirementDate", bySource, staleAfterDays, now),
      inputPricePerMillion: buildEnvelope("inputPricePerMillion", bySource, staleAfterDays, now),
      outputPricePerMillion: buildEnvelope("outputPricePerMillion", bySource, staleAfterDays, now),
      contextLimit: buildEnvelope("contextLimit", bySource, staleAfterDays, now),
      maxOutputLimit: buildEnvelope("maxOutputLimit", bySource, staleAfterDays, now),
      toolCalling: buildEnvelope("toolCalling", bySource, staleAfterDays, now),
      structuredOutput: buildEnvelope("structuredOutput", bySource, staleAfterDays, now),
      vision: buildEnvelope("vision", bySource, staleAfterDays, now),
    };

    // Silence unused MATERIAL_FIELDS lint by referencing
    void MATERIAL_FIELDS;

    const evidence: EvidenceRef[] = [...bySource.values()].map(({ meta }) => ({
      sourceId: meta.sourceId,
      sourceUrl: meta.sourceUrl,
      fetchedAt: meta.fetchedAt,
      sourceDigest: meta.sourceDigest,
      parserVersion: meta.parserVersion,
      contentDigest: meta.sourceDigest,
    }));

    models.push({ key, provider, modelId, facts, evidence });
  }

  return {
    schemaVersion: 1,
    generatedAt: nowIso(),
    generatorVersion: options.generatorVersion ?? PACKAGE_VERSION,
    frozen: options.frozen ?? false,
    ...(options.freezeReason ? { freezeReason: options.freezeReason } : {}),
    warnings,
    models,
  };
}
