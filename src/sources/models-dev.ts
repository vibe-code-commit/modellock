import { sha256, nowIso } from "../util/canonical.js";
import { PARSER_VERSION, SOURCE_IDS } from "../types/constants.js";
import { limitedFetch, parseJsonBody, NetworkError } from "../network/fetch.js";
import {
  type SourceAdapter,
  type SourceModelFactSet,
  type SourceResult,
  normalizeProvider,
} from "./types.js";
import { isFixedModelId } from "../util/canonical.js";
import { FLOATING_ALIASES } from "../types/constants.js";
import { omitUndefined } from "../util/omit-undefined.js";

const DEFAULT_URL = "https://models.dev/api.json";
export const MODELS_DEV_PARSER_VERSION = `${PARSER_VERSION}+models-dev.1`;

interface ModelsDevModel {
  id?: string;
  name?: string;
  status?: string;
  attachment?: boolean;
  tool_call?: boolean;
  structured_output?: boolean;
  cost?: { input?: number; output?: number };
  limit?: { context?: number; output?: number };
  modalities?: { input?: string[] };
}

interface ModelsDevProvider {
  id?: string;
  name?: string;
  models?: Record<string, ModelsDevModel> | ModelsDevModel[];
}

function mapLifecycle(status: string | undefined): SourceModelFactSet["lifecycleStatus"] {
  if (!status) return "unknown";
  const s = status.toLowerCase();
  if (s === "deprecated") return "deprecated";
  if (s === "retired" || s === "shutdown") return "retired";
  if (s === "alpha" || s === "beta" || s === "active") return "active";
  return "unknown";
}

function identifierKindFor(modelId: string): "floating" | "fixed" {
  if (isFixedModelId(modelId)) return "fixed";
  if (FLOATING_ALIASES.has(modelId) || modelId.endsWith("-latest") || modelId === "latest") {
    return "floating";
  }
  return isFixedModelId(modelId) ? "fixed" : "floating";
}

function extractModels(data: unknown): SourceModelFactSet[] {
  const out: SourceModelFactSet[] = [];

  // api.json is typically { [providerId]: { id, models: { [modelId]: {...} } } }
  if (!data || typeof data !== "object") return out;

  const root = data as Record<string, unknown>;

  for (const [providerKey, providerVal] of Object.entries(root)) {
    if (!providerVal || typeof providerVal !== "object") continue;
    const provider = providerVal as ModelsDevProvider;
    const providerId = normalizeProvider(provider.id ?? provider.name ?? providerKey);

    const models = provider.models;
    if (!models) continue;

    const entries: Array<[string, ModelsDevModel]> = Array.isArray(models)
      ? models.map((m, i) => [m.id ?? m.name ?? String(i), m])
      : Object.entries(models);

    for (const [modelKey, model] of entries) {
      const modelId = model.id ?? modelKey;
      if (!modelId || typeof modelId !== "string") continue;

      const hasImageModality =
        Array.isArray(model.modalities?.input) &&
        model.modalities.input.some((m) => m === "image" || m === "vision");
      const vision: boolean | null = Array.isArray(model.modalities?.input)
        ? hasImageModality || model.attachment === true
        : model.attachment === true
          ? true
          : model.attachment === false
            ? false
            : null;

      out.push({
        provider: providerId,
        modelId,
        lifecycleStatus: mapLifecycle(model.status),
        retirementDate: null,
        inputPricePerMillion: model.cost?.input ?? null,
        outputPricePerMillion: model.cost?.output ?? null,
        contextLimit: model.limit?.context ?? null,
        maxOutputLimit: model.limit?.output ?? null,
        toolCalling: model.tool_call ?? null,
        structuredOutput: model.structured_output ?? null,
        vision,
        identifierKind: identifierKindFor(modelId),
      });
    }
  }

  return out;
}

export const modelsDevAdapter: SourceAdapter = async (ctx): Promise<SourceResult> => {
  const url = DEFAULT_URL;
  const fetchedAt = nowIso();

  try {
    let body: string;
    if (ctx.fixtureBody !== undefined) {
      body = ctx.fixtureBody;
    } else {
      const res = await limitedFetch(
        omitUndefined({
          url,
          timeoutMs: ctx.timeoutMs,
          maxBytes: ctx.maxBytes,
          fetchImpl: ctx.fetchImpl,
        }),
      );
      body = res.body;
    }

    const digest = sha256(body);
    const data = parseJsonBody(body, url);
    const models = extractModels(data);

    return {
      meta: {
        sourceId: SOURCE_IDS.modelsDev,
        sourceUrl: url,
        fetchedAt,
        sourceDigest: digest,
        parserVersion: MODELS_DEV_PARSER_VERSION,
        ok: true,
      },
      models,
    };
  } catch (err) {
    const warning =
      err instanceof NetworkError
        ? `models.dev fetch failed (${err.code}): ${err.message}`
        : `models.dev fetch failed: ${err instanceof Error ? err.message : String(err)}`;
    return {
      meta: {
        sourceId: SOURCE_IDS.modelsDev,
        sourceUrl: url,
        fetchedAt,
        sourceDigest: sha256(""),
        parserVersion: MODELS_DEV_PARSER_VERSION,
        ok: false,
        warning,
      },
      models: [],
    };
  }
};

/** Exported for unit tests. */
export const _internal = { extractModels, mapLifecycle, identifierKindFor };
