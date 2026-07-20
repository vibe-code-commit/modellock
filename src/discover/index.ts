import { readdirSync, readFileSync, statSync } from "node:fs";
import { join, relative, extname } from "node:path";
import * as parser from "@babel/parser";
import _traverse from "@babel/traverse";
import type { NodePath } from "@babel/traverse";
import type {
  CallExpression,
  ImportDeclaration,
  NewExpression,
  StringLiteral,
  File,
} from "@babel/types";
import type {
  Config,
  DetectedDependency,
  DiscoveryOccurrence,
  ProviderId,
} from "../types/schemas.js";
import { FLOATING_ALIASES } from "../types/constants.js";
import { isFixedModelId, modelKey } from "../util/canonical.js";
import yaml from "js-yaml";

type TraverseFn = (parent: File, opts: Record<string, (path: NodePath) => void>) => void;

const traverse = ((_traverse as unknown as { default?: TraverseFn }).default ??
  (_traverse as unknown as TraverseFn)) as TraverseFn;

const SKIP_DIR_NAMES = new Set([
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
  ".mypy_cache",
]);

const CODE_EXTS = new Set([".js", ".jsx", ".mjs", ".cjs", ".ts", ".tsx", ".mts", ".cts"]);
const PYTHON_EXTS = new Set([".py"]);
const DATA_EXTS = new Set([".json", ".yaml", ".yml"]);

const PROVIDER_PACKAGES: Record<string, ProviderId> = {
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
  xai: "xai",
};

const ENV_MODEL_KEYS: Record<string, ProviderId> = {
  OPENAI_MODEL: "openai",
  OPENAI_API_MODEL: "openai",
  ANTHROPIC_MODEL: "anthropic",
  CLAUDE_MODEL: "anthropic",
  GOOGLE_MODEL: "google",
  GEMINI_MODEL: "google",
  GOOGLE_GENAI_MODEL: "google",
  XAI_MODEL: "xai",
  GROK_MODEL: "xai",
};

const MODEL_ID_RE =
  /^(gpt-[a-z0-9.-]+|o[1-9](-[a-z0-9.-]+)?|claude-[a-z0-9.-]+|gemini-[a-z0-9.-]+|grok-[a-z0-9.-]+|text-embedding-[a-z0-9.-]+)$/i;

function looksLikeModelId(value: string): boolean {
  if (value.length < 3 || value.length > 120) return false;
  if (containsPathOrUrl(value)) return false;
  return MODEL_ID_RE.test(value) || FLOATING_ALIASES.has(value);
}

function containsPathOrUrl(value: string): boolean {
  return (
    /[\\/]/.test(value) ||
    /^https?:/i.test(value) ||
    (value.includes("@") && !value.includes("gpt"))
  );
}

function inferProvider(modelId: string): ProviderId {
  const m = modelId.toLowerCase();
  if (
    m.startsWith("gpt-") ||
    m.startsWith("o1") ||
    m.startsWith("o3") ||
    m.startsWith("o4") ||
    m.startsWith("text-embedding")
  )
    return "openai";
  if (m.startsWith("claude-")) return "anthropic";
  if (m.startsWith("gemini-")) return "google";
  if (m.startsWith("grok-")) return "xai";
  return "unknown";
}

function identifierKind(modelId: string): "floating" | "fixed" {
  if (isFixedModelId(modelId)) return "fixed";
  if (FLOATING_ALIASES.has(modelId) || modelId.endsWith("-latest") || modelId === "latest")
    return "floating";
  return "floating";
}

function shouldSkipDir(name: string): boolean {
  return SKIP_DIR_NAMES.has(name) || name.startsWith(".");
}

function isMinified(path: string, content: string): boolean {
  if (path.includes(".min.")) return true;
  if (content.length > 50_000 && content.split("\n").length < 5) return true;
  return false;
}

function walkFiles(root: string, ignoreGlobs: string[]): string[] {
  const out: string[] = [];

  function walk(dir: string): void {
    let entries;
    try {
      entries = readdirSync(dir, { withFileTypes: true });
    } catch {
      return;
    }
    for (const ent of entries) {
      const full = join(dir, ent.name);
      const rel = relative(root, full).replace(/\\/g, "/");
      if (ent.isDirectory()) {
        if (shouldSkipDir(ent.name)) continue;
        if (ignoreGlobs.some((g) => matchIgnore(rel + "/", g))) continue;
        walk(full);
      } else if (ent.isFile()) {
        if (ignoreGlobs.some((g) => matchIgnore(rel, g))) continue;
        const ext = extname(ent.name).toLowerCase();
        if (
          CODE_EXTS.has(ext) ||
          PYTHON_EXTS.has(ext) ||
          DATA_EXTS.has(ext) ||
          ent.name === ".env.example" ||
          ent.name.endsWith(".env.example")
        ) {
          out.push(full);
        }
      }
    }
  }

  walk(root);
  return out.sort();
}

/** Minimal glob matcher for ** and * patterns used in defaults. */
function matchIgnore(relPath: string, pattern: string): boolean {
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
      "^" + norm.replace(/\./g, "\\.").replace(/\*\*/g, ".*").replace(/\*/g, "[^/]*") + "$",
    );
    return re.test(relPath);
  }
  return relPath === norm || relPath.endsWith("/" + norm);
}

interface RawHit {
  provider: ProviderId;
  modelId: string;
  confidence: number;
  occurrence: DiscoveryOccurrence;
}

function addHit(hits: RawHit[], hit: RawHit): void {
  if (!looksLikeModelId(hit.modelId) && hit.confidence < 0.8) {
    // Still record low-confidence string matches that almost look like models
    if (!MODEL_ID_RE.test(hit.modelId)) return;
  }
  if (!looksLikeModelId(hit.modelId) && hit.confidence >= 0.8) {
    // High confidence SDK context can accept broader IDs
  } else if (!looksLikeModelId(hit.modelId)) {
    return;
  }
  hits.push(hit);
}

function scanJsTs(filePath: string, rel: string, content: string, hits: RawHit[]): void {
  let ast;
  try {
    ast = parser.parse(content, {
      sourceType: "unambiguous",
      plugins: ["typescript", "jsx", "decorators-legacy"],
      errorRecovery: true,
    });
  } catch {
    return;
  }

  const providerImports = new Map<string, ProviderId>();

  traverse(ast, {
    ImportDeclaration(path: NodePath) {
      const node = path.node as ImportDeclaration;
      const src = node.source.value;
      const provider = PROVIDER_PACKAGES[src];
      if (!provider) return;
      for (const spec of node.specifiers) {
        if (spec.local?.name) providerImports.set(spec.local.name, provider);
      }
    },
    CallExpression(path: NodePath) {
      const call = path.node as CallExpression;
      const callee = call.callee;
      const args = call.arguments;
      for (const arg of args) {
        if (arg?.type === "ObjectExpression") {
          for (const prop of arg.properties) {
            if (prop.type !== "ObjectProperty") continue;
            const key =
              prop.key.type === "Identifier"
                ? prop.key.name
                : prop.key.type === "StringLiteral"
                  ? prop.key.value
                  : null;
            if (key !== "model" && key !== "modelId" && key !== "model_id") continue;
            if (prop.value.type !== "StringLiteral") continue;
            const modelId = prop.value.value;
            let provider: ProviderId = inferProvider(modelId);
            if (callee.type === "MemberExpression") {
              let obj = callee.object;
              while (obj.type === "MemberExpression") obj = obj.object;
              if (obj.type === "Identifier" && providerImports.has(obj.name)) {
                provider = providerImports.get(obj.name)!;
              }
            }
            const loc = prop.value.loc?.start;
            const occurrence: DiscoveryOccurrence = {
              path: rel,
              line: loc?.line ?? 1,
              snippet: `model: "${modelId}"`,
              confidence: 0.9,
              kind: "sdk",
            };
            if (loc?.column !== undefined) occurrence.column = loc.column;
            addHit(hits, {
              provider,
              modelId,
              confidence: 0.9,
              occurrence,
            });
          }
        }
      }
    },
    NewExpression(_path: NodePath) {
      // Model ids are usually on subsequent method calls.
      void (_path.node as NewExpression);
    },
    StringLiteral(path: NodePath) {
      const parent = path.parent;
      if (parent.type === "ObjectProperty") {
        const key =
          parent.key.type === "Identifier"
            ? parent.key.name
            : parent.key.type === "StringLiteral"
              ? parent.key.value
              : "";
        if (!/model/i.test(key)) return;
        const modelId = (path.node as StringLiteral).value;
        if (!looksLikeModelId(modelId)) return;
        const loc = path.node.loc?.start;
        const occurrence: DiscoveryOccurrence = {
          path: rel,
          line: loc?.line ?? 1,
          snippet: `${key}: "${modelId}"`,
          confidence: 0.55,
          kind: "literal",
        };
        if (loc?.column !== undefined) occurrence.column = loc.column;
        addHit(hits, {
          provider: inferProvider(modelId),
          modelId,
          confidence: 0.55,
          occurrence,
        });
      }
    },
  });
}

function scanPython(filePath: string, rel: string, content: string, hits: RawHit[]): void {
  // Lightweight pattern-based AST-ish scan without native tree-sitter binding.
  const lines = content.split(/\r?\n/);
  const providerHints: ProviderId[] = [];
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i]!;
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
      /\.chat\.completions\.create\([^)]*model\s*=\s*["']([^"']+)["']/,
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
          kind: "sdk",
        },
      });
    }
  }
  void filePath;
}

function scanJsonYaml(rel: string, content: string, hits: RawHit[]): void {
  let data: unknown;
  try {
    data = rel.endsWith(".json") ? JSON.parse(content) : yaml.load(content);
  } catch {
    return;
  }

  function walk(node: unknown, pathHint: string): void {
    if (!node || typeof node !== "object") return;
    if (Array.isArray(node)) {
      node.forEach((v, i) => walk(v, `${pathHint}[${i}]`));
      return;
    }
    const obj = node as Record<string, unknown>;
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
            kind: "config",
          },
        });
      }
      walk(v, `${pathHint}.${k}`);
    }
  }
  walk(data, "$");
}

function scanEnvExample(rel: string, content: string, hits: RawHit[]): void {
  const lines = content.split(/\r?\n/);
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i]!;
    const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)$/);
    if (!m) continue;
    const key = m[1]!;
    const value = m[2]!.trim().replace(/^["']|["']$/g, "");
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
        kind: "env",
      },
    });
  }
}

function consolidate(hits: RawHit[]): DetectedDependency[] {
  const map = new Map<string, DetectedDependency>();
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
        occurrences: [hit.occurrence],
      });
    } else {
      existing.occurrences.push(hit.occurrence);
      existing.confidence = Math.max(existing.confidence, hit.confidence);
      existing.lowConfidence = existing.confidence < 0.6;
    }
  }
  return [...map.values()].sort((a, b) =>
    modelKey(a.provider, a.modelId).localeCompare(modelKey(b.provider, b.modelId)),
  );
}

export function discoverDependencies(rootDir: string, config: Config): DetectedDependency[] {
  const hits: RawHit[] = [];
  const roots = config.scan.roots.length ? config.scan.roots : ["."];

  for (const rootRel of roots) {
    const root = join(rootDir, rootRel);
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
      let content: string;
      try {
        content = readFileSync(file, "utf8");
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
