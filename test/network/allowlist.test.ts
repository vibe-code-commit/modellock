import { describe, it, expect, vi } from "vitest";
import { isAllowedFetchUrl } from "../../src/network/allowlist.js";
import { limitedFetch, type NetworkError } from "../../src/network/fetch.js";

describe("network allowlist", () => {
  it("allows HTTPS models.dev and deprecations.info", () => {
    expect(isAllowedFetchUrl("https://models.dev/api.json").ok).toBe(true);
    expect(isAllowedFetchUrl("https://deprecations.info/api").ok).toBe(true);
  });

  it("rejects non-HTTPS and off-allowlist hosts", () => {
    expect(isAllowedFetchUrl("http://models.dev/api.json").ok).toBe(false);
    expect(isAllowedFetchUrl("https://evil.example/x").ok).toBe(false);
  });

  it("rejects redirects to off-allowlist hosts", async () => {
    const fetchImpl = vi.fn(async () => {
      return new Response(null, {
        status: 302,
        headers: { Location: "https://evil.example/steal" },
      });
    });

    await expect(
      limitedFetch({
        url: "https://models.dev/api.json",
        timeoutMs: 1000,
        maxBytes: 1024,
        fetchImpl: fetchImpl as unknown as typeof fetch,
      }),
    ).rejects.toMatchObject({ code: "allowlist" } satisfies Partial<NetworkError>);
  });
});
