import { describe, expect, it, vi } from 'vitest'
import type { AuthApi } from '../authApi'
import { createAuthSession } from '../session'
import { createTokenStore } from '../tokenStore'

const response = (accessToken: string) => ({
  accessToken,
  tokenType: 'Bearer' as const,
  expiresAt: '2099-01-01T00:00:00Z',
  principal: { accountId: 'a', roles: [] },
})
const unused = async () => {
  throw new Error('unused')
}
const apiWith = (mfaVerify: AuthApi['mfaVerify']) =>
  ({
    login: unused,
    socialLogin: unused,
    me: unused,
    refresh: unused,
    logout: unused,
    magicLinkRequest: unused,
    magicLinkRedeem: unused,
    cancelDeletion: unused,
    methods: unused,
    mfaVerify,
  }) as AuthApi

describe('session.mfaLogin (the second step of every sign-in)', () => {
  it('signs in with the answer exactly like a login (token stored, device named)', async () => {
    const mfaVerify = vi.fn(async () => response('second-step-token'))
    const store = createTokenStore()
    const session = createAuthSession({ api: apiWith(mfaVerify), store, deviceName: 'Pixel' })
    await session.mfaLogin({ mfaToken: 'opaque', code: '123456' })
    expect(mfaVerify).toHaveBeenCalledWith(
      { mfaToken: 'opaque', code: '123456' },
      { deviceName: 'Pixel' },
    )
    expect(store.get()).toBe('second-step-token')
    expect(session.getState().status).toBe('authenticated')
  })

  it('a wrong code leaves the session anonymous', async () => {
    const store = createTokenStore()
    const session = createAuthSession({
      api: apiWith(async () => {
        throw new Error('400')
      }),
      store,
    })
    await expect(session.mfaLogin({ mfaToken: 'opaque', code: '000000' })).rejects.toThrow('400')
    expect(store.get()).toBeNull()
  })
})
