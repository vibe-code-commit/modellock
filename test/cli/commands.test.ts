import { describe, it, expect } from "vitest";
import { mkdtempSync, rmSync, mkdirSync, writeFileSync, readFileSync, existsSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import {
  cmdInit,
  cmdCheck,
  cmdUpdate,
  cmdExplain,
  cmdScan,
  cmdValidate,
} from "../../src/commands.js";
import { ExitCode } from "../../src/types/schemas.js";

function fixtureProject(): string {
  const dir = mkdtempSync(join(tmpdir(), "ml-cli-"));
  mkdirSync(join(dir, "src"));
  writeFileSync(
    join(dir, "src", "app.ts"),
    `import OpenAI from "openai";\nconst c = new OpenAI();\nc.chat.completions.create({ model: "gpt-4o-2024-08-06", messages: [] });\n`,
    "utf8",
  );
  return dir;
}

describe("CLI commands", () => {
  it("init creates config and lockfile without modifying source", async () => {
    const dir = fixtureProject();
    const dataDir = join(process.cwd(), "data");
    try {
      // Ensure registry exists
      if (!existsSync(join(dataDir, "registry", "latest.json"))) {
        throw new Error("registry snapshot missing; run seed first");
      }
      const before = readFileSync(join(dir, "src", "app.ts"), "utf8");
      const result = await cmdInit({ cwd: dir, dataDir, allowNetwork: false });
      expect(result.exitCode).toBe(ExitCode.Success);
      expect(existsSync(join(dir, ".llm-lock.yml"))).toBe(true);
      expect(existsSync(join(dir, "llm.lock.json"))).toBe(true);
      expect(readFileSync(join(dir, "src", "app.ts"), "utf8")).toBe(before);
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  it("init refuses overwrite without --force", async () => {
    const dir = fixtureProject();
    const dataDir = join(process.cwd(), "data");
    try {
      await cmdInit({ cwd: dir, dataDir, allowNetwork: false });
      const again = await cmdInit({ cwd: dir, dataDir, allowNetwork: false });
      expect(again.exitCode).toBe(ExitCode.InvalidConfig);
      expect(again.stderr).toMatch(/--force/);
      const forced = await cmdInit({ cwd: dir, dataDir, allowNetwork: false, force: true });
      expect(forced.exitCode).toBe(ExitCode.Success);
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  it("scan inventories without writing files", async () => {
    const dir = fixtureProject();
    try {
      const result = await cmdScan({ cwd: dir, format: "json" });
      expect(result.exitCode).toBe(ExitCode.Success);
      expect(existsSync(join(dir, "llm.lock.json"))).toBe(false);
      const parsed = JSON.parse(result.stdout) as { dependencies: unknown[] };
      expect(parsed.dependencies.length).toBeGreaterThan(0);
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  it("validate checks lockfile and registry", async () => {
    const dir = fixtureProject();
    const dataDir = join(process.cwd(), "data");
    try {
      const missing = await cmdValidate({ cwd: dir, dataDir });
      expect(missing.exitCode).toBe(ExitCode.InvalidLockfile);
      await cmdInit({ cwd: dir, dataDir, allowNetwork: false });
      const ok = await cmdValidate({ cwd: dir, dataDir });
      expect(ok.exitCode).toBe(ExitCode.Success);
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  it("check returns InvalidLockfile when lockfile missing", async () => {
    const dir = fixtureProject();
    const dataDir = join(process.cwd(), "data");
    try {
      const result = await cmdCheck({ cwd: dir, dataDir, allowNetwork: false });
      expect(result.exitCode).toBe(ExitCode.InvalidLockfile);
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  it("check returns stable success on matching registry", async () => {
    const dir = fixtureProject();
    const dataDir = join(process.cwd(), "data");
    try {
      await cmdInit({ cwd: dir, dataDir, allowNetwork: false });
      const result = await cmdCheck({ cwd: dir, dataDir, allowNetwork: false, format: "json" });
      expect([ExitCode.Success, ExitCode.PolicyFailure]).toContain(result.exitCode);
      const parsed = JSON.parse(result.stdout);
      expect(parsed).toHaveProperty("findings");
      expect(parsed).toHaveProperty("exitCode");
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  it("update requires --write to replace lockfile", async () => {
    const dir = fixtureProject();
    const dataDir = join(process.cwd(), "data");
    try {
      await cmdInit({ cwd: dir, dataDir, allowNetwork: false });
      const original = readFileSync(join(dir, "llm.lock.json"), "utf8");
      const proposed = await cmdUpdate({ cwd: dir, dataDir, allowNetwork: false, write: false });
      expect(proposed.exitCode).toBe(ExitCode.Success);
      expect(existsSync(join(dir, "llm.lock.proposed.json"))).toBe(true);
      expect(readFileSync(join(dir, "llm.lock.json"), "utf8")).toBe(original);
      const written = await cmdUpdate({ cwd: dir, dataDir, allowNetwork: false, write: true });
      expect(written.exitCode).toBe(ExitCode.Success);
      expect(existsSync(join(dir, "llm.lock.report.md"))).toBe(true);
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  it("explain shows approved and current data", async () => {
    const dir = fixtureProject();
    const dataDir = join(process.cwd(), "data");
    try {
      await cmdInit({ cwd: dir, dataDir, allowNetwork: false });
      const result = await cmdExplain({
        cwd: dir,
        dataDir,
        target: "openai:gpt-4o-2024-08-06",
        allowNetwork: false,
      });
      expect(result.exitCode).toBe(ExitCode.Success);
      expect(result.stdout).toContain("Approved");
      expect(result.stdout).toContain("Current");
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });
});
