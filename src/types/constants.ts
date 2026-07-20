export const PACKAGE_VERSION = "0.1.1";
export const PARSER_VERSION = "1.0.0";
export const LOCKFILE_VERSION = 1 as const;
export const REGISTRY_SCHEMA_VERSION = 1 as const;
export const CONFIG_FILENAME = ".llm-lock.yml";
export const LOCKFILE_FILENAME = "llm.lock.json";

export const SOURCE_IDS = {
  modelsDev: "models.dev",
  deprecationsInfo: "deprecations.info",
  officialProvider: "official-provider",
  frozenRegistry: "frozen-registry",
  discovery: "discovery",
} as const;

export const FLOATING_ALIASES = new Set([
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
  "latest",
]);
