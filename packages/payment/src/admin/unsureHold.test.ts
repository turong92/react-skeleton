import { describe, expect, it } from 'vitest'
import { OPERATOR_REFUND_TIMEOUT_MS } from './adminApi'
import { UNSURE_FLOOR_MS, unsureVerdict } from './unsureHold'

describe('unsureVerdict — 「결제사와 맞추기」 may let go of an unsure refund only once the first send cannot still be on its way (counted from when it was SENT)', () => {
  const sentAt = 1_000_000
  const unsure = { unsure: true, pending: false, sentAt, unsureAt: sentAt }

  it('holds for the length of one refund call after the send, and says how long is left (the server may not have claimed the line yet; the sync would see no refund line)', () => {
    expect(unsureVerdict(unsure, sentAt)).toEqual({
      kind: 'hold',
      waitMs: OPERATOR_REFUND_TIMEOUT_MS,
    })
    expect(unsureVerdict(unsure, sentAt + OPERATOR_REFUND_TIMEOUT_MS - 1)).toEqual({
      kind: 'hold',
      waitMs: 1,
    })
  })

  it('lets go once that long has passed since the send', () => {
    expect(unsureVerdict(unsure, sentAt + OPERATOR_REFUND_TIMEOUT_MS)).toEqual({ kind: 'release' })
  })

  it('a send that turned unsure by timing out has already waited the whole hold: once the floor after it turned unsure has passed, the sync lets go', () => {
    // 45 s call timed out at sentAt + 45 s - the answer is lost "now", but it was sent 45 s ago
    const timedOutAt = sentAt + OPERATOR_REFUND_TIMEOUT_MS
    const state = { ...unsure, unsureAt: timedOutAt }
    expect(unsureVerdict(state, timedOutAt + UNSURE_FLOOR_MS)).toEqual({ kind: 'release' })
  })

  it('a send that only really went out later (a change that sat paused offline, or a retry) still holds a floor after it turned unsure: counted from when it became unsure', () => {
    const became = sentAt + OPERATOR_REFUND_TIMEOUT_MS + 1000 // long after the send + hold: the plain rule would release
    const state = { ...unsure, unsureAt: became }
    expect(unsureVerdict(state, became)).toEqual({ kind: 'hold', waitMs: UNSURE_FLOOR_MS })
    expect(unsureVerdict(state, became + UNSURE_FLOOR_MS - 1)).toEqual({ kind: 'hold', waitMs: 1 })
    expect(unsureVerdict(state, became + UNSURE_FLOOR_MS)).toEqual({ kind: 'release' })
  })

  it('the hold length can be given (a screen that knows its client timeout)', () => {
    const holdMs = UNSURE_FLOOR_MS + 5000 // longer than the floor, so the floor does not decide
    expect(unsureVerdict(unsure, sentAt + holdMs, holdMs)).toEqual({ kind: 'release' })
    expect(unsureVerdict(unsure, sentAt + holdMs - 1, holdMs)).toEqual({ kind: 'hold', waitMs: 1 })
  })

  it('never lets go of something that is not unsure, or is being sent again right now - and has nothing to wait for either', () => {
    expect(unsureVerdict({ ...unsure, unsure: false }, sentAt + 10 ** 9)).toEqual({ kind: 'none' })
    expect(unsureVerdict({ ...unsure, pending: true }, sentAt + 10 ** 9)).toEqual({ kind: 'none' })
  })

  it('a send time of zero (nothing was ever sent) holds nothing and lets nothing go', () => {
    expect(unsureVerdict({ ...unsure, sentAt: 0 }, sentAt)).toEqual({ kind: 'none' })
  })
})
