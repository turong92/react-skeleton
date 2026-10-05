import { describe, expect, it } from 'vitest'
import { newIdempotencyKey } from './idempotencyKey'

describe('newIdempotencyKey', () => {
  it('prefixes a UUID with fe-', () => {
    expect(newIdempotencyKey()).toMatch(
      /^fe-[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/,
    )
  })

  it('returns a new key every call', () => {
    expect(newIdempotencyKey()).not.toBe(newIdempotencyKey())
  })
})
