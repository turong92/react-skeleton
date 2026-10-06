import { describe, expect, it } from 'vitest'
import { parseAuthMethods, parseDelivery, socialProviderConfigs } from './authConfig'

describe('parseAuthMethods (how the app enables or disables each sign-in method)', () => {
  it('defaults to password + magic link', () => {
    expect(parseAuthMethods(undefined)).toEqual({ password: true, magicLink: true, social: [] })
  })
  it('a list picks exactly those methods, social providers by code', () => {
    expect(parseAuthMethods('password, google ,KAKAO')).toEqual({
      password: true,
      magicLink: false,
      social: [{ provider: 'google' }, { provider: 'kakao' }],
    })
    expect(parseAuthMethods('magic-link')).toEqual({ password: false, magicLink: true, social: [] })
  })
})

describe('refresh delivery', () => {
  it('body unless cookie is asked for', () => {
    expect(parseDelivery(undefined)).toBe('body')
    expect(parseDelivery('cookie')).toBe('cookie')
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
