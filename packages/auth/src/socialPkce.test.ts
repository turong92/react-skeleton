import { describe, expect, it, vi } from 'vitest'
import { methodsFromInfo, normalizeMethodsInfo } from './discovery'
import { codeChallengeS256, PkceUnavailableError } from './pkce'
import type { AuthSession } from './session'
import {
  buildAuthorizeUrl,
  createSocialLoginFlow,
  SocialLoginCallbackError,
  type SocialProviderConfig,
} from './social'
import type { AuthTokenResponse } from './types'

const REDIRECT = 'https://app.test/auth/callback'

/** `GET /auth/methods` of the social backend branch (CONTRACT addendum A) */
const wire = {
  methods: ['password'],
  signUp: { password: true, emailVerification: true, social: true },
  social: [
    {
      provider: 'google',
      clientId: 'g-id',
      redirectUri: REDIRECT,
      pkce: 'SUPPORTED',
      nonce: 'UNSUPPORTED',
      authorize: {
        url: 'https://accounts.google.com/o/oauth2/v2/auth',
        scopes: ['openid', 'email', 'profile'],
        params: { response_type: 'code' },
      },
    },
    {
      provider: 'line',
      clientId: '2001234567',
      redirectUri: REDIRECT,
      pkce: 'REQUIRED',
      nonce: 'REQUIRED',
      authorize: {
        url: 'https://access.line.me/oauth2/v2.1/authorize',
        scopes: ['openid', 'profile', 'email'],
        params: { response_type: 'code' },
      },
    },
    {
      provider: 'x',
      clientId: 'x-client',
      redirectUri: REDIRECT,
      pkce: 'REQUIRED',
      nonce: 'UNSUPPORTED',
      authorize: {
        url: 'https://x.com/i/oauth2/authorize',
        scopes: ['users.read', 'tweet.read'],
        params: { response_type: 'code' },
      },
    },
    {
      provider: 'kakao',
      clientId: 'k-id',
      redirectUri: REDIRECT,
      pkce: 'UNSUPPORTED',
      nonce: 'UNSUPPORTED',
      authorize: null,
    },
  ],
  captchaRequired: false,
  refreshDelivery: 'body',
}

const discovered = () => methodsFromInfo(normalizeMethodsInfo(wire)).providers

const token: AuthTokenResponse = {
  accessToken: 'jwt',
  tokenType: 'Bearer',
  expiresAt: '2026-06-12T01:00:00Z',
  principal: { accountId: 'a1', roles: [] },
}

function memoryStorage() {
  const data = new Map<string, string>()
  return {
    data,
    getItem: (key: string) => data.get(key) ?? null,
    setItem: (key: string, value: string) => void data.set(key, value),
    removeItem: (key: string) => void data.delete(key),
  }
}

function flowWith(providers: Record<string, SocialProviderConfig> = discovered()) {
  const storage = memoryStorage()
  const socialLogin = vi.fn<AuthSession['socialLogin']>(async () => token)
  const flow = createSocialLoginFlow({ providers, session: { socialLogin }, storage })
  return { flow, storage, socialLogin }
}

describe('discovery carries what the backend says about every provider', () => {
  it('keeps pkce, nonce and the authorize endpoint of each provider', () => {
    const line = normalizeMethodsInfo(wire).social.find((s) => s.provider === 'line')
    expect(line).toMatchObject({
      pkce: 'REQUIRED',
      nonce: 'REQUIRED',
      authorize: { url: 'https://access.line.me/oauth2/v2.1/authorize' },
    })
    expect(discovered().line).toMatchObject({
      clientId: '2001234567',
      pkce: 'REQUIRED',
      nonce: 'REQUIRED',
      authorize: { scopes: ['openid', 'profile', 'email'] },
    })
  })

  it('reads an older backend (no pkce / nonce / authorize) as "send nothing new"', () => {
    const [google] = normalizeMethodsInfo({
      ...wire,
      social: [{ provider: 'google', clientId: 'g', redirectUri: null }],
    }).social
    expect(google.pkce).toBeUndefined()
    expect(google.nonce).toBeUndefined()
    expect(google.authorize).toBeUndefined()
  })

  it('drops values it does not know instead of guessing (an unknown mode, a malformed authorize)', () => {
    const [entry] = normalizeMethodsInfo({
      ...wire,
      social: [
        {
          provider: 'p',
          clientId: 'c',
          pkce: 'MAYBE',
          nonce: 7,
          authorize: { url: 42, scopes: 'openid' },
        },
      ],
    }).social
    expect(entry.pkce).toBeUndefined()
    expect(entry.nonce).toBeUndefined()
    expect(entry.authorize).toBeUndefined()
  })

  it('lists the providers in the order the backend sent them', () => {
    expect(
      methodsFromInfo(normalizeMethodsInfo(wire)).methods.social?.map((p) => p.provider),
    ).toEqual(['google', 'line', 'x', 'kakao'])
  })
})

describe('buildAuthorizeUrl from the discovered authorize info (no per-provider URL in the frontend)', () => {
  it('LINE: endpoint, scopes joined by a space, state, S256 challenge and nonce', () => {
    const url = new URL(
      buildAuthorizeUrl('line', discovered().line, 'st', { codeChallenge: 'CH', nonce: 'NO' }),
    )
    expect(url.origin + url.pathname).toBe('https://access.line.me/oauth2/v2.1/authorize')
    expect(Object.fromEntries(url.searchParams)).toEqual({
      client_id: '2001234567',
      redirect_uri: REDIRECT,
      response_type: 'code',
      scope: 'openid profile email',
      state: 'st',
      code_challenge: 'CH',
      code_challenge_method: 'S256',
      nonce: 'NO',
    })
  })

  it('X: PKCE yes, nonce never (the provider does not use one)', () => {
    const url = new URL(
      buildAuthorizeUrl('x', discovered().x, 'st', { codeChallenge: 'CH', nonce: 'NO' }),
    )
    expect(url.origin + url.pathname).toBe('https://x.com/i/oauth2/authorize')
    expect(url.searchParams.get('code_challenge_method')).toBe('S256')
    expect(url.searchParams.has('nonce')).toBe(false)
    expect(url.searchParams.get('scope')).toBe('users.read tweet.read')
  })

  it('kakao (UNSUPPORTED, no authorize info) keeps the legacy table and sends no PKCE parameters', () => {
    const url = new URL(
      buildAuthorizeUrl('kakao', discovered().kakao, 'st', { codeChallenge: 'CH', nonce: 'NO' }),
    )
    expect(url.origin + url.pathname).toBe('https://kauth.kakao.com/oauth/authorize')
    expect(url.searchParams.has('code_challenge')).toBe(false)
    expect(url.searchParams.has('nonce')).toBe(false)
  })

  it('authorize params cannot override the protocol parameters', () => {
    const config: SocialProviderConfig = {
      ...discovered().line,
      authorize: {
        url: 'https://idp.test/authorize',
        scopes: [],
        params: { prompt: 'consent', code_challenge: 'evil', nonce: 'evil', state: 'evil' },
      },
    }
    const url = new URL(
      buildAuthorizeUrl('line', config, 'st', { codeChallenge: 'CH', nonce: 'NO' }),
    )
    expect(url.searchParams.get('prompt')).toBe('consent')
    expect(url.searchParams.get('code_challenge')).toBe('CH')
    expect(url.searchParams.get('nonce')).toBe('NO')
    expect(url.searchParams.get('state')).toBe('st')
    expect(url.searchParams.has('scope')).toBe(false)
  })
})

describe('a social attempt owns its verifier and nonce', () => {
  it('start() makes a fresh verifier per attempt, keeps it next to the state, and sends only its S256 challenge', async () => {
    const { flow, storage } = flowWith()
    const first = await flow.start('line')
    const second = await flow.start('line')
    const stored = JSON.parse(storage.data.get(`skeleton.social.${first.state}`) ?? '{}')
    expect(stored.codeVerifier).toMatch(/^[A-Za-z0-9\-._~]{43,128}$/)
    expect(new URL(first.url).searchParams.get('code_challenge')).toBe(
      await codeChallengeS256(stored.codeVerifier),
    )
    expect(new URL(first.url).searchParams.get('nonce')).toBe(stored.nonce)
    expect(first.url).not.toContain(stored.codeVerifier)
    const other = JSON.parse(storage.data.get(`skeleton.social.${second.state}`) ?? '{}')
    expect(other.codeVerifier).not.toBe(stored.codeVerifier)
    expect(other.nonce).not.toBe(stored.nonce)
  })

  it('does not store a nonce for a provider that does not use one', async () => {
    const { flow, storage } = flowWith()
    const { state } = await flow.start('x')
    const stored = JSON.parse(storage.data.get(`skeleton.social.${state}`) ?? '{}')
    expect(stored.codeVerifier).toBeTruthy()
    expect(stored.nonce).toBeUndefined()
  })

  it('a provider that does not support PKCE stores no verifier', async () => {
    const { flow, storage } = flowWith()
    const { state } = await flow.start('kakao')
    expect(JSON.parse(storage.data.get(`skeleton.social.${state}`) ?? '{}').codeVerifier).toBe(
      undefined,
    )
  })

  it('complete() sends the stored verifier and nonce with the code and spends them', async () => {
    const { flow, storage, socialLogin } = flowWith()
    const { state } = await flow.start('line')
    const stored = JSON.parse(storage.data.get(`skeleton.social.${state}`) ?? '{}')
    await flow.complete(`?code=the-code&state=${state}`)
    expect(socialLogin).toHaveBeenCalledWith('line', 'the-code', REDIRECT, {
      codeVerifier: stored.codeVerifier,
      nonce: stored.nonce,
    })
    expect(storage.data.size).toBe(0)
    await expect(flow.complete(`?code=again&state=${state}`)).resolves.toBeTruthy() // double invocation: same login, not a second code
    expect(socialLogin).toHaveBeenCalledTimes(1)
  })

  it('a pkce REQUIRED provider cannot start without WebCrypto: a clear error and nothing stored', async () => {
    const { flow, storage } = flowWith()
    const crypto = globalThis.crypto
    Object.defineProperty(globalThis, 'crypto', {
      value: { getRandomValues: crypto.getRandomValues.bind(crypto) },
      configurable: true,
    })
    try {
      await expect(flow.start('line')).rejects.toBeInstanceOf(PkceUnavailableError)
      await expect(flow.start('x')).rejects.toBeInstanceOf(PkceUnavailableError)
      expect(storage.data.size).toBe(0)
      const supported = await flow.start('google') // SUPPORTED: carries on without it
      expect(new URL(supported.url).searchParams.has('code_challenge')).toBe(false)
    } finally {
      Object.defineProperty(globalThis, 'crypto', { value: crypto, configurable: true })
    }
  })

  it('a state started for linking cannot be consumed by the sign-in callback', async () => {
    const storage = memoryStorage()
    const socialLogin = vi.fn<AuthSession['socialLogin']>(async () => token)
    const login = createSocialLoginFlow({
      providers: discovered(),
      session: { socialLogin },
      storage,
      purpose: 'login',
    })
    const link = createSocialLoginFlow({
      providers: discovered(),
      session: { socialLogin },
      storage,
      purpose: 'link',
    })
    const { state } = await link.start('google')
    const failure = await login.complete(`?code=c&state=${state}`).catch((e: unknown) => e)
    expect((failure as SocialLoginCallbackError).reason).toBe('state_mismatch')
    expect(socialLogin).not.toHaveBeenCalled()
    expect(storage.data.size).toBe(1) // the link attempt is still there for its own callback
  })
})

describe('callback shapes of real providers', () => {
  it('a cancelled consent that echoes our state is a provider error (X and LINE both send error + state)', async () => {
    const { flow, socialLogin } = flowWith()
    const { state } = await flow.start('x')
    const failure = await flow
      .complete(`?error=access_denied&error_description=The+user+denied&state=${state}`)
      .catch((e: unknown) => e)
    expect((failure as SocialLoginCallbackError).reason).toBe('provider_error')
    expect((failure as SocialLoginCallbackError).providerError).toBe('access_denied')
    expect(socialLogin).not.toHaveBeenCalled()
  })

  it('an error without any state is still reported as the provider error, with no request', async () => {
    const { flow, socialLogin } = flowWith()
    const failure = await flow.complete('?error=access_denied').catch((e: unknown) => e)
    expect((failure as SocialLoginCallbackError).reason).toBe('provider_error')
    expect(socialLogin).not.toHaveBeenCalled()
  })

  it('an error carrying a state we never issued is a mismatch (not trusted for anything)', async () => {
    const { flow } = flowWith()
    const failure = await flow
      .complete('?error=access_denied&state=forged')
      .catch((e: unknown) => e)
    expect((failure as SocialLoginCallbackError).reason).toBe('state_mismatch')
  })

  it('a callback opened in another tab has no state in that tab and is refused before any request', async () => {
    const { flow } = flowWith()
    const { state } = await flow.start('line')
    const otherTab = flowWith() // a different tab has its own sessionStorage
    const failure = await otherTab.flow.complete(`?code=c&state=${state}`).catch((e: unknown) => e)
    expect((failure as SocialLoginCallbackError).reason).toBe('state_mismatch')
    expect(otherTab.socialLogin).not.toHaveBeenCalled()
  })
})
