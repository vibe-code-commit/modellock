import { writeFileSync, mkdirSync, readFileSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { officialProviderAdapter } from "../src/sources/official-provider.js";
import { modelsDevAdapter } from "../src/sources/models-dev.js";
import { deprecationsInfoAdapter } from "../src/sources/deprecations-info.js";
import { mergeSourceResults } from "../src/sources/merge.js";
import { canonicalize } from "../src/util/canonical.js";
import { PACKAGE_VERSION } from "../src/types/constants.js";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const dataDir = join(root, "data");

const modelsDevFixture = readFileSync(join(dataDir, "fixtures", "models-dev-valid.json"), "utf8");
const deprecationsFixture = readFileSync(
  join(dataDir, "fixtures", "deprecations-valid.json"),
  "utf8",
);

const results = await Promise.all([
  modelsDevAdapter({
    timeoutMs: 1000,
    maxBytes: 1_000_000,
    fixtureBody: modelsDevFixture,
    dataDir,
  }),
  deprecationsInfoAdapter({
    timeoutMs: 1000,
    maxBytes: 1_000_000,
    fixtureBody: deprecationsFixture,
    dataDir,
  }),
  officialProviderAdapter({ timeoutMs: 1000, maxBytes: 1_000_000, dataDir }),
]);

const snapshot = mergeSourceResults(results, {
  generatorVersion: PACKAGE_VERSION,
  frozen: false,
});

const dir = join(dataDir, "registry");
mkdirSync(dir, { recursive: true });
const text = canonicalize(snapshot);
writeFileSync(join(dir, "latest.json"), text);
writeFileSync(join(dir, `${snapshot.generatedAt.slice(0, 10)}.json`), text);
console.log(`Wrote registry with ${snapshot.models.length} models`);
