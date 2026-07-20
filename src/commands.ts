import { mkdirSync, writeFileSync, existsSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { loadConfig, configToYaml, defaultConfig } from "./config/load.js";
import { discoverDependencies } from "./discover/index.js";
import { loadCurrentRegistry, loadRegistrySnapshot } from "./registry/load.js";
import {
  generateLockfile,
  writeLockfile,
  readLockfile,
  lockfilePath,
  LockfileValidationError,
} from "./lockfile/io.js";
import { evaluatePolicy } from "./policy/engine.js";
import {
  formatHumanReport,
  formatJsonReport,
  formatSarifReport,
  formatMarkdownChangeReport,
  formatExplain,
} from "./report/format.js";
import { ExitCode, type ExitCodeValue } from "./types/schemas.js";
import { CONFIG_FILENAME, LOCKFILE_FILENAME, PACKAGE_VERSION } from "./types/constants.js";
import { parseModelKey } from "./util/canonical.js";
import { sanitizeLine } from "./sanitize/index.js";

export function resolveDataDir(explicit?: string | undefined): string {
  if (explicit) return explicit;

  const candidates: string[] = [];

  if (process.env.GITHUB_ACTION_PATH) {
    candidates.push(join(process.env.GITHUB_ACTION_PATH, "data"));
  }

  try {
    const metaUrl = import.meta.url;
    if (typeof metaUrl === "string" && metaUrl.length > 0) {
      const here = dirname(fileURLToPath(metaUrl));
      candidates.push(join(here, "..", "data"));
      candidates.push(join(here, "..", "..", "data"));
    }
  } catch {
    // ignore empty import.meta in CJS bundles
  }

  // CJS GitHub Action bundle lives at dist/action/index.cjs
  const cjsDir = typeof __dirname === "string" ? __dirname : "";
  if (cjsDir) {
    candidates.push(join(cjsDir, "..", "..", "data"));
    candidates.push(join(cjsDir, "..", "data"));
  }

  candidates.push(join(process.cwd(), "data"));

  for (const c of candidates) {
    if (existsSync(join(c, "registry")) || existsSync(join(c, "official"))) return c;
  }
  return join(process.cwd(), "data");
}

export interface CommandResult {
  exitCode: ExitCodeValue;
  stdout: string;
  stderr: string;
}

export async function cmdInit(opts: {
  cwd: string;
  dataDir?: string | undefined;
  allowNetwork?: boolean | undefined;
}): Promise<CommandResult> {
  try {
    const cwd = opts.cwd;
    const { config, path: existingConfig, digest } = loadConfig(cwd);
    if (!existingConfig) {
      const yaml = configToYaml(defaultConfig());
      writeFileSync(join(cwd, CONFIG_FILENAME), yaml, "utf8");
    }

    const dataDir = resolveDataDir(opts.dataDir);
    const { registry, warnings } = await loadCurrentRegistry({
      dataDir,
      config: {
        ...config,
        sources: {
          ...config.sources,
          allowNetwork: opts.allowNetwork ?? config.sources.allowNetwork,
        },
      },
    });

    const detected = discoverDependencies(cwd, config);
    const lockfile = generateLockfile({
      detected,
      registry,
      config,
      configDigest: digest,
    });
    writeLockfile(lockfilePath(cwd), lockfile);

    const lines = [
      `Created ${existingConfig ? "lockfile" : `${CONFIG_FILENAME} and lockfile`}`,
      `Dependencies: ${lockfile.dependencies.length}`,
      ...warnings.map((w) => `Warning: ${sanitizeLine(w)}`),
    ];
    return { exitCode: ExitCode.Success, stdout: lines.join("\n") + "\n", stderr: "" };
  } catch (err) {
    if (err instanceof LockfileValidationError) {
      return { exitCode: ExitCode.ValidationError, stdout: "", stderr: err.message + "\n" };
    }
    return {
      exitCode: ExitCode.InternalError,
      stdout: "",
      stderr: (err instanceof Error ? err.message : String(err)) + "\n",
    };
  }
}

export async function cmdCheck(opts: {
  cwd: string;
  dataDir?: string | undefined;
  allowNetwork?: boolean | undefined;
  format?: "human" | "json" | "sarif" | undefined;
  failOnWarn?: boolean | undefined;
}): Promise<CommandResult> {
  try {
    const { config, digest: _digest } = loadConfig(opts.cwd);
    void _digest;
    const lfPath = lockfilePath(opts.cwd);
    if (!existsSync(lfPath)) {
      return {
        exitCode: ExitCode.ValidationError,
        stdout: "",
        stderr: `Missing ${LOCKFILE_FILENAME}. Run \`model-lock init\` first.\n`,
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
          allowNetwork: opts.allowNetwork ?? config.sources.allowNetwork,
        },
      },
    });

    const result = evaluatePolicy({ lockfile, registry, config });
    result.warnings.push(...warnings.filter((w) => !result.warnings.includes(w)));

    let exitCode = result.exitCode;
    if (opts.failOnWarn && result.findings.some((f) => f.severity === "warn")) {
      exitCode = ExitCode.PolicyFailure;
    }

    const format = opts.format ?? "human";
    let stdout: string;
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
      stderr: (err instanceof Error ? err.message : String(err)) + "\n",
    };
  }
}

export async function cmdUpdate(opts: {
  cwd: string;
  dataDir?: string | undefined;
  allowNetwork?: boolean | undefined;
  write?: boolean | undefined;
  reportPath?: string | undefined;
}): Promise<CommandResult> {
  try {
    const { config, digest } = loadConfig(opts.cwd);
    const dataDir = resolveDataDir(opts.dataDir);
    const { registry, warnings } = await loadCurrentRegistry({
      dataDir,
      config: {
        ...config,
        sources: {
          ...config.sources,
          allowNetwork: opts.allowNetwork ?? true,
        },
      },
    });

    const detected = discoverDependencies(opts.cwd, config);
    const next = generateLockfile({ detected, registry, config, configDigest: digest });

    let previousKeys: string[] = [];
    const lfPath = lockfilePath(opts.cwd);
    if (existsSync(lfPath)) {
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
      warnings: [...warnings, ...policy.warnings],
    });

    const reportPath = opts.reportPath ?? join(opts.cwd, "llm.lock.report.md");
    writeFileSync(reportPath, report, "utf8");

    const proposedPath = join(opts.cwd, "llm.lock.proposed.json");
    writeLockfile(proposedPath, next);

    if (opts.write) {
      writeLockfile(lfPath, next);
    }

    const lines = [
      opts.write
        ? `Wrote ${LOCKFILE_FILENAME} and ${reportPath}`
        : `Proposed lockfile at ${proposedPath} (pass --write to replace ${LOCKFILE_FILENAME})`,
      `Report: ${reportPath}`,
      `Dependencies: ${next.dependencies.length}`,
      ...warnings.map((w) => `Warning: ${sanitizeLine(w)}`),
    ];
    return { exitCode: ExitCode.Success, stdout: lines.join("\n") + "\n", stderr: "" };
  } catch (err) {
    if (err instanceof LockfileValidationError) {
      return { exitCode: ExitCode.ValidationError, stdout: "", stderr: err.message + "\n" };
    }
    return {
      exitCode: ExitCode.InternalError,
      stdout: "",
      stderr: (err instanceof Error ? err.message : String(err)) + "\n",
    };
  }
}

export async function cmdExplain(opts: {
  cwd: string;
  target: string;
  dataDir?: string | undefined;
  allowNetwork?: boolean | undefined;
}): Promise<CommandResult> {
  try {
    const { provider, modelId } = parseModelKey(opts.target);
    const key = `${provider}:${modelId}`;
    const { config } = loadConfig(opts.cwd);
    const lfPath = lockfilePath(opts.cwd);
    if (!existsSync(lfPath)) {
      return {
        exitCode: ExitCode.ValidationError,
        stdout: "",
        stderr: `Missing ${LOCKFILE_FILENAME}\n`,
      };
    }
    const lockfile = readLockfile(lfPath);
    const approved = lockfile.dependencies.find((d) => d.key === key);
    if (!approved) {
      return {
        exitCode: ExitCode.UsageError,
        stdout: "",
        stderr: `Model ${key} not found in lockfile\n`,
      };
    }

    const dataDir = resolveDataDir(opts.dataDir);
    const { registry } = await loadCurrentRegistry({
      dataDir,
      config: {
        ...config,
        sources: {
          ...config.sources,
          allowNetwork: opts.allowNetwork ?? config.sources.allowNetwork,
        },
      },
    });
    const current = registry.models.find((m) => m.key === key) ?? null;
    const policy = evaluatePolicy({
      lockfile: { ...lockfile, dependencies: [approved] },
      registry: {
        ...registry,
        models: current ? [current] : [],
      },
      config,
    });
    const modelDiff = policy.diffs.find((d) => d.key === key) ?? null;

    const stdout =
      formatExplain({
        key,
        approved,
        current,
        diffs: modelDiff,
        policy,
      }) + "\n";

    return { exitCode: ExitCode.Success, stdout, stderr: "" };
  } catch (err) {
    if (err instanceof Error && err.message.startsWith("Invalid model key")) {
      return { exitCode: ExitCode.UsageError, stdout: "", stderr: err.message + "\n" };
    }
    return {
      exitCode: ExitCode.InternalError,
      stdout: "",
      stderr: (err instanceof Error ? err.message : String(err)) + "\n",
    };
  }
}

export function ensureDir(path: string): void {
  mkdirSync(path, { recursive: true });
}

export { loadRegistrySnapshot };
