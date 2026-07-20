import { writeFileSync, mkdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { zodToJsonSchema } from "zod-to-json-schema";
import { ConfigSchema, LockfileSchema, RegistrySnapshotSchema } from "../src/types/schemas.js";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const schemasDir = join(root, "schemas");
mkdirSync(schemasDir, { recursive: true });

function writeSchema(name: string, schema: unknown): void {
  const path = join(schemasDir, name);
  writeFileSync(path, JSON.stringify(schema, null, 2) + "\n", "utf8");
  console.log(`wrote ${path}`);
}

writeSchema(
  "llm-lock.schema.json",
  zodToJsonSchema(LockfileSchema, {
    name: "LlmLock",
    $refStrategy: "none",
  }),
);

writeSchema(
  "config.schema.json",
  zodToJsonSchema(ConfigSchema, {
    name: "LlmLockConfig",
    $refStrategy: "none",
  }),
);

writeSchema(
  "registry.schema.json",
  zodToJsonSchema(RegistrySnapshotSchema, {
    name: "RegistrySnapshot",
    $refStrategy: "none",
  }),
);
