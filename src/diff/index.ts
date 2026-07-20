import type {
  Confidence,
  FieldDiff,
  LockDependency,
  Lockfile,
  NormalizedModelRecord,
  RegistrySnapshot,
} from "../types/schemas.js";
import { BLOCKING_CONFIDENCES } from "../types/schemas.js";

const FACT_FIELDS = [
  "provider",
  "requestedModelId",
  "identifierKind",
  "lifecycleStatus",
  "retirementDate",
  "inputPricePerMillion",
  "outputPricePerMillion",
  "contextLimit",
  "maxOutputLimit",
  "toolCalling",
  "structuredOutput",
  "vision",
] as const;

export type FactField = (typeof FACT_FIELDS)[number];

export interface ModelDiff {
  key: string;
  kind: "added" | "removed" | "changed" | "unchanged";
  fields: FieldDiff[];
}

function factValue(
  dep: LockDependency | NormalizedModelRecord | undefined,
  field: FactField,
): { value: unknown; confidence: Confidence } | undefined {
  if (!dep) return undefined;
  const facts = "facts" in dep ? dep.facts : undefined;
  if (!facts) return undefined;
  const f = facts[field];
  return { value: f.value, confidence: f.confidence };
}

function isBlockingEligible(confidence: Confidence | undefined): boolean {
  if (!confidence) return false;
  return (BLOCKING_CONFIDENCES as readonly string[]).includes(confidence);
}

/**
 * Deterministic field-level differences between approved lockfile and current registry.
 */
export function diffLockfileToRegistry(
  lockfile: Lockfile,
  registry: RegistrySnapshot,
): ModelDiff[] {
  const regMap = new Map(registry.models.map((m) => [m.key, m]));
  const lockMap = new Map(lockfile.dependencies.map((d) => [d.key, d]));
  const keys = new Set([...regMap.keys(), ...lockMap.keys()]);
  const diffs: ModelDiff[] = [];

  for (const key of [...keys].sort()) {
    const approved = lockMap.get(key);
    const current = regMap.get(key);

    if (approved && !current) {
      // Model missing from registry: treat facts as unavailable, not as removal of dependency
      const fields: FieldDiff[] = FACT_FIELDS.map((field) => ({
        field,
        kind: "unknown" as const,
        approved: approved.facts[field].value,
        current: null,
        confidence: "unavailable" as const,
        blockingEligible: false,
      }));
      diffs.push({ key, kind: "changed", fields });
      continue;
    }

    if (!approved && current) {
      // Not in lockfile: only relevant if discovering new deps; for check, skip unless in lock
      continue;
    }

    if (!approved || !current) continue;

    const fields: FieldDiff[] = [];
    let anyChange = false;

    for (const field of FACT_FIELDS) {
      const a = factValue(approved, field)!;
      const c = factValue(current, field)!;

      if (c.confidence === "conflicting") {
        fields.push({
          field,
          kind: "conflicting",
          approved: a.value,
          current: null,
          confidence: "conflicting",
          blockingEligible: false,
        });
        anyChange = true;
        continue;
      }

      if (a.value === c.value || (a.value === null && c.value === null)) {
        fields.push({
          field,
          kind: "unchanged",
          approved: a.value,
          current: c.value,
          confidence: c.confidence,
          blockingEligible: isBlockingEligible(c.confidence),
        });
        continue;
      }

      // Numeric equality
      if (
        typeof a.value === "number" &&
        typeof c.value === "number" &&
        Math.abs(a.value - c.value) < 1e-9
      ) {
        fields.push({
          field,
          kind: "unchanged",
          approved: a.value,
          current: c.value,
          confidence: c.confidence,
          blockingEligible: isBlockingEligible(c.confidence),
        });
        continue;
      }

      anyChange = true;
      fields.push({
        field,
        kind: "changed",
        approved: a.value,
        current: c.value,
        confidence: c.confidence,
        blockingEligible: isBlockingEligible(c.confidence),
      });
    }

    diffs.push({
      key,
      kind: anyChange ? "changed" : "unchanged",
      fields,
    });
  }

  return diffs.sort((a, b) => a.key.localeCompare(b.key));
}

export { FACT_FIELDS };
