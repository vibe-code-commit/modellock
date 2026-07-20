import { describe, it, expect } from "vitest";

/**
 * Scheduled / opt-in live integration tests against public endpoints.
 * Never run as part of the default unit suite.
 */
describe("live public endpoints", () => {
  it("fetches models.dev api.json", async () => {
    const res = await fetch("https://models.dev/api.json", {
      signal: AbortSignal.timeout(20_000),
    });
    expect(res.ok).toBe(true);
    const data = (await res.json()) as unknown;
    expect(data).toBeTypeOf("object");
  });

  it("fetches deprecations.info feed", async () => {
    const res = await fetch("https://deprecations.info/v1/feed.json", {
      signal: AbortSignal.timeout(20_000),
    });
    expect(res.ok).toBe(true);
    const data = (await res.json()) as { items?: unknown[] };
    expect(Array.isArray(data.items)).toBe(true);
  });
});
