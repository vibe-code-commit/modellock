export type FetchLike = (input: string | URL, init?: RequestInit) => Promise<Response>;

export class NetworkError extends Error {
  readonly code: "timeout" | "oversized" | "http" | "network" | "invalid";
  override readonly cause?: unknown;

  constructor(
    message: string,
    code: "timeout" | "oversized" | "http" | "network" | "invalid",
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
}

export interface LimitedFetchResult {
  body: string;
  status: number;
  url: string;
  bytes: number;
}

/**
 * Deterministic, timeout-limited, size-limited HTTP GET for public metadata.
 */
export async function limitedFetch(opts: LimitedFetchOptions): Promise<LimitedFetchResult> {
  const fetchImpl = opts.fetchImpl ?? globalThis.fetch;
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), opts.timeoutMs);

  try {
    const res = await fetchImpl(opts.url, {
      method: "GET",
      signal: controller.signal,
      headers: {
        Accept: "application/json, text/plain;q=0.9, */*;q=0.1",
        "User-Agent": "model-lock/0.1.0 (+https://github.com/vibe-code-commit/model-lock)",
        ...opts.headers,
      },
      redirect: "follow",
    });

    const contentLength = res.headers.get("content-length");
    if (contentLength && Number(contentLength) > opts.maxBytes) {
      throw new NetworkError(
        `Response Content-Length ${contentLength} exceeds maxBytes ${opts.maxBytes}`,
        "oversized",
      );
    }

    const reader = res.body?.getReader();
    if (!reader) {
      const text = await res.text();
      if (Buffer.byteLength(text, "utf8") > opts.maxBytes) {
        throw new NetworkError(`Response body exceeds maxBytes ${opts.maxBytes}`, "oversized");
      }
      if (!res.ok) {
        throw new NetworkError(`HTTP ${res.status} for ${opts.url}`, "http");
      }
      return { body: text, status: res.status, url: opts.url, bytes: Buffer.byteLength(text) };
    }

    const chunks: Uint8Array[] = [];
    let total = 0;
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      if (value) {
        total += value.byteLength;
        if (total > opts.maxBytes) {
          await reader.cancel();
          throw new NetworkError(`Response body exceeds maxBytes ${opts.maxBytes}`, "oversized");
        }
        chunks.push(value);
      }
    }

    const body = Buffer.concat(chunks.map((c) => Buffer.from(c))).toString("utf8");
    if (!res.ok) {
      throw new NetworkError(`HTTP ${res.status} for ${opts.url}`, "http");
    }
    return { body, status: res.status, url: opts.url, bytes: total };
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
