import { Command } from "commander";
import { PACKAGE_VERSION } from "./types/constants.js";
import { ExitCode } from "./types/schemas.js";
import { cmdInit, cmdCheck, cmdUpdate, cmdExplain } from "./commands.js";
import { omitUndefined } from "./util/omit-undefined.js";

export function createProgram(): Command {
  const program = new Command();
  program
    .name("model-lock")
    .description("package-lock.json for AI model dependencies")
    .version(PACKAGE_VERSION);

  program
    .command("init")
    .description("Discover model dependencies and create llm.lock.json")
    .option("--cwd <path>", "Working directory", process.cwd())
    .option("--data-dir <path>", "Path to ModelLock data directory")
    .option("--network", "Allow network refresh of registry sources", false)
    .action(async (opts: { cwd: string; dataDir?: string; network?: boolean }) => {
      const result = await cmdInit(
        omitUndefined({
          cwd: opts.cwd,
          dataDir: opts.dataDir,
          allowNetwork: opts.network,
        }),
      );
      process.stdout.write(result.stdout);
      process.stderr.write(result.stderr);
      process.exitCode = result.exitCode;
    });

  program
    .command("check")
    .description("Compare approved lockfile against current registry and apply policy")
    .option("--cwd <path>", "Working directory", process.cwd())
    .option("--data-dir <path>", "Path to ModelLock data directory")
    .option("--network", "Allow network refresh of registry sources", false)
    .option("--format <format>", "Output format: human | json | sarif", "human")
    .option("--fail-on-warn", "Treat warnings as failures", false)
    .action(
      async (opts: {
        cwd: string;
        dataDir?: string;
        network?: boolean;
        format?: string;
        failOnWarn?: boolean;
      }) => {
        const format = opts.format ?? "human";
        if (format !== "human" && format !== "json" && format !== "sarif") {
          process.stderr.write(`Invalid --format: ${format}\n`);
          process.exitCode = ExitCode.UsageError;
          return;
        }
        const result = await cmdCheck(
          omitUndefined({
            cwd: opts.cwd,
            dataDir: opts.dataDir,
            allowNetwork: opts.network,
            format,
            failOnWarn: opts.failOnWarn,
          }),
        );
        process.stdout.write(result.stdout);
        process.stderr.write(result.stderr);
        process.exitCode = result.exitCode;
      },
    );

  program
    .command("update")
    .description("Generate a proposed lockfile and Markdown change report")
    .option("--cwd <path>", "Working directory", process.cwd())
    .option("--data-dir <path>", "Path to ModelLock data directory")
    .option("--network", "Allow network refresh (default true for update)", true)
    .option("--no-network", "Disable network refresh")
    .option("--write", "Replace llm.lock.json with the proposal", false)
    .option("--report <path>", "Markdown report output path")
    .action(
      async (opts: {
        cwd: string;
        dataDir?: string;
        network?: boolean;
        write?: boolean;
        report?: string;
      }) => {
        const result = await cmdUpdate(
          omitUndefined({
            cwd: opts.cwd,
            dataDir: opts.dataDir,
            allowNetwork: opts.network,
            write: opts.write,
            reportPath: opts.report,
          }),
        );
        process.stdout.write(result.stdout);
        process.stderr.write(result.stderr);
        process.exitCode = result.exitCode;
      },
    );

  program
    .command("explain")
    .description("Explain approved vs current facts for a provider:model")
    .argument("<target>", "provider:model identifier")
    .option("--cwd <path>", "Working directory", process.cwd())
    .option("--data-dir <path>", "Path to ModelLock data directory")
    .option("--network", "Allow network refresh of registry sources", false)
    .action(async (target: string, opts: { cwd: string; dataDir?: string; network?: boolean }) => {
      const result = await cmdExplain(
        omitUndefined({
          cwd: opts.cwd,
          target,
          dataDir: opts.dataDir,
          allowNetwork: opts.network,
        }),
      );
      process.stdout.write(result.stdout);
      process.stderr.write(result.stderr);
      process.exitCode = result.exitCode;
    });

  return program;
}

export async function runCli(argv = process.argv): Promise<void> {
  const program = createProgram();
  program.configureOutput({
    writeErr: (str) => process.stderr.write(str),
  });
  await program.parseAsync(argv);
}

const isDirect =
  process.argv[1] &&
  (process.argv[1].endsWith("cli.ts") ||
    process.argv[1].endsWith("cli.js") ||
    process.argv[1].includes(`${"model-lock"}`));

if (isDirect) {
  runCli().catch((err: unknown) => {
    console.error(err instanceof Error ? err.message : err);
    process.exitCode = 4;
  });
}
