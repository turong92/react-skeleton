import type { ApiRequest } from '@skeleton/api-client'
import { describe, expect, it } from 'vitest'
import { createAccountApi } from './accountApi'

function fakeClient(result: unknown = {}) {
  const calls: Array<{ kind: string; path: string; request?: ApiRequest }> = []
  const record = (kind: string) => async (path: string, request?: ApiRequest) => {
    calls.push({ kind, path, request })
    return result as never
  }
  return {
    calls,
    client: { value: record('value'), list: record('list'), noContent: record('noContent') },
  }
}

/* FINAL-7 L3 · L4 · L8 · L9 (kotlin-skeleton docs/account-http-contract.md) */
describe('login id calls', () => {
  it('checkLoginId → public POST /account/login-id/availability {loginId}, answers the value as is', async () => {
    const answer = { normalized: 'sumin.kim', available: false, reason: 'TAKEN' }
    const { client, calls } = fakeClient(answer)
    const result = await createAccountApi(client).checkLoginId('Sumin.Kim')
    expect(calls[0]).toMatchObject({
      kind: 'value',
      path: '/account/login-id/availability',
      request: { method: 'POST', json: { loginId: 'Sumin.Kim' }, skipAuth: true },
    })
    expect(result).toBe(answer)
  })

  it('setLoginId → authenticated POST /account/login-id {loginId}, answers the me body', async () => {
    const me = { id: 'a', loginId: 'sumin.kim' }
    const { client, calls } = fakeClient(me)
    const result = await createAccountApi(client).setLoginId('sumin.kim')
    expect(calls[0]).toMatchObject({
      kind: 'value',
      path: '/account/login-id',
      request: { method: 'POST', json: { loginId: 'sumin.kim' } },
    })
    expect(calls[0].request?.skipAuth).toBeUndefined()
    expect(result).toBe(me)
  })

  it('forgotLoginId → public POST /account/login-id/forgot {email, captchaToken?}, resolves with nothing', async () => {
    const { client, calls } = fakeClient({ status: 'ACCEPTED' })
    const api = createAccountApi(client)
    await expect(api.forgotLoginId('a@x.y', 'cap')).resolves.toBeUndefined()
    await api.forgotLoginId('b@x.y')
    expect(calls[0]).toMatchObject({
      path: '/account/login-id/forgot',
      request: { method: 'POST', json: { email: 'a@x.y', captchaToken: 'cap' }, skipAuth: true },
    })
    expect(calls[1].request?.json).toEqual({ email: 'b@x.y' })
  })

  it('verifySignUpCode may carry a replacement login id (same signUpId and code after LOGIN_ID_TAKEN)', async () => {
    const { client, calls } = fakeClient({})
    const api = createAccountApi(client)
    await api.verifySignUpCode('sid', '123456', { loginId: 'sumin.kim', displayName: '수민' })
    await api.verifySignUpCode('sid', '123456')
    expect(calls[0].request?.json).toEqual({
      signUpId: 'sid',
      code: '123456',
      displayName: '수민',
      loginId: 'sumin.kim',
    })
    expect(calls[1].request?.json).toEqual({ signUpId: 'sid', code: '123456' })
  })
})
