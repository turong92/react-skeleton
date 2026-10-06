import { describe, expect, it, vi } from 'vitest'
import type { AccountApi } from './account/accountApi'
import { createSocialLoginFlow } from './social'
import { createSocialLinkFlow } from './socialLink'

const providers = {
  google: { clientId: 'cid', redirectUri: 'https://app.example.com/account/link-callback' },
}

describe('createSocialLinkFlow (logged-in user adds a provider to the account)', () => {
  it('start builds the authorize url for the link callback', async () => {
    const flow = createSocialLinkFlow({
      providers,
      accountApi: { linkSocial: vi.fn() },
      createState: () => 'state-1',
    })
    const { url, state } = await flow.start('google')
    expect(state).toBe('state-1')
    expect(new URL(url).searchParams.get('redirect_uri')).toBe(providers.google.redirectUri)
  })

  it('a state issued for linking cannot finish a sign-in, and a sign-in state cannot finish a link (separate key prefixes in one storage)', async () => {
    const data = new Map<string, string>()
    const storage = {
      getItem: (k: string) => data.get(k) ?? null,
      setItem: (k: string, v: string) => void data.set(k, v),
      removeItem: (k: string) => void data.delete(k),
    }
    const socialLogin = vi.fn()
    const login = createSocialLoginFlow({
      providers,
      session: { socialLogin },
      storage,
      createState: () => 'login-state',
    })
    const link = createSocialLinkFlow({
      providers,
      accountApi: { linkSocial: vi.fn() },
      storage,
      createState: () => 'link-state',
    })
    await link.start('google')
    await login.start('google')
    // the two flows keep their states under different prefixes
    expect([...data.keys()].sort()).toEqual([
      'skeleton.social-link.link-state',
      'skeleton.social.login-state',
    ])
    // same state values crossed over: each side rejects the other's
    const sameState = createSocialLinkFlow({
      providers,
      accountApi: { linkSocial: vi.fn() },
      storage,
      createState: () => 'login-state',
    })
    await expect(sameState.read('code=c&state=login-state')).rejects.toMatchObject({
      reason: 'state_mismatch',
    })
    await expect(login.complete('code=c&state=link-state')).rejects.toMatchObject({
      reason: 'state_mismatch',
    })
    expect(socialLogin).not.toHaveBeenCalled()
  })

  it('complete sends the code to POST /account/identities/social/{provider}, never to a login', async () => {
    const linkSocial = vi.fn(async () => ({
      id: 'idn_9',
      method: 'google',
      subject: null,
      verified: true,
      createdAt: 't',
      lastUsedAt: null,
      removable: true,
    }))
    const flow = createSocialLinkFlow({
      providers,
      accountApi: { linkSocial } as Pick<AccountApi, 'linkSocial'>,
      createState: () => 's',
    })
    await flow.start('google')
    const result = await flow.complete('?code=abc&state=s')
    expect(linkSocial).toHaveBeenCalledWith('google', 'abc', providers.google.redirectUri)
    expect(result.provider).toBe('google')
  })

  it('a callback this browser did not start is refused before any request', async () => {
    const linkSocial = vi.fn()
    const flow = createSocialLinkFlow({
      providers,
      accountApi: { linkSocial },
      createState: () => 's',
    })
    await expect(flow.complete('?code=abc&state=other')).rejects.toMatchObject({
      reason: 'state_mismatch',
    })
    expect(linkSocial).not.toHaveBeenCalled()
  })

  it('a callback without state is refused (login CSRF / forced linking)', async () => {
    const linkSocial = vi.fn()
    const flow = createSocialLinkFlow({
      providers,
      accountApi: { linkSocial },
      createState: () => 's',
    })
    await flow.start('google')
    await expect(flow.complete('?code=abc')).rejects.toMatchObject({ reason: 'state_mismatch' })
    expect(linkSocial).not.toHaveBeenCalled()
  })

  it('state is single use: a replayed callback after completion is refused and links once', async () => {
    const linkSocial = vi.fn(async () => ({}) as never)
    const flow = createSocialLinkFlow({
      providers,
      accountApi: { linkSocial },
      createState: () => 's',
    })
    await flow.start('google')
    await flow.complete('?code=abc&state=s')
    await expect(flow.complete('?code=abc&state=s')).resolves.toBeDefined() // same in-flight result, no second request
    expect(linkSocial).toHaveBeenCalledTimes(1)
  })

  it('state is bound to the browser storage it was started in', async () => {
    const data = new Map<string, string>()
    const storage = {
      getItem: (k: string) => data.get(k) ?? null,
      setItem: (k: string, v: string) => void data.set(k, v),
      removeItem: (k: string) => void data.delete(k),
    }
    const linkSocial = vi.fn(async () => ({}) as never)
    createSocialLinkFlow({
      providers,
      accountApi: { linkSocial },
      storage,
      createState: () => 's',
    }).start('google')
    const other = createSocialLinkFlow({
      providers,
      accountApi: { linkSocial },
      createState: () => 's',
    }) // another browser: empty storage
    await expect(other.complete('?code=abc&state=s')).rejects.toMatchObject({
      reason: 'state_mismatch',
    })
    const same = createSocialLinkFlow({ providers, accountApi: { linkSocial }, storage })
    await same.complete('?code=abc&state=s')
    expect(linkSocial).toHaveBeenCalledTimes(1)
  })

  it('read checks state and hands back the code without linking (the page asks for the password first)', async () => {
    const linkSocial = vi.fn(async () => ({}) as never)
    const flow = createSocialLinkFlow({
      providers,
      accountApi: { linkSocial },
      createState: () => 's',
    })
    await flow.start('google')
    const first = await flow.read('?code=abc&state=s')
    expect(first).toEqual({
      provider: 'google',
      authorizationCode: 'abc',
      redirectUri: providers.google.redirectUri,
    })
    expect(await flow.read('?code=abc&state=s')).toEqual(first) // a double effect reads the same result
    expect(linkSocial).not.toHaveBeenCalled()
    await expect(flow.read('?code=abc&state=other')).rejects.toMatchObject({
      reason: 'state_mismatch',
    })
  })

  it('complete carries the re-authentication credential to the server call', async () => {
    const linkSocial = vi.fn(async () => ({}) as never)
    const flow = createSocialLinkFlow({
      providers,
      accountApi: { linkSocial },
      createState: () => 's',
    })
    await flow.start('google')
    await flow.complete('?code=abc&state=s', { confirmationCode: '123456' })
    expect(linkSocial).toHaveBeenCalledWith('google', 'abc', providers.google.redirectUri, {
      confirmationCode: '123456',
    })
  })

  describe('the state carries the pending action and the account (re-consent round trip)', () => {
    const storage = () => {
      const data = new Map<string, string>()
      return {
        data,
        storage: {
          getItem: (k: string) => data.get(k) ?? null,
          setItem: (k: string, v: string) => void data.set(k, v),
          removeItem: (k: string) => void data.delete(k),
        },
      }
    }
    const make = (store: ReturnType<typeof storage>, state = 's') =>
      createSocialLinkFlow({
        providers,
        accountApi: { linkSocial: vi.fn() },
        storage: store.storage,
        createState: () => state,
      })

    it('start(provider, context) → read hands the same context back, read twice gives the same result (StrictMode)', async () => {
      const store = storage()
      const flow = make(store)
      const context = {
        accountId: 'acc_1',
        action: { kind: 'email-change', newEmail: 'n@b.c' },
      } as const
      await flow.start('google', context)
      const first = await flow.read('?code=abc&state=s')
      expect(first).toMatchObject({ provider: 'google', authorizationCode: 'abc', context })
      expect(await flow.read('?code=abc&state=s')).toEqual(first)
    })

    it('the record disappears from storage when it is read (one use) — a replay of the same callback is a mismatch', async () => {
      const store = storage()
      make(store).start('google', { accountId: 'acc_1', action: { kind: 'delete' } })
      expect(store.data.size).toBe(1)
      await make(store).read('?code=abc&state=s')
      expect(store.data.size).toBe(0)
      await expect(make(store).read('?code=abc&state=s')).rejects.toMatchObject({
        reason: 'state_mismatch',
      })
    })

    it('a plain start has no context', async () => {
      const store = storage()
      const flow = make(store)
      await flow.start('google')
      expect((await flow.read('?code=abc&state=s')).context).toBeUndefined()
    })
  })

  describe('PKCE and nonce of the provider consent (LINE / X link, re-auth)', () => {
    const line = {
      line: {
        clientId: '2001234567',
        redirectUri: 'https://app.example.com/account/link-callback',
        pkce: 'REQUIRED' as const,
        nonce: 'REQUIRED' as const,
        authorize: {
          url: 'https://access.line.me/oauth2/v2.1/authorize',
          scopes: ['openid', 'profile'],
          params: {},
        },
      },
    }
    const storage = () => {
      const data = new Map<string, string>()
      return {
        data,
        storage: {
          getItem: (k: string) => data.get(k) ?? null,
          setItem: (k: string, v: string) => void data.set(k, v),
          removeItem: (k: string) => void data.delete(k),
        },
      }
    }

    it('complete sends the verifier and nonce of THIS attempt at the top level of the link call', async () => {
      const linkSocial = vi.fn(async () => ({}) as never)
      const { data, storage: store } = storage()
      const flow = createSocialLinkFlow({
        providers: line,
        accountApi: { linkSocial },
        storage: store,
        createState: () => 's',
      })
      await flow.start('line')
      const kept = JSON.parse([...data.values()][0])
      await flow.complete('?code=abc&state=s', { currentPassword: 'pw' })
      expect(linkSocial).toHaveBeenCalledWith(
        'line',
        'abc',
        line.line.redirectUri,
        { currentPassword: 'pw' },
        { codeVerifier: kept.codeVerifier, nonce: kept.nonce },
      )
    })

    it('read hands the verifier and nonce back so a page that waits for the password still has them', async () => {
      const { storage: store } = storage()
      const flow = createSocialLinkFlow({
        providers: line,
        accountApi: { linkSocial: vi.fn() },
        storage: store,
        createState: () => 's',
      })
      await flow.start('line', {
        accountId: 'acc',
        action: { kind: 'unlink', identityId: 'idn_1' },
      })
      const read = await flow.read('?code=abc&state=s')
      expect(read.codeVerifier).toMatch(/^[A-Za-z0-9\-._~]{43}$/)
      expect(read.nonce).toBeTruthy()
      expect(read.context).toEqual({
        accountId: 'acc',
        action: { kind: 'unlink', identityId: 'idn_1' },
      })
    })

    it('a re-authentication round trip is stored as a "reauth", linking as a "link"', async () => {
      const { data, storage: store } = storage()
      let n = 0
      const flow = createSocialLinkFlow({
        providers: line,
        accountApi: { linkSocial: vi.fn() },
        storage: store,
        createState: () => `s${(n += 1)}`,
      })
      await flow.start('line', { accountId: 'acc', action: { kind: 'link' } })
      await flow.start('line', { accountId: 'acc', action: { kind: 'delete' } })
      expect(JSON.parse(data.get('skeleton.social-link.s1') ?? '{}').action).toBe('link')
      expect(JSON.parse(data.get('skeleton.social-link.s2') ?? '{}').action).toBe('reauth')
    })
  })
})
