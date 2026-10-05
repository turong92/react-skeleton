import { describe, expect, it } from 'vitest'
import { applyReaction, removeReaction, reactionCount } from './reactions'
import type { ReactionState } from './types'

const state = (counts: Record<string, number>, myReactions: string[] = []): ReactionState => ({
  counts,
  myReactions,
})

describe("applyReaction — the server's PUT, computed locally", () => {
  it('SINGLE: the first reaction adds one to its type and becomes mine', () => {
    expect(applyReaction(state({}), 'SINGLE', 'LIKE')).toEqual(state({ LIKE: 1 }, ['LIKE']))
  })

  it('SINGLE: switching moves my one reaction — the old type loses one, the new type gains one', () => {
    const before = state({ LIKE: 3, EMPATHY: 1 }, ['LIKE'])
    expect(applyReaction(before, 'SINGLE', 'EMPATHY')).toEqual(
      state({ LIKE: 2, EMPATHY: 2 }, ['EMPATHY']),
    )
  })

  it("SINGLE: the same type again is a no-op (the server's PUT is idempotent)", () => {
    const before = state({ LIKE: 3 }, ['LIKE'])
    expect(applyReaction(before, 'SINGLE', 'LIKE')).toEqual(before)
  })

  it('PER_TYPE: a second type is added next to the first', () => {
    const before = state({ LIKE: 3 }, ['LIKE'])
    expect(applyReaction(before, 'PER_TYPE', 'EMPATHY')).toEqual(
      state({ LIKE: 3, EMPATHY: 1 }, ['LIKE', 'EMPATHY']),
    )
  })

  it('PER_TYPE: the same type again is a no-op', () => {
    const before = state({ LIKE: 3 }, ['LIKE'])
    expect(applyReaction(before, 'PER_TYPE', 'LIKE')).toEqual(before)
  })

  it('does not change the state it was given', () => {
    const before = state({ LIKE: 3 }, ['LIKE'])
    const snapshot = JSON.stringify(before)
    applyReaction(before, 'SINGLE', 'EMPATHY')
    expect(JSON.stringify(before)).toBe(snapshot)
  })
})

describe("removeReaction — the server's DELETE, computed locally", () => {
  it('removes the named type from my reactions and the count', () => {
    expect(removeReaction(state({ LIKE: 3 }, ['LIKE']), 'SINGLE', 'LIKE')).toEqual(
      state({ LIKE: 2 }, []),
    )
  })

  it('SINGLE without a type removes whichever reaction is mine', () => {
    expect(removeReaction(state({ EMPATHY: 1, LIKE: 2 }, ['EMPATHY']), 'SINGLE')).toEqual(
      state({ EMPATHY: 0, LIKE: 2 }, []),
    )
  })

  it('a type that is not mine changes nothing', () => {
    const before = state({ LIKE: 3, EMPATHY: 1 }, ['LIKE'])
    expect(removeReaction(before, 'PER_TYPE', 'EMPATHY')).toEqual(before)
    expect(removeReaction(before, 'SINGLE', 'EMPATHY')).toEqual(before)
  })

  it('PER_TYPE removes only that type and keeps the others', () => {
    expect(
      removeReaction(state({ LIKE: 3, EMPATHY: 1 }, ['LIKE', 'EMPATHY']), 'PER_TYPE', 'LIKE'),
    ).toEqual(state({ LIKE: 2, EMPATHY: 1 }, ['EMPATHY']))
  })

  it('never goes below zero, even when the cached count is stale', () => {
    expect(removeReaction(state({ LIKE: 0 }, ['LIKE']), 'SINGLE', 'LIKE').counts.LIKE).toBe(0)
  })
})

describe('reactionCount', () => {
  it('reads a type that the server did not report as zero', () => {
    expect(reactionCount({ LIKE: 2 }, 'LIKE')).toBe(2)
    expect(reactionCount({ LIKE: 2 }, 'EMPATHY')).toBe(0)
  })
})
