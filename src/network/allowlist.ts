/** Hostnames allowed for public metadata fetches (HTTPS only). */
export const ALLOWED_FETCH_HOSTS = new Set([
  "models.dev",
  "www.models.dev",
  "deprecations.info",
  "www.deprecations.info",
]);

export function isAllowedFetchUrl(
  urlString: string,
): { ok: true; url: URL } | { ok: false; reason: string } {
  let url: URL;
  try {
    url = new URL(urlString);
  } catch {
    return { ok: false, reason: `Invalid URL: ${urlString}` };
  }
  if (url.protocol !== "https:") {
    return { ok: false, reason: `Only HTTPS is allowed (got ${url.protocol})` };
  }
  if (!ALLOWED_FETCH_HOSTS.has(url.hostname.toLowerCase())) {
    return {
      ok: false,
      reason: `Hostname not on allowlist: ${url.hostname}`,
    };
  }
  return { ok: true, url };
}
