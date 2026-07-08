// Returns the URL only if it is a well-formed http(s) URL, else null. Guards
// against rendering attacker-controlled hrefs (e.g. `javascript:` or `data:`
// URLs) — React does not sanitize the href attribute. Evidence URLs are
// user/collaborator-writable on a shared house, so link rendering must gate on
// this rather than trust the stored value.
export function safeHttpUrl(url: string | undefined | null): string | null {
  if (!url) return null
  let parsed: URL
  try {
    parsed = new URL(url)
  } catch {
    return null
  }
  return parsed.protocol === 'http:' || parsed.protocol === 'https:' ? url : null
}
