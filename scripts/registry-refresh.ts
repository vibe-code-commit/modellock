import { mkdirSync, writeFileSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { modelsDevAdapter } from "../src/sources/models-dev.js";
import { deprecationsInfoAdapter } from "../src/sources/deprecations-info.js";
import { officialProviderAdapter } from "../src/sources/official-provider.js";
import { mergeSourceResults } from "../src/sources/merge.js";
import { canonicalize, digestJson } from "../src/util/canonical.js";
import { RegistrySnapshotSchema } from "../src/types/schemas.js";
import { PACKAGE_VERSION } from "../src/types/constants.js";
import { loadRegistrySnapshot, preservePreviousSnapshot } from "../src/registry/load.js";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const dataDir = join(root, "data");

async function main(): Promise<void> {
  const timeoutMs = 15_000;
  const maxBytes = 10 * 1024 * 1024;
  const ctx = { timeoutMs, maxBytes, dataDir };

  console.log("Fetching sources...");
  const results = await Promise.all([
    modelsDevAdapter(ctx),
    deprecationsInfoAdapter(ctx),
    officialProviderAdapter(ctx),
  ]);

  for (const r of results) {
    console.log(`  ${r.meta.sourceId}: ok=${r.meta.ok} models=${r.models.length}`);
    if (r.meta.warning) console.warn(`  warning: ${r.meta.warning}`);
  }

  const anyOk = results.some((r) => r.meta.ok);
  if (!anyOk) {
    console.error("All sources failed; preserving previous snapshot");
    process.exitCode = 1;
    return;
  }

  const officialOk = results.find((r) => r.meta.sourceId.includes("official"))?.meta.ok;
  if (!officialOk) {
    console.error("Official evidence pack failed schema/load; opening diagnostic path");
    writeFileSync(
      join(dataDir, "registry", "DIAGNOSTIC.md"),
      `# Registry refresh diagnostic\n\nOfficial provider pack failed validation at ${new Date().toISOString()}.\n`,
      "utf8",
    );
    process.exitCode = 2;
    return;
  }

  const merged = mergeSourceResults(results, {
    generatorVersion: PACKAGE_VERSION,
    frozen: false,
  });

  const validated = RegistrySnapshotSchema.safeParse(merged);
  if (!validated.success) {
    console.error("Merged registry failed schema validation:", validated.error.message);
    writeFileSync(
      join(dataDir, "registry", "DIAGNOSTIC.md"),
      `# Registry refresh diagnostic\n\nSchema breakage:\n\n\`\`\`\n${validated.error.message}\n\`\`\`\n`,
      "utf8",
    );
    process.exitCode = 2;
    return;
  }

  const previous = loadRegistrySnapshot(dataDir);
  const prevDigest = digestJson(previous.models);
  const nextDigest = digestJson(validated.data.models);

  const changelog = [
    "# Registry changelog",
    "",
    `- Generated at: ${validated.data.generatedAt}`,
    `- Previous digest: ${prevDigest}`,
    `- New digest: ${nextDigest}`,
    `- Model count: ${previous.models.length} -> ${validated.data.models.length}`,
    `- Warnings: ${validated.data.warnings.length ? validated.data.warnings.join("; ") : "(none)"}`,
    "",
  ].join("\n");

  mkdirSync(join(dataDir, "registry"), { recursive: true });
  writeFileSync(join(dataDir, "registry", "CHANGELOG.md"), changelog, "utf8");

  if (prevDigest === nextDigest) {
    console.log("No material registry changes");
    return;
  }

  preservePreviousSnapshot(dataDir);
  const text = canonicalize(validated.data);
  const day = validated.data.generatedAt.slice(0, 10);
  writeFileSync(join(dataDir, "registry", "latest.json"), text, "utf8");
  writeFileSync(join(dataDir, "registry", `${day}.json`), text, "utf8");
  console.log(`Updated registry snapshot ${day}.json`);
}

main().catch((err: unknown) => {
  console.error(err);
  process.exitCode = 1;
});
