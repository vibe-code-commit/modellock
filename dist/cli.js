#!/usr/bin/env node


// src/cli.ts
import { Command } from "commander";

// src/types/constants.ts
var PACKAGE_VERSION = "0.1.0";
var PARSER_VERSION = "1.0.0";
var CONFIG_FILENAME = ".llm-lock.yml";
var LOCKFILE_FILENAME = "llm.lock.json";
var SOURCE_IDS = {
  modelsDev: "models.dev",
  deprecationsInfo: "deprecations.info",
  officialProvider: "official-provider",
  frozenRegistry: "frozen-registry",
  discovery: "discovery"
};
var FLOATING_ALIASES = /* @__PURE__ */ new Set([
  "gpt-4",
  "gpt-4o",
  "gpt-4.1",
  "gpt-5",
  "gpt-3.5-turbo",
  "o1",
  "o3",
  "o4-mini",
  "claude-3-opus-latest",
  "claude-3-sonnet-latest",
  "claude-3-haiku-latest",
  "claude-sonnet-4-0",
  "claude-opus-4-0",
  "claude-haiku-4-0",
  "gemini-pro",
  "gemini-1.5-pro",
  "gemini-1.5-flash",
  "gemini-2.0-flash",
  "gemini-2.5-pro",
  "gemini-2.5-flash",
  "grok-2",
  "grok-3",
  "grok-4",
  "latest"
]);

// src/types/schemas.ts
import { z } from "zod";
var ConfidenceSchema = z.enum([
  "official-verified",
  "multi-source-verified",
  "single-source",
  "conflicting",
  "stale",
  "unavailable"
]);
var BLOCKING_CONFIDENCES = [
  "official-verified",
  "multi-source-verified"
];
var LifecycleStatusSchema = z.enum(["active", "deprecated", "retired", "unknown"]);
var ProviderIdSchema = z.enum(["openai", "anthropic", "google", "xai", "unknown"]);
var FactCandidateSchema = z.object({
  value: z.unknown(),
  sourceId: z.string().min(1),
  sourceUrl: z.string().url().or(z.string().startsWith("file:")),
  fetchedAt: z.string().datetime(),
  sourceDigest: z.string().min(1),
  parserVersion: z.string().min(1),
  effectiveAt: z.string().datetime().optional()
});
function FactEnvelopeSchema(valueSchema) {
  return z.object({
    value: valueSchema.nullable(),
    sourceId: z.string().min(1),
    sourceUrl: z.string().min(1),
    fetchedAt: z.string().datetime(),
    sourceDigest: z.string().min(1),
    parserVersion: z.string().min(1),
    confidence: ConfidenceSchema,
    effectiveAt: z.string().datetime().optional(),
    candidates: z.array(FactCandidateSchema).optional()
  });
}
var StringFactSchema = FactEnvelopeSchema(z.string());
var NumberFactSchema = FactEnvelopeSchema(z.number());
var BooleanFactSchema = FactEnvelopeSchema(z.boolean());
var LifecycleFactSchema = FactEnvelopeSchema(LifecycleStatusSchema);
var ModelIdentifierKindSchema = z.enum(["floating", "fixed"]);
var NormalizedModelFactsSchema = z.object({
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
  vision: BooleanFactSchema
});
var EvidenceRefSchema = z.object({
  sourceId: z.string(),
  sourceUrl: z.string(),
  fetchedAt: z.string().datetime(),
  sourceDigest: z.string(),
  parserVersion: z.string(),
  contentDigest: z.string()
});
var NormalizedModelRecordSchema = z.object({
  key: z.string().min(1),
  provider: ProviderIdSchema,
  modelId: z.string().min(1),
  facts: NormalizedModelFactsSchema,
  evidence: z.array(EvidenceRefSchema)
});
var RegistrySnapshotSchema = z.object({
  schemaVersion: z.literal(1),
  generatedAt: z.string().datetime(),
  generatorVersion: z.string(),
  frozen: z.boolean().default(false),
  freezeReason: z.string().optional(),
  warnings: z.array(z.string()).default([]),
  models: z.array(NormalizedModelRecordSchema)
});
var DiscoveryOccurrenceSchema = z.object({
  path: z.string(),
  line: z.number().int().positive(),
  column: z.number().int().nonnegative().optional(),
  snippet: z.string().max(200).optional(),
  confidence: z.number().min(0).max(1),
  kind: z.enum(["sdk", "config", "env", "literal", "override"])
});
var DetectedDependencySchema = z.object({
  provider: ProviderIdSchema,
  modelId: z.string().min(1),
  identifierKind: ModelIdentifierKindSchema,
  confidence: z.number().min(0).max(1),
  occurrences: z.array(DiscoveryOccurrenceSchema).min(1),
  lowConfidence: z.boolean().default(false)
});
var LockDependencySchema = z.object({
  key: z.string(),
  provider: ProviderIdSchema,
  modelId: z.string(),
  identifierKind: ModelIdentifierKindSchema,
  discovery: z.object({
    confidence: z.number().min(0).max(1),
    lowConfidence: z.boolean(),
    occurrences: z.array(DiscoveryOccurrenceSchema)
  }),
  facts: NormalizedModelFactsSchema,
  evidence: z.array(EvidenceRefSchema)
});
var LockfileSchema = z.object({
  lockfileVersion: z.literal(1),
  generatedAt: z.string().datetime(),
  generatorVersion: z.string(),
  configDigest: z.string(),
  registryDigest: z.string(),
  dependencies: z.array(LockDependencySchema)
});
var StaleSourceBehaviorSchema = z.enum(["warn", "fail", "ignore"]);
var FloatingAliasPolicySchema = z.enum(["deny", "warn", "allow"]);
var ConfigSchema = z.object({
  version: z.literal(1).default(1),
  include: z.array(z.string()).default([]),
  exclude: z.array(z.string()).default([]),
  pins: z.array(
    z.object({
      provider: ProviderIdSchema,
      modelId: z.string().min(1)
    })
  ).default([]),
  scan: z.object({
    roots: z.array(z.string()).default(["."]),
    ignore: z.array(z.string()).default([
      "**/node_modules/**",
      "**/.git/**",
      "**/dist/**",
      "**/build/**",
      "**/.venv/**",
      "**/venv/**",
      "**/__pycache__/**",
      "**/coverage/**",
      "**/*.min.js",
      "**/*.min.css"
    ])
  }).default({}),
  policy: z.object({
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
    minBlockingConfidence: ConfidenceSchema.default("multi-source-verified")
  }).default({}),
  sources: z.object({
    allowNetwork: z.boolean().default(false),
    staleAfterDays: z.number().int().positive().default(14),
    timeoutMs: z.number().int().positive().default(1e4),
    maxBytes: z.number().int().positive().default(8 * 1024 * 1024)
  }).default({})
});
var ExitCode = {
  Success: 0,
  PolicyFailure: 1,
  UsageError: 2,
  ValidationError: 3,
  InternalError: 4
};
var FindingSeveritySchema = z.enum(["pass", "warn", "fail"]);
var DiffKindSchema = z.enum([
  "added",
  "removed",
  "changed",
  "unchanged",
  "unknown",
  "conflicting"
]);
var FieldDiffSchema = z.object({
  field: z.string(),
  kind: DiffKindSchema,
  approved: z.unknown().optional(),
  current: z.unknown().optional(),
  confidence: ConfidenceSchema.optional(),
  blockingEligible: z.boolean()
});
var PolicyFindingSchema = z.object({
  key: z.string(),
  field: z.string(),
  severity: FindingSeveritySchema,
  code: z.string(),
  message: z.string(),
  path: z.string().optional(),
  line: z.number().int().positive().optional(),
  confidence: ConfidenceSchema.optional()
});

// src/commands.ts
import { mkdirSync as mkdirSync3, writeFileSync as writeFileSync3, existsSync as existsSync5 } from "node:fs";
import { join as join6, dirname as dirname2 } from "node:path";
import { fileURLToPath } from "node:url";

// src/config/load.ts
import { readFileSync, existsSync } from "node:fs";
import { join } from "node:path";
import yaml from "js-yaml";

// src/util/canonical.ts
import { createHash } from "node:crypto";
function canonicalize(value) {
  return JSON.stringify(sortKeys(value), null, 2) + "\n";
}
function sortKeys(value) {
  if (value === null || typeof value !== "object") {
    return value;
  }
  if (Array.isArray(value)) {
    return value.map(sortKeys);
  }
  const obj = value;
  const sorted = {};
  for (const key of Object.keys(obj).sort()) {
    const v = obj[key];
    if (v !== void 0) {
      sorted[key] = sortKeys(v);
    }
  }
  return sorted;
}
function sha256(content) {
  return createHash("sha256").update(content).digest("hex");
}
function digestJson(value) {
  return sha256(canonicalize(value));
}
function modelKey(provider, modelId) {
  return `${provider}:${modelId}`;
}
function parseModelKey(key) {
  const idx = key.indexOf(":");
  if (idx <= 0) {
    throw new Error(`Invalid model key: ${key}`);
  }
  return { provider: key.slice(0, idx), modelId: key.slice(idx + 1) };
}
function isFixedModelId(modelId) {
  if (/\d{4}-\d{2}-\d{2}/.test(modelId)) return true;
  if (/-\d{8}$/.test(modelId)) return true;
  if (/@\d/.test(modelId)) return true;
  if (/-\d{4}$/.test(modelId)) return true;
  return false;
}
var SECRET_PATTERNS = [
  /sk-[A-Za-z0-9_-]{20,}/,
  /sk-ant-[A-Za-z0-9_-]{20,}/,
  /xai-[A-Za-z0-9_-]{20,}/,
  /AIza[A-Za-z0-9_-]{20,}/,
  /Bearer\s+[A-Za-z0-9._~+/=-]{20,}/i,
  /api[_-]?key\s*[:=]\s*['"][^'"]+['"]/i
];
function containsSecret(value) {
  return SECRET_PATTERNS.some((re) => re.test(value));
}
function scrubSecrets(value) {
  if (typeof value === "string") {
    let out = value;
    for (const re of SECRET_PATTERNS) {
      out = out.replace(re, "[REDACTED]");
    }
    return out;
  }
  if (Array.isArray(value)) {
    return value.map(scrubSecrets);
  }
  if (value !== null && typeof value === "object") {
    const out = {};
    for (const [k, v] of Object.entries(value)) {
      if (/secret|password|token|apikey|api_key|authorization/i.test(k)) {
        out[k] = "[REDACTED]";
      } else {
        out[k] = scrubSecrets(v);
      }
    }
    return out;
  }
  return value;
}
function nowIso() {
  return (/* @__PURE__ */ new Date()).toISOString();
}

// src/config/load.ts
function defaultConfig() {
  return ConfigSchema.parse({});
}
function loadConfig(rootDir, explicitPath) {
  const path = explicitPath ?? join(rootDir, CONFIG_FILENAME);
  if (!existsSync(path)) {
    const config2 = defaultConfig();
    return { config: config2, path: null, digest: digestJson(config2) };
  }
  const raw = readFileSync(path, "utf8");
  const parsed = yaml.load(raw);
  const config = ConfigSchema.parse(parsed ?? {});
  return { config, path, digest: digestJson(config) };
}
function configToYaml(config) {
  const doc = {
    version: 1,
    include: config.include,
    exclude: config.exclude,
    pins: config.pins,
    scan: config.scan,
    policy: config.policy,
    sources: config.sources
  };
  return `# ModelLock configuration
# See docs/configuration.md for the full reference.
` + yaml.dump(doc, { lineWidth: 100, noRefs: true, sortKeys: true });
}

// src/discover/index.ts
import { readdirSync, readFileSync as readFileSync2, statSync } from "node:fs";
import { join as join2, relative, extname } from "node:path";
import * as parser from "@babel/parser";
import _traverse from "@babel/traverse";
import yaml2 from "js-yaml";
var traverse = _traverse.default ?? _traverse;
var SKIP_DIR_NAMES = /* @__PURE__ */ new Set([
  "node_modules",
  ".git",
  "dist",
  "build",
  ".venv",
  "venv",
  "__pycache__",
  "coverage",
  ".next",
  ".turbo",
  "vendor",
  ".tox",
  ".mypy_cache"
]);
var CODE_EXTS = /* @__PURE__ */ new Set([".js", ".jsx", ".mjs", ".cjs", ".ts", ".tsx", ".mts", ".cts"]);
var PYTHON_EXTS = /* @__PURE__ */ new Set([".py"]);
var DATA_EXTS = /* @__PURE__ */ new Set([".json", ".yaml", ".yml"]);
var PROVIDER_PACKAGES = {
  openai: "openai",
  "@openai/openai": "openai",
  "@ai-sdk/openai": "openai",
  "@anthropic-ai/sdk": "anthropic",
  "@ai-sdk/anthropic": "anthropic",
  anthropic: "anthropic",
  "@google/generative-ai": "google",
  "@ai-sdk/google": "google",
  "@google/genai": "google",
  "@xai-org/xai": "xai",
  "@ai-sdk/xai": "xai",
  xai: "xai"
};
var ENV_MODEL_KEYS = {
  OPENAI_MODEL: "openai",
  OPENAI_API_MODEL: "openai",
  ANTHROPIC_MODEL: "anthropic",
  CLAUDE_MODEL: "anthropic",
  GOOGLE_MODEL: "google",
  GEMINI_MODEL: "google",
  GOOGLE_GENAI_MODEL: "google",
  XAI_MODEL: "xai",
  GROK_MODEL: "xai"
};
var MODEL_ID_RE = /^(gpt-[a-z0-9.-]+|o[1-9](-[a-z0-9.-]+)?|claude-[a-z0-9.-]+|gemini-[a-z0-9.-]+|grok-[a-z0-9.-]+|text-embedding-[a-z0-9.-]+)$/i;
function looksLikeModelId(value) {
  if (value.length < 3 || value.length > 120) return false;
  if (containsPathOrUrl(value)) return false;
  return MODEL_ID_RE.test(value) || FLOATING_ALIASES.has(value);
}
function containsPathOrUrl(value) {
  return /[\\/]/.test(value) || /^https?:/i.test(value) || value.includes("@") && !value.includes("gpt");
}
function inferProvider(modelId) {
  const m = modelId.toLowerCase();
  if (m.startsWith("gpt-") || m.startsWith("o1") || m.startsWith("o3") || m.startsWith("o4") || m.startsWith("text-embedding"))
    return "openai";
  if (m.startsWith("claude-")) return "anthropic";
  if (m.startsWith("gemini-")) return "google";
  if (m.startsWith("grok-")) return "xai";
  return "unknown";
}
function identifierKind(modelId) {
  if (isFixedModelId(modelId)) return "fixed";
  if (FLOATING_ALIASES.has(modelId) || modelId.endsWith("-latest") || modelId === "latest")
    return "floating";
  return "floating";
}
function shouldSkipDir(name) {
  return SKIP_DIR_NAMES.has(name) || name.startsWith(".");
}
function isMinified(path, content) {
  if (path.includes(".min.")) return true;
  if (content.length > 5e4 && content.split("\n").length < 5) return true;
  return false;
}
function walkFiles(root, ignoreGlobs) {
  const out = [];
  function walk(dir) {
    let entries;
    try {
      entries = readdirSync(dir, { withFileTypes: true });
    } catch {
      return;
    }
    for (const ent of entries) {
      const full = join2(dir, ent.name);
      const rel = relative(root, full).replace(/\\/g, "/");
      if (ent.isDirectory()) {
        if (shouldSkipDir(ent.name)) continue;
        if (ignoreGlobs.some((g) => matchIgnore(rel + "/", g))) continue;
        walk(full);
      } else if (ent.isFile()) {
        if (ignoreGlobs.some((g) => matchIgnore(rel, g))) continue;
        const ext = extname(ent.name).toLowerCase();
        if (CODE_EXTS.has(ext) || PYTHON_EXTS.has(ext) || DATA_EXTS.has(ext) || ent.name === ".env.example" || ent.name.endsWith(".env.example")) {
          out.push(full);
        }
      }
    }
  }
  walk(root);
  return out.sort();
}
function matchIgnore(relPath, pattern) {
  const norm = pattern.replace(/\\/g, "/");
  if (norm.startsWith("**/") && norm.endsWith("/**")) {
    const mid = norm.slice(3, -3);
    return relPath.split("/").includes(mid);
  }
  if (norm.startsWith("**/")) {
    const rest = norm.slice(3);
    if (rest.includes("*")) {
      const re = new RegExp("^" + rest.replace(/\./g, "\\.").replace(/\*/g, ".*") + "$");
      return re.test(relPath.split("/").pop() ?? "") || relPath.endsWith(rest.replace(/\*/g, ""));
    }
    return relPath === rest || relPath.endsWith("/" + rest) || relPath.includes("/" + rest);
  }
  if (norm.includes("*")) {
    const re = new RegExp(
      "^" + norm.replace(/\./g, "\\.").replace(/\*\*/g, ".*").replace(/\*/g, "[^/]*") + "$"
    );
    return re.test(relPath);
  }
  return relPath === norm || relPath.endsWith("/" + norm);
}
function addHit(hits, hit) {
  if (!looksLikeModelId(hit.modelId) && hit.confidence < 0.8) {
    if (!MODEL_ID_RE.test(hit.modelId)) return;
  }
  if (!looksLikeModelId(hit.modelId) && hit.confidence >= 0.8) {
  } else if (!looksLikeModelId(hit.modelId)) {
    return;
  }
  hits.push(hit);
}
function scanJsTs(filePath, rel, content, hits) {
  let ast;
  try {
    ast = parser.parse(content, {
      sourceType: "unambiguous",
      plugins: ["typescript", "jsx", "decorators-legacy"],
      errorRecovery: true
    });
  } catch {
    return;
  }
  const providerImports = /* @__PURE__ */ new Map();
  traverse(ast, {
    ImportDeclaration(path) {
      const node = path.node;
      const src = node.source.value;
      const provider = PROVIDER_PACKAGES[src];
      if (!provider) return;
      for (const spec of node.specifiers) {
        if (spec.local?.name) providerImports.set(spec.local.name, provider);
      }
    },
    CallExpression(path) {
      const call = path.node;
      const callee = call.callee;
      const args = call.arguments;
      for (const arg of args) {
        if (arg?.type === "ObjectExpression") {
          for (const prop of arg.properties) {
            if (prop.type !== "ObjectProperty") continue;
            const key = prop.key.type === "Identifier" ? prop.key.name : prop.key.type === "StringLiteral" ? prop.key.value : null;
            if (key !== "model" && key !== "modelId" && key !== "model_id") continue;
            if (prop.value.type !== "StringLiteral") continue;
            const modelId = prop.value.value;
            let provider = inferProvider(modelId);
            if (callee.type === "MemberExpression") {
              let obj = callee.object;
              while (obj.type === "MemberExpression") obj = obj.object;
              if (obj.type === "Identifier" && providerImports.has(obj.name)) {
                provider = providerImports.get(obj.name);
              }
            }
            const loc = prop.value.loc?.start;
            const occurrence = {
              path: rel,
              line: loc?.line ?? 1,
              snippet: `model: "${modelId}"`,
              confidence: 0.9,
              kind: "sdk"
            };
            if (loc?.column !== void 0) occurrence.column = loc.column;
            addHit(hits, {
              provider,
              modelId,
              confidence: 0.9,
              occurrence
            });
          }
        }
      }
    },
    NewExpression(_path) {
      void _path.node;
    },
    StringLiteral(path) {
      const parent = path.parent;
      if (parent.type === "ObjectProperty") {
        const key = parent.key.type === "Identifier" ? parent.key.name : parent.key.type === "StringLiteral" ? parent.key.value : "";
        if (!/model/i.test(key)) return;
        const modelId = path.node.value;
        if (!looksLikeModelId(modelId)) return;
        const loc = path.node.loc?.start;
        const occurrence = {
          path: rel,
          line: loc?.line ?? 1,
          snippet: `${key}: "${modelId}"`,
          confidence: 0.55,
          kind: "literal"
        };
        if (loc?.column !== void 0) occurrence.column = loc.column;
        addHit(hits, {
          provider: inferProvider(modelId),
          modelId,
          confidence: 0.55,
          occurrence
        });
      }
    }
  });
}
function scanPython(filePath, rel, content, hits) {
  const lines = content.split(/\r?\n/);
  const providerHints = [];
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    if (/from\s+openai|import\s+openai/.test(line)) providerHints.push("openai");
    if (/from\s+anthropic|import\s+anthropic/.test(line)) providerHints.push("anthropic");
    if (/google\.generativeai|from\s+google|import\s+google\.genai/.test(line))
      providerHints.push("google");
    if (/from\s+xai|import\s+xai|openai\.OpenAI\(.*xai/i.test(line)) providerHints.push("xai");
    const patterns = [
      /\bmodel\s*=\s*["']([^"']+)["']/,
      /\bmodel_id\s*=\s*["']([^"']+)["']/,
      /["']model["']\s*:\s*["']([^"']+)["']/,
      /\.messages\.create\([^)]*model\s*=\s*["']([^"']+)["']/,
      /\.chat\.completions\.create\([^)]*model\s*=\s*["']([^"']+)["']/
    ];
    for (const re of patterns) {
      const m = line.match(re);
      if (!m?.[1]) continue;
      const modelId = m[1];
      if (!looksLikeModelId(modelId)) continue;
      const provider = providerHints[providerHints.length - 1] ?? inferProvider(modelId);
      const confidence = /messages\.create|chat\.completions/.test(line) ? 0.9 : 0.7;
      addHit(hits, {
        provider,
        modelId,
        confidence,
        occurrence: {
          path: rel,
          line: i + 1,
          snippet: line.trim().slice(0, 120),
          confidence,
          kind: "sdk"
        }
      });
    }
  }
  void filePath;
}
function scanJsonYaml(rel, content, hits) {
  let data;
  try {
    data = rel.endsWith(".json") ? JSON.parse(content) : yaml2.load(content);
  } catch {
    return;
  }
  function walk(node, pathHint) {
    if (!node || typeof node !== "object") return;
    if (Array.isArray(node)) {
      node.forEach((v, i) => walk(v, `${pathHint}[${i}]`));
      return;
    }
    const obj = node;
    for (const [k, v] of Object.entries(obj)) {
      if (typeof v === "string" && /^(model|model_id|modelId)$/i.test(k) && looksLikeModelId(v)) {
        addHit(hits, {
          provider: inferProvider(v),
          modelId: v,
          confidence: 0.75,
          occurrence: {
            path: rel,
            line: 1,
            snippet: `${k}: ${v}`,
            confidence: 0.75,
            kind: "config"
          }
        });
      }
      walk(v, `${pathHint}.${k}`);
    }
  }
  walk(data, "$");
}
function scanEnvExample(rel, content, hits) {
  const lines = content.split(/\r?\n/);
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)$/);
    if (!m) continue;
    const key = m[1];
    const value = m[2].trim().replace(/^["']|["']$/g, "");
    const provider = ENV_MODEL_KEYS[key];
    if (!provider) continue;
    if (!looksLikeModelId(value)) continue;
    addHit(hits, {
      provider,
      modelId: value,
      confidence: 0.85,
      occurrence: {
        path: rel,
        line: i + 1,
        snippet: `${key}=${value}`,
        confidence: 0.85,
        kind: "env"
      }
    });
  }
}
function consolidate(hits) {
  const map = /* @__PURE__ */ new Map();
  for (const hit of hits) {
    const key = modelKey(hit.provider, hit.modelId);
    const existing = map.get(key);
    if (!existing) {
      const low = hit.confidence < 0.6;
      map.set(key, {
        provider: hit.provider,
        modelId: hit.modelId,
        identifierKind: identifierKind(hit.modelId),
        confidence: hit.confidence,
        lowConfidence: low,
        occurrences: [hit.occurrence]
      });
    } else {
      existing.occurrences.push(hit.occurrence);
      existing.confidence = Math.max(existing.confidence, hit.confidence);
      existing.lowConfidence = existing.confidence < 0.6;
    }
  }
  return [...map.values()].sort(
    (a, b) => modelKey(a.provider, a.modelId).localeCompare(modelKey(b.provider, b.modelId))
  );
}
function discoverDependencies(rootDir, config) {
  const hits = [];
  const roots = config.scan.roots.length ? config.scan.roots : ["."];
  for (const rootRel of roots) {
    const root = join2(rootDir, rootRel);
    let st;
    try {
      st = statSync(root);
    } catch {
      continue;
    }
    if (!st.isDirectory()) continue;
    const files = walkFiles(root, config.scan.ignore);
    for (const file of files) {
      const rel = relative(rootDir, file).replace(/\\/g, "/");
      let content;
      try {
        content = readFileSync2(file, "utf8");
      } catch {
        continue;
      }
      if (isMinified(rel, content)) continue;
      const ext = extname(file).toLowerCase();
      if (CODE_EXTS.has(ext)) scanJsTs(file, rel, content, hits);
      else if (PYTHON_EXTS.has(ext)) scanPython(file, rel, content, hits);
      else if (DATA_EXTS.has(ext)) scanJsonYaml(rel, content, hits);
      else if (rel.endsWith(".env.example") || rel === ".env.example")
        scanEnvExample(rel, content, hits);
    }
  }
  return consolidate(hits);
}

// src/registry/load.ts
import {
  readFileSync as readFileSync4,
  writeFileSync,
  existsSync as existsSync3,
  mkdirSync,
  readdirSync as readdirSync2,
  copyFileSync
} from "node:fs";
import { join as join4 } from "node:path";

// src/network/fetch.ts
var NetworkError = class extends Error {
  code;
  cause;
  constructor(message, code, cause) {
    super(message);
    this.name = "NetworkError";
    this.code = code;
    if (cause !== void 0) {
      this.cause = cause;
    }
  }
};
async function limitedFetch(opts) {
  const fetchImpl = opts.fetchImpl ?? globalThis.fetch;
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), opts.timeoutMs);
  try {
    const res = await fetchImpl(opts.url, {
      method: "GET",
      signal: controller.signal,
      headers: {
        Accept: "application/json, text/plain;q=0.9, */*;q=0.1",
        "User-Agent": "model-lock/0.1.0 (+https://github.com/vibe-code-commit/model-lock)",
        ...opts.headers
      },
      redirect: "follow"
    });
    const contentLength = res.headers.get("content-length");
    if (contentLength && Number(contentLength) > opts.maxBytes) {
      throw new NetworkError(
        `Response Content-Length ${contentLength} exceeds maxBytes ${opts.maxBytes}`,
        "oversized"
      );
    }
    const reader = res.body?.getReader();
    if (!reader) {
      const text = await res.text();
      if (Buffer.byteLength(text, "utf8") > opts.maxBytes) {
        throw new NetworkError(`Response body exceeds maxBytes ${opts.maxBytes}`, "oversized");
      }
      if (!res.ok) {
        throw new NetworkError(`HTTP ${res.status} for ${opts.url}`, "http");
      }
      return { body: text, status: res.status, url: opts.url, bytes: Buffer.byteLength(text) };
    }
    const chunks = [];
    let total = 0;
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      if (value) {
        total += value.byteLength;
        if (total > opts.maxBytes) {
          await reader.cancel();
          throw new NetworkError(`Response body exceeds maxBytes ${opts.maxBytes}`, "oversized");
        }
        chunks.push(value);
      }
    }
    const body = Buffer.concat(chunks.map((c) => Buffer.from(c))).toString("utf8");
    if (!res.ok) {
      throw new NetworkError(`HTTP ${res.status} for ${opts.url}`, "http");
    }
    return { body, status: res.status, url: opts.url, bytes: total };
  } catch (err) {
    if (err instanceof NetworkError) throw err;
    if (err instanceof Error && err.name === "AbortError") {
      throw new NetworkError(
        `Request timed out after ${opts.timeoutMs}ms: ${opts.url}`,
        "timeout",
        err
      );
    }
    throw new NetworkError(
      `Network failure for ${opts.url}: ${err instanceof Error ? err.message : String(err)}`,
      "network",
      err
    );
  } finally {
    clearTimeout(timer);
  }
}
function parseJsonBody(body, url) {
  try {
    return JSON.parse(body);
  } catch (err) {
    throw new NetworkError(
      `Invalid JSON from ${url}: ${err instanceof Error ? err.message : String(err)}`,
      "invalid",
      err
    );
  }
}

// src/sources/types.ts
import { z as z2 } from "zod";
var SourceModelFactSetSchema = z2.object({
  provider: z2.string(),
  modelId: z2.string(),
  lifecycleStatus: z2.enum(["active", "deprecated", "retired", "unknown"]).nullable().optional(),
  retirementDate: z2.string().nullable().optional(),
  inputPricePerMillion: z2.number().nullable().optional(),
  outputPricePerMillion: z2.number().nullable().optional(),
  contextLimit: z2.number().nullable().optional(),
  maxOutputLimit: z2.number().nullable().optional(),
  toolCalling: z2.boolean().nullable().optional(),
  structuredOutput: z2.boolean().nullable().optional(),
  vision: z2.boolean().nullable().optional(),
  identifierKind: z2.enum(["floating", "fixed"]).nullable().optional()
});
function unavailableFact(sourceId, sourceUrl, fetchedAt, sourceDigest, parserVersion, confidence = "unavailable") {
  return {
    value: null,
    sourceId,
    sourceUrl,
    fetchedAt,
    sourceDigest,
    parserVersion,
    confidence
  };
}
function normalizeProvider(raw) {
  const p = raw.toLowerCase().trim();
  if (p === "openai" || p.includes("openai")) return "openai";
  if (p === "anthropic" || p.includes("anthropic") || p.includes("claude")) return "anthropic";
  if (p === "google" || p.includes("google") || p.includes("gemini") || p.includes("vertex"))
    return "google";
  if (p === "xai" || p.includes("xai") || p.includes("grok")) return "xai";
  return "unknown";
}

// src/util/omit-undefined.ts
function omitUndefined(obj) {
  const out = {};
  for (const [k, v] of Object.entries(obj)) {
    if (v !== void 0) out[k] = v;
  }
  return out;
}

// src/sources/models-dev.ts
var DEFAULT_URL = "https://models.dev/api.json";
var MODELS_DEV_PARSER_VERSION = `${PARSER_VERSION}+models-dev.1`;
function mapLifecycle(status) {
  if (!status) return "unknown";
  const s = status.toLowerCase();
  if (s === "deprecated") return "deprecated";
  if (s === "retired" || s === "shutdown") return "retired";
  if (s === "alpha" || s === "beta" || s === "active") return "active";
  return "unknown";
}
function identifierKindFor(modelId) {
  if (isFixedModelId(modelId)) return "fixed";
  if (FLOATING_ALIASES.has(modelId) || modelId.endsWith("-latest") || modelId === "latest") {
    return "floating";
  }
  return isFixedModelId(modelId) ? "fixed" : "floating";
}
function extractModels(data) {
  const out = [];
  if (!data || typeof data !== "object") return out;
  const root = data;
  for (const [providerKey, providerVal] of Object.entries(root)) {
    if (!providerVal || typeof providerVal !== "object") continue;
    const provider = providerVal;
    const providerId = normalizeProvider(provider.id ?? provider.name ?? providerKey);
    const models = provider.models;
    if (!models) continue;
    const entries = Array.isArray(models) ? models.map((m, i) => [m.id ?? m.name ?? String(i), m]) : Object.entries(models);
    for (const [modelKey2, model] of entries) {
      const modelId = model.id ?? modelKey2;
      if (!modelId || typeof modelId !== "string") continue;
      const hasImageModality = Array.isArray(model.modalities?.input) && model.modalities.input.some((m) => m === "image" || m === "vision");
      const vision = Array.isArray(model.modalities?.input) ? hasImageModality || model.attachment === true : model.attachment === true ? true : model.attachment === false ? false : null;
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
        identifierKind: identifierKindFor(modelId)
      });
    }
  }
  return out;
}
var modelsDevAdapter = async (ctx) => {
  const url = DEFAULT_URL;
  const fetchedAt = nowIso();
  try {
    let body;
    if (ctx.fixtureBody !== void 0) {
      body = ctx.fixtureBody;
    } else {
      const res = await limitedFetch(
        omitUndefined({
          url,
          timeoutMs: ctx.timeoutMs,
          maxBytes: ctx.maxBytes,
          fetchImpl: ctx.fetchImpl
        })
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
        ok: true
      },
      models
    };
  } catch (err) {
    const warning = err instanceof NetworkError ? `models.dev fetch failed (${err.code}): ${err.message}` : `models.dev fetch failed: ${err instanceof Error ? err.message : String(err)}`;
    return {
      meta: {
        sourceId: SOURCE_IDS.modelsDev,
        sourceUrl: url,
        fetchedAt,
        sourceDigest: sha256(""),
        parserVersion: MODELS_DEV_PARSER_VERSION,
        ok: false,
        warning
      },
      models: []
    };
  }
};

// src/sources/deprecations-info.ts
var DEFAULT_URL2 = "https://deprecations.info/v1/feed.json";
var DEPRECATIONS_PARSER_VERSION = `${PARSER_VERSION}+deprecations.1`;
function mapStatus(item) {
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
function extractModels2(data) {
  const out = [];
  if (!data || typeof data !== "object") return out;
  const feed = data;
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
      identifierKind: null
    });
  }
  return out;
}
var deprecationsInfoAdapter = async (ctx) => {
  const url = DEFAULT_URL2;
  const fetchedAt = nowIso();
  try {
    let body;
    if (ctx.fixtureBody !== void 0) {
      body = ctx.fixtureBody;
    } else {
      const res = await limitedFetch(
        omitUndefined({
          url,
          timeoutMs: ctx.timeoutMs,
          maxBytes: ctx.maxBytes,
          fetchImpl: ctx.fetchImpl
        })
      );
      body = res.body;
    }
    const digest = sha256(body);
    const data = parseJsonBody(body, url);
    const models = extractModels2(data);
    return {
      meta: {
        sourceId: SOURCE_IDS.deprecationsInfo,
        sourceUrl: url,
        fetchedAt,
        sourceDigest: digest,
        parserVersion: DEPRECATIONS_PARSER_VERSION,
        ok: true
      },
      models
    };
  } catch (err) {
    const warning = err instanceof NetworkError ? `deprecations.info fetch failed (${err.code}): ${err.message}` : `deprecations.info fetch failed: ${err instanceof Error ? err.message : String(err)}`;
    return {
      meta: {
        sourceId: SOURCE_IDS.deprecationsInfo,
        sourceUrl: url,
        fetchedAt,
        sourceDigest: sha256(""),
        parserVersion: DEPRECATIONS_PARSER_VERSION,
        ok: false,
        warning
      },
      models: []
    };
  }
};

// src/sources/official-provider.ts
import { readFileSync as readFileSync3, existsSync as existsSync2 } from "node:fs";
import { join as join3 } from "node:path";
import { z as z3 } from "zod";
var OFFICIAL_PARSER_VERSION = `${PARSER_VERSION}+official.1`;
var OfficialModelSchema = z3.object({
  provider: z3.string(),
  modelId: z3.string(),
  lifecycleStatus: z3.enum(["active", "deprecated", "retired", "unknown"]).nullable().optional(),
  retirementDate: z3.string().nullable().optional(),
  inputPricePerMillion: z3.number().nullable().optional(),
  outputPricePerMillion: z3.number().nullable().optional(),
  contextLimit: z3.number().nullable().optional(),
  maxOutputLimit: z3.number().nullable().optional(),
  toolCalling: z3.boolean().nullable().optional(),
  structuredOutput: z3.boolean().nullable().optional(),
  vision: z3.boolean().nullable().optional(),
  identifierKind: z3.enum(["floating", "fixed"]).nullable().optional(),
  evidenceUrl: z3.string().url().optional()
});
var OfficialPackSchema = z3.object({
  schemaVersion: z3.literal(1),
  updatedAt: z3.string(),
  models: z3.array(OfficialModelSchema)
});
var officialProviderAdapter = async (ctx) => {
  const fetchedAt = nowIso();
  const sourceUrl = "file:data/official/providers.json";
  try {
    let body;
    if (ctx.fixtureBody !== void 0) {
      body = ctx.fixtureBody;
    } else {
      const dataDir = ctx.dataDir;
      if (!dataDir) {
        throw new Error("dataDir required for official-provider adapter");
      }
      const path = join3(dataDir, "official", "providers.json");
      if (!existsSync2(path)) {
        throw new Error(`Official evidence pack missing: ${path}`);
      }
      body = readFileSync3(path, "utf8");
    }
    const digest = sha256(body);
    const parsed = OfficialPackSchema.parse(JSON.parse(body));
    const models = parsed.models.map((m) => ({
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
      identifierKind: m.identifierKind ?? null
    }));
    return {
      meta: {
        sourceId: SOURCE_IDS.officialProvider,
        sourceUrl,
        fetchedAt,
        sourceDigest: digest,
        parserVersion: OFFICIAL_PARSER_VERSION,
        ok: true
      },
      models
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
        warning: `official-provider failed: ${err instanceof Error ? err.message : String(err)}`
      },
      models: []
    };
  }
};

// src/sources/merge.ts
var MATERIAL_FIELDS = [
  "lifecycleStatus",
  "retirementDate",
  "inputPricePerMillion",
  "outputPricePerMillion",
  "contextLimit",
  "maxOutputLimit",
  "toolCalling",
  "structuredOutput",
  "vision",
  "identifierKind"
];
function valuesEqual(a, b) {
  if (a === b) return true;
  if (typeof a === "number" && typeof b === "number") {
    return Math.abs(a - b) < 1e-9;
  }
  return JSON.stringify(a) === JSON.stringify(b);
}
function classifyConfidence(observations, staleAfterDays, now) {
  const present = observations.filter((o) => o.value !== null && o.value !== void 0);
  if (present.length === 0) {
    return {
      confidence: "unavailable",
      value: null,
      primary: observations[0] ?? null
    };
  }
  const staleCutoff = now.getTime() - staleAfterDays * 24 * 60 * 60 * 1e3;
  const fresh = present.filter((o) => Date.parse(o.fetchedAt) >= staleCutoff);
  const pool = fresh.length > 0 ? fresh : present;
  const allStale = fresh.length === 0;
  const unique = [];
  for (const obs of pool) {
    if (!unique.some((u) => valuesEqual(u.value, obs.value))) {
      unique.push(obs);
    }
  }
  if (unique.length > 1) {
    return { confidence: "conflicting", value: null, primary: unique[0] };
  }
  const agreed = unique[0];
  if (allStale) {
    return { confidence: "stale", value: agreed.value, primary: agreed };
  }
  const hasOfficial = pool.some((o) => o.sourceId === SOURCE_IDS.officialProvider);
  const distinctSources = new Set(pool.map((o) => o.sourceId));
  if (hasOfficial && distinctSources.size >= 1) {
    const officialObs = pool.filter((o) => o.sourceId === SOURCE_IDS.officialProvider);
    const othersAgree = pool.filter((o) => o.sourceId !== SOURCE_IDS.officialProvider).every((o) => valuesEqual(o.value, agreed.value));
    if (officialObs.length > 0 && (distinctSources.size === 1 || othersAgree)) {
      return { confidence: "official-verified", value: agreed.value, primary: agreed };
    }
  }
  if (distinctSources.size >= 2) {
    return { confidence: "multi-source-verified", value: agreed.value, primary: agreed };
  }
  return { confidence: "single-source", value: agreed.value, primary: agreed };
}
function buildEnvelope(field, bySource, staleAfterDays, now) {
  const observations = [];
  for (const [, { model, meta }] of bySource) {
    const raw = model[field];
    observations.push({
      value: raw === void 0 ? null : raw,
      sourceId: meta.sourceId,
      sourceUrl: meta.sourceUrl,
      fetchedAt: meta.fetchedAt,
      sourceDigest: meta.sourceDigest,
      parserVersion: meta.parserVersion
    });
  }
  const { confidence, value, primary } = classifyConfidence(observations, staleAfterDays, now);
  const candidates = confidence === "conflicting" ? observations.filter((o) => o.value !== null && o.value !== void 0).map((o) => ({
    value: o.value,
    sourceId: o.sourceId,
    sourceUrl: o.sourceUrl,
    fetchedAt: o.fetchedAt,
    sourceDigest: o.sourceDigest,
    parserVersion: o.parserVersion
  })) : void 0;
  const base = primary ?? observations[0];
  return {
    value: value ?? null,
    sourceId: base?.sourceId ?? SOURCE_IDS.frozenRegistry,
    sourceUrl: base?.sourceUrl ?? "file:unavailable",
    fetchedAt: base?.fetchedAt ?? nowIso(),
    sourceDigest: base?.sourceDigest ?? sha256(""),
    parserVersion: base?.parserVersion ?? "0",
    confidence,
    ...candidates ? { candidates } : {}
  };
}
function groupKey(provider, modelId) {
  return modelKey(normalizeProvider(provider), modelId);
}
function mergeSourceResults(results, options = {}) {
  const staleAfterDays = options.staleAfterDays ?? 14;
  const now = /* @__PURE__ */ new Date();
  const warnings = [];
  for (const r of results) {
    if (!r.meta.ok && r.meta.warning) {
      warnings.push(r.meta.warning);
    }
  }
  const grouped = /* @__PURE__ */ new Map();
  for (const result of results) {
    for (const model of result.models) {
      const key = groupKey(model.provider, model.modelId);
      let bySource = grouped.get(key);
      if (!bySource) {
        bySource = /* @__PURE__ */ new Map();
        grouped.set(key, bySource);
      }
      bySource.set(result.meta.sourceId, { model, meta: result.meta });
    }
  }
  const models = [];
  for (const [key, bySource] of [...grouped.entries()].sort(([a], [b]) => a.localeCompare(b))) {
    const first = [...bySource.values()][0];
    const provider = normalizeProvider(first.model.provider);
    const modelId = first.model.modelId;
    const facts = {
      provider: {
        value: provider,
        sourceId: first.meta.sourceId,
        sourceUrl: first.meta.sourceUrl,
        fetchedAt: first.meta.fetchedAt,
        sourceDigest: first.meta.sourceDigest,
        parserVersion: first.meta.parserVersion,
        confidence: bySource.size >= 2 ? "multi-source-verified" : "single-source"
      },
      requestedModelId: {
        value: modelId,
        sourceId: first.meta.sourceId,
        sourceUrl: first.meta.sourceUrl,
        fetchedAt: first.meta.fetchedAt,
        sourceDigest: first.meta.sourceDigest,
        parserVersion: first.meta.parserVersion,
        confidence: "single-source"
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
      vision: buildEnvelope("vision", bySource, staleAfterDays, now)
    };
    void MATERIAL_FIELDS;
    const evidence = [...bySource.values()].map(({ meta }) => ({
      sourceId: meta.sourceId,
      sourceUrl: meta.sourceUrl,
      fetchedAt: meta.fetchedAt,
      sourceDigest: meta.sourceDigest,
      parserVersion: meta.parserVersion,
      contentDigest: meta.sourceDigest
    }));
    models.push({ key, provider, modelId, facts, evidence });
  }
  return {
    schemaVersion: 1,
    generatedAt: nowIso(),
    generatorVersion: options.generatorVersion ?? PACKAGE_VERSION,
    frozen: options.frozen ?? false,
    ...options.freezeReason ? { freezeReason: options.freezeReason } : {},
    warnings,
    models
  };
}

// src/registry/load.ts
function latestRegistryPath(dataDir) {
  return join4(dataDir, "registry", "latest.json");
}
function loadRegistrySnapshot(dataDir) {
  const path = latestRegistryPath(dataDir);
  if (!existsSync3(path)) {
    return {
      schemaVersion: 1,
      generatedAt: nowIso(),
      generatorVersion: PACKAGE_VERSION,
      frozen: true,
      freezeReason: "No registry snapshot present",
      warnings: ["No registry snapshot present; using empty frozen registry"],
      models: []
    };
  }
  const raw = JSON.parse(readFileSync4(path, "utf8"));
  return RegistrySnapshotSchema.parse(raw);
}
async function loadCurrentRegistry(opts) {
  const lkg = loadRegistrySnapshot(opts.dataDir);
  const allowNetwork = opts.allowNetwork ?? opts.config.sources.allowNetwork;
  if (!allowNetwork) {
    return {
      registry: { ...lkg, frozen: lkg.frozen, warnings: [...lkg.warnings] },
      warnings: lkg.warnings,
      fromNetwork: false
    };
  }
  const ctx = omitUndefined({
    timeoutMs: opts.config.sources.timeoutMs,
    maxBytes: opts.config.sources.maxBytes,
    fetchImpl: opts.fetchImpl,
    dataDir: opts.dataDir
  });
  const results = await Promise.all([
    modelsDevAdapter(ctx),
    deprecationsInfoAdapter(ctx),
    officialProviderAdapter(ctx)
  ]);
  const anyOk = results.some((r) => r.meta.ok);
  if (!anyOk) {
    const warnings2 = [
      ...results.map((r) => r.meta.warning).filter((w) => Boolean(w)),
      "All sources failed; freezing last-known-good registry"
    ];
    return {
      registry: {
        ...lkg,
        frozen: true,
        freezeReason: "All upstream sources failed",
        warnings: [...lkg.warnings, ...warnings2]
      },
      warnings: warnings2,
      fromNetwork: false
    };
  }
  const merged = mergeSourceResults(results, {
    staleAfterDays: opts.config.sources.staleAfterDays,
    generatorVersion: PACKAGE_VERSION,
    frozen: false
  });
  const warnings = [...merged.warnings];
  const failed = results.filter((r) => !r.meta.ok);
  if (failed.length > 0) {
    warnings.push(
      `Partial source failure (${failed.map((f) => f.meta.sourceId).join(", ")}); merged available sources and retained warnings`
    );
  }
  return {
    registry: { ...merged, warnings },
    warnings,
    fromNetwork: true
  };
}

// src/lockfile/io.ts
import { readFileSync as readFileSync5, writeFileSync as writeFileSync2, existsSync as existsSync4, mkdirSync as mkdirSync2 } from "node:fs";
import { dirname, join as join5 } from "node:path";
var LockfileValidationError = class extends Error {
  constructor(message) {
    super(message);
    this.name = "LockfileValidationError";
  }
};
function readLockfile(path) {
  if (!existsSync4(path)) {
    throw new LockfileValidationError(`Lockfile not found: ${path}`);
  }
  const raw = readFileSync5(path, "utf8");
  if (containsSecret(raw)) {
    throw new LockfileValidationError("Lockfile appears to contain secrets and was rejected");
  }
  let parsed;
  try {
    parsed = JSON.parse(raw);
  } catch (err) {
    throw new LockfileValidationError(
      `Lockfile is not valid JSON: ${err instanceof Error ? err.message : String(err)}`
    );
  }
  const result = LockfileSchema.safeParse(parsed);
  if (!result.success) {
    throw new LockfileValidationError(`Lockfile schema validation failed: ${result.error.message}`);
  }
  return result.data;
}
function writeLockfile(path, lockfile) {
  const validated = LockfileSchema.parse(lockfile);
  const scrubbed = scrubSecrets(validated);
  const text = canonicalize(scrubbed);
  if (containsSecret(text)) {
    throw new LockfileValidationError("Refusing to write lockfile containing secrets");
  }
  mkdirSync2(dirname(path), { recursive: true });
  writeFileSync2(path, text, "utf8");
}
function lockfilePath(rootDir) {
  return join5(rootDir, LOCKFILE_FILENAME);
}
function resolveIdentifierKind(modelId, detected) {
  if (detected?.identifierKind) return detected.identifierKind;
  if (isFixedModelId(modelId)) return "fixed";
  if (FLOATING_ALIASES.has(modelId) || modelId.endsWith("-latest")) return "floating";
  return "floating";
}
function emptyFacts(fetchedAt) {
  const base = {
    sourceId: "unavailable",
    sourceUrl: "file:unavailable",
    fetchedAt,
    sourceDigest: "0",
    parserVersion: "0"
  };
  return {
    provider: unavailableFact(
      base.sourceId,
      base.sourceUrl,
      fetchedAt,
      base.sourceDigest,
      base.parserVersion
    ),
    requestedModelId: unavailableFact(
      base.sourceId,
      base.sourceUrl,
      fetchedAt,
      base.sourceDigest,
      base.parserVersion
    ),
    identifierKind: unavailableFact(
      base.sourceId,
      base.sourceUrl,
      fetchedAt,
      base.sourceDigest,
      base.parserVersion
    ),
    lifecycleStatus: unavailableFact(
      base.sourceId,
      base.sourceUrl,
      fetchedAt,
      base.sourceDigest,
      base.parserVersion
    ),
    retirementDate: unavailableFact(
      base.sourceId,
      base.sourceUrl,
      fetchedAt,
      base.sourceDigest,
      base.parserVersion
    ),
    inputPricePerMillion: unavailableFact(
      base.sourceId,
      base.sourceUrl,
      fetchedAt,
      base.sourceDigest,
      base.parserVersion
    ),
    outputPricePerMillion: unavailableFact(
      base.sourceId,
      base.sourceUrl,
      fetchedAt,
      base.sourceDigest,
      base.parserVersion
    ),
    contextLimit: unavailableFact(
      base.sourceId,
      base.sourceUrl,
      fetchedAt,
      base.sourceDigest,
      base.parserVersion
    ),
    maxOutputLimit: unavailableFact(
      base.sourceId,
      base.sourceUrl,
      fetchedAt,
      base.sourceDigest,
      base.parserVersion
    ),
    toolCalling: unavailableFact(
      base.sourceId,
      base.sourceUrl,
      fetchedAt,
      base.sourceDigest,
      base.parserVersion
    ),
    structuredOutput: unavailableFact(
      base.sourceId,
      base.sourceUrl,
      fetchedAt,
      base.sourceDigest,
      base.parserVersion
    ),
    vision: unavailableFact(
      base.sourceId,
      base.sourceUrl,
      fetchedAt,
      base.sourceDigest,
      base.parserVersion
    )
  };
}
function buildLockDependency(detected, registryModel, fetchedAt) {
  const key = modelKey(detected.provider, detected.modelId);
  const facts = registryModel?.facts ?? emptyFacts(fetchedAt);
  facts.provider = {
    ...facts.provider,
    value: detected.provider,
    confidence: facts.provider.confidence === "unavailable" ? "single-source" : facts.provider.confidence
  };
  facts.requestedModelId = {
    ...facts.requestedModelId,
    value: detected.modelId,
    confidence: "single-source"
  };
  const kind = resolveIdentifierKind(detected.modelId, detected);
  facts.identifierKind = {
    ...facts.identifierKind,
    value: kind,
    confidence: facts.identifierKind.confidence === "unavailable" ? "single-source" : facts.identifierKind.confidence
  };
  return {
    key,
    provider: detected.provider,
    modelId: detected.modelId,
    identifierKind: kind,
    discovery: {
      confidence: detected.confidence,
      lowConfidence: detected.lowConfidence,
      occurrences: detected.occurrences
    },
    facts,
    evidence: registryModel?.evidence ?? []
  };
}
function generateLockfile(opts) {
  const generatedAt = opts.generatedAt ?? nowIso();
  const byKey = new Map(opts.registry.models.map((m) => [m.key, m]));
  const detectedMap = /* @__PURE__ */ new Map();
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
            kind: "override"
          }
        ]
      });
    }
  }
  for (const include of opts.config.include) {
    const idx = include.indexOf(":");
    if (idx <= 0) continue;
    const provider = include.slice(0, idx);
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
            kind: "override"
          }
        ]
      });
    }
  }
  const dependencies = [...detectedMap.values()].map((d) => buildLockDependency(d, byKey.get(modelKey(d.provider, d.modelId)), generatedAt)).sort((a, b) => a.key.localeCompare(b.key));
  return {
    lockfileVersion: 1,
    generatedAt,
    generatorVersion: PACKAGE_VERSION,
    configDigest: opts.configDigest,
    registryDigest: digestJson(opts.registry.models),
    dependencies
  };
}

// src/diff/index.ts
var FACT_FIELDS = [
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
  "vision"
];
function factValue(dep, field) {
  if (!dep) return void 0;
  const facts = "facts" in dep ? dep.facts : void 0;
  if (!facts) return void 0;
  const f = facts[field];
  return { value: f.value, confidence: f.confidence };
}
function isBlockingEligible(confidence) {
  if (!confidence) return false;
  return BLOCKING_CONFIDENCES.includes(confidence);
}
function diffLockfileToRegistry(lockfile, registry) {
  const regMap = new Map(registry.models.map((m) => [m.key, m]));
  const lockMap = new Map(lockfile.dependencies.map((d) => [d.key, d]));
  const keys = /* @__PURE__ */ new Set([...regMap.keys(), ...lockMap.keys()]);
  const diffs = [];
  for (const key of [...keys].sort()) {
    const approved = lockMap.get(key);
    const current = regMap.get(key);
    if (approved && !current) {
      const fields2 = FACT_FIELDS.map((field) => ({
        field,
        kind: "unknown",
        approved: approved.facts[field].value,
        current: null,
        confidence: "unavailable",
        blockingEligible: false
      }));
      diffs.push({ key, kind: "changed", fields: fields2 });
      continue;
    }
    if (!approved && current) {
      continue;
    }
    if (!approved || !current) continue;
    const fields = [];
    let anyChange = false;
    for (const field of FACT_FIELDS) {
      const a = factValue(approved, field);
      const c = factValue(current, field);
      if (c.confidence === "conflicting") {
        fields.push({
          field,
          kind: "conflicting",
          approved: a.value,
          current: null,
          confidence: "conflicting",
          blockingEligible: false
        });
        anyChange = true;
        continue;
      }
      if (a.value === c.value || a.value === null && c.value === null) {
        fields.push({
          field,
          kind: "unchanged",
          approved: a.value,
          current: c.value,
          confidence: c.confidence,
          blockingEligible: isBlockingEligible(c.confidence)
        });
        continue;
      }
      if (typeof a.value === "number" && typeof c.value === "number" && Math.abs(a.value - c.value) < 1e-9) {
        fields.push({
          field,
          kind: "unchanged",
          approved: a.value,
          current: c.value,
          confidence: c.confidence,
          blockingEligible: isBlockingEligible(c.confidence)
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
        blockingEligible: isBlockingEligible(c.confidence)
      });
    }
    diffs.push({
      key,
      kind: anyChange ? "changed" : "unchanged",
      fields
    });
  }
  return diffs.sort((a, b) => a.key.localeCompare(b.key));
}

// src/policy/engine.ts
function confidenceRank(c) {
  const order = [
    "unavailable",
    "stale",
    "conflicting",
    "single-source",
    "multi-source-verified",
    "official-verified"
  ];
  return order.indexOf(c);
}
function meetsMinConfidence(actual, min) {
  return confidenceRank(actual) >= confidenceRank(min);
}
function canBlock(confidence, min) {
  if (!confidence) return false;
  if (confidence === "conflicting" || confidence === "unavailable") return false;
  if (!BLOCKING_CONFIDENCES.includes(confidence) && min !== "single-source") {
    if (!meetsMinConfidence(confidence, min)) return false;
  }
  return meetsMinConfidence(confidence, min);
}
function pctIncrease(approved, current) {
  if (approved === 0) return current > 0 ? Infinity : 0;
  return (current - approved) / approved * 100;
}
function daysUntil(dateStr, now) {
  const t = Date.parse(dateStr);
  if (Number.isNaN(t)) return Number.POSITIVE_INFINITY;
  return Math.ceil((t - now.getTime()) / (24 * 60 * 60 * 1e3));
}
function evaluatePolicy(opts) {
  const now = opts.now ?? /* @__PURE__ */ new Date();
  const policy = opts.config.policy;
  const findings = [];
  const warnings = [...opts.registry.warnings];
  const diffs = diffLockfileToRegistry(opts.lockfile, opts.registry);
  if (opts.registry.frozen || opts.registry.warnings.length > 0) {
    const msg = opts.registry.freezeReason ?? "Registry sources degraded; using last-known-good data";
    if (policy.staleSourceBehavior === "fail") {
      findings.push({
        key: "*",
        field: "registry",
        severity: "fail",
        code: "stale-source",
        message: msg,
        confidence: "stale"
      });
    } else if (policy.staleSourceBehavior === "warn") {
      findings.push({
        key: "*",
        field: "registry",
        severity: "warn",
        code: "stale-source",
        message: msg,
        confidence: "stale"
      });
      warnings.push(msg);
    }
  }
  for (const dep of opts.lockfile.dependencies) {
    if (dep.identifierKind === "floating") {
      if (policy.floatingAliases === "deny") {
        findings.push({
          key: dep.key,
          field: "identifierKind",
          severity: "fail",
          code: "floating-alias",
          message: `Floating model alias "${dep.modelId}" is denied by policy`,
          path: dep.discovery.occurrences[0]?.path,
          line: dep.discovery.occurrences[0]?.line
        });
      } else if (policy.floatingAliases === "warn") {
        findings.push({
          key: dep.key,
          field: "identifierKind",
          severity: "warn",
          code: "floating-alias",
          message: `Floating model alias "${dep.modelId}" detected`,
          path: dep.discovery.occurrences[0]?.path,
          line: dep.discovery.occurrences[0]?.line
        });
      }
    }
    if (dep.discovery.lowConfidence) {
      findings.push({
        key: dep.key,
        field: "discovery",
        severity: "warn",
        code: "low-confidence-discovery",
        message: `Dependency ${dep.key} was discovered with low confidence`,
        path: dep.discovery.occurrences[0]?.path,
        line: dep.discovery.occurrences[0]?.line
      });
    }
    const retirement = dep.facts.retirementDate.value ?? (() => {
      const d = diffs.find((x) => x.key === dep.key);
      const f = d?.fields.find((x) => x.field === "retirementDate");
      return typeof f?.current === "string" ? f.current : null;
    })();
    if (retirement) {
      const days = daysUntil(retirement, now);
      if (days <= policy.retirementWindowDays) {
        const currentConf = diffs.find((x) => x.key === dep.key)?.fields.find((f) => f.field === "retirementDate")?.confidence ?? dep.facts.retirementDate.confidence;
        const severity = canBlock(currentConf, policy.minBlockingConfidence) && days <= policy.retirementWindowDays ? "fail" : "warn";
        findings.push({
          key: dep.key,
          field: "retirementDate",
          severity,
          code: "retirement-window",
          message: `Model ${dep.key} retires in ${days} day(s) (window=${policy.retirementWindowDays})`,
          confidence: currentConf,
          path: dep.discovery.occurrences[0]?.path,
          line: dep.discovery.occurrences[0]?.line
        });
      }
    }
  }
  for (const modelDiff of diffs) {
    const dep = opts.lockfile.dependencies.find((d) => d.key === modelDiff.key);
    for (const field of modelDiff.fields) {
      if (field.kind === "unchanged" || field.kind === "conflicting") {
        if (field.kind === "conflicting") {
          findings.push({
            key: modelDiff.key,
            field: field.field,
            severity: "warn",
            code: "conflicting-fact",
            message: `Conflicting data for ${modelDiff.key}.${field.field}; not blocking`,
            confidence: "conflicting",
            path: dep?.discovery.occurrences[0]?.path,
            line: dep?.discovery.occurrences[0]?.line
          });
        }
        continue;
      }
      if (field.kind !== "changed" && field.kind !== "unknown") continue;
      const conf = field.confidence ?? "unavailable";
      const block = canBlock(conf, policy.minBlockingConfidence);
      if (field.field === "inputPricePerMillion" && typeof field.approved === "number" && typeof field.current === "number" && field.current > field.approved) {
        const pct = pctIncrease(field.approved, field.current);
        if (pct > policy.maxInputPriceIncreasePercent) {
          findings.push({
            key: modelDiff.key,
            field: field.field,
            severity: block ? "fail" : "warn",
            code: "input-price-increase",
            message: `Input price increased ${pct.toFixed(1)}% (max ${policy.maxInputPriceIncreasePercent}%)`,
            confidence: conf,
            path: dep?.discovery.occurrences[0]?.path,
            line: dep?.discovery.occurrences[0]?.line
          });
        }
      }
      if (field.field === "outputPricePerMillion" && typeof field.approved === "number" && typeof field.current === "number" && field.current > field.approved) {
        const pct = pctIncrease(field.approved, field.current);
        if (pct > policy.maxOutputPriceIncreasePercent) {
          findings.push({
            key: modelDiff.key,
            field: field.field,
            severity: block ? "fail" : "warn",
            code: "output-price-increase",
            message: `Output price increased ${pct.toFixed(1)}% (max ${policy.maxOutputPriceIncreasePercent}%)`,
            confidence: conf,
            path: dep?.discovery.occurrences[0]?.path,
            line: dep?.discovery.occurrences[0]?.line
          });
        }
      }
      if (policy.failOnContextDecrease && field.field === "contextLimit" && typeof field.approved === "number" && typeof field.current === "number" && field.current < field.approved) {
        findings.push({
          key: modelDiff.key,
          field: field.field,
          severity: block ? "fail" : "warn",
          code: "context-decrease",
          message: `Context limit decreased from ${field.approved} to ${field.current}`,
          confidence: conf,
          path: dep?.discovery.occurrences[0]?.path,
          line: dep?.discovery.occurrences[0]?.line
        });
      }
      if (policy.failOnMaxOutputDecrease && field.field === "maxOutputLimit" && typeof field.approved === "number" && typeof field.current === "number" && field.current < field.approved) {
        findings.push({
          key: modelDiff.key,
          field: field.field,
          severity: block ? "fail" : "warn",
          code: "max-output-decrease",
          message: `Max output decreased from ${field.approved} to ${field.current}`,
          confidence: conf,
          path: dep?.discovery.occurrences[0]?.path,
          line: dep?.discovery.occurrences[0]?.line
        });
      }
      if (policy.failOnToolCallingRemoval && field.field === "toolCalling" && field.approved === true && field.current === false) {
        findings.push({
          key: modelDiff.key,
          field: field.field,
          severity: block ? "fail" : "warn",
          code: "tool-calling-removal",
          message: "Tool-calling support removed",
          confidence: conf,
          path: dep?.discovery.occurrences[0]?.path,
          line: dep?.discovery.occurrences[0]?.line
        });
      }
      if (policy.failOnStructuredOutputRemoval && field.field === "structuredOutput" && field.approved === true && field.current === false) {
        findings.push({
          key: modelDiff.key,
          field: field.field,
          severity: block ? "fail" : "warn",
          code: "structured-output-removal",
          message: "Structured-output support removed",
          confidence: conf,
          path: dep?.discovery.occurrences[0]?.path,
          line: dep?.discovery.occurrences[0]?.line
        });
      }
      if (policy.failOnVisionRemoval && field.field === "vision" && field.approved === true && field.current === false) {
        findings.push({
          key: modelDiff.key,
          field: field.field,
          severity: block ? "fail" : "warn",
          code: "vision-removal",
          message: "Vision support removed",
          confidence: conf,
          path: dep?.discovery.occurrences[0]?.path,
          line: dep?.discovery.occurrences[0]?.line
        });
      }
      if (field.field === "lifecycleStatus" && field.approved === "active" && (field.current === "deprecated" || field.current === "retired")) {
        findings.push({
          key: modelDiff.key,
          field: field.field,
          severity: block ? "fail" : "warn",
          code: "lifecycle-regression",
          message: `Lifecycle changed from ${String(field.approved)} to ${String(field.current)}`,
          confidence: conf,
          path: dep?.discovery.occurrences[0]?.path,
          line: dep?.discovery.occurrences[0]?.line
        });
      }
    }
  }
  const hasFail = findings.some((f) => f.severity === "fail");
  return {
    findings: findings.sort((a, b) => a.key.localeCompare(b.key) || a.code.localeCompare(b.code)),
    diffs,
    exitCode: hasFail ? ExitCode.PolicyFailure : ExitCode.Success,
    warnings
  };
}

// src/sanitize/index.ts
function sanitizeForPrint(input) {
  let s = input;
  s = s.replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi, "");
  s = s.replace(/<style\b[^>]*>[\s\S]*?<\/style>/gi, "");
  s = s.replace(/<\/?[a-zA-Z][^>]*>/g, "");
  s = s.replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&amp;/g, "&").replace(/&quot;/g, '"').replace(/&#39;/g, "'").replace(/&nbsp;/g, " ");
  s = s.replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/g, "");
  return s;
}
function sanitizeLine(input) {
  return sanitizeForPrint(input).replace(/\s+/g, " ").trim();
}

// src/report/format.ts
function formatHumanReport(result, opts = {}) {
  const lines = [];
  lines.push(opts.title ?? "ModelLock check");
  lines.push("");
  const fails = result.findings.filter((f) => f.severity === "fail");
  const warns = result.findings.filter((f) => f.severity === "warn");
  lines.push(`Findings: ${fails.length} fail, ${warns.length} warn`);
  if (result.warnings.length) {
    lines.push("Warnings:");
    for (const w of result.warnings) {
      lines.push(`  - ${sanitizeLine(w)}`);
    }
  }
  lines.push("");
  for (const f of result.findings) {
    lines.push(formatFindingLine(f));
  }
  if (result.findings.length === 0) {
    lines.push("No policy findings.");
  }
  return sanitizeForPrint(lines.join("\n"));
}
function formatFindingLine(f) {
  const loc = f.path ? `${f.path}${f.line ? `:${f.line}` : ""}` : "";
  const conf = f.confidence ? ` [${f.confidence}]` : "";
  return sanitizeLine(
    `${f.severity.toUpperCase()} ${f.code} ${f.key}.${f.field}${conf}${loc ? ` @ ${loc}` : ""}: ${f.message}`
  );
}
function formatJsonReport(result) {
  return JSON.stringify(
    {
      exitCode: result.exitCode,
      findings: result.findings,
      warnings: result.warnings,
      diffs: result.diffs
    },
    null,
    2
  );
}
function formatSarifReport(result, toolVersion) {
  const sarif = {
    $schema: "https://json.schemastore.org/sarif-2.1.0.json",
    version: "2.1.0",
    runs: [
      {
        tool: {
          driver: {
            name: "model-lock",
            version: toolVersion,
            informationUri: "https://github.com/vibe-code-commit/model-lock",
            rules: uniqueRules(result.findings)
          }
        },
        results: result.findings.map((f) => ({
          ruleId: f.code,
          level: f.severity === "fail" ? "error" : f.severity === "warn" ? "warning" : "note",
          message: { text: sanitizeLine(f.message) },
          locations: f.path ? [
            {
              physicalLocation: {
                artifactLocation: { uri: f.path.replace(/\\/g, "/") },
                region: { startLine: f.line ?? 1 }
              }
            }
          ] : []
        }))
      }
    ]
  };
  return JSON.stringify(sarif, null, 2);
}
function uniqueRules(findings) {
  const seen = /* @__PURE__ */ new Set();
  const rules = [];
  for (const f of findings) {
    if (seen.has(f.code)) continue;
    seen.add(f.code);
    rules.push({
      id: f.code,
      shortDescription: { text: f.code },
      fullDescription: { text: sanitizeLine(f.message) }
    });
  }
  return rules;
}
function formatMarkdownChangeReport(opts) {
  const added = opts.nextKeys.filter((k) => !opts.previousKeys.includes(k));
  const removed = opts.previousKeys.filter((k) => !opts.nextKeys.includes(k));
  const lines = [
    "# ModelLock update report",
    "",
    `## Dependencies`,
    "",
    `- Previous: ${opts.previousKeys.length}`,
    `- Proposed: ${opts.nextKeys.length}`,
    `- Added: ${added.length ? added.join(", ") : "(none)"}`,
    `- Removed: ${removed.length ? removed.join(", ") : "(none)"}`,
    "",
    "## Policy preview",
    ""
  ];
  if (!opts.findings.length) {
    lines.push("No findings.");
  } else {
    for (const f of opts.findings) {
      lines.push(`- **${f.severity}** \`${f.code}\` ${f.key}: ${sanitizeLine(f.message)}`);
    }
  }
  if (opts.warnings.length) {
    lines.push("", "## Warnings", "");
    for (const w of opts.warnings) lines.push(`- ${sanitizeLine(w)}`);
  }
  lines.push("");
  return lines.join("\n");
}
function formatExplain(opts) {
  const lines = [
    `ModelLock explain: ${opts.key}`,
    "",
    "## Approved",
    "```json",
    JSON.stringify(opts.approved, null, 2),
    "```",
    "",
    "## Current",
    "```json",
    JSON.stringify(opts.current, null, 2),
    "```",
    "",
    "## Differences",
    "```json",
    JSON.stringify(opts.diffs, null, 2),
    "```",
    "",
    "## Policy",
    formatHumanReport(opts.policy, { title: "Policy result" })
  ];
  return sanitizeForPrint(lines.join("\n"));
}

// src/commands.ts
function resolveDataDir(explicit) {
  if (explicit) return explicit;
  const candidates = [];
  if (process.env.GITHUB_ACTION_PATH) {
    candidates.push(join6(process.env.GITHUB_ACTION_PATH, "data"));
  }
  try {
    const metaUrl = import.meta.url;
    if (typeof metaUrl === "string" && metaUrl.length > 0) {
      const here = dirname2(fileURLToPath(metaUrl));
      candidates.push(join6(here, "..", "data"));
      candidates.push(join6(here, "..", "..", "data"));
    }
  } catch {
  }
  const cjsDir = typeof __dirname === "string" ? __dirname : "";
  if (cjsDir) {
    candidates.push(join6(cjsDir, "..", "..", "data"));
    candidates.push(join6(cjsDir, "..", "data"));
  }
  candidates.push(join6(process.cwd(), "data"));
  for (const c of candidates) {
    if (existsSync5(join6(c, "registry")) || existsSync5(join6(c, "official"))) return c;
  }
  return join6(process.cwd(), "data");
}
async function cmdInit(opts) {
  try {
    const cwd = opts.cwd;
    const { config, path: existingConfig, digest } = loadConfig(cwd);
    if (!existingConfig) {
      const yaml3 = configToYaml(defaultConfig());
      writeFileSync3(join6(cwd, CONFIG_FILENAME), yaml3, "utf8");
    }
    const dataDir = resolveDataDir(opts.dataDir);
    const { registry, warnings } = await loadCurrentRegistry({
      dataDir,
      config: {
        ...config,
        sources: {
          ...config.sources,
          allowNetwork: opts.allowNetwork ?? config.sources.allowNetwork
        }
      }
    });
    const detected = discoverDependencies(cwd, config);
    const lockfile = generateLockfile({
      detected,
      registry,
      config,
      configDigest: digest
    });
    writeLockfile(lockfilePath(cwd), lockfile);
    const lines = [
      `Created ${existingConfig ? "lockfile" : `${CONFIG_FILENAME} and lockfile`}`,
      `Dependencies: ${lockfile.dependencies.length}`,
      ...warnings.map((w) => `Warning: ${sanitizeLine(w)}`)
    ];
    return { exitCode: ExitCode.Success, stdout: lines.join("\n") + "\n", stderr: "" };
  } catch (err) {
    if (err instanceof LockfileValidationError) {
      return { exitCode: ExitCode.ValidationError, stdout: "", stderr: err.message + "\n" };
    }
    return {
      exitCode: ExitCode.InternalError,
      stdout: "",
      stderr: (err instanceof Error ? err.message : String(err)) + "\n"
    };
  }
}
async function cmdCheck(opts) {
  try {
    const { config, digest: _digest } = loadConfig(opts.cwd);
    void _digest;
    const lfPath = lockfilePath(opts.cwd);
    if (!existsSync5(lfPath)) {
      return {
        exitCode: ExitCode.ValidationError,
        stdout: "",
        stderr: `Missing ${LOCKFILE_FILENAME}. Run \`model-lock init\` first.
`
      };
    }
    const lockfile = readLockfile(lfPath);
    const dataDir = resolveDataDir(opts.dataDir);
    const { registry, warnings } = await loadCurrentRegistry({
      dataDir,
      config: {
        ...config,
        sources: {
          ...config.sources,
          allowNetwork: opts.allowNetwork ?? config.sources.allowNetwork
        }
      }
    });
    const result = evaluatePolicy({ lockfile, registry, config });
    result.warnings.push(...warnings.filter((w) => !result.warnings.includes(w)));
    let exitCode = result.exitCode;
    if (opts.failOnWarn && result.findings.some((f) => f.severity === "warn")) {
      exitCode = ExitCode.PolicyFailure;
    }
    const format = opts.format ?? "human";
    let stdout;
    if (format === "json") stdout = formatJsonReport(result) + "\n";
    else if (format === "sarif") stdout = formatSarifReport(result, PACKAGE_VERSION) + "\n";
    else stdout = formatHumanReport(result) + "\n";
    return { exitCode, stdout, stderr: "" };
  } catch (err) {
    if (err instanceof LockfileValidationError) {
      return { exitCode: ExitCode.ValidationError, stdout: "", stderr: err.message + "\n" };
    }
    return {
      exitCode: ExitCode.InternalError,
      stdout: "",
      stderr: (err instanceof Error ? err.message : String(err)) + "\n"
    };
  }
}
async function cmdUpdate(opts) {
  try {
    const { config, digest } = loadConfig(opts.cwd);
    const dataDir = resolveDataDir(opts.dataDir);
    const { registry, warnings } = await loadCurrentRegistry({
      dataDir,
      config: {
        ...config,
        sources: {
          ...config.sources,
          allowNetwork: opts.allowNetwork ?? true
        }
      }
    });
    const detected = discoverDependencies(opts.cwd, config);
    const next = generateLockfile({ detected, registry, config, configDigest: digest });
    let previousKeys = [];
    const lfPath = lockfilePath(opts.cwd);
    if (existsSync5(lfPath)) {
      try {
        previousKeys = readLockfile(lfPath).dependencies.map((d) => d.key);
      } catch {
        previousKeys = [];
      }
    }
    const policy = evaluatePolicy({ lockfile: next, registry, config });
    const report = formatMarkdownChangeReport({
      previousKeys,
      nextKeys: next.dependencies.map((d) => d.key),
      findings: policy.findings,
      warnings: [...warnings, ...policy.warnings]
    });
    const reportPath = opts.reportPath ?? join6(opts.cwd, "llm.lock.report.md");
    writeFileSync3(reportPath, report, "utf8");
    const proposedPath = join6(opts.cwd, "llm.lock.proposed.json");
    writeLockfile(proposedPath, next);
    if (opts.write) {
      writeLockfile(lfPath, next);
    }
    const lines = [
      opts.write ? `Wrote ${LOCKFILE_FILENAME} and ${reportPath}` : `Proposed lockfile at ${proposedPath} (pass --write to replace ${LOCKFILE_FILENAME})`,
      `Report: ${reportPath}`,
      `Dependencies: ${next.dependencies.length}`,
      ...warnings.map((w) => `Warning: ${sanitizeLine(w)}`)
    ];
    return { exitCode: ExitCode.Success, stdout: lines.join("\n") + "\n", stderr: "" };
  } catch (err) {
    if (err instanceof LockfileValidationError) {
      return { exitCode: ExitCode.ValidationError, stdout: "", stderr: err.message + "\n" };
    }
    return {
      exitCode: ExitCode.InternalError,
      stdout: "",
      stderr: (err instanceof Error ? err.message : String(err)) + "\n"
    };
  }
}
async function cmdExplain(opts) {
  try {
    const { provider, modelId } = parseModelKey(opts.target);
    const key = `${provider}:${modelId}`;
    const { config } = loadConfig(opts.cwd);
    const lfPath = lockfilePath(opts.cwd);
    if (!existsSync5(lfPath)) {
      return {
        exitCode: ExitCode.ValidationError,
        stdout: "",
        stderr: `Missing ${LOCKFILE_FILENAME}
`
      };
    }
    const lockfile = readLockfile(lfPath);
    const approved = lockfile.dependencies.find((d) => d.key === key);
    if (!approved) {
      return {
        exitCode: ExitCode.UsageError,
        stdout: "",
        stderr: `Model ${key} not found in lockfile
`
      };
    }
    const dataDir = resolveDataDir(opts.dataDir);
    const { registry } = await loadCurrentRegistry({
      dataDir,
      config: {
        ...config,
        sources: {
          ...config.sources,
          allowNetwork: opts.allowNetwork ?? config.sources.allowNetwork
        }
      }
    });
    const current = registry.models.find((m) => m.key === key) ?? null;
    const policy = evaluatePolicy({
      lockfile: { ...lockfile, dependencies: [approved] },
      registry: {
        ...registry,
        models: current ? [current] : []
      },
      config
    });
    const modelDiff = policy.diffs.find((d) => d.key === key) ?? null;
    const stdout = formatExplain({
      key,
      approved,
      current,
      diffs: modelDiff,
      policy
    }) + "\n";
    return { exitCode: ExitCode.Success, stdout, stderr: "" };
  } catch (err) {
    if (err instanceof Error && err.message.startsWith("Invalid model key")) {
      return { exitCode: ExitCode.UsageError, stdout: "", stderr: err.message + "\n" };
    }
    return {
      exitCode: ExitCode.InternalError,
      stdout: "",
      stderr: (err instanceof Error ? err.message : String(err)) + "\n"
    };
  }
}

// src/cli.ts
function createProgram() {
  const program = new Command();
  program.name("model-lock").description("package-lock.json for AI model dependencies").version(PACKAGE_VERSION);
  program.command("init").description("Discover model dependencies and create llm.lock.json").option("--cwd <path>", "Working directory", process.cwd()).option("--data-dir <path>", "Path to ModelLock data directory").option("--network", "Allow network refresh of registry sources", false).action(async (opts) => {
    const result = await cmdInit(
      omitUndefined({
        cwd: opts.cwd,
        dataDir: opts.dataDir,
        allowNetwork: opts.network
      })
    );
    process.stdout.write(result.stdout);
    process.stderr.write(result.stderr);
    process.exitCode = result.exitCode;
  });
  program.command("check").description("Compare approved lockfile against current registry and apply policy").option("--cwd <path>", "Working directory", process.cwd()).option("--data-dir <path>", "Path to ModelLock data directory").option("--network", "Allow network refresh of registry sources", false).option("--format <format>", "Output format: human | json | sarif", "human").option("--fail-on-warn", "Treat warnings as failures", false).action(
    async (opts) => {
      const format = opts.format ?? "human";
      if (format !== "human" && format !== "json" && format !== "sarif") {
        process.stderr.write(`Invalid --format: ${format}
`);
        process.exitCode = ExitCode.UsageError;
        return;
      }
      const result = await cmdCheck(
        omitUndefined({
          cwd: opts.cwd,
          dataDir: opts.dataDir,
          allowNetwork: opts.network,
          format,
          failOnWarn: opts.failOnWarn
        })
      );
      process.stdout.write(result.stdout);
      process.stderr.write(result.stderr);
      process.exitCode = result.exitCode;
    }
  );
  program.command("update").description("Generate a proposed lockfile and Markdown change report").option("--cwd <path>", "Working directory", process.cwd()).option("--data-dir <path>", "Path to ModelLock data directory").option("--network", "Allow network refresh (default true for update)", true).option("--no-network", "Disable network refresh").option("--write", "Replace llm.lock.json with the proposal", false).option("--report <path>", "Markdown report output path").action(
    async (opts) => {
      const result = await cmdUpdate(
        omitUndefined({
          cwd: opts.cwd,
          dataDir: opts.dataDir,
          allowNetwork: opts.network,
          write: opts.write,
          reportPath: opts.report
        })
      );
      process.stdout.write(result.stdout);
      process.stderr.write(result.stderr);
      process.exitCode = result.exitCode;
    }
  );
  program.command("explain").description("Explain approved vs current facts for a provider:model").argument("<target>", "provider:model identifier").option("--cwd <path>", "Working directory", process.cwd()).option("--data-dir <path>", "Path to ModelLock data directory").option("--network", "Allow network refresh of registry sources", false).action(async (target, opts) => {
    const result = await cmdExplain(
      omitUndefined({
        cwd: opts.cwd,
        target,
        dataDir: opts.dataDir,
        allowNetwork: opts.network
      })
    );
    process.stdout.write(result.stdout);
    process.stderr.write(result.stderr);
    process.exitCode = result.exitCode;
  });
  return program;
}
async function runCli(argv = process.argv) {
  const program = createProgram();
  program.configureOutput({
    writeErr: (str) => process.stderr.write(str)
  });
  await program.parseAsync(argv);
}
var isDirect = process.argv[1] && (process.argv[1].endsWith("cli.ts") || process.argv[1].endsWith("cli.js") || process.argv[1].includes(`${"model-lock"}`));
if (isDirect) {
  runCli().catch((err) => {
    console.error(err instanceof Error ? err.message : err);
    process.exitCode = 4;
  });
}
export {
  createProgram,
  runCli
};
//# sourceMappingURL=cli.js.map
