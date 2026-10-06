import { describe, expect, it } from 'vitest'
import {
  parseAuthMethods,
  parseDelivery,
  socialClientIds,
  socialProviderConfigs,
} from './authConfig'

describe('parseAuthMethods (the optional override of what the backend says)', () => {
  it('unset or blank means: ask the backend (GET /auth/methods) — there is no env default any more', () => {
    expect(parseAuthMethods(undefined)).toBeUndefined()
    expect(parseAuthMethods('')).toBeUndefined()
    expect(parseAuthMethods('   ')).toBeUndefined()
  })
  it('a list picks exactly those methods, social providers by code', () => {
    expect(parseAuthMethods('password, google ,KAKAO')).toEqual({
      password: true,
      magicLink: false,
      social: [{ provider: 'google' }, { provider: 'kakao' }],
    })
    expect(parseAuthMethods('magic-link')).toEqual({ password: false, magicLink: true, social: [] })
  })
  it('M8: the backend spelling magic_link works too (it must not be read as a social provider)', () => {
    expect(parseAuthMethods('password,magic_link')).toEqual({
      password: true,
      magicLink: true,
      social: [],
    })
  })
})

describe('refresh delivery', () => {
  it('body unless cookie is asked for', () => {
    expect(parseDelivery(undefined)).toBe('body')
    expect(parseDelivery('cookie')).toBe('cookie')
  })
})

describe('socialClientIds (public client ids the app supplies when discovery does not know them)', () => {
  it('reads VITE_SOCIAL_<PROVIDER>_CLIENT_ID for any provider', () => {
    expect(
      socialClientIds({
        VITE_SOCIAL_GOOGLE_CLIENT_ID: 'g',
        VITE_SOCIAL_KAKAO_CLIENT_ID: 'k',
        VITE_SOCIAL_NAVER_CLIENT_ID: '',
        UNRELATED: 'x',
      }),
    ).toEqual({ google: 'g', kakao: 'k' })
  })
})

describe('socialProviderConfigs', () => {
  it('only providers that have a client id', () => {
    expect(
      socialProviderConfigs(
        { VITE_AUTH_METHODS: 'google,kakao', VITE_SOCIAL_GOOGLE_CLIENT_ID: 'cid' },
        'https://app.example.com',
      ),
    ).toEqual({ google: { clientId: 'cid', redirectUri: 'https://app.example.com/auth/callback' } })
  })
})
