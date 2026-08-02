// Failover state-machine tests for the multi-LLM router. The most intricate
// logic in the repo previously had no validation other than live paid traffic;
// these cases pin the semantics that decisions 012/013 and the ai-subsystem
// plan (Phase 0) define. A fake client is injected via __setClientFactory, so
// no keys or network are involved; module-global state resets per test.

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { z } from 'zod'
import {
  completeJSON,
  dailyLimitsExhausted,
  drafterLaneStress,
  probeTargets,
  __resetRouterState,
  __setClientFactory,
} from './router'

// Every default target must look configured (record()/laneStep read these).
const KEY_ENVS = [
  'MISTRAL_MINISTRAL_8B_API_KEY',
  'GROQ_QWEN_3_POINT_6_27B_API_KEY',
  'GROQ_OPENAI_GPT_OSS_20B_API_KEY',
  'GEMINI_FLASH_2_POINT_5_API_KEY',
  'CEREBRAS_GPT_OSS_120B_API_KEY',
  'OPENROUTER_API_KEY',
]
for (const k of KEY_ENVS) process.env[k] = 'test-key'

const MODELS = {
  mistral: 'ministral-8b-latest',
  groqQwen: 'qwen/qwen3.6-27b',
  groqOss: 'openai/gpt-oss-20b',
  gemini: 'gemini-2.5-flash',
  cerebras: 'gpt-oss-120b',
  openrouter: 'qwen/qwen3-coder:free',
}

interface Call {
  provider: string
  model: string
  params: Record<string, unknown>
}

const OK = '{"ok":true}'
const Schema = z.object({ ok: z.boolean() })

// Per-test behavior: return content, or throw. Keyed off model (and call order
// via the calls array when a test needs "first call fails, second succeeds").
let script: (model: string, params: Record<string, unknown>) => string
const calls: Call[] = []

function makeErr(status: number | undefined, message = 'provider error'): Error {
  const e = new Error(message) as Error & { status?: number }
  if (status !== undefined) e.status = status
  return e
}

function ask(
  role: 'coach' | 'critic' | 'suggestor' | 'drafter',
  overrides: { effort?: 'low' | 'high'; user?: string } = {}
) {
  return completeJSON({
    role,
    system: 'sys',
    user: overrides.user ?? 'hi',
    schema: Schema,
    schemaName: 'test',
    effort: overrides.effort ?? 'low',
    maxTokens: 100,
  })
}

beforeEach(() => {
  __resetRouterState()
  calls.length = 0
  script = () => OK
  __setClientFactory((t) => ({
    chat: {
      completions: {
        create: async (params: Record<string, unknown>) => {
          calls.push({ provider: t.provider, model: t.model, params })
          const content = script(t.model, params)
          return { choices: [{ message: { content } }] }
        },
      },
    },
  }))
  vi.spyOn(console, 'error').mockImplementation(() => {})
})

afterEach(() => {
  vi.useRealTimers()
  vi.restoreAllMocks()
})

describe('lane order and 429 cascade', () => {
  it('suggestor walks cerebras → mistral → groq on 429s and stops at first success', async () => {
    script = (m) => {
      if (m === MODELS.cerebras || m === MODELS.mistral) throw makeErr(429, 'rate limit')
      return OK
    }
    await expect(ask('suggestor')).resolves.toEqual({ ok: true })
    expect(calls.map((c) => c.model)).toEqual([MODELS.cerebras, MODELS.mistral, MODELS.groqQwen])
  })
})

describe('groq penalty box', () => {
  it('opens on a groq 429, diverts realtime traffic for 30s, then recovers on gpt-oss-20b', async () => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date('2026-07-16T12:00:00Z'))

    // Call 1: mistral 429 → groq qwen 429 (opens penalty) → gemini serves.
    script = (m) => {
      if (m === MODELS.mistral || m === MODELS.groqQwen) throw makeErr(429, 'rate limit')
      return OK
    }
    await expect(ask('coach')).resolves.toEqual({ ok: true })
    expect(calls.at(-1)?.model).toBe(MODELS.gemini)

    // Call 2, inside the 30s box: groq is skipped entirely.
    calls.length = 0
    script = (m) => {
      if (m === MODELS.mistral) throw makeErr(429, 'rate limit')
      return OK
    }
    await ask('coach')
    expect(calls.map((c) => c.model)).toEqual([MODELS.mistral, MODELS.gemini])

    // Call 3, after the box clears: groq returns on the SAFER model until a
    // success clears recovery.
    vi.setSystemTime(new Date('2026-07-16T12:00:31Z'))
    calls.length = 0
    await ask('coach')
    expect(calls.map((c) => c.model)).toEqual([MODELS.mistral, MODELS.groqOss])

    // Call 4: recovery cleared by the success — back on qwen.
    calls.length = 0
    await ask('coach')
    expect(calls.map((c) => c.model)).toEqual([MODELS.mistral, MODELS.groqQwen])
  })
})

describe('daily airbag (per provider)', () => {
  const DAILY = 'You exceeded your requests per day quota'

  it('one provider daily-exhausted does NOT reach OpenRouter while others merely rate-limit', async () => {
    script = (m) => {
      if (m === MODELS.gemini) throw makeErr(429, DAILY)
      throw makeErr(429, 'per-minute rate limit') // cerebras, groq: transient only
    }
    await expect(ask('drafter')).rejects.toMatchObject({ status: 429, message: 'ai-rate-limited' })
    expect(calls.some((c) => c.model === MODELS.openrouter)).toBe(false)
    expect(dailyLimitsExhausted()).toBe(true) // gemini marked, monitor signal
  })

  it('fires OpenRouter only when the whole lane is daily-exhausted, and skips marked providers', async () => {
    script = (m) => {
      if ([MODELS.gemini, MODELS.cerebras, MODELS.groqOss].includes(m)) {
        throw makeErr(429, DAILY)
      }
      return OK
    }
    await expect(ask('drafter')).resolves.toEqual({ ok: true })
    expect(calls.map((c) => c.model)).toEqual([
      MODELS.groqOss,
      MODELS.gemini,
      MODELS.cerebras,
      MODELS.openrouter,
    ])

    // Next drafter request: all four marked providers are skipped without a call.
    calls.length = 0
    await expect(ask('drafter')).resolves.toEqual({ ok: true })
    expect(calls.map((c) => c.model)).toEqual([MODELS.openrouter])
  })
})

describe('drafter lane stress signal', () => {
  const DAILY = 'You exceeded your requests per day quota'

  it('is none with no daily exhaustion', () => {
    expect(drafterLaneStress()).toBe('none')
  })

  it('is degraded once groq is daily-exhausted but fallbacks stay healthy', async () => {
    script = (m) => (m === MODELS.groqOss ? (() => { throw makeErr(429, DAILY) })() : OK)
    await ask('drafter')
    expect(drafterLaneStress()).toBe('degraded')
  })

  it('is critical once groq is out and a fallback also shows elevated recent failures', async () => {
    // Call 1: groq daily-exhausts, gemini serves.
    script = (m) => (m === MODELS.groqOss ? (() => { throw makeErr(429, DAILY) })() : OK)
    await ask('drafter')
    expect(drafterLaneStress()).toBe('degraded')

    // Call 2: groq now skipped (daily-exhausted); gemini rate-limits, cerebras serves —
    // gemini's recent event ratio (1 rate-limited of 2) crosses the stress threshold.
    script = (m) => (m === MODELS.gemini ? (() => { throw makeErr(429, 'rate limit') })() : OK)
    await ask('drafter')
    expect(drafterLaneStress()).toBe('critical')
  })
})

describe('transient vs terminal errors', () => {
  it('5xx cascades to the next target', async () => {
    script = (m) => {
      if (m === MODELS.mistral) throw makeErr(500)
      return OK
    }
    await expect(ask('coach')).resolves.toEqual({ ok: true })
    expect(calls.map((c) => c.model)).toEqual([MODELS.mistral, MODELS.groqQwen])
  })

  it('timeout/network (no status) cascades', async () => {
    script = (m) => {
      if (m === MODELS.mistral) throw makeErr(undefined, 'Request timed out.')
      return OK
    }
    await expect(ask('coach')).resolves.toEqual({ ok: true })
    expect(calls.length).toBe(2)
  })

  it('a sunset model id (404) cascades instead of killing the lane', async () => {
    script = (m) => {
      if (m === MODELS.mistral) throw makeErr(404, 'model not found')
      return OK
    }
    await expect(ask('coach')).resolves.toEqual({ ok: true })
    expect(calls.map((c) => c.model)).toEqual([MODELS.mistral, MODELS.groqQwen])
  })

  it('empty generation cascades', async () => {
    script = (m) => (m === MODELS.mistral ? '' : OK)
    await expect(ask('coach')).resolves.toEqual({ ok: true })
    expect(calls.map((c) => c.model)).toEqual([MODELS.mistral, MODELS.groqQwen])
  })

  it("Groq's json_validate_failed (its own generation failing strict-schema validation) cascades, not thrown as a terminal 400", async () => {
    script = (m) => {
      if (m === MODELS.groqOss) {
        throw makeErr(400, 'Failed to generate JSON. json_validate_failed invalid_request_error')
      }
      return OK
    }
    await expect(ask('drafter')).resolves.toEqual({ ok: true })
    expect(calls.map((c) => c.model)).toEqual([MODELS.groqOss, MODELS.gemini])
  })

  it('401 is terminal (misconfiguration must surface)', async () => {
    script = () => {
      throw makeErr(401)
    }
    await expect(ask('coach')).rejects.toMatchObject({ status: 401, message: 'ai-unauthorized' })
    expect(calls.length).toBe(1)
  })

  it('400 is terminal', async () => {
    script = () => {
      throw makeErr(400, 'invalid request')
    }
    await expect(ask('coach')).rejects.toMatchObject({ status: 400, message: 'ai-bad-request' })
    expect(calls.length).toBe(1)
  })

  it('5xx on every target surfaces ai-upstream-error after the full walk', async () => {
    script = () => {
      throw makeErr(503)
    }
    await expect(ask('coach')).rejects.toMatchObject({ status: 502, message: 'ai-upstream-error' })
    expect(calls.length).toBe(4) // whole realtime lane tried, no airbag
  })
})

describe('size-aware routing and overflow', () => {
  it('a large request skips small-window targets and lands on gemini', async () => {
    await expect(ask('suggestor', { user: 'x'.repeat(600_000) })).resolves.toEqual({ ok: true })
    expect(calls.map((c) => c.model)).toEqual([MODELS.gemini])
  })

  it('a request too large for every window is 413 ai-context-overflow without any call', async () => {
    await expect(ask('drafter', { user: 'x'.repeat(4_200_000) })).rejects.toMatchObject({
      status: 413,
      message: 'ai-context-overflow',
    })
    expect(calls.length).toBe(0)
  })

  it('a provider-reported context overflow escalates to the next target', async () => {
    script = (m) => {
      if (m === MODELS.mistral) throw makeErr(400, 'maximum context length exceeded')
      return OK
    }
    await expect(ask('coach')).resolves.toEqual({ ok: true })
    expect(calls.map((c) => c.model)).toEqual([MODELS.mistral, MODELS.groqQwen])
  })
})

describe('chain deadline', () => {
  it('stops attempting once the deadline passes and throws the last transient error', async () => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date('2026-07-16T12:00:00Z'))
    script = (m) => {
      if (m === MODELS.mistral) {
        // Simulate an attempt that consumed the whole budget before failing.
        vi.setSystemTime(new Date('2026-07-16T12:00:27Z'))
        throw makeErr(500)
      }
      return OK
    }
    await expect(ask('coach')).rejects.toMatchObject({ status: 502, message: 'ai-upstream-error' })
    expect(calls.length).toBe(1) // no further attempts after the deadline
  })
})

describe('completeJSON self-correction', () => {
  it('retries once with a truncated schema error and succeeds', async () => {
    let first = true
    script = () => {
      if (first) {
        first = false
        return '{"ok":"not-a-boolean"}'
      }
      return OK
    }
    await expect(ask('suggestor')).resolves.toEqual({ ok: true })
    expect(calls.length).toBe(2)
    const retryUser = (calls[1].params.messages as { content: string }[])[1].content
    expect(retryUser).toContain('did not match the required schema')
    // Compact single-issue feedback, not zod's full stringified issue array.
    expect(retryUser).toContain('ok:')
    expect(retryUser.length).toBeLessThan(600)
  })

  it('two schema failures surface as 502 ai-invalid-output', async () => {
    script = () => '{"ok":"still-wrong"}'
    await expect(ask('suggestor')).rejects.toMatchObject({
      status: 502,
      message: 'ai-invalid-output',
    })
    expect(calls.length).toBe(2)
  })
})

describe('reasoning_effort mapping', () => {
  it('gemini gets low (not passthrough high) and none (not undefined); gpt-oss/qwen capped at their floor; mistral omits', async () => {
    // drafter now leads with Groq (gpt-oss-20b) — fail it so the chain reaches Gemini.
    script = (m) => {
      if (m === MODELS.groqOss) throw makeErr(429, 'rate limit')
      return OK
    }
    await ask('drafter', { effort: 'high' })
    expect(calls.at(-1)?.params.reasoning_effort).toBe('low')

    calls.length = 0
    await ask('drafter', { effort: 'low' })
    expect(calls.at(-1)?.params.reasoning_effort).toBe('none')

    calls.length = 0
    script = () => OK
    // gpt-oss capped at its floor ('low') regardless of requested effort — see
    // reasoningEffortFor (router-shared.ts): 'high' was confirmed live to
    // starve the actual JSON output of its token budget.
    await ask('suggestor', { effort: 'high' }) // cerebras gpt-oss-120b primary
    expect(calls.at(-1)?.params.reasoning_effort).toBe('low')

    calls.length = 0
    await ask('coach', { effort: 'high' }) // mistral primary
    expect(calls.at(-1)?.params).not.toHaveProperty('reasoning_effort')
  })
})

describe('probes', () => {
  it('sends the same structured-output shape as live traffic', async () => {
    const results = await probeTargets()
    expect(results.every((r) => r.up)).toBe(true)
    for (const call of calls) {
      const rf = call.params.response_format as { type: string }
      expect(rf).toBeDefined()
      expect(rf.type).toBe(call.model.includes('gpt-oss') ? 'json_schema' : 'json_object')
    }
  })

  it('an AiError never leaks from a failing probe', async () => {
    script = () => {
      throw makeErr(400, 'response_format not supported')
    }
    const results = await probeTargets()
    expect(results.every((r) => !r.up && r.status === 'error')).toBe(true)
  })
})
