import { describe, expect, it } from 'vitest'
import { decodeTokenPrincipal } from './principal'
import {
  applyAuthHeaders,
  bearerAuthorization,
  breakGlassHeaders,
  devLoginHeaders,
  parseDevIdentity,
  requestAuthHeaders,
} from './headers'

describe('auth headers and principal', () => {
  it('maps dev login input to the backend-supported identity headers', () => {
    expect(parseDevIdentity('user@example.com')).toEqual({ email: 'user@example.com' })
    expect(parseDevIdentity('acc_admin')).toEqual({ accountId: 'acc_admin' })
    expect(parseDevIdentity('admin')).toEqual({ username: 'admin' })
  })

  it('decodes the skeleton JWT principal claims without requiring validation', () => {
    const payload = btoa(
      JSON.stringify({
        sub: 'acc_admin',
        username: 'admin',
        email: 'admin@example.com',
        roles: ['USER', 'ADMIN'],
      }),
    )
      .replaceAll('+', '-')
      .replaceAll('/', '_')
      .replaceAll('=', '')

    expect(decodeTokenPrincipal(`header.${payload}.signature`)).toEqual({
      accountId: 'acc_admin',
      username: 'admin',
      email: 'admin@example.com',
      roles: ['USER', 'ADMIN'],
    })
  })

  it('keeps username and email null when the token omits them, as the backend principal does', () => {
    const payload = btoa(JSON.stringify({ sub: 'acc_1' }))
      .replaceAll('+', '-')
      .replaceAll('/', '_')
      .replaceAll('=', '')

    expect(decodeTokenPrincipal(`header.${payload}.signature`)).toEqual({
      accountId: 'acc_1',
      username: null,
      email: null,
      roles: [],
    })
  })

  it('builds the Authorization value and never doubles the Bearer prefix', () => {
    expect(bearerAuthorization('abc')).toBe('Bearer abc')
    expect(bearerAuthorization('Bearer abc')).toBe('Bearer abc')
  })

  it('maps dev login and break-glass identities to the backend filter headers', () => {
    expect(devLoginHeaders({ accountId: 'acc_1', username: 'u', email: 'u@example.com' })).toEqual({
      'X-Dev-Account-Id': 'acc_1',
      'X-Dev-Username': 'u',
      'X-Dev-Email': 'u@example.com',
    })
    expect(devLoginHeaders({ email: 'only@example.com' })).toEqual({
      'X-Dev-Email': 'only@example.com',
    })
    expect(breakGlassHeaders({ accountId: 'acc_admin', reason: 'support', secret: 's3' })).toEqual({
      'X-Break-Glass-Account-Id': 'acc_admin',
      'X-Break-Glass-Reason': 'support',
      'X-Break-Glass-Secret': 's3',
    })
  })

  it('requestAuthHeaders merges whatever is given (bearer, dev login and break-glass are independent)', () => {
    expect(requestAuthHeaders({})).toEqual({})
    expect(
      requestAuthHeaders({
        accessToken: 't',
        devLogin: { email: 'u@example.com' },
        breakGlass: { accountId: 'a', reason: 'r', secret: 's' },
      }),
    ).toEqual({
      Authorization: 'Bearer t',
      'X-Dev-Email': 'u@example.com',
      'X-Break-Glass-Account-Id': 'a',
      'X-Break-Glass-Reason': 'r',
      'X-Break-Glass-Secret': 's',
    })
    expect(requestAuthHeaders({ accessToken: null })).toEqual({})
  })

  it('applyAuthHeaders prefers the token and falls back to dev login (SSE / fetch style)', () => {
    const withToken = new Headers()
    applyAuthHeaders(withToken, 'tok', { email: 'u@example.com' })
    expect(withToken.get('Authorization')).toBe('Bearer tok')
    expect(withToken.has('X-Dev-Email')).toBe(false)

    const devOnly = new Headers()
    applyAuthHeaders(devOnly, '', { accountId: 'acc_1', username: 'u' })
    expect(devOnly.get('X-Dev-Account-Id')).toBe('acc_1')
    expect(devOnly.get('X-Dev-Username')).toBe('u')
    expect(devOnly.has('Authorization')).toBe(false)
  })
})
