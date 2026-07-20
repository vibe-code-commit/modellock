import type { PolicyFinding } from "../types/schemas.js";
import type { PolicyResult } from "../policy/engine.js";
import { sanitizeForPrint, sanitizeLine } from "../sanitize/index.js";

type EvalResult = PolicyResult;

export function formatHumanReport(result: EvalResult, opts: { title?: string } = {}): string {
  const lines: string[] = [];
  lines.push(opts.title ?? "ModelLock check");
  lines.push("");

  const fails = result.findings.filter((f) => f.severity === "fail");
  const warns = result.findings.filter((f) => f.severity === "warn");

  lines.push(`Findings: ${fails.length} fail, ${warns.length} warn`);
  if (result.warnings.length) {
    lines.push("Warnings:");
    for (const w of result.warnings) {
      lines.push(`  - ${sanitizeLine(w)}`);
    }
  }
  lines.push("");

  for (const f of result.findings) {
    lines.push(formatFindingLine(f));
  }

  if (result.findings.length === 0) {
    lines.push("No policy findings.");
  }

  return sanitizeForPrint(lines.join("\n"));
}

function formatFindingLine(f: PolicyFinding): string {
  const loc = f.path ? `${f.path}${f.line ? `:${f.line}` : ""}` : "";
  const conf = f.confidence ? ` [${f.confidence}]` : "";
  return sanitizeLine(
    `${f.severity.toUpperCase()} ${f.code} ${f.key}.${f.field}${conf}${loc ? ` @ ${loc}` : ""}: ${f.message}`,
  );
}

export function formatJsonReport(result: EvalResult): string {
  return JSON.stringify(
    {
      exitCode: result.exitCode,
      findings: result.findings,
      warnings: result.warnings,
      diffs: result.diffs,
    },
    null,
    2,
  );
}

export function formatSarifReport(result: EvalResult, toolVersion: string): string {
  const sarif = {
    $schema: "https://json.schemastore.org/sarif-2.1.0.json",
    version: "2.1.0",
    runs: [
      {
        tool: {
          driver: {
            name: "modellock",
            version: toolVersion,
            informationUri: "https://github.com/vibe-code-commit/modellock",
            rules: uniqueRules(result.findings),
          },
        },
        results: result.findings.map((f) => ({
          ruleId: f.code,
          level: f.severity === "fail" ? "error" : f.severity === "warn" ? "warning" : "note",
          message: { text: sanitizeLine(f.message) },
          locations: f.path
            ? [
                {
                  physicalLocation: {
                    artifactLocation: { uri: f.path.replace(/\\/g, "/") },
                    region: { startLine: f.line ?? 1 },
                  },
                },
              ]
            : [],
        })),
      },
    ],
  };
  return JSON.stringify(sarif, null, 2);
}

function uniqueRules(findings: PolicyFinding[]) {
  const seen = new Set<string>();
  const rules = [];
  for (const f of findings) {
    if (seen.has(f.code)) continue;
    seen.add(f.code);
    rules.push({
      id: f.code,
      shortDescription: { text: f.code },
      fullDescription: { text: sanitizeLine(f.message) },
    });
  }
  return rules;
}

export function formatMarkdownChangeReport(opts: {
  previousKeys: string[];
  nextKeys: string[];
  findings: PolicyFinding[];
  warnings: string[];
}): string {
  const added = opts.nextKeys.filter((k) => !opts.previousKeys.includes(k));
  const removed = opts.previousKeys.filter((k) => !opts.nextKeys.includes(k));
  const lines = [
    "# ModelLock update report",
    "",
    `## Dependencies`,
    "",
    `- Previous: ${opts.previousKeys.length}`,
    `- Proposed: ${opts.nextKeys.length}`,
    `- Added: ${added.length ? added.join(", ") : "(none)"}`,
    `- Removed: ${removed.length ? removed.join(", ") : "(none)"}`,
    "",
    "## Policy preview",
    "",
  ];
  if (!opts.findings.length) {
    lines.push("No findings.");
  } else {
    for (const f of opts.findings) {
      lines.push(`- **${f.severity}** \`${f.code}\` ${f.key}: ${sanitizeLine(f.message)}`);
    }
  }
  if (opts.warnings.length) {
    lines.push("", "## Warnings", "");
    for (const w of opts.warnings) lines.push(`- ${sanitizeLine(w)}`);
  }
  lines.push("");
  return lines.join("\n");
}

export function formatExplain(opts: {
  key: string;
  approved: unknown;
  current: unknown;
  diffs: unknown;
  policy: PolicyResult | EvalResult;
}): string {
  const lines = [
    `ModelLock explain: ${opts.key}`,
    "",
    "## Approved",
    "```json",
    JSON.stringify(opts.approved, null, 2),
    "```",
    "",
    "## Current",
    "```json",
    JSON.stringify(opts.current, null, 2),
    "```",
    "",
    "## Differences",
    "```json",
    JSON.stringify(opts.diffs, null, 2),
    "```",
    "",
    "## Policy",
    formatHumanReport(opts.policy, { title: "Policy result" }),
  ];
  return sanitizeForPrint(lines.join("\n"));
}
