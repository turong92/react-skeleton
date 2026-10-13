import { describe, expect, it } from 'vitest'
import {
  holdReasonOf,
  noticeAfterOpening,
  noticeOfOrderFailure,
  openingIn,
  type HoldNotice,
} from './cheerHold'

const limited = (until: number | null): HoldNotice => ({ kind: 'rateLimited', until })
const closed: HoldNotice = { kind: 'closed' }

describe('holdReasonOf — why 「응원하기」 cannot be pressed right now', () => {
  const open = { configAvailable: true, keyMissing: false, notice: null }

  it('nothing holds it when payments are on, the checkout key was there and no 429 is waiting', () => {
    expect(holdReasonOf(open)).toBeNull()
    expect(holdReasonOf({ ...open, configAvailable: undefined })).toBeNull() // config not read yet
    expect(holdReasonOf({ ...open, notice: closed })).toBeNull()
  })

  it('the server saying payments are off holds it', () => {
    expect(holdReasonOf({ ...open, configAvailable: false })).toBe('unavailable')
  })

  it('a checkout key the server turned out not to have holds it for good (until the screen is opened again) - the same hold, the same reason', () => {
    expect(holdReasonOf({ ...open, keyMissing: true })).toBe('unavailable')
  })

  it('a 429 with a time holds it; a 429 without one has no time to hold for', () => {
    expect(holdReasonOf({ ...open, notice: limited(9_000) })).toBe('rateLimited')
    expect(holdReasonOf({ ...open, notice: limited(null) })).toBeNull()
  })

  it('payments being off is the stronger reason when both hold', () => {
    expect(holdReasonOf({ ...open, keyMissing: true, notice: limited(9_000) })).toBe('unavailable')
  })
})

describe('openingIn — how long the timer waits before the 429 hold is over', () => {
  it('is the time left until the moment the server said', () => {
    expect(openingIn(limited(10_000), 4_000)).toBe(6_000)
  })

  it('is zero when that moment has already passed (a screen that slept)', () => {
    expect(openingIn(limited(10_000), 12_000)).toBe(0)
  })

  it('is null when there is nothing to wait for', () => {
    expect(openingIn(null, 0)).toBeNull()
    expect(openingIn(limited(null), 0)).toBeNull()
    expect(openingIn(closed, 0)).toBeNull()
  })
})

describe('noticeAfterOpening — what the timer clears when the hold ends', () => {
  it('clears the 429 notice too, not only the hold (the red band must not outlive the block)', () => {
    expect(noticeAfterOpening(limited(10_000))).toBeNull()
  })

  it('leaves every other notice alone', () => {
    expect(noticeAfterOpening(closed)).toBe(closed)
    expect(noticeAfterOpening(null)).toBeNull()
  })

  it('a 429 that had no time is not a hold, so the timer never touches it', () => {
    const soon = limited(null)
    expect(noticeAfterOpening(soon)).toBe(soon)
  })
})

describe('noticeOfOrderFailure — a refused order is told on the screen, not held', () => {
  it('a 503 UNAVAILABLE (e.g. the provider refused to prepare the payment) shows its message with the error reference and leaves the button pressable', () => {
    const error = new Error('503')
    const notice = noticeOfOrderFailure({ kind: 'unavailable' }, error)
    expect(notice).toEqual({ kind: 'unavailable', error })
    expect(holdReasonOf({ configAvailable: true, keyMissing: false, notice })).toBeNull()
  })

  it('keeps the 429 time, and the other refusals by their kind', () => {
    const error = new Error('x')
    expect(noticeOfOrderFailure({ kind: 'rateLimited', until: 5 }, error)).toEqual({
      kind: 'rateLimited',
      until: 5,
      error,
    })
    expect(noticeOfOrderFailure({ kind: 'notOffered' }, error)).toEqual({
      kind: 'notOffered',
      error,
    })
    expect(noticeOfOrderFailure({ kind: 'orderFailed' }, error)).toEqual({
      kind: 'orderFailed',
      error,
    })
  })
})
