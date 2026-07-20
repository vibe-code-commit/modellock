import { sha256, nowIso } from "../util/canonical.js";
import { PARSER_VERSION, SOURCE_IDS } from "../types/constants.js";
import { limitedFetch, parseJsonBody, NetworkError } from "../network/fetch.js";
import {
  type SourceAdapter,
  type SourceModelFactSet,
  type SourceResult,
  normalizeProvider,
} from "./types.js";
import { omitUndefined } from "../util/omit-undefined.js";

const DEFAULT_URL = "https://deprecations.info/v1/feed.json";
export const DEPRECATIONS_PARSER_VERSION = `${PARSER_VERSION}+deprecations.1`;

interface DeprecationExt {
  provider?: string;
  model_id?: string;
  shutdown_date?: string;
  deprecation_date?: string;
  status?: string;
}

interface FeedItem {
  title?: string;
  url?: string;
  date_published?: string;
  _deprecation?: DeprecationExt;
}

interface Feed {
  items?: FeedItem[];
}

function mapStatus(item: FeedItem): SourceModelFactSet["lifecycleStatus"] {
  const status = item._deprecation?.status?.toLowerCase();
  const shutdown = item._deprecation?.shutdown_date;
  if (status === "shutdown" || status === "retired") return "retired";
  if (status === "deprecated" || shutdown) return "deprecated";
  if (shutdown) {
    const d = Date.parse(shutdown);
    if (!Number.isNaN(d) && d <= Date.now()) return "retired";
  }
  return "deprecated";
}

function extractModels(data: unknown): SourceModelFactSet[] {
  const out: SourceModelFactSet[] = [];
  if (!data || typeof data !== "object") return out;
  const feed = data as Feed;
  for (const item of feed.items ?? []) {
    const dep = item._deprecation;
    if (!dep?.model_id) continue;
    const provider = normalizeProvider(dep.provider ?? "unknown");
    out.push({
      provider,
      modelId: dep.model_id,
      lifecycleStatus: mapStatus(item),
      retirementDate: dep.shutdown_date ?? dep.deprecation_date ?? null,
      inputPricePerMillion: null,
      outputPricePerMillion: null,
      contextLimit: null,
      maxOutputLimit: null,
      toolCalling: null,
      structuredOutput: null,
      vision: null,
      identifierKind: null,
    });
  }
  return out;
}

export const deprecationsInfoAdapter: SourceAdapter = async (ctx): Promise<SourceResult> => {
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
        sourceId: SOURCE_IDS.deprecationsInfo,
        sourceUrl: url,
        fetchedAt,
        sourceDigest: digest,
        parserVersion: DEPRECATIONS_PARSER_VERSION,
        ok: true,
      },
      models,
    };
  } catch (err) {
    const warning =
      err instanceof NetworkError
        ? `deprecations.info fetch failed (${err.code}): ${err.message}`
        : `deprecations.info fetch failed: ${err instanceof Error ? err.message : String(err)}`;
    return {
      meta: {
        sourceId: SOURCE_IDS.deprecationsInfo,
        sourceUrl: url,
        fetchedAt,
        sourceDigest: sha256(""),
        parserVersion: DEPRECATIONS_PARSER_VERSION,
        ok: false,
        warning,
      },
      models: [],
    };
  }
};

export const _internal = { extractModels, mapStatus };
