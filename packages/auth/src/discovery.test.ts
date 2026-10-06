import { describe, expect, it, vi } from 'vitest'
import type { AuthApi } from './authApi'
import {
  clearAuthMethodsCache,
  deliveryMismatch,
  loadAuthMethods,
  methodsFromInfo,
  normalizeMethodsInfo,
  redirectUriProblems,
} from './discovery'

const wire = {
  methods: ['password', 'magic_link'],
  signUp: { password: true, emailVerification: true, social: true },
  social: [
    { provider: 'google', clientId: 'cid-google', redirectUri: 'https://app/auth/callback' },
    { provider: 'kakao', clientId: null, redirectUri: null },
  ],
  captchaRequired: false,
  refreshDelivery: 'body',
}

describe('normalizeMethodsInfo (the wire shape of GET /auth/methods, tolerant of older or partial backends)', () => {
  it('reads the contract shape', () => {
    expect(normalizeMethodsInfo(wire)).toEqual({
      methods: ['password', 'magic_link'],
      signUp: { password: true, emailVerification: true, social: true },
      social: wire.social,
      captchaRequired: false,
      refreshDelivery: 'body',
    })
  })
  it('missing or odd parts fall back to the safe reading (password only, sign-up closed)', () => {
    const odd = normalizeMethodsInfo({ methods: 'nope', social: [{ provider: 7 }, null] })
    expect(odd.methods).toEqual([])
    expect(odd.social).toEqual([])
    expect(odd.signUp).toEqual({ password: false, emailVerification: false, social: false })
    expect(odd.refreshDelivery).toBeNull()
    expect(normalizeMethodsInfo(undefined).methods).toEqual([])
  })
})

describe('methodsFromInfo', () => {
  it('maps backend method codes onto the screens: magic_link → magicLink, social with a client id → a button', () => {
    const { methods, signUp } = methodsFromInfo(normalizeMethodsInfo(wire))
    expect(methods).toEqual({
      password: true,
      magicLink: true,
      social: [{ provider: 'google' }],
    })
    expect(signUp).toBe(true)
  })
  it('a provider without a public client id gets a button only when the app supplies one', () => {
    const info = normalizeMethodsInfo(wire)
    expect(
      methodsFromInfo(info, { clientIds: { kakao: 'app-kakao' } }).methods.social?.map(
        (p) => p.provider,
      ),
    ).toEqual(['google', 'kakao'])
  })
  it('sign-up closed on the backend → no sign-up', () => {
    const closed = normalizeMethodsInfo({ ...wire, signUp: { ...wire.signUp, password: false } })
    expect(methodsFromInfo(closed).signUp).toBe(false)
  })
  it('providers for the redirect flows carry the public values; redirectUri falls back to this app', () => {
    const { providers } = methodsFromInfo(normalizeMethodsInfo(wire), {
      clientIds: { kakao: 'k' },
      defaultRedirectUri: 'https://me/auth/callback',
    })
    expect(providers).toEqual({
      google: { clientId: 'cid-google', redirectUri: 'https://app/auth/callback' },
      kakao: { clientId: 'k', redirectUri: 'https://me/auth/callback' },
    })
  })
})

describe('deliveryMismatch', () => {
  it('names the wrong configuration (cookie backend, body client) — the refresh would silently fail', () => {
    expect(
      deliveryMismatch(normalizeMethodsInfo({ ...wire, refreshDelivery: 'cookie' }), 'body'),
    ).toMatch(/cookie/)
    expect(deliveryMismatch(normalizeMethodsInfo(wire), 'body')).toBeNull()
    expect(
      deliveryMismatch(normalizeMethodsInfo({ ...wire, refreshDelivery: null }), 'body'),
    ).toBeNull()
  })
})

describe('loadAuthMethods (one request per api, shared by every page that needs it)', () => {
  const api = (impl: () => Promise<unknown>) =>
    ({ methods: vi.fn(impl) }) as unknown as AuthApi & { methods: ReturnType<typeof vi.fn> }

  it('asks once and shares the answer', async () => {
    const a = api(async () => wire)
    const [one, two] = await Promise.all([loadAuthMethods(a), loadAuthMethods(a)])
    expect(a.methods).toHaveBeenCalledTimes(1)
    expect(one).toBe(two)
  })
  it('a failure is not remembered — the next page asks again', async () => {
    let fail = true
    const a = api(async () => {
      if (fail) throw new Error('down')
      return wire
    })
    await expect(loadAuthMethods(a)).rejects.toThrow('down')
    fail = false
    expect((await loadAuthMethods(a)).methods).toContain('password')
    expect(a.methods).toHaveBeenCalledTimes(2)
  })
  it('the answer is reused for five minutes, then asked again (the backend caches the same time)', async () => {
    let now = 0
    const a = api(async () => wire)
    await loadAuthMethods(a, { now: () => now })
    now = 4 * 60_000
    await loadAuthMethods(a, { now: () => now })
    expect(a.methods).toHaveBeenCalledTimes(1)
    now = 6 * 60_000
    await loadAuthMethods(a, { now: () => now })
    expect(a.methods).toHaveBeenCalledTimes(2)
  })
  it('clearAuthMethodsCache forgets everything (the retry button)', async () => {
    const a = api(async () => wire)
    await loadAuthMethods(a)
    clearAuthMethodsCache(a)
    await loadAuthMethods(a)
    expect(a.methods).toHaveBeenCalledTimes(2)
  })
})

describe('redirectUriProblems (the exact-match pitfalls of provider consoles)', () => {
  const entry = (redirectUri: string | null) => ({ provider: 'line', clientId: 'c', redirectUri })
  const expected = 'https://app.example.com/auth/callback'

  it('is quiet when the backend address is byte-identical to this app’s callback', () => {
    expect(redirectUriProblems([entry(expected)], expected)).toEqual([])
    expect(redirectUriProblems([entry(null)], expected)).toEqual([]) // the app uses its own
  })

  it('names the origin when http/https, host or port differ — the provider would send the code to another place', () => {
    for (const other of [
      'http://app.example.com/auth/callback',
      'https://www.example.com/auth/callback',
      'https://app.example.com:8443/auth/callback',
    ])
      expect(redirectUriProblems([entry(other)], expected)).toMatchObject([
        { provider: 'line', kind: 'origin' },
      ])
  })

  it('names a trailing slash, which most providers compare exactly', () => {
    expect(redirectUriProblems([entry(expected + '/')], expected)).toMatchObject([
      { kind: 'trailing-slash' },
    ])
  })

  it('names a different path: the callback would land where this app has no callback route', () => {
    expect(redirectUriProblems([entry('https://app.example.com/cb/line')], expected)).toMatchObject(
      [{ kind: 'path' }],
    )
  })
})
