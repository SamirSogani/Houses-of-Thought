// Persistence round-trip and save-protocol tests (frontend plan Phase 1, tests
// 1–5). A tiny recording fake stands in for the Supabase client — saveHouse
// takes the client as a parameter, so no module mocking is needed.

import { describe, expect, it, afterEach } from 'vitest'
import {
  blankState,
  loadHouse,
  loadLocalHouse,
  PERSISTED_KEYS,
  SaveError,
  saveHouse,
  saveLocalHouse,
  serializeContent,
} from './persistence'
import type { State } from './types'

// ── Recording fake Supabase client ───────────────────────────────────────────
// Chainable + thenable like the real builder. Results are scripted per
// `${table}.${op}`; every operation is recorded with payload and filters.

interface Result {
  data?: unknown
  error?: { message: string } | null
}
interface Op {
  table: string
  op: 'select' | 'update' | 'insert' | 'delete'
  payload?: unknown
  filters: [string, unknown][]
}

function fakeDb(results: Record<string, Result> = {}) {
  const ops: Op[] = []
  const resultFor = (key: string): Result => results[key] ?? { data: [], error: null }

  function from(table: string) {
    const rec: Op = { table, op: 'select', filters: [] }
    let recorded = false
    const push = () => {
      if (!recorded) {
        ops.push(rec)
        recorded = true
      }
    }
    /* eslint-disable @typescript-eslint/no-explicit-any */
    const b: any = {
      select: () => {
        push() // for update/insert this is the returning-modifier; op already set
        return b
      },
      update: (payload: unknown) => {
        rec.op = 'update'
        rec.payload = payload
        push()
        return b
      },
      insert: (payload: unknown) => {
        rec.op = 'insert'
        rec.payload = payload
        push()
        return b
      },
      delete: () => {
        rec.op = 'delete'
        push()
        return b
      },
      eq: (col: string, v: unknown) => {
        rec.filters.push([col, v])
        return b
      },
      order: () => b,
      maybeSingle: () => Promise.resolve(resultFor(`${table}.select`)),
      then: (res: (r: Result) => unknown, rej?: (e: unknown) => unknown) =>
        Promise.resolve(resultFor(`${table}.${rec.op}`)).then(res, rej),
    }
    return b
  }
  return { client: { from } as any, ops }
}

// A house with content in every layer, ids sequential per list (as loadHouse
// re-assigns them), so the round-trip compares equal.
function richState(): State {
  const s = blankState()
  s.title = 'T'
  s.question = 'Q?'
  s.purpose = 'P'
  s.conclusion = 'C'
  s.reasoning = 'R'
  s.mode = 'learn'
  s.aiContext = { summary: 'sum', facts: ['f1'] }
  s.concepts = [
    { term: 'a', definition: 'da' },
    { term: 'b', definition: '' },
  ]
  s.perspectives = [
    {
      id: 1,
      name: 'Students',
      summary: 'sum',
      stance: 'st',
      subQuestions: [{ q: 'q1', note: 'n1' }],
      supportingEvidence: [{ text: 'e', source: 's' }],
      counters: ['c1'],
      strength: 0,
      owner: 'you',
    },
  ]
  s.evidence = [
    { id: 1, text: 'ev1', source: 'src', owner: 'ai', byAI: true, url: 'https://x.test/a' },
    { id: 2, text: 'ev2', source: '', owner: 'you', byAI: false },
  ]
  s.assumptions = [{ id: 1, text: 'as1', owner: 'you' }]
  s.pos = [{ id: 1, text: 'p1', horizon: 'Near-term', who: 'w' }]
  s.neg = [{ id: 1, text: 'n1', horizon: 'Long-term', who: '' }]
  s.unc = []
  s.watchpoints = ['wp1']
  return s
}

const okSave = (rev = '2026-07-16T01:00:00Z'): Record<string, Result> => ({
  'houses.update': { data: [{ updated_at: rev }], error: null },
})

afterEach(() => {
  delete (globalThis as { window?: unknown }).window
})

describe('loadHouse', () => {
  it('returns null when any child select errors — never an empty layer (B2)', async () => {
    const { client } = fakeDb({
      'houses.select': { data: { title: 'T', updated_at: 'r1' }, error: null },
      'house_perspectives.select': { data: null, error: { message: 'boom' } },
    })
    expect(await loadHouse(client, 'h1')).toBeNull()
  })

  it('returns null when the parent row is missing (RLS or deleted)', async () => {
    const { client } = fakeDb({ 'houses.select': { data: null, error: null } })
    expect(await loadHouse(client, 'h1')).toBeNull()
  })
})

describe('save/load round-trip', () => {
  it('replays saved rows back into an equal state (the keystone test)', async () => {
    const original = richState()
    const { client: writer, ops } = fakeDb(okSave())
    const rev = await saveHouse(writer, 'h1', original, 'r0')
    expect(rev).toBe('2026-07-16T01:00:00Z')

    const parent = ops.find((o) => o.table === 'houses' && o.op === 'update')!
      .payload as Record<string, unknown>
    const rows = (table: string) =>
      (ops.find((o) => o.table === table && o.op === 'insert')?.payload as Record<
        string,
        unknown
      >[]) ?? []

    const { client: reader } = fakeDb({
      'houses.select': { data: { ...parent, updated_at: rev }, error: null },
      'house_perspectives.select': { data: rows('house_perspectives'), error: null },
      'house_evidence.select': { data: rows('house_evidence'), error: null },
      'house_assumptions.select': { data: rows('house_assumptions'), error: null },
      'house_implications.select': { data: rows('house_implications'), error: null },
    })
    const loaded = await loadHouse(reader, 'h1')
    expect(loaded).not.toBeNull()
    expect(loaded!.rev).toBe(rev)
    expect(JSON.parse(serializeContent(loaded!.state))).toEqual(
      JSON.parse(serializeContent(original))
    )
  })

  it('writes the expected shape: 1 guarded update, 4 deletes, positional inserts, aligned concept arrays', async () => {
    const { client, ops } = fakeDb(okSave())
    await saveHouse(client, 'h1', richState(), 'r0')

    expect(ops.filter((o) => o.op === 'update')).toHaveLength(1)
    expect(ops.filter((o) => o.op === 'delete')).toHaveLength(4)
    const update = ops[0]
    expect(update.filters).toContainEqual(['id', 'h1'])
    expect(update.filters).toContainEqual(['updated_at', 'r0']) // the rev guard
    const payload = update.payload as { concepts: string[]; concept_definitions: string[] }
    expect(payload.concepts).toEqual(['a', 'b'])
    expect(payload.concept_definitions).toEqual(['da', '']) // index-aligned (DB M2)

    const evidence = ops.find((o) => o.table === 'house_evidence' && o.op === 'insert')!
      .payload as { position: number }[]
    evidence.forEach((row, i) => expect(row.position).toBe(i))
  })
})

describe('saveHouse failure classification', () => {
  it('zero rows updated under a rev guard is a stale-write, before any child delete', async () => {
    const { client, ops } = fakeDb({ 'houses.update': { data: [], error: null } })
    await expect(saveHouse(client, 'h1', richState(), 'r-stale')).rejects.toMatchObject({
      code: 'stale-write',
    })
    expect(ops.filter((o) => o.op === 'delete')).toHaveLength(0) // fresher data intact
  })

  it('a JWT-expired error classifies as signed-out', async () => {
    const { client } = fakeDb({
      'houses.update': { data: null, error: { message: 'JWT expired' } },
    })
    await expect(saveHouse(client, 'h1', richState())).rejects.toMatchObject({
      code: 'signed-out',
    })
  })

  it('a failed child insert throws save-failed instead of resolving silently (B1)', async () => {
    const { client } = fakeDb({
      ...okSave(),
      'house_evidence.insert': { data: null, error: { message: 'network' } },
    })
    const err = await saveHouse(client, 'h1', richState(), 'r0').catch((e) => e)
    expect(err).toBeInstanceOf(SaveError)
    expect((err as SaveError).code).toBe('save-failed')
  })
})

describe('serializeContent', () => {
  it('persists exactly the PERSISTED_KEYS fields — adding a State field forces a decision here', () => {
    expect(Object.keys(JSON.parse(serializeContent(blankState())))).toEqual([...PERSISTED_KEYS])
    expect(PERSISTED_KEYS).toHaveLength(16)
  })
})

describe('local persistence', () => {
  function stubWindow() {
    const store = new Map<string, string>()
    ;(globalThis as { window?: unknown }).window = {
      localStorage: {
        getItem: (k: string) => store.get(k) ?? null,
        setItem: (k: string, v: string) => void store.set(k, v),
      },
    }
  }

  it('round-trips through localStorage', () => {
    stubWindow()
    const s = richState()
    saveLocalHouse(s)
    const loaded = loadLocalHouse()
    expect(loaded).not.toBeNull()
    expect(JSON.parse(serializeContent(loaded!))).toEqual(JSON.parse(serializeContent(s)))
  })

  it('normalizes legacy shapes (string[] concepts, pre-detail perspectives)', () => {
    stubWindow()
    const legacy = {
      title: 'Old',
      concepts: ['plain', 'strings'],
      perspectives: [{ id: 1, name: 'P', summary: 's', strength: 40, owner: 'you' }],
    }
    ;(globalThis as { window?: { localStorage: Storage } }).window!.localStorage.setItem(
      'hot:house:draft',
      JSON.stringify(legacy)
    )
    const loaded = loadLocalHouse()!
    expect(loaded.concepts).toEqual([
      { term: 'plain', definition: '' },
      { term: 'strings', definition: '' },
    ])
    expect(loaded.perspectives[0].subQuestions).toEqual([])
    expect(loaded.perspectives[0].counters).toEqual([])
  })
})
