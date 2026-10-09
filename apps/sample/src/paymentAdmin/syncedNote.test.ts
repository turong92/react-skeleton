import { describe, expect, it } from 'vitest'
import { syncNoteIsStale } from './syncedNote'

describe('syncNoteIsStale — the 「결제사와 맞췄어요」 note stops being about the reason on screen', () => {
  it('there is no note to go stale before anything was matched', () => {
    expect(syncNoteIsStale(undefined, 'REFUND_MISMATCH')).toBe(false)
    expect(syncNoteIsStale(undefined, null)).toBe(false)
  })

  it('the reason on screen is still the one the match answered: the note is about it', () => {
    expect(syncNoteIsStale({ reviewReason: 'REFUND_MISMATCH' }, 'REFUND_MISMATCH')).toBe(false)
    expect(syncNoteIsStale({ reviewReason: null }, null)).toBe(false)
    expect(syncNoteIsStale({ reviewReason: undefined }, null)).toBe(false) // none and missing are the same
  })

  it('the reason differs - cleared after the match, or a different one - the note is stale (reset it for good: a later match of the same kind must not revive it)', () => {
    expect(syncNoteIsStale({ reviewReason: 'REFUND_MISMATCH' }, null)).toBe(true) // matched, then it cleared
    expect(syncNoteIsStale({ reviewReason: null }, 'REFUND_MISMATCH')).toBe(true) // matched, then a new reason
    expect(syncNoteIsStale({ reviewReason: 'AMOUNT_MISMATCH' }, 'REFUND_MISMATCH')).toBe(true)
  })
})
