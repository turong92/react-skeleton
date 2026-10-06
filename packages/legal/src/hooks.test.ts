import { ApiRequestError } from '@skeleton/api-client'
import { describe, expect, it } from 'vitest'
import { legalRetry } from './hooks'

const error = (status: number) =>
  new ApiRequestError({ code: 'X', title: 'x', status, timestamp: 't' }, 't', 's', 'p')

describe('legalRetry — a backend without the legal module must not keep the sign-up form waiting', () => {
  it('never retries an answer that will not change (401 / 403 / 404 / 405: the module is not there)', () => {
    for (const status of [401, 403, 404, 405]) expect(legalRetry(0, error(status))).toBe(false)
  })

  it('retries a transient failure (network, 5xx) a couple of times, then gives up', () => {
    expect(legalRetry(0, error(0))).toBe(true)
    expect(legalRetry(1, error(503))).toBe(true)
    expect(legalRetry(2, error(503))).toBe(false)
  })

  it('retries what is not an api error (a thrown network error) the same way', () => {
    expect(legalRetry(0, new Error('boom'))).toBe(true)
  })
})
