import { createHash } from "node:crypto";

/** Deterministic JSON stringify with sorted object keys at every level. */
export function canonicalize(value: unknown): string {
  return JSON.stringify(sortKeys(value), null, 2) + "\n";
}

export function sortKeys(value: unknown): unknown {
  if (value === null || typeof value !== "object") {
    return value;
  }
  if (Array.isArray(value)) {
    return value.map(sortKeys);
  }
  const obj = value as Record<string, unknown>;
  const sorted: Record<string, unknown> = {};
  for (const key of Object.keys(obj).sort()) {
    const v = obj[key];
    if (v !== undefined) {
      sorted[key] = sortKeys(v);
    }
  }
  return sorted;
}

export function sha256(content: string | Buffer): string {
  return createHash("sha256").update(content).digest("hex");
}

export function digestJson(value: unknown): string {
  return sha256(canonicalize(value));
}

export function modelKey(provider: string, modelId: string): string {
  return `${provider}:${modelId}`;
}

export function parseModelKey(key: string): { provider: string; modelId: string } {
  const idx = key.indexOf(":");
  if (idx <= 0) {
    throw new Error(`Invalid model key: ${key}`);
  }
  return { provider: key.slice(0, idx), modelId: key.slice(idx + 1) };
}

export function isFixedModelId(modelId: string): boolean {
  // Date-stamped or version-pinned IDs are treated as fixed.
  if (/\d{4}-\d{2}-\d{2}/.test(modelId)) return true;
  if (/-\d{8}$/.test(modelId)) return true;
  if (/@\d/.test(modelId)) return true;
  if (/-\d{4}$/.test(modelId)) return true;
  return false;
}

const SECRET_PATTERNS = [
  /sk-[A-Za-z0-9_-]{20,}/,
  /sk-ant-[A-Za-z0-9_-]{20,}/,
  /xai-[A-Za-z0-9_-]{20,}/,
  /AIza[A-Za-z0-9_-]{20,}/,
  /Bearer\s+[A-Za-z0-9._~+/=-]{20,}/i,
  /api[_-]?key\s*[:=]\s*['"][^'"]+['"]/i,
];

export function containsSecret(value: string): boolean {
  return SECRET_PATTERNS.some((re) => re.test(value));
}

export function scrubSecrets(value: unknown): unknown {
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
    const out: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(value as Record<string, unknown>)) {
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

export function nowIso(): string {
  return new Date().toISOString();
}
