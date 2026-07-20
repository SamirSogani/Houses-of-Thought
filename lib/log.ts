// Structured server-side logging: one JSON line per event so Vercel's log
// search can filter on level/scope and a future log drain needs zero parsing
// work. Dependency-free on purpose. Level maps to the console method (error →
// console.error etc.) so Vercel's own severity classification stays intact.

type LogLevel = 'info' | 'warn' | 'error'
export type LogMeta = Record<string, unknown>

function emit(level: LogLevel, scope: string, msg: string, meta?: LogMeta): void {
  const line: Record<string, unknown> = { level, scope, msg }
  if (meta) {
    for (const [k, v] of Object.entries(meta)) {
      // Error instances stringify to {} — flatten to the message instead.
      line[k] = v instanceof Error ? v.message : v
    }
  }
  let out: string
  try {
    out = JSON.stringify(line)
  } catch {
    // Circular meta must never take down the caller; keep the bare event.
    out = JSON.stringify({ level, scope, msg })
  }
  const fn = level === 'error' ? console.error : level === 'warn' ? console.warn : console.log
  fn(out)
}

export const log = {
  info: (scope: string, msg: string, meta?: LogMeta) => emit('info', scope, msg, meta),
  warn: (scope: string, msg: string, meta?: LogMeta) => emit('warn', scope, msg, meta),
  error: (scope: string, msg: string, meta?: LogMeta) => emit('error', scope, msg, meta),
}
