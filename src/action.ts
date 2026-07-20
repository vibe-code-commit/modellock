import * as core from "@actions/core";
import { writeFileSync, mkdirSync } from "node:fs";
import { join } from "node:path";
import { cmdCheck } from "./commands.js";
import { ExitCode } from "./types/schemas.js";
import { PACKAGE_VERSION } from "./types/constants.js";
import { formatSarifReport, formatJsonReport } from "./report/format.js";
import { evaluatePolicy } from "./policy/engine.js";
import { loadConfig } from "./config/load.js";
import { readLockfile, lockfilePath } from "./lockfile/io.js";
import { loadCurrentRegistry } from "./registry/load.js";
import { resolveDataDir } from "./commands.js";
import { sanitizeLine } from "./sanitize/index.js";

async function main(): Promise<void> {
  const workingDirectory = core.getInput("working-directory") || process.cwd();
  const failOnWarn = core.getBooleanInput("fail-on-warn");
  const allowNetwork = core.getBooleanInput("network");
  const format = (core.getInput("format") || "human") as "human" | "json" | "sarif";

  // Default permissions: contents:read — never send repository contents anywhere.
  core.info(`model-lock ${PACKAGE_VERSION} running check in ${workingDirectory}`);

  const result = await cmdCheck({
    cwd: workingDirectory,
    allowNetwork,
    format,
    failOnWarn,
  });

  // Step summary
  core.summary.addHeading("ModelLock", 2);
  core.summary.addRaw(result.stdout.replace(/\n/g, "\n\n"));
  await core.summary.write();

  // Annotations from findings
  try {
    const { config } = loadConfig(workingDirectory);
    const lockfile = readLockfile(lockfilePath(workingDirectory));
    const dataDir = resolveDataDir();
    const { registry } = await loadCurrentRegistry({
      dataDir,
      config: {
        ...config,
        sources: { ...config.sources, allowNetwork },
      },
    });
    const policy = evaluatePolicy({ lockfile, registry, config });

    for (const f of policy.findings) {
      const msg = sanitizeLine(`${f.code}: ${f.message}`);
      if (f.path) {
        const props = { file: f.path, startLine: f.line ?? 1, title: f.code };
        if (f.severity === "fail") core.error(msg, props);
        else if (f.severity === "warn") core.warning(msg, props);
        else core.notice(msg, props);
      } else if (f.severity === "fail") {
        core.error(msg);
      } else if (f.severity === "warn") {
        core.warning(msg);
      }
    }

    // Upload machine-readable report (findings only — never repository source contents)
    const outDir = join(workingDirectory, "model-lock-report");
    mkdirSync(outDir, { recursive: true });
    writeFileSync(join(outDir, "report.json"), formatJsonReport(policy), "utf8");
    writeFileSync(join(outDir, "report.sarif"), formatSarifReport(policy, PACKAGE_VERSION), "utf8");
    core.setOutput("report-dir", outDir);
    core.setOutput("exit-code", String(result.exitCode));
  } catch (err) {
    core.warning(
      `Could not emit annotations/report: ${err instanceof Error ? err.message : String(err)}`,
    );
  }

  process.stdout.write(result.stdout);
  process.stderr.write(result.stderr);

  if (result.exitCode !== ExitCode.Success) {
    core.setFailed(`model-lock check failed with exit code ${result.exitCode}`);
  }
}

main().catch((err: unknown) => {
  core.setFailed(err instanceof Error ? err.message : String(err));
});
