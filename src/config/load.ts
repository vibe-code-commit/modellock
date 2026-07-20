import { readFileSync, existsSync } from "node:fs";
import { join } from "node:path";
import yaml from "js-yaml";
import { ConfigSchema, type Config } from "../types/schemas.js";
import { CONFIG_FILENAME } from "../types/constants.js";
import { canonicalize, digestJson } from "../util/canonical.js";

export function defaultConfig(): Config {
  return ConfigSchema.parse({});
}

export function loadConfig(
  rootDir: string,
  explicitPath?: string,
): { config: Config; path: string | null; digest: string } {
  const path = explicitPath ?? join(rootDir, CONFIG_FILENAME);
  if (!existsSync(path)) {
    const config = defaultConfig();
    return { config, path: null, digest: digestJson(config) };
  }
  const raw = readFileSync(path, "utf8");
  const parsed = yaml.load(raw);
  const config = ConfigSchema.parse(parsed ?? {});
  return { config, path, digest: digestJson(config) };
}

export function configToYaml(config: Config): string {
  const doc = {
    version: 1,
    include: config.include,
    exclude: config.exclude,
    pins: config.pins,
    scan: config.scan,
    policy: config.policy,
    sources: config.sources,
  };
  return (
    `# ModelLock configuration\n` +
    `# See docs/configuration.md for the full reference.\n` +
    yaml.dump(doc, { lineWidth: 100, noRefs: true, sortKeys: true })
  );
}

export function validateConfigObject(value: unknown): Config {
  return ConfigSchema.parse(value);
}

export function configCanonicalJson(config: Config): string {
  return canonicalize(config);
}
