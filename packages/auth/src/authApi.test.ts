import type { ApiRequest } from '@skeleton/api-client'
import { describe, expect, it } from 'vitest'
import { createAuthApi } from './authApi'
import type { AuthPrincipal, AuthTokenResponse } from './types'

type Call = { path: string; request?: ApiRequest }

function fakeClient<T>(result: T) {
  const calls: Call[] = []
  return {
    calls,
    client: {
      value: async <V>(path: string, request?: ApiRequest) => {
        calls.push({ path, request })
        return result as unknown as V
      },
    },
  }
}

const principal: AuthPrincipal = { accountId: 'acc_1', username: 'u', email: null, roles: ['USER'] }
const token: AuthTokenResponse = {
  accessToken: 'jwt',
  tokenType: 'Bearer',
  expiresAt: '2026-06-12T01:00:00Z',
  principal,
}

describe('createAuthApi (mirrors kotlin-skeleton modules/auth and auth-social)', () => {
  it('login → POST /auth/login with the PasswordLoginRequest body, without the stale token', async () => {
    const { client, calls } = fakeClient(token)
    const result = await createAuthApi(client).login({ email: 'u@example.com', password: 'pw' })
    expect(result).toBe(token)
    expect(calls).toEqual([
      {
        path: '/auth/login',
        request: {
          method: 'POST',
          json: { email: 'u@example.com', password: 'pw' },
          skipAuth: true,
        },
      },
    ])
  })

  it('login accepts accountId or username as the identifier too', async () => {
    const { client, calls } = fakeClient(token)
    const api = createAuthApi(client)
    await api.login({ accountId: 'acc_1', password: 'pw' })
    await api.login({ username: 'admin', password: 'pw' })
    expect(calls.map((c) => c.request?.json)).toEqual([
      { accountId: 'acc_1', password: 'pw' },
      { username: 'admin', password: 'pw' },
    ])
  })

  it('me → GET /auth/me (auth comes from the client getAuthHeaders)', async () => {
    const { client, calls } = fakeClient(principal)
    expect(await createAuthApi(client).me()).toBe(principal)
    expect(calls).toEqual([{ path: '/auth/me', request: undefined }])
  })

  it('socialLogin → POST /auth/social/{provider}/login with authorizationCode and redirectUri', async () => {
    const { client, calls } = fakeClient(token)
    await createAuthApi(client).socialLogin('google', 'code-1', 'https://app.example.com/cb')
    expect(calls).toEqual([
      {
        path: '/auth/social/google/login',
        request: {
          method: 'POST',
          json: { authorizationCode: 'code-1', redirectUri: 'https://app.example.com/cb' },
          skipAuth: true,
        },
      },
    ])
  })

  it('socialLogin leaves redirectUri out when not given and encodes the provider segment', async () => {
    const { client, calls } = fakeClient(token)
    await createAuthApi(client).socialLogin('my provider', 'code-2')
    expect(calls[0].path).toBe('/auth/social/my%20provider/login')
    expect(JSON.parse(JSON.stringify(calls[0].request?.json))).toEqual({
      authorizationCode: 'code-2',
    })
  })
})
