import { describe, expect, it } from 'vitest'
import { paddleSignature } from './fakePaddle'

describe('paddleSignature', () => {
  it('is the documented header: ts and the HMAC-SHA256 of "<ts>:<body>"', () => {
    const header = paddleSignature('{"a":1}', 'secret', 1700000000)
    expect(header).toMatch(/^ts=1700000000;h1=[0-9a-f]{64}$/)
    expect(paddleSignature('{"a":1} ', 'secret', 1700000000)).not.toBe(header)
    expect(paddleSignature('{"a":1}', 'other', 1700000000)).not.toBe(header)
  })
})
