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
  toSavePayload,
  type SaveHousePayload,
} from './persistence'
import type { State } from './types'

// ── Recording fake Supabase client ───────────────────────────────────────────
// Chainable + thenable like the real builder, plus rpc() for save_house.
// Results are scripted per `${table}.${op}` (or 'rpc.<name>'); every call is
// recorded with its payload and filters.

interface Result {
  data?: unknown
  error?: { message: string } | null
}
interface Op {
  table: string
  op: 'select' | 'update' | 'insert' | 'delete' | 'rpc'
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

  const rpc = (name: string, args: unknown) => {
    ops.push({ table: name, op: 'rpc', payload: args, filters: [] })
    return Promise.resolve(resultFor(`rpc.${name}`))
  }

  return { client: { from, rpc } as any, ops }
}

// The SQL half of the round trip, expressed in TS: mirrors exactly what
// save_house (migration 0027) inserts into each child table from the payload.
// Keeping it here means the round-trip test still fails if toSavePayload and
// loadHouse drift apart — and it documents the RPC's mapping next to the code
// that has to agree with it.
function childRowsFor(p: SaveHousePayload) {
  return {
    house_perspectives: p.perspectives.map((x, i) => ({
      name: x.name,
      summary: x.summary,
      questions: x.subQuestions.length,
      stance: x.stance,
      sub_questions: x.subQuestions,
      supporting_evidence: x.supportingEvidence,
      counters: x.counters,
      strength: x.strength,
      owner_key: x.owner,
      position: i,
    })),
    house_evidence: p.evidence.map((x, i) => ({
      text: x.text,
      source: x.source,
      url: x.url,
      owner_key: x.owner,
      by_ai: x.byAI,
      position: i,
    })),
    house_assumptions: p.assumptions.map((x, i) => ({
      text: x.text,
      owner_key: x.owner,
      position: i,
    })),
    house_implications: (['pos', 'neg', 'unc'] as const).flatMap((kind) =>
      p[kind].map((x, i) => ({
        kind,
        text: x.text,
        horizon: x.horizon || null,
        who: x.who,
        position: i,
      }))
    ),
  }
}

// The parent-row half: the columns save_house writes, as loadHouse reads them.
function parentRowFor(p: SaveHousePayload, rev: string) {
  return {
    title: p.title || null,
    question: p.question || null,
    purpose: p.purpose || null,
    conclusion: p.conclusion || null,
    reasoning: p.reasoning || null,
    concepts: p.concepts,
    concept_definitions: p.conceptDefinitions,
    watchpoints: p.watchpoints,
    mode: p.mode,
    ai_context: p.aiContext,
    draft: p.draft,
    updated_at: rev,
  }
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
  'rpc.save_house': { data: rev, error: null },
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

    // Replay the payload through the RPC's documented row mapping, then read it
    // back: toSavePayload → (SQL) → loadHouse must reproduce the same content.
    const sent = (ops.find((o) => o.op === 'rpc')!.payload as { p_content: SaveHousePayload })
      .p_content
    const rows = childRowsFor(sent)

    const { client: reader } = fakeDb({
      'houses.select': { data: parentRowFor(sent, rev), error: null },
      'house_perspectives.select': { data: rows.house_perspectives, error: null },
      'house_evidence.select': { data: rows.house_evidence, error: null },
      'house_assumptions.select': { data: rows.house_assumptions, error: null },
      'house_implications.select': { data: rows.house_implications, error: null },
    })
    const loaded = await loadHouse(reader, 'h1')
    expect(loaded).not.toBeNull()
    expect(loaded!.rev).toBe(rev)
    expect(JSON.parse(serializeContent(loaded!.state))).toEqual(
      JSON.parse(serializeContent(original))
    )
  })

  it('saves in ONE transactional rpc call carrying the rev guard (perf H3)', async () => {
    const { client, ops } = fakeDb(okSave())
    await saveHouse(client, 'h1', richState(), 'r0')

    // The whole point of 0027: no client-side delete/insert fan-out remains.
    expect(ops).toHaveLength(1)
    expect(ops[0]).toMatchObject({ table: 'save_house', op: 'rpc' })
    const args = ops[0].payload as { p_id: string; p_expected_rev: string | null; p_content: SaveHousePayload }
    expect(args.p_id).toBe('h1')
    expect(args.p_expected_rev).toBe('r0')
    expect(args.p_content.concepts).toEqual(['a', 'b'])
    expect(args.p_content.conceptDefinitions).toEqual(['da', '']) // index-aligned (DB M2)
  })

  it('omits the rev guard on a first save', async () => {
    const { client, ops } = fakeDb(okSave())
    await saveHouse(client, 'h1', richState())
    expect((ops[0].payload as { p_expected_rev: string | null }).p_expected_rev).toBeNull()
  })

  it('toSavePayload carries no reducer ids — position comes from array order', () => {
    const p = toSavePayload(richState())
    for (const row of [...p.perspectives, ...p.evidence, ...p.assumptions, ...p.pos]) {
      expect(row).not.toHaveProperty('id')
    }
  })
})

describe('saveHouse failure classification', () => {
  it('the RPC stale-write raise maps to the stale-write code', async () => {
    const { client } = fakeDb({
      'rpc.save_house': { data: null, error: { message: 'stale-write' } },
    })
    await expect(saveHouse(client, 'h1', richState(), 'r-stale')).rejects.toMatchObject({
      code: 'stale-write',
    })
  })

  it('the RPC save-failed raise maps to the save-failed code', async () => {
    const { client } = fakeDb({
      'rpc.save_house': { data: null, error: { message: 'save-failed' } },
    })
    await expect(saveHouse(client, 'h1', richState())).rejects.toMatchObject({
      code: 'save-failed',
    })
  })

  it('a JWT-expired error classifies as signed-out', async () => {
    const { client } = fakeDb({
      'rpc.save_house': { data: null, error: { message: 'JWT expired' } },
    })
    await expect(saveHouse(client, 'h1', richState())).rejects.toMatchObject({
      code: 'signed-out',
    })
  })

  it('a missing rev in the response is a failure, never a silent success', async () => {
    const { client } = fakeDb({ 'rpc.save_house': { data: null, error: null } })
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
