import type {
  Config,
  Confidence,
  Lockfile,
  PolicyFinding,
  RegistrySnapshot,
} from "../types/schemas.js";
import { BLOCKING_CONFIDENCES } from "../types/schemas.js";
import { diffLockfileToRegistry, type ModelDiff } from "../diff/index.js";
import { ExitCode, type ExitCodeValue } from "../types/schemas.js";

function confidenceRank(c: Confidence): number {
  const order: Confidence[] = [
    "unavailable",
    "stale",
    "conflicting",
    "single-source",
    "multi-source-verified",
    "official-verified",
  ];
  return order.indexOf(c);
}

function meetsMinConfidence(actual: Confidence, min: Confidence): boolean {
  return confidenceRank(actual) >= confidenceRank(min);
}

function canBlock(confidence: Confidence | undefined, min: Confidence): boolean {
  if (!confidence) return false;
  if (confidence === "conflicting" || confidence === "unavailable") return false;
  if (
    !(BLOCKING_CONFIDENCES as readonly string[]).includes(confidence) &&
    min !== "single-source"
  ) {
    // Default: only official/multi may block unless min is lowered
    if (!meetsMinConfidence(confidence, min)) return false;
  }
  return meetsMinConfidence(confidence, min);
}

function pctIncrease(approved: number, current: number): number {
  if (approved === 0) return current > 0 ? Infinity : 0;
  return ((current - approved) / approved) * 100;
}

function daysUntil(dateStr: string, now: Date): number {
  const t = Date.parse(dateStr);
  if (Number.isNaN(t)) return Number.POSITIVE_INFINITY;
  return Math.ceil((t - now.getTime()) / (24 * 60 * 60 * 1000));
}

export interface PolicyResult {
  findings: PolicyFinding[];
  diffs: ModelDiff[];
  exitCode: ExitCodeValue;
  warnings: string[];
}

export function evaluatePolicy(opts: {
  lockfile: Lockfile;
  registry: RegistrySnapshot;
  config: Config;
  now?: Date;
}): PolicyResult {
  const now = opts.now ?? new Date();
  const policy = opts.config.policy;
  const findings: PolicyFinding[] = [];
  const warnings = [...opts.registry.warnings];
  const diffs = diffLockfileToRegistry(opts.lockfile, opts.registry);

  // Stale / frozen registry behavior
  if (opts.registry.frozen || opts.registry.warnings.length > 0) {
    const msg =
      opts.registry.freezeReason ?? "Registry sources degraded; using last-known-good data";
    if (policy.staleSourceBehavior === "fail") {
      findings.push({
        key: "*",
        field: "registry",
        severity: "fail",
        code: "stale-source",
        message: msg,
        confidence: "stale",
      });
    } else if (policy.staleSourceBehavior === "warn") {
      findings.push({
        key: "*",
        field: "registry",
        severity: "warn",
        code: "stale-source",
        message: msg,
        confidence: "stale",
      });
      warnings.push(msg);
    }
  }

  for (const dep of opts.lockfile.dependencies) {
    // Floating alias policy
    if (dep.identifierKind === "floating") {
      if (policy.floatingAliases === "deny") {
        findings.push({
          key: dep.key,
          field: "identifierKind",
          severity: "fail",
          code: "floating-alias",
          message: `Floating model alias "${dep.modelId}" is denied by policy`,
          path: dep.discovery.occurrences[0]?.path,
          line: dep.discovery.occurrences[0]?.line,
        });
      } else if (policy.floatingAliases === "warn") {
        findings.push({
          key: dep.key,
          field: "identifierKind",
          severity: "warn",
          code: "floating-alias",
          message: `Floating model alias "${dep.modelId}" detected`,
          path: dep.discovery.occurrences[0]?.path,
          line: dep.discovery.occurrences[0]?.line,
        });
      }
    }

    // Low-confidence discovery marking
    if (dep.discovery.lowConfidence) {
      findings.push({
        key: dep.key,
        field: "discovery",
        severity: "warn",
        code: "low-confidence-discovery",
        message: `Dependency ${dep.key} was discovered with low confidence`,
        path: dep.discovery.occurrences[0]?.path,
        line: dep.discovery.occurrences[0]?.line,
      });
    }

    // Retirement window against approved or current retirement date
    const retirement =
      dep.facts.retirementDate.value ??
      (() => {
        const d = diffs.find((x) => x.key === dep.key);
        const f = d?.fields.find((x) => x.field === "retirementDate");
        return typeof f?.current === "string" ? f.current : null;
      })();

    if (retirement) {
      const days = daysUntil(retirement, now);
      if (days <= policy.retirementWindowDays) {
        const currentConf =
          diffs.find((x) => x.key === dep.key)?.fields.find((f) => f.field === "retirementDate")
            ?.confidence ?? dep.facts.retirementDate.confidence;
        const severity =
          canBlock(currentConf, policy.minBlockingConfidence) && days <= policy.retirementWindowDays
            ? "fail"
            : "warn";
        findings.push({
          key: dep.key,
          field: "retirementDate",
          severity,
          code: "retirement-window",
          message: `Model ${dep.key} retires in ${days} day(s) (window=${policy.retirementWindowDays})`,
          confidence: currentConf,
          path: dep.discovery.occurrences[0]?.path,
          line: dep.discovery.occurrences[0]?.line,
        });
      }
    }
  }

  for (const modelDiff of diffs) {
    const dep = opts.lockfile.dependencies.find((d) => d.key === modelDiff.key);
    for (const field of modelDiff.fields) {
      if (field.kind === "unchanged" || field.kind === "conflicting") {
        if (field.kind === "conflicting") {
          findings.push({
            key: modelDiff.key,
            field: field.field,
            severity: "warn",
            code: "conflicting-fact",
            message: `Conflicting data for ${modelDiff.key}.${field.field}; not blocking`,
            confidence: "conflicting",
            path: dep?.discovery.occurrences[0]?.path,
            line: dep?.discovery.occurrences[0]?.line,
          });
        }
        continue;
      }
      if (field.kind !== "changed" && field.kind !== "unknown") continue;

      const conf = field.confidence ?? "unavailable";
      const block = canBlock(conf, policy.minBlockingConfidence);

      // Price increases
      if (
        field.field === "inputPricePerMillion" &&
        typeof field.approved === "number" &&
        typeof field.current === "number" &&
        field.current > field.approved
      ) {
        const pct = pctIncrease(field.approved, field.current);
        if (pct > policy.maxInputPriceIncreasePercent) {
          findings.push({
            key: modelDiff.key,
            field: field.field,
            severity: block ? "fail" : "warn",
            code: "input-price-increase",
            message: `Input price increased ${pct.toFixed(1)}% (max ${policy.maxInputPriceIncreasePercent}%)`,
            confidence: conf,
            path: dep?.discovery.occurrences[0]?.path,
            line: dep?.discovery.occurrences[0]?.line,
          });
        }
      }

      if (
        field.field === "outputPricePerMillion" &&
        typeof field.approved === "number" &&
        typeof field.current === "number" &&
        field.current > field.approved
      ) {
        const pct = pctIncrease(field.approved, field.current);
        if (pct > policy.maxOutputPriceIncreasePercent) {
          findings.push({
            key: modelDiff.key,
            field: field.field,
            severity: block ? "fail" : "warn",
            code: "output-price-increase",
            message: `Output price increased ${pct.toFixed(1)}% (max ${policy.maxOutputPriceIncreasePercent}%)`,
            confidence: conf,
            path: dep?.discovery.occurrences[0]?.path,
            line: dep?.discovery.occurrences[0]?.line,
          });
        }
      }

      if (
        policy.failOnContextDecrease &&
        field.field === "contextLimit" &&
        typeof field.approved === "number" &&
        typeof field.current === "number" &&
        field.current < field.approved
      ) {
        findings.push({
          key: modelDiff.key,
          field: field.field,
          severity: block ? "fail" : "warn",
          code: "context-decrease",
          message: `Context limit decreased from ${field.approved} to ${field.current}`,
          confidence: conf,
          path: dep?.discovery.occurrences[0]?.path,
          line: dep?.discovery.occurrences[0]?.line,
        });
      }

      if (
        policy.failOnMaxOutputDecrease &&
        field.field === "maxOutputLimit" &&
        typeof field.approved === "number" &&
        typeof field.current === "number" &&
        field.current < field.approved
      ) {
        findings.push({
          key: modelDiff.key,
          field: field.field,
          severity: block ? "fail" : "warn",
          code: "max-output-decrease",
          message: `Max output decreased from ${field.approved} to ${field.current}`,
          confidence: conf,
          path: dep?.discovery.occurrences[0]?.path,
          line: dep?.discovery.occurrences[0]?.line,
        });
      }

      if (
        policy.failOnToolCallingRemoval &&
        field.field === "toolCalling" &&
        field.approved === true &&
        field.current === false
      ) {
        findings.push({
          key: modelDiff.key,
          field: field.field,
          severity: block ? "fail" : "warn",
          code: "tool-calling-removal",
          message: "Tool-calling support removed",
          confidence: conf,
          path: dep?.discovery.occurrences[0]?.path,
          line: dep?.discovery.occurrences[0]?.line,
        });
      }

      if (
        policy.failOnStructuredOutputRemoval &&
        field.field === "structuredOutput" &&
        field.approved === true &&
        field.current === false
      ) {
        findings.push({
          key: modelDiff.key,
          field: field.field,
          severity: block ? "fail" : "warn",
          code: "structured-output-removal",
          message: "Structured-output support removed",
          confidence: conf,
          path: dep?.discovery.occurrences[0]?.path,
          line: dep?.discovery.occurrences[0]?.line,
        });
      }

      if (
        policy.failOnVisionRemoval &&
        field.field === "vision" &&
        field.approved === true &&
        field.current === false
      ) {
        findings.push({
          key: modelDiff.key,
          field: field.field,
          severity: block ? "fail" : "warn",
          code: "vision-removal",
          message: "Vision support removed",
          confidence: conf,
          path: dep?.discovery.occurrences[0]?.path,
          line: dep?.discovery.occurrences[0]?.line,
        });
      }

      // Lifecycle regressions
      if (
        field.field === "lifecycleStatus" &&
        field.approved === "active" &&
        (field.current === "deprecated" || field.current === "retired")
      ) {
        findings.push({
          key: modelDiff.key,
          field: field.field,
          severity: block ? "fail" : "warn",
          code: "lifecycle-regression",
          message: `Lifecycle changed from ${String(field.approved)} to ${String(field.current)}`,
          confidence: conf,
          path: dep?.discovery.occurrences[0]?.path,
          line: dep?.discovery.occurrences[0]?.line,
        });
      }
    }
  }

  const hasFail = findings.some((f) => f.severity === "fail");
  return {
    findings: findings.sort((a, b) => a.key.localeCompare(b.key) || a.code.localeCompare(b.code)),
    diffs,
    exitCode: hasFail ? ExitCode.PolicyFailure : ExitCode.Success,
    warnings,
  };
}
