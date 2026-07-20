import { mkdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import * as esbuild from "esbuild";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
mkdirSync(join(root, "dist", "action"), { recursive: true });

async function build(): Promise<void> {
  // CLI: ESM with external deps (installed via npm with the package)
  await esbuild.build({
    entryPoints: [join(root, "src/cli.ts")],
    bundle: true,
    platform: "node",
    target: "node24",
    format: "esm",
    outfile: join(root, "dist/cli.js"),
    packages: "external",
    banner: {
      js: "#!/usr/bin/env node\n",
    },
    sourcemap: true,
    logLevel: "info",
  });

  // Library entry: ESM, external deps
  await esbuild.build({
    entryPoints: [join(root, "src/index.ts")],
    bundle: true,
    platform: "node",
    target: "node24",
    format: "esm",
    outfile: join(root, "dist/index.js"),
    packages: "external",
    sourcemap: true,
    logLevel: "info",
  });

  // GitHub Action: fully bundled CJS (no node_modules on the action runner checkout)
  await esbuild.build({
    entryPoints: [join(root, "src/action.ts")],
    bundle: true,
    platform: "node",
    target: "node24",
    format: "cjs",
    outfile: join(root, "dist/action/index.cjs"),
    packages: "bundle",
    sourcemap: true,
    logLevel: "info",
  });

  console.log("build complete");
}

await build();
