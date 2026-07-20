/**
 * Strip HTML tags and dangerous content before printing to terminals or reports.
 * Never prints raw HTML.
 */
export function sanitizeForPrint(input: string): string {
  let s = input;
  // Remove script/style blocks first
  s = s.replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi, "");
  s = s.replace(/<style\b[^>]*>[\s\S]*?<\/style>/gi, "");
  // Remove all HTML tags
  s = s.replace(/<\/?[a-zA-Z][^>]*>/g, "");
  // Decode a minimal set of entities
  s = s
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&amp;/g, "&")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&nbsp;/g, " ");
  // Strip control chars except tab/newline
  // eslint-disable-next-line no-control-regex -- intentional control-character scrubbing
  s = s.replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/g, "");
  // Collapse excessive whitespace for single-line contexts is caller-controlled
  return s;
}

export function sanitizeLine(input: string): string {
  return sanitizeForPrint(input).replace(/\s+/g, " ").trim();
}
