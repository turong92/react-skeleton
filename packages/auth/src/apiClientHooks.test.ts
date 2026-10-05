import { ApiRequestError, ErrorCodes, type ApiError } from '@skeleton/api-client'
import { describe, expect, it, vi } from 'vitest'
import { createAuthHeadersProvider, createUnauthorizedHandler } from './apiClientHooks'
import { createTokenStore } from './tokenStore'

function failure(status: number, code = 'COMMON.UNAUTHORIZED') {
  const apiError: ApiError = { code, title: 't', status, timestamp: '2026-06-12T00:00:00Z' }
  return new ApiRequestError(apiError, 'trace', 'span', 'tp')
}

describe('createAuthHeadersProvider (for createApiClient({ getAuthHeaders }))', () => {
  it('returns nothing without a token and a Bearer header with one, following the store', () => {
    const store = createTokenStore()
    const getAuthHeaders = createAuthHeadersProvider(store)
    expect(getAuthHeaders()).toBeUndefined()
    store.set('abc')
    expect(getAuthHeaders()).toEqual({ Authorization: 'Bearer abc' })
    store.clear()
    expect(getAuthHeaders()).toBeUndefined()
  })
})

describe('createUnauthorizedHandler (for createApiClient({ onError }))', () => {
  it('on a 401 it clears the stored token and tells the app once', () => {
    const store = createTokenStore()
    store.set('expired')
    const onUnauthorized = vi.fn()
    const handler = createUnauthorizedHandler({ store, onUnauthorized })
    const error = failure(401)
    handler(error)
    expect(store.get()).toBeNull()
    expect(onUnauthorized).toHaveBeenCalledExactlyOnceWith(error)
  })

  it('leaves other statuses alone (403 is a permission problem, not an expired session)', () => {
    const store = createTokenStore()
    store.set('still-valid')
    const onUnauthorized = vi.fn()
    createUnauthorizedHandler({ store, onUnauthorized })(failure(403, 'COMMON.FORBIDDEN'))
    createUnauthorizedHandler({ store, onUnauthorized })(
      failure(500, 'COMMON.INTERNAL_SERVER_ERROR'),
    )
    expect(store.get()).toBe('still-valid')
    expect(onUnauthorized).not.toHaveBeenCalled()
  })

  it('does not treat a wrong password (AUTH.INVALID_CREDENTIALS) as an expired session', () => {
    const store = createTokenStore()
    store.set('still-valid')
    const onUnauthorized = vi.fn()
    createUnauthorizedHandler({ store, onUnauthorized })(
      failure(401, ErrorCodes.AUTH_INVALID_CREDENTIALS),
    )
    expect(store.get()).toBe('still-valid')
    expect(onUnauthorized).not.toHaveBeenCalled()
  })

  it('works without an onUnauthorized callback', () => {
    const store = createTokenStore()
    store.set('x')
    expect(() => createUnauthorizedHandler({ store })(failure(401))).not.toThrow()
    expect(store.get()).toBeNull()
  })
})
