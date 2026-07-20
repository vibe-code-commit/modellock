import { z } from "zod";
import type { Confidence, FactEnvelope, ProviderId } from "../types/schemas.js";

export const SourceModelFactSetSchema = z.object({
  provider: z.string(),
  modelId: z.string(),
  lifecycleStatus: z.enum(["active", "deprecated", "retired", "unknown"]).nullable().optional(),
  retirementDate: z.string().nullable().optional(),
  inputPricePerMillion: z.number().nullable().optional(),
  outputPricePerMillion: z.number().nullable().optional(),
  contextLimit: z.number().nullable().optional(),
  maxOutputLimit: z.number().nullable().optional(),
  toolCalling: z.boolean().nullable().optional(),
  structuredOutput: z.boolean().nullable().optional(),
  vision: z.boolean().nullable().optional(),
  identifierKind: z.enum(["floating", "fixed"]).nullable().optional(),
});
export type SourceModelFactSet = z.infer<typeof SourceModelFactSetSchema>;

export interface SourceMeta {
  sourceId: string;
  sourceUrl: string;
  fetchedAt: string;
  sourceDigest: string;
  parserVersion: string;
  ok: boolean;
  warning?: string;
}

export interface SourceResult {
  meta: SourceMeta;
  models: SourceModelFactSet[];
}

export type SourceAdapter = (ctx: SourceAdapterContext) => Promise<SourceResult>;

export interface SourceAdapterContext {
  timeoutMs: number;
  maxBytes: number;
  fetchImpl?: ((input: string | URL, init?: RequestInit) => Promise<Response>) | undefined;
  dataDir?: string | undefined;
  fixtureBody?: string | undefined;
}

export type MaterialField =
  | "lifecycleStatus"
  | "retirementDate"
  | "inputPricePerMillion"
  | "outputPricePerMillion"
  | "contextLimit"
  | "maxOutputLimit"
  | "toolCalling"
  | "structuredOutput"
  | "vision"
  | "identifierKind"
  | "provider"
  | "requestedModelId";

export function unavailableFact<T>(
  sourceId: string,
  sourceUrl: string,
  fetchedAt: string,
  sourceDigest: string,
  parserVersion: string,
  confidence: Confidence = "unavailable",
): FactEnvelope<T> {
  return {
    value: null,
    sourceId,
    sourceUrl,
    fetchedAt,
    sourceDigest,
    parserVersion,
    confidence,
  };
}

export function normalizeProvider(raw: string): ProviderId {
  const p = raw.toLowerCase().trim();
  if (p === "openai" || p.includes("openai")) return "openai";
  if (p === "anthropic" || p.includes("anthropic") || p.includes("claude")) return "anthropic";
  if (p === "google" || p.includes("google") || p.includes("gemini") || p.includes("vertex"))
    return "google";
  if (p === "xai" || p.includes("xai") || p.includes("grok")) return "xai";
  return "unknown";
}
