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

/* FINAL-3 (kotlin-skeleton docs/account-http-contract.md, cbb8b4a) */
describe('FINAL-3: codes in session', () => {
  it('verifySignUpCode → POST /auth/verify-email {signUpId, code}, public, answers with the tokens (signed in)', async () => {
    const tokens = {
      accessToken: 'a',
      tokenType: 'Bearer',
      expiresAt: 't',
      principal: { accountId: 'x', roles: [] },
    }
    const { client, calls } = fakeClient(tokens)
    const result = await createAccountApi(client).verifySignUpCode('sid', '123456')
    expect(calls[0]).toMatchObject({
      kind: 'value',
      path: '/auth/verify-email',
      request: { method: 'POST', json: { signUpId: 'sid', code: '123456' }, skipAuth: true },
    })
    expect(result).toBe(tokens)
  })

  it('verifySignUpCode may carry a replacement nickname (after a DISPLAY_NAME_TAKEN, same signUpId and code)', async () => {
    const { client, calls } = fakeClient({})
    await createAccountApi(client).verifySignUpCode('sid', '123456', { displayName: '수민' })
    expect(calls[0].request?.json).toEqual({ signUpId: 'sid', code: '123456', displayName: '수민' })
  })

  it('resendSignUpCode → POST /account/verification/resend {signUpId}', async () => {
    const { client, calls } = fakeClient()
    await createAccountApi(client).resendSignUpCode('sid', 'cap')
    expect(calls[0].path).toBe('/account/verification/resend')
    expect(calls[0].request?.json).toEqual({ signUpId: 'sid', captchaToken: 'cap' })
    expect(calls[0].request?.skipAuth).toBe(true)
  })

  it('confirmEmailChangeCode → authenticated POST /account/email/change/confirm {code}', async () => {
    const { client, calls } = fakeClient()
    await createAccountApi(client).confirmEmailChangeCode('654321')
    expect(calls[0]).toMatchObject({
      kind: 'noContent',
      path: '/account/email/change/confirm',
      request: { method: 'POST', json: { code: '654321' } },
    })
    expect(calls[0].request?.skipAuth).toBeUndefined()
  })

  it('re-auth carries confirmationCode or socialReauth', async () => {
    const { client, calls } = fakeClient()
    const api = createAccountApi(client)
    await api.changeEmail({ newEmail: 'n@x.y', confirmationCode: '111111' }, 'k1')
    await api.deleteAccount({ socialReauth: { provider: 'naver', authorizationCode: 'c' } }, 'k2')
    expect(calls[0].request?.json).toEqual({ newEmail: 'n@x.y', confirmationCode: '111111' })
    expect(calls[1].request?.json).toEqual({
      socialReauth: { provider: 'naver', authorizationCode: 'c' },
    })
  })

  it('unlinkIdentity requires re-auth: the credential goes in the DELETE body', async () => {
    const { client, calls } = fakeClient()
    const api = createAccountApi(client)
    await api.unlinkIdentity('idn_1', { currentPassword: 'pw' })
    await api.unlinkIdentity('idn_2')
    expect(calls[0]).toMatchObject({
      path: '/account/identities/idn_1',
      request: { method: 'DELETE', json: { currentPassword: 'pw' } },
    })
    expect(calls[1].request?.json).toBeUndefined()
  })
})

describe('FINAL-3: the superseded link calls are gone', () => {
  it('has no link round-trip members (verify-email token, email-change link, resend by email)', () => {
    const api = createAccountApi(fakeClient().client) as unknown as Record<string, unknown>
    for (const name of ['verifyEmail', 'confirmEmailChange', 'resendVerification'])
      expect(api[name], name).toBeUndefined()
  })

  it('verifySignUpCode passes the device name as X-Device-Name (the session list shows it)', async () => {
    const { client, calls } = fakeClient({})
    await createAccountApi(client, { deviceName: 'Chrome on Mac' }).verifySignUpCode(
      'sid',
      '123456',
    )
    expect(calls[0].request?.headers).toEqual({ 'X-Device-Name': 'Chrome on Mac' })
  })
})
