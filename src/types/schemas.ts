import { z } from "zod";

/** Confidence levels for material facts. Only official-verified and multi-source-verified block CI by default. */
export const ConfidenceSchema = z.enum([
  "official-verified",
  "multi-source-verified",
  "single-source",
  "conflicting",
  "stale",
  "unavailable",
]);
export type Confidence = z.infer<typeof ConfidenceSchema>;

export const BLOCKING_CONFIDENCES: readonly Confidence[] = [
  "official-verified",
  "multi-source-verified",
] as const;

export const LifecycleStatusSchema = z.enum(["active", "deprecated", "retired", "unknown"]);
export type LifecycleStatus = z.infer<typeof LifecycleStatusSchema>;

export const ProviderIdSchema = z.enum(["openai", "anthropic", "google", "xai", "unknown"]);
export type ProviderId = z.infer<typeof ProviderIdSchema>;

export const FactCandidateSchema = z.object({
  value: z.unknown(),
  sourceId: z.string().min(1),
  sourceUrl: z.string().url().or(z.string().startsWith("file:")),
  fetchedAt: z.string().datetime(),
  sourceDigest: z.string().min(1),
  parserVersion: z.string().min(1),
  effectiveAt: z.string().datetime().optional(),
});
export type FactCandidate = z.infer<typeof FactCandidateSchema>;

export function FactEnvelopeSchema<T extends z.ZodTypeAny>(valueSchema: T) {
  return z.object({
    value: valueSchema.nullable(),
    sourceId: z.string().min(1),
    sourceUrl: z.string().min(1),
    fetchedAt: z.string().datetime(),
    sourceDigest: z.string().min(1),
    parserVersion: z.string().min(1),
    confidence: ConfidenceSchema,
    effectiveAt: z.string().datetime().optional(),
    candidates: z.array(FactCandidateSchema).optional(),
  });
}

export const StringFactSchema = FactEnvelopeSchema(z.string());
export const NumberFactSchema = FactEnvelopeSchema(z.number());
export const BooleanFactSchema = FactEnvelopeSchema(z.boolean());
export const LifecycleFactSchema = FactEnvelopeSchema(LifecycleStatusSchema);

export type FactEnvelope<T> = {
  value: T | null;
  sourceId: string;
  sourceUrl: string;
  fetchedAt: string;
  sourceDigest: string;
  parserVersion: string;
  confidence: Confidence;
  effectiveAt?: string;
  candidates?: FactCandidate[];
};

export const ModelIdentifierKindSchema = z.enum(["floating", "fixed"]);
export type ModelIdentifierKind = z.infer<typeof ModelIdentifierKindSchema>;

export const NormalizedModelFactsSchema = z.object({
  provider: StringFactSchema,
  requestedModelId: StringFactSchema,
  identifierKind: FactEnvelopeSchema(ModelIdentifierKindSchema),
  lifecycleStatus: LifecycleFactSchema,
  retirementDate: StringFactSchema,
  inputPricePerMillion: NumberFactSchema,
  outputPricePerMillion: NumberFactSchema,
  contextLimit: NumberFactSchema,
  maxOutputLimit: NumberFactSchema,
  toolCalling: BooleanFactSchema,
  structuredOutput: BooleanFactSchema,
  vision: BooleanFactSchema,
});
export type NormalizedModelFacts = z.infer<typeof NormalizedModelFactsSchema>;

export const EvidenceRefSchema = z.object({
  sourceId: z.string(),
  sourceUrl: z.string(),
  fetchedAt: z.string().datetime(),
  sourceDigest: z.string(),
  parserVersion: z.string(),
  contentDigest: z.string(),
});
export type EvidenceRef = z.infer<typeof EvidenceRefSchema>;

export const NormalizedModelRecordSchema = z.object({
  key: z.string().min(1),
  provider: ProviderIdSchema,
  modelId: z.string().min(1),
  facts: NormalizedModelFactsSchema,
  evidence: z.array(EvidenceRefSchema),
});
export type NormalizedModelRecord = z.infer<typeof NormalizedModelRecordSchema>;

export const RegistrySnapshotSchema = z.object({
  schemaVersion: z.literal(1),
  generatedAt: z.string().datetime(),
  generatorVersion: z.string(),
  frozen: z.boolean().default(false),
  freezeReason: z.string().optional(),
  warnings: z.array(z.string()).default([]),
  models: z.array(NormalizedModelRecordSchema),
});
export type RegistrySnapshot = z.infer<typeof RegistrySnapshotSchema>;

export const DiscoveryOccurrenceSchema = z.object({
  path: z.string(),
  line: z.number().int().positive(),
  column: z.number().int().nonnegative().optional(),
  snippet: z.string().max(200).optional(),
  confidence: z.number().min(0).max(1),
  kind: z.enum(["sdk", "config", "env", "literal", "override"]),
});
export type DiscoveryOccurrence = z.infer<typeof DiscoveryOccurrenceSchema>;

export const DetectedDependencySchema = z.object({
  provider: ProviderIdSchema,
  modelId: z.string().min(1),
  identifierKind: ModelIdentifierKindSchema,
  confidence: z.number().min(0).max(1),
  occurrences: z.array(DiscoveryOccurrenceSchema).min(1),
  lowConfidence: z.boolean().default(false),
});
export type DetectedDependency = z.infer<typeof DetectedDependencySchema>;

export const LockDependencySchema = z.object({
  key: z.string(),
  provider: ProviderIdSchema,
  modelId: z.string(),
  identifierKind: ModelIdentifierKindSchema,
  discovery: z.object({
    confidence: z.number().min(0).max(1),
    lowConfidence: z.boolean(),
    occurrences: z.array(DiscoveryOccurrenceSchema),
  }),
  facts: NormalizedModelFactsSchema,
  evidence: z.array(EvidenceRefSchema),
});
export type LockDependency = z.infer<typeof LockDependencySchema>;

export const LockfileSchema = z.object({
  lockfileVersion: z.literal(1),
  generatedAt: z.string().datetime(),
  generatorVersion: z.string(),
  configDigest: z.string(),
  registryDigest: z.string(),
  dependencies: z.array(LockDependencySchema),
});
export type Lockfile = z.infer<typeof LockfileSchema>;

export const StaleSourceBehaviorSchema = z.enum(["warn", "fail", "ignore"]);
export type StaleSourceBehavior = z.infer<typeof StaleSourceBehaviorSchema>;

export const FloatingAliasPolicySchema = z.enum(["deny", "warn", "allow"]);
export type FloatingAliasPolicy = z.infer<typeof FloatingAliasPolicySchema>;

export const ConfigSchema = z.object({
  version: z.literal(1).default(1),
  include: z.array(z.string()).default([]),
  exclude: z.array(z.string()).default([]),
  pins: z
    .array(
      z.object({
        provider: ProviderIdSchema,
        modelId: z.string().min(1),
      }),
    )
    .default([]),
  scan: z
    .object({
      roots: z.array(z.string()).default(["."]),
      ignore: z
        .array(z.string())
        .default([
          "**/node_modules/**",
          "**/.git/**",
          "**/dist/**",
          "**/build/**",
          "**/.venv/**",
          "**/venv/**",
          "**/__pycache__/**",
          "**/coverage/**",
          "**/*.min.js",
          "**/*.min.css",
        ]),
    })
    .default({}),
  policy: z
    .object({
      floatingAliases: FloatingAliasPolicySchema.default("warn"),
      retirementWindowDays: z.number().int().nonnegative().default(90),
      maxInputPriceIncreasePercent: z.number().nonnegative().default(10),
      maxOutputPriceIncreasePercent: z.number().nonnegative().default(10),
      failOnContextDecrease: z.boolean().default(true),
      failOnMaxOutputDecrease: z.boolean().default(true),
      failOnToolCallingRemoval: z.boolean().default(true),
      failOnStructuredOutputRemoval: z.boolean().default(true),
      failOnVisionRemoval: z.boolean().default(true),
      staleSourceBehavior: StaleSourceBehaviorSchema.default("warn"),
      minBlockingConfidence: ConfidenceSchema.default("multi-source-verified"),
    })
    .default({}),
  sources: z
    .object({
      allowNetwork: z.boolean().default(false),
      staleAfterDays: z.number().int().positive().default(14),
      timeoutMs: z.number().int().positive().default(10_000),
      maxBytes: z
        .number()
        .int()
        .positive()
        .default(8 * 1024 * 1024),
    })
    .default({}),
});
export type Config = z.infer<typeof ConfigSchema>;

export const ExitCode = {
  Success: 0,
  PolicyFailure: 1,
  UsageError: 2,
  ValidationError: 3,
  InternalError: 4,
} as const;
export type ExitCodeValue = (typeof ExitCode)[keyof typeof ExitCode];

export const FindingSeveritySchema = z.enum(["pass", "warn", "fail"]);
export type FindingSeverity = z.infer<typeof FindingSeveritySchema>;

export const DiffKindSchema = z.enum([
  "added",
  "removed",
  "changed",
  "unchanged",
  "unknown",
  "conflicting",
]);
export type DiffKind = z.infer<typeof DiffKindSchema>;

export const FieldDiffSchema = z.object({
  field: z.string(),
  kind: DiffKindSchema,
  approved: z.unknown().optional(),
  current: z.unknown().optional(),
  confidence: ConfidenceSchema.optional(),
  blockingEligible: z.boolean(),
});
export type FieldDiff = z.infer<typeof FieldDiffSchema>;

export const PolicyFindingSchema = z.object({
  key: z.string(),
  field: z.string(),
  severity: FindingSeveritySchema,
  code: z.string(),
  message: z.string(),
  path: z.string().optional(),
  line: z.number().int().positive().optional(),
  confidence: ConfidenceSchema.optional(),
});
export type PolicyFinding = z.infer<typeof PolicyFindingSchema>;
