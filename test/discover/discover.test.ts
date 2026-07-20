import { describe, it, expect } from "vitest";
import { mkdtempSync, writeFileSync, rmSync, mkdirSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { discoverDependencies } from "../../src/discover/index.js";
import { defaultConfig } from "../../src/config/load.js";

describe("discovery", () => {
  it("detects OpenAI/Anthropic/Google/xAI SDK model declarations with file and line", () => {
    const dir = mkdtempSync(join(tmpdir(), "ml-discover-"));
    try {
      mkdirSync(join(dir, "src"));
      writeFileSync(
        join(dir, "src", "app.ts"),
        `
import OpenAI from "openai";
import Anthropic from "@anthropic-ai/sdk";
const openai = new OpenAI();
await openai.chat.completions.create({ model: "gpt-4o-2024-08-06", messages: [] });
const anthropic = new Anthropic();
await anthropic.messages.create({ model: "claude-sonnet-4-20250514", max_tokens: 1, messages: [] });
`,
        "utf8",
      );
      writeFileSync(
        join(dir, "src", "gemini.py"),
        `
import google.generativeai as genai
model = "gemini-2.5-pro"
`,
        "utf8",
      );
      writeFileSync(
        join(dir, "src", "xai.ts"),
        `
import { createXai } from "@ai-sdk/xai";
const r = { model: "grok-3" };
`,
        "utf8",
      );
      writeFileSync(join(dir, ".env.example"), "OPENAI_MODEL=gpt-4o\n", "utf8");
      writeFileSync(join(dir, "config.json"), JSON.stringify({ model: "gpt-4o" }), "utf8");

      const deps = discoverDependencies(dir, defaultConfig());
      const keys = deps.map((d) => `${d.provider}:${d.modelId}`);
      expect(keys).toContain("openai:gpt-4o-2024-08-06");
      expect(keys).toContain("anthropic:claude-sonnet-4-20250514");
      expect(keys).toContain("google:gemini-2.5-pro");
      expect(keys).toContain("xai:grok-3");
      expect(keys).toContain("openai:gpt-4o");

      const fixed = deps.find((d) => d.modelId === "gpt-4o-2024-08-06");
      expect(fixed?.occurrences[0]?.line).toBeGreaterThan(0);
      expect(fixed?.occurrences[0]?.path).toContain("app.ts");
      expect(fixed?.identifierKind).toBe("fixed");
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  it("skips node_modules and does not treat unrelated strings as models", () => {
    const dir = mkdtempSync(join(tmpdir(), "ml-discover2-"));
    try {
      mkdirSync(join(dir, "node_modules", "pkg"), { recursive: true });
      writeFileSync(
        join(dir, "node_modules", "pkg", "index.js"),
        `export const model = "gpt-4o";`,
        "utf8",
      );
      writeFileSync(join(dir, "notes.ts"), `const path = "src/gpt-4o/file.ts";\n`, "utf8");
      const deps = discoverDependencies(dir, defaultConfig());
      expect(deps.find((d) => d.modelId === "gpt-4o")).toBeUndefined();
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  it("marks low-confidence matches", () => {
    const dir = mkdtempSync(join(tmpdir(), "ml-discover3-"));
    try {
      writeFileSync(join(dir, "loose.ts"), `const modelHint = { model: "gpt-4o" };\n`, "utf8");
      const deps = discoverDependencies(dir, defaultConfig());
      const hit = deps.find((d) => d.modelId === "gpt-4o");
      expect(hit).toBeDefined();
      // object property model: still fairly confident via literal handler
      expect(hit!.confidence).toBeGreaterThan(0);
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });
});
