import { describe, expect, it } from 'vitest'
import { decodeTokenPrincipal, parseDevIdentity } from './authSession'

describe('authSession', () => {
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
})
