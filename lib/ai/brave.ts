// Server-only Brave Web Search client. Research Mode's ONLY source of evidence —
// candidates that don't trace to a URL returned here are dropped upstream
// (invariant 3: evidence cites only Brave results from the same request). Never
// model memory. See plans/active/ai/06-research-mode.md.

import { AiError } from './groq'

if (typeof window !== 'undefined') {
  throw new Error('lib/ai/brave.ts is server-only and must not run in the browser')
}

export interface BraveResult {
  title: string
  url: string
  description: string
}

const ENDPOINT = 'https://api.search.brave.com/res/v1/web/search'

export async function braveSearch(query: string, count = 6): Promise<BraveResult[]> {
  const key = process.env.BRAVE_SEARCH_API_KEY
  if (!key) throw new AiError(500, 'search-not-configured')

  const controller = new AbortController()
  const timeout = setTimeout(() => controller.abort(), 10_000)

  let res: Response
  try {
    const url = `${ENDPOINT}?q=${encodeURIComponent(query)}&count=${count}`
    res = await fetch(url, {
      headers: {
        Accept: 'application/json',
        'X-Subscription-Token': key,
      },
      signal: controller.signal,
    })
  } catch {
    // Timeout / network error.
    throw new AiError(502, 'search-failed')
  } finally {
    clearTimeout(timeout)
  }

  if (res.status === 429) throw new AiError(429, 'search-rate-limited')
  if (!res.ok) throw new AiError(502, 'search-failed')

  let data: unknown
  try {
    data = await res.json()
  } catch {
    throw new AiError(502, 'search-failed')
  }

  // web.results[] → { title, url, description } (verified against Brave docs).
  const results = (data as { web?: { results?: unknown[] } })?.web?.results ?? []
  return results
    .map((r) => {
      const o = r as { title?: string; url?: string; description?: string }
      return {
        title: (o.title ?? '').trim(),
        url: (o.url ?? '').trim(),
        description: (o.description ?? '').trim(),
      }
    })
    .filter((r) => r.url.length > 0)
}
