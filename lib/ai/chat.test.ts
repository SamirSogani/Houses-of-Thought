// The verbatim-span clamps are what make House Chat's intake extractive rather
// than generative (invariant 1): a model rephrasing slips past prompts, but not
// past these.

import { describe, expect, it } from 'vitest'
import {
  ChatConclusionsResponseSchema,
  clampPurpose,
  clampQuestion,
  isVerbatimSpan,
  titleFromQuestion,
  type ChatTurn,
} from './chat'

const turns: ChatTurn[] = [
  { role: 'user', content: 'Should our middle school ban homework next term?' },
  { role: 'assistant', content: 'Is this a policy decision for a specific school?' },
  { role: 'user', content: 'Yes — we are deciding the policy for next term.' },
]

describe('isVerbatimSpan', () => {
  it('accepts an exact span of a user turn', () => {
    expect(isVerbatimSpan('ban homework next term', turns)).toBe(true)
  })

  it('ignores case, extra whitespace, and end punctuation', () => {
    expect(isVerbatimSpan('  should our MIDDLE school   ban homework next term  ', turns)).toBe(true)
    expect(isVerbatimSpan('deciding the policy for next term?', turns)).toBe(true)
  })

  it('rejects rephrased text and assistant turns', () => {
    expect(isVerbatimSpan('Should homework be banned at our school?', turns)).toBe(false)
    expect(isVerbatimSpan('a policy decision for a specific school', turns)).toBe(false)
    expect(isVerbatimSpan('', turns)).toBe(false)
  })
})

describe('clampQuestion', () => {
  it('keeps a verbatim extraction', () => {
    expect(clampQuestion('Should our middle school ban homework next term?', turns)).toBe(
      'Should our middle school ban homework next term?'
    )
  })

  it('falls back to the most recent question-shaped user turn on a rephrase', () => {
    expect(clampQuestion('Is a homework ban wise?', turns)).toBe(
      'Should our middle school ban homework next term?'
    )
  })

  it('falls back to the last user turn when nothing is question-shaped', () => {
    const flat: ChatTurn[] = [{ role: 'user', content: 'Thinking about a homework ban.' }]
    expect(clampQuestion(null, flat)).toBe('Thinking about a homework ban.')
  })

  it('clips to the field bound', () => {
    const long: ChatTurn[] = [{ role: 'user', content: `${'x'.repeat(400)}?` }]
    expect(clampQuestion(null, long).length).toBeLessThanOrEqual(300)
  })
})

describe('clampPurpose', () => {
  it('keeps a verbatim phrase and empties a rephrase', () => {
    expect(clampPurpose('deciding the policy for next term', turns)).toBe(
      'deciding the policy for next term'
    )
    expect(clampPurpose('to settle school policy', turns)).toBe('')
    expect(clampPurpose(null, turns)).toBe('')
  })
})

describe('ChatConclusionsResponseSchema', () => {
  const candidate = {
    conclusion: 'Ban homework for one term and measure the results.',
    reasoning: 'The evidence on stress outweighs the retention studies the house cites.',
    basis: ['Stanford stress study', 'Assumption: retention drives grades'],
    implications: [
      { ikind: 'pos', text: 'Less evening stress for students.', horizon: 'Near-term', who: 'Students' },
      { ikind: 'unc', text: 'Retention effects unknown for a term.', horizon: 'Long-term', who: 'Teachers' },
    ],
  }

  it('accepts 2-4 disagreeing candidates', () => {
    expect(ChatConclusionsResponseSchema.safeParse({ candidates: [candidate, candidate] }).success).toBe(true)
  })

  it('rejects a single candidate — plural is the contract', () => {
    expect(ChatConclusionsResponseSchema.safeParse({ candidates: [candidate] }).success).toBe(false)
  })

  it('rejects a bad ikind and an implication-free candidate', () => {
    const badKind = { ...candidate, implications: [{ ...candidate.implications[0], ikind: 'good' }] }
    expect(ChatConclusionsResponseSchema.safeParse({ candidates: [candidate, badKind] }).success).toBe(false)
    const noImp = { ...candidate, implications: [] }
    expect(ChatConclusionsResponseSchema.safeParse({ candidates: [candidate, noImp] }).success).toBe(false)
  })
})

describe('titleFromQuestion', () => {
  it('passes short questions through and truncates long ones on a word break', () => {
    expect(titleFromQuestion('Should we ban homework?')).toBe('Should we ban homework?')
    const long = 'Should our overextended regional school district eliminate all take-home assignments permanently everywhere?'
    const title = titleFromQuestion(long)
    expect(title.length).toBeLessThanOrEqual(81)
    expect(title.endsWith('…')).toBe(true)
    expect(long.startsWith(title.slice(0, -1))).toBe(true)
  })
})
