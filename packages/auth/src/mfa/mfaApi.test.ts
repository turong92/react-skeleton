import type { ApiRequest } from '@skeleton/api-client'
import { describe, expect, it } from 'vitest'
import { createAuthApi } from '../authApi'
import { createMfaApi } from './mfaApi'

type Call = { kind: string; path: string; request?: ApiRequest }
function fake() {
  const calls: Call[] = []
  const rec = (kind: string) => async (path: string, request?: ApiRequest) => {
    calls.push({ kind, path, request })
    return {} as never
  }
  return { calls, client: { value: rec('value'), noContent: rec('noContent') } }
}

describe('createMfaApi (backend: auth-mfa)', () => {
  it('status → GET /auth/mfa', async () => {
    const { client, calls } = fake()
    await createMfaApi(client).status()
    expect(calls).toEqual([{ kind: 'value', path: '/auth/mfa', request: undefined }])
  })
  it('startEnrollment → POST /auth/mfa/totp/enrollment with the re-auth proof flat in the body', async () => {
    const { client, calls } = fake()
    await createMfaApi(client).startEnrollment({ currentPassword: 'pw' })
    expect(calls[0]).toEqual({
      kind: 'value',
      path: '/auth/mfa/totp/enrollment',
      request: { method: 'POST', json: { currentPassword: 'pw' } },
    })
  })
  it('confirmEnrollment → POST …/enrollment/confirm {code}', async () => {
    const { client, calls } = fake()
    await createMfaApi(client).confirmEnrollment('123456')
    expect(calls[0]).toEqual({
      kind: 'value',
      path: '/auth/mfa/totp/enrollment/confirm',
      request: { method: 'POST', json: { code: '123456' } },
    })
  })
  it('regenerateRecoveryCodes → POST /auth/mfa/recovery-codes with the re-auth proof', async () => {
    const { client, calls } = fake()
    await createMfaApi(client).regenerateRecoveryCodes({ confirmationCode: '654321' })
    expect(calls[0]).toEqual({
      kind: 'value',
      path: '/auth/mfa/recovery-codes',
      request: { method: 'POST', json: { confirmationCode: '654321' } },
    })
  })
  it('disable → POST /auth/mfa/disable (204) with the re-auth proof and the code or a recovery code', async () => {
    const { client, calls } = fake()
    const api = createMfaApi(client)
    await api.disable({ currentPassword: 'pw', code: '123456' })
    await api.disable({ currentPassword: 'pw', recoveryCode: 'AAAA-BBBB' })
    expect(calls[0]).toEqual({
      kind: 'noContent',
      path: '/auth/mfa/disable',
      request: { method: 'POST', json: { currentPassword: 'pw', code: '123456' } },
    })
    expect(calls[1].request).toEqual({
      method: 'POST',
      json: { currentPassword: 'pw', recoveryCode: 'AAAA-BBBB' },
    })
  })
})

describe('createAuthApi().mfaVerify (second step of a sign-in, public)', () => {
  it('POST /auth/mfa/verify with the mfaToken and the code, no access token, device named', async () => {
    const { client, calls } = fake()
    await createAuthApi(client).mfaVerify(
      { mfaToken: 'opaque', code: '123456' },
      { deviceName: 'Pixel' },
    )
    expect(calls[0]).toEqual({
      kind: 'value',
      path: '/auth/mfa/verify',
      request: {
        method: 'POST',
        json: { mfaToken: 'opaque', code: '123456' },
        skipAuth: true,
        headers: { 'X-Device-Name': 'Pixel' },
      },
    })
  })
  it('sends a recovery code the same way', async () => {
    const { client, calls } = fake()
    await createAuthApi(client).mfaVerify({ mfaToken: 'opaque', recoveryCode: 'AAAA-BBBB' })
    expect(calls[0].request).toEqual({
      method: 'POST',
      json: { mfaToken: 'opaque', recoveryCode: 'AAAA-BBBB' },
      skipAuth: true,
    })
  })
})
