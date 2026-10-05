import { describe, expect, it, vi } from 'vitest'
import type { AuthSession } from './session'
import {
  buildAuthorizeUrl,
  createSocialLoginFlow,
  parseSocialCallback,
  SocialLoginCallbackError,
  type SocialProviderConfig,
} from './social'
import type { AuthTokenResponse } from './types'

const providers: Record<string, SocialProviderConfig> = {
  google: { clientId: 'g-id', redirectUri: 'https://app.test/auth/callback' },
  kakao: {
    clientId: 'k-id',
    redirectUri: 'https://app.test/auth/callback',
    scope: ['profile_nickname', 'account_email'],
  },
  naver: { clientId: 'n-id', redirectUri: 'https://app.test/auth/callback' },
  custom: {
    clientId: 'c-id',
    redirectUri: 'https://app.test/auth/callback',
    authorizeUrl: 'https://idp.test/authorize',
    params: { prompt: 'consent', state: 'ignored', client_id: 'ignored' },
  },
}

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

type SocialLogin = AuthSession['socialLogin']

function flowWith(overrides: { socialLogin?: SocialLogin } = {}) {
  const storage = memoryStorage()
  const socialLogin = vi.fn<SocialLogin>(overrides.socialLogin ?? (async () => token))
  let n = 0
  const flow = createSocialLoginFlow({
    providers,
    session: { socialLogin },
    storage,
    createState: () => `state-${(n += 1)}`,
  })
  return { flow, storage, socialLogin }
}

describe('buildAuthorizeUrl — the provider authorize redirect (the backend only receives the code)', () => {
  it('google: authorization-code request with client id, redirect uri, state and the default scope', () => {
    const url = new URL(buildAuthorizeUrl('google', providers.google, 's1'))
    expect(`${url.origin}${url.pathname}`).toBe('https://accounts.google.com/o/oauth2/v2/auth')
    expect(Object.fromEntries(url.searchParams)).toEqual({
      client_id: 'g-id',
      redirect_uri: 'https://app.test/auth/callback',
      response_type: 'code',
      scope: 'openid email profile',
      state: 's1',
    })
  })

  it('kakao and naver use their own authorize endpoints; a scope array is space-joined', () => {
    const kakao = new URL(buildAuthorizeUrl('kakao', providers.kakao, 's'))
    expect(`${kakao.origin}${kakao.pathname}`).toBe('https://kauth.kakao.com/oauth/authorize')
    expect(kakao.searchParams.get('scope')).toBe('profile_nickname account_email')
    const naver = new URL(buildAuthorizeUrl('naver', providers.naver, 's'))
    expect(`${naver.origin}${naver.pathname}`).toBe('https://nid.naver.com/oauth2.0/authorize')
    expect(naver.searchParams.has('scope')).toBe(false)
  })

  it('a provider with its own authorizeUrl works, extra params are added but cannot override the protocol ones', () => {
    const url = new URL(buildAuthorizeUrl('custom', providers.custom, 's9'))
    expect(url.origin + url.pathname).toBe('https://idp.test/authorize')
    expect(url.searchParams.get('prompt')).toBe('consent')
    expect(url.searchParams.get('state')).toBe('s9')
    expect(url.searchParams.get('client_id')).toBe('c-id')
  })

  it('a provider without a preset or authorizeUrl cannot build a URL', () => {
    expect(() =>
      buildAuthorizeUrl('mystery', { clientId: 'x', redirectUri: 'https://app.test/cb' }, 's'),
    ).toThrow(/authorizeUrl/)
  })
})

describe('parseSocialCallback', () => {
  it('reads code and state from a query string with or without the leading ?', () => {
    expect(parseSocialCallback('?code=abc&state=s1')).toEqual({ code: 'abc', state: 's1' })
    expect(parseSocialCallback('code=abc&state=s1')).toEqual({ code: 'abc', state: 's1' })
    expect(parseSocialCallback(new URLSearchParams({ code: 'c', state: 's' }))).toEqual({
      code: 'c',
      state: 's',
    })
  })

  it('reports a provider error (user denied, …) with its description', () => {
    expect(parseSocialCallback('?error=access_denied&error_description=nope&state=s1')).toEqual({
      state: 's1',
      error: 'access_denied',
      errorDescription: 'nope',
    })
  })
})

describe('createSocialLoginFlow', () => {
  it('start stores the state for that provider and returns the redirect url carrying it', () => {
    const { flow, storage } = flowWith()
    const { url, state } = flow.start('kakao')
    expect(state).toBe('state-1')
    expect(new URL(url).searchParams.get('state')).toBe('state-1')
    expect([...storage.data.values()].some((value) => value.includes('kakao'))).toBe(true)
  })

  it('start for a provider that is not configured throws and stores nothing', () => {
    const { flow, storage } = flowWith()
    expect(() => flow.start('github')).toThrow(/github/)
    expect(storage.data.size).toBe(0)
  })

  it('complete → session.socialLogin(provider, code, the redirectUri used at start), and the state is single-use', async () => {
    const { flow, storage, socialLogin } = flowWith()
    const { state } = flow.start('google')
    const result = await flow.complete(`?code=the-code&state=${state}`)
    expect(result).toEqual({ provider: 'google', token })
    expect(socialLogin).toHaveBeenCalledWith('google', 'the-code', 'https://app.test/auth/callback')
    expect(storage.data.size).toBe(0)
  })

  it('completing the same callback twice (React StrictMode) logs in once', async () => {
    const { flow, socialLogin } = flowWith()
    const { state } = flow.start('google')
    const [a, b] = await Promise.all([
      flow.complete(`?code=c&state=${state}`),
      flow.complete(`?code=c&state=${state}`),
    ])
    expect(a).toBe(b)
    expect(socialLogin).toHaveBeenCalledTimes(1)
  })

  it('a state we never issued is rejected before any request (CSRF guard)', async () => {
    const { flow, socialLogin } = flowWith()
    flow.start('google')
    const failure = await flow.complete('?code=c&state=forged').catch((e: unknown) => e)
    expect(failure).toBeInstanceOf(SocialLoginCallbackError)
    expect((failure as SocialLoginCallbackError).reason).toBe('state_mismatch')
    expect(socialLogin).not.toHaveBeenCalled()
  })

  it('a missing state or code is rejected with its own reason', async () => {
    const { flow } = flowWith()
    const { state } = flow.start('google')
    const noState = await flow.complete('?code=c').catch((e: unknown) => e)
    expect((noState as SocialLoginCallbackError).reason).toBe('state_mismatch')
    const noCode = await flow.complete(`?state=${state}`).catch((e: unknown) => e)
    expect((noCode as SocialLoginCallbackError).reason).toBe('missing_code')
  })

  it('a provider error (the user pressed cancel) is surfaced and consumes the state', async () => {
    const { flow, storage, socialLogin } = flowWith()
    const { state } = flow.start('google')
    const failure = await flow
      .complete(`?error=access_denied&state=${state}`)
      .catch((e: unknown) => e)
    expect((failure as SocialLoginCallbackError).reason).toBe('provider_error')
    expect((failure as SocialLoginCallbackError).providerError).toBe('access_denied')
    expect(socialLogin).not.toHaveBeenCalled()
    expect(storage.data.size).toBe(0)
  })

  it('a backend failure of socialLogin propagates to the caller untouched', async () => {
    const boom = new Error('AUTH_SOCIAL.INVALID_AUTHORIZATION_CODE')
    const { flow } = flowWith({ socialLogin: async () => Promise.reject(boom) })
    const { state } = flow.start('google')
    await expect(flow.complete(`?code=c&state=${state}`)).rejects.toBe(boom)
  })
})
