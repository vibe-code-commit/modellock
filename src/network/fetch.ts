import { PACKAGE_VERSION } from "../types/constants.js";
import { isAllowedFetchUrl } from "./allowlist.js";

export type FetchLike = (input: string | URL, init?: RequestInit) => Promise<Response>;

export class NetworkError extends Error {
  readonly code: "timeout" | "oversized" | "http" | "network" | "invalid" | "allowlist";
  override readonly cause?: unknown;

  constructor(
    message: string,
    code: "timeout" | "oversized" | "http" | "network" | "invalid" | "allowlist",
    cause?: unknown,
  ) {
    super(message);
    this.name = "NetworkError";
    this.code = code;
    if (cause !== undefined) {
      this.cause = cause;
    }
  }
}

export interface LimitedFetchOptions {
  url: string;
  timeoutMs: number;
  maxBytes: number;
  fetchImpl?: FetchLike | undefined;
  headers?: Record<string, string> | undefined;
  maxRedirects?: number | undefined;
}

export interface LimitedFetchResult {
  body: string;
  status: number;
  url: string;
  bytes: number;
}

async function readBodyLimited(
  res: Response,
  maxBytes: number,
): Promise<{ body: string; bytes: number }> {
  const contentLength = res.headers.get("content-length");
  if (contentLength && Number(contentLength) > maxBytes) {
    throw new NetworkError(
      `Response Content-Length ${contentLength} exceeds maxBytes ${maxBytes}`,
      "oversized",
    );
  }

  const reader = res.body?.getReader();
  if (!reader) {
    const text = await res.text();
    if (Buffer.byteLength(text, "utf8") > maxBytes) {
      throw new NetworkError(`Response body exceeds maxBytes ${maxBytes}`, "oversized");
    }
    return { body: text, bytes: Buffer.byteLength(text) };
  }

  const chunks: Uint8Array[] = [];
  let total = 0;
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    if (value) {
      total += value.byteLength;
      if (total > maxBytes) {
        await reader.cancel();
        throw new NetworkError(`Response body exceeds maxBytes ${maxBytes}`, "oversized");
      }
      chunks.push(value);
    }
  }
  const body = Buffer.concat(chunks.map((c) => Buffer.from(c))).toString("utf8");
  return { body, bytes: total };
}

/**
 * Deterministic, timeout-limited, size-limited HTTP GET for public metadata.
 * HTTPS + hostname allowlist; redirects to off-allowlist hosts are rejected.
 */
export async function limitedFetch(opts: LimitedFetchOptions): Promise<LimitedFetchResult> {
  const fetchImpl = opts.fetchImpl ?? globalThis.fetch;
  const maxRedirects = opts.maxRedirects ?? 3;
  const initial = isAllowedFetchUrl(opts.url);
  if (!initial.ok) {
    throw new NetworkError(initial.reason, "allowlist");
  }

  let currentUrl = initial.url.toString();
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), opts.timeoutMs);

  try {
    for (let hop = 0; hop <= maxRedirects; hop++) {
      const allowed = isAllowedFetchUrl(currentUrl);
      if (!allowed.ok) {
        throw new NetworkError(allowed.reason, "allowlist");
      }

      const res = await fetchImpl(currentUrl, {
        method: "GET",
        signal: controller.signal,
        headers: {
          Accept: "application/json, text/plain;q=0.9, */*;q=0.1",
          "User-Agent": `modellock/${PACKAGE_VERSION} (+https://github.com/vibe-code-commit/modellock)`,
          ...opts.headers,
        },
        redirect: "manual",
      });

      if (res.status >= 300 && res.status < 400) {
        const location = res.headers.get("location");
        if (!location) {
          throw new NetworkError(`Redirect without Location from ${currentUrl}`, "http");
        }
        const next = new URL(location, currentUrl).toString();
        const nextAllowed = isAllowedFetchUrl(next);
        if (!nextAllowed.ok) {
          throw new NetworkError(
            `Redirect to unapproved host rejected: ${nextAllowed.reason}`,
            "allowlist",
          );
        }
        currentUrl = next;
        continue;
      }

      const { body, bytes } = await readBodyLimited(res, opts.maxBytes);
      if (!res.ok) {
        throw new NetworkError(`HTTP ${res.status} for ${currentUrl}`, "http");
      }

      const contentType = res.headers.get("content-type") ?? "";
      if (
        contentType &&
        !/application\/json|text\/json|text\/plain|\+json/i.test(contentType) &&
        !contentType.includes("javascript")
      ) {
        // Soft check: allow empty/missing; reject clearly HTML error pages
        if (/text\/html/i.test(contentType)) {
          throw new NetworkError(
            `Unexpected Content-Type ${contentType} from ${currentUrl}`,
            "invalid",
          );
        }
      }

      return { body, status: res.status, url: currentUrl, bytes };
    }

    throw new NetworkError(`Too many redirects (max ${maxRedirects}) for ${opts.url}`, "http");
  } catch (err) {
    if (err instanceof NetworkError) throw err;
    if (err instanceof Error && err.name === "AbortError") {
      throw new NetworkError(
        `Request timed out after ${opts.timeoutMs}ms: ${opts.url}`,
        "timeout",
        err,
      );
    }
    throw new NetworkError(
      `Network failure for ${opts.url}: ${err instanceof Error ? err.message : String(err)}`,
      "network",
      err,
    );
  } finally {
    clearTimeout(timer);
  }
}

export function parseJsonBody(body: string, url: string): unknown {
  try {
    return JSON.parse(body) as unknown;
  } catch (err) {
    throw new NetworkError(
      `Invalid JSON from ${url}: ${err instanceof Error ? err.message : String(err)}`,
      "invalid",
      err,
    );
  }
}
