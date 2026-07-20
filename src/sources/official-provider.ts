import { readFileSync, existsSync } from "node:fs";
import { join } from "node:path";
import { sha256, nowIso } from "../util/canonical.js";
import { PARSER_VERSION, SOURCE_IDS } from "../types/constants.js";
import {
  type SourceAdapter,
  type SourceModelFactSet,
  type SourceResult,
  normalizeProvider,
} from "./types.js";
import { z } from "zod";

export const OFFICIAL_PARSER_VERSION = `${PARSER_VERSION}+official.1`;

const OfficialModelSchema = z.object({
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
  evidenceUrl: z.string().url().optional(),
});

const OfficialPackSchema = z.object({
  schemaVersion: z.literal(1),
  updatedAt: z.string(),
  models: z.array(OfficialModelSchema),
});

/**
 * Official-provider evidence adapter.
 * Reads curated structured packs under data/official/ (no paid APIs, no browser automation).
 * When network is available and fixtureBody is a pack JSON string, that is used instead.
 */
export const officialProviderAdapter: SourceAdapter = async (ctx): Promise<SourceResult> => {
  const fetchedAt = nowIso();
  const sourceUrl = "file:data/official/providers.json";

  try {
    let body: string;
    if (ctx.fixtureBody !== undefined) {
      body = ctx.fixtureBody;
    } else {
      const dataDir = ctx.dataDir;
      if (!dataDir) {
        throw new Error("dataDir required for official-provider adapter");
      }
      const path = join(dataDir, "official", "providers.json");
      if (!existsSync(path)) {
        throw new Error(`Official evidence pack missing: ${path}`);
      }
      body = readFileSync(path, "utf8");
    }

    const digest = sha256(body);
    const parsed = OfficialPackSchema.parse(JSON.parse(body));
    const models: SourceModelFactSet[] = parsed.models.map((m) => ({
      provider: normalizeProvider(m.provider),
      modelId: m.modelId,
      lifecycleStatus: m.lifecycleStatus ?? null,
      retirementDate: m.retirementDate ?? null,
      inputPricePerMillion: m.inputPricePerMillion ?? null,
      outputPricePerMillion: m.outputPricePerMillion ?? null,
      contextLimit: m.contextLimit ?? null,
      maxOutputLimit: m.maxOutputLimit ?? null,
      toolCalling: m.toolCalling ?? null,
      structuredOutput: m.structuredOutput ?? null,
      vision: m.vision ?? null,
      identifierKind: m.identifierKind ?? null,
    }));

    return {
      meta: {
        sourceId: SOURCE_IDS.officialProvider,
        sourceUrl,
        fetchedAt,
        sourceDigest: digest,
        parserVersion: OFFICIAL_PARSER_VERSION,
        ok: true,
      },
      models,
    };
  } catch (err) {
    return {
      meta: {
        sourceId: SOURCE_IDS.officialProvider,
        sourceUrl,
        fetchedAt,
        sourceDigest: sha256(""),
        parserVersion: OFFICIAL_PARSER_VERSION,
        ok: false,
        warning: `official-provider failed: ${err instanceof Error ? err.message : String(err)}`,
      },
      models: [],
    };
  }
};
