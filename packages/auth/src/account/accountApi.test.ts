import type { ApiRequest } from '@skeleton/api-client'
import { describe, expect, it } from 'vitest'
import { createAccountApi } from './accountApi'

type Call = { kind: string; path: string; request?: ApiRequest }

function fakeClient(result: unknown = { ok: true }) {
  const calls: Call[] = []
  const record = (kind: string) => async (path: string, request?: ApiRequest) => {
    calls.push({ kind, path, request })
    return result as never
  }
  return {
    calls,
    client: {
      value: record('value'),
      list: record('list'),
      noContent: record('noContent'),
    },
  }
}

describe('createAccountApi (mirrors kotlin-skeleton docs/account-http-contract.md)', () => {
  it('signUp → POST /account/sign-up, public', async () => {
    const { client, calls } = fakeClient({ status: 'VERIFICATION_SENT' })
    await createAccountApi(client).signUp({ email: 'a@b.c', password: 'pw', locale: 'ko' })
    expect(calls).toEqual([
      {
        kind: 'value',
        path: '/account/sign-up',
        request: {
          method: 'POST',
          json: { email: 'a@b.c', password: 'pw', locale: 'ko' },
          skipAuth: true,
        },
      },
    ])
  })

  it('forgot / reset / policy are public calls with the contract bodies', async () => {
    const { client, calls } = fakeClient()
    const api = createAccountApi(client)
    await api.forgotPassword('a@b.c', 'cap')
    await api.resetPassword('tok', 'new-pw')
    await api.passwordPolicy()
    expect(calls.map((c) => [c.kind, c.path, c.request?.json, c.request?.skipAuth])).toEqual([
      ['value', '/account/password/forgot', { email: 'a@b.c', captchaToken: 'cap' }, true],
      ['noContent', '/account/password/reset', { token: 'tok', newPassword: 'new-pw' }, true],
      ['value', '/account/password/policy', undefined, true],
    ])
  })

  it('profile: me GET, updateProfile PATCH with only the given fields', async () => {
    const { client, calls } = fakeClient()
    const api = createAccountApi(client)
    await api.me()
    await api.updateProfile({ displayName: 'Ann', timeZone: 'Asia/Seoul' })
    expect(calls[0]).toMatchObject({ path: '/account/me' })
    expect(calls[1]).toMatchObject({
      path: '/account/me',
      request: { method: 'PATCH', json: { displayName: 'Ann', timeZone: 'Asia/Seoul' } },
    })
  })

  it('changePassword → POST /account/password/change (204), currentPassword optional', async () => {
    const { client, calls } = fakeClient()
    await createAccountApi(client).changePassword({ newPassword: 'n' })
    expect(calls[0]).toMatchObject({
      kind: 'noContent',
      path: '/account/password/change',
      request: { method: 'POST', json: { newPassword: 'n' } },
    })
  })

  it('changeEmail and delete carry an Idempotency-Key (the sample installs the idempotency module)', async () => {
    const { client, calls } = fakeClient({ status: 'VERIFICATION_SENT' })
    const api = createAccountApi(client)
    await api.changeEmail({ newEmail: 'n@b.c', currentPassword: 'pw' })
    await api.deleteAccount({ currentPassword: 'pw' })
    expect(calls[0].path).toBe('/account/email/change')
    expect(calls[1].path).toBe('/account/delete')
    for (const call of calls) expect(call.request?.idempotencyKey).toMatch(/^[0-9a-f-]{20,}$/i)
    expect(calls[0].request?.idempotencyKey).not.toBe(calls[1].request?.idempotencyKey)
  })

  it('a caller supplied idempotency key is kept (retry of the same command)', async () => {
    const { client, calls } = fakeClient()
    await createAccountApi(client).deleteAccount({ currentPassword: 'pw' }, 'fixed-key')
    expect(calls[0].request?.idempotencyKey).toBe('fixed-key')
  })

  it('re-authentication: confirmationCode rides on first-password, email change and social link', async () => {
    const { client, calls } = fakeClient()
    const api = createAccountApi(client)
    await api.changePassword({ newPassword: 'n', confirmationCode: '123456' })
    await api.changeEmail({ newEmail: 'n@b.c', confirmationCode: '123456' })
    await api.linkSocial('google', 'code', 'https://app/cb', { confirmationCode: '123456' })
    await api.linkSocial('kakao', 'code2', undefined, { currentPassword: 'pw' })
    expect(calls[0].request?.json).toEqual({ newPassword: 'n', confirmationCode: '123456' })
    expect(calls[1].request?.json).toEqual({ newEmail: 'n@b.c', confirmationCode: '123456' })
    expect(calls[2].request?.json).toEqual({
      authorizationCode: 'code',
      redirectUri: 'https://app/cb',
      confirmationCode: '123456',
    })
    expect(calls[3].request?.json).toEqual({ authorizationCode: 'code2', currentPassword: 'pw' })
  })

  it('requestReauthConfirmation → POST /account/reauth/confirmation (202, authenticated)', async () => {
    const { client, calls } = fakeClient({ status: 'ACCEPTED' })
    await createAccountApi(client).requestReauthConfirmation()
    expect(calls[0]).toMatchObject({
      kind: 'value',
      path: '/account/reauth/confirmation',
      request: { method: 'POST' },
    })
    expect(calls[0].request?.skipAuth).toBeUndefined()
  })

  it('identities: list, unlink, link social', async () => {
    const { client, calls } = fakeClient()
    const api = createAccountApi(client)
    await api.identities()
    await api.unlinkIdentity('idn_1')
    await api.linkSocial('google', 'code', 'https://app/cb')
    expect(calls.map((c) => [c.kind, c.path, c.request?.method])).toEqual([
      ['list', '/account/identities', undefined],
      ['noContent', '/account/identities/idn_1', 'DELETE'],
      ['value', '/account/identities/social/google', 'POST'],
    ])
    expect(calls[2].request?.json).toEqual({
      authorizationCode: 'code',
      redirectUri: 'https://app/cb',
    })
  })

  it('delete confirmation mail for passwordless accounts', async () => {
    const { client, calls } = fakeClient()
    await createAccountApi(client).requestDeleteConfirmation()
    expect(calls[0]).toMatchObject({
      path: '/account/delete/confirmation',
      request: { method: 'POST' },
    })
  })

  it('sessions: list, revoke one, revoke the others (keepCurrent default true) or all', async () => {
    const { client, calls } = fakeClient()
    const api = createAccountApi(client)
    await api.sessions()
    await api.revokeSession('ses_1')
    await api.revokeOtherSessions()
    await api.revokeAllSessions()
    expect(calls.map((c) => [c.kind, c.path, c.request?.method, c.request?.params])).toEqual([
      ['list', '/auth/sessions', undefined, undefined],
      ['noContent', '/auth/sessions/ses_1', 'DELETE', undefined],
      ['noContent', '/auth/sessions', 'DELETE', { keepCurrent: true }],
      ['noContent', '/auth/sessions', 'DELETE', { keepCurrent: false }],
    ])
  })

  it('encodes path segments', async () => {
    const { client, calls } = fakeClient()
    await createAccountApi(client).revokeSession('a/b')
    expect(calls[0].path).toBe('/auth/sessions/a%2Fb')
  })

  it('passwordPolicy accepts the backend maxBytes and the documented maxLength', async () => {
    const base = {
      minLength: 10,
      requireLetter: true,
      requireDigit: true,
      requireSymbol: false,
      forbidEmailLocalPart: true,
    }
    const a = fakeClient({ ...base, maxBytes: 72 })
    expect((await createAccountApi(a.client).passwordPolicy()).maxBytes).toBe(72)
    const b = fakeClient({ ...base, maxLength: 64 })
    expect((await createAccountApi(b.client).passwordPolicy()).maxBytes).toBe(64)
  })
})
