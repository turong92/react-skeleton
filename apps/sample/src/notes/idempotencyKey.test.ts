import { describe, expect, it } from 'vitest'
import { createKeyRing } from './idempotencyKey'

describe('createKeyRing — one Idempotency-Key per distinct request', () => {
  let n = 0
  const newKey = () => `k${++n}`

  it('gives the same key to an identical resubmission (double click, retry after a timeout)', () => {
    const keyFor = createKeyRing(newKey)
    const first = keyFor({ title: 'a', body: '' })
    expect(keyFor({ title: 'a', body: '' })).toBe(first)
  })

  it('gives a new key once the content changed — the backend answers 409 when a key is reused with a different body (e.g. after fixing a 400)', () => {
    const keyFor = createKeyRing(newKey)
    const first = keyFor({ title: 'a', body: 'too long' })
    const fixed = keyFor({ title: 'a', body: 'short' })
    expect(fixed).not.toBe(first)
    expect(keyFor({ title: 'a', body: 'short' })).toBe(fixed)
  })
})
