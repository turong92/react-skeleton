import { describe, expect, it } from 'vitest'
import { createIntentKeys, INTENT_KEY_TTL_MS } from './intentKeys'

function setup() {
  let n = 0
  let clock = 1_000_000
  const keys = createIntentKeys({ make: () => `k${++n}`, now: () => clock })
  return { keys, advance: (ms: number) => (clock += ms) }
}

describe('createIntentKeys — one key per intent', () => {
  it('gives the same key for the same intent and a new one for another', () => {
    const { keys } = setup()
    expect(keys.keyFor('a')).toBe('k1')
    expect(keys.keyFor('a')).toBe('k1')
    expect(keys.keyFor('b')).toBe('k2')
  })

  it('an explicit key wins and is not remembered', () => {
    const { keys } = setup()
    expect(keys.keyFor('a', 'mine')).toBe('mine')
    expect(keys.keyFor('a')).toBe('k1')
  })

  it('release(key) forgets the held key only when it is that very key', () => {
    const { keys } = setup()
    const a = keys.keyFor('a')
    const b = keys.keyFor('b') // b replaced a
    keys.release(a) // a's call finished late — b is still the live intent
    expect(keys.keyFor('b')).toBe(b)
    keys.release(b)
    expect(keys.keyFor('b')).not.toBe(b)
  })

  it('a held key has an age limit shorter than the checkout lifetime (30 minutes)', () => {
    expect(INTENT_KEY_TTL_MS).toBeLessThan(30 * 60_000)
    const { keys, advance } = setup()
    const first = keys.keyFor('a')
    advance(INTENT_KEY_TTL_MS - 1)
    expect(keys.keyFor('a')).toBe(first)
    advance(1)
    const second = keys.keyFor('a')
    expect(second).not.toBe(first)
    // the new key starts its own age
    advance(INTENT_KEY_TTL_MS - 1)
    expect(keys.keyFor('a')).toBe(second)
  })
})

describe('hold(key) — a key whose outcome is unknown must not quietly expire (operator refunds)', () => {
  it('a held key outlives the age limit for as long as it is held', () => {
    const { keys, advance } = setup()
    const first = keys.keyFor('a')
    keys.hold(first)
    advance(INTENT_KEY_TTL_MS * 5)
    expect(keys.keyFor('a')).toBe(first)
    keys.release(first) // a verdict came - now it is let go
    expect(keys.keyFor('a')).not.toBe(first)
  })

  it('without hold the same key still expires (the customer side is unchanged)', () => {
    const { keys, advance } = setup()
    const first = keys.keyFor('a')
    advance(INTENT_KEY_TTL_MS)
    expect(keys.keyFor('a')).not.toBe(first)
  })

  it('holding a key that is no longer the live one does nothing to the live one', () => {
    const { keys, advance } = setup()
    const a = keys.keyFor('a')
    const b = keys.keyFor('b')
    keys.hold(a)
    advance(INTENT_KEY_TTL_MS)
    expect(keys.keyFor('b')).not.toBe(b)
  })
})

describe('clear() — the result was checked elsewhere, so the same input is a new intent', () => {
  it('lets go of a held key: the same intent gets a new one', () => {
    const { keys } = setup()
    const first = keys.keyFor('a')
    keys.hold(first)
    keys.clear()
    expect(keys.keyFor('a')).not.toBe(first)
  })
})
