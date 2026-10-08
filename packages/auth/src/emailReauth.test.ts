import { describe, expect, it } from 'vitest'
import { emailReauthOf, emailReauthState } from './emailReauth'

describe('email re-confirmation hand-off (router state only)', () => {
  it('carries the provider and the typed address to the account page', () => {
    expect(emailReauthOf(emailReauthState('kakao', 'me@example.com'))).toEqual({
      provider: 'kakao',
      newEmail: 'me@example.com',
    })
  })

  it.each([
    [null],
    [undefined],
    [{}],
    [{ emailReauth: { provider: 3, newEmail: 'a@b.c' } }],
    [{ emailReauth: { provider: '<script>', newEmail: 'a@b.c' } }],
    [{ emailReauth: { provider: 'kakao', newEmail: '' } }],
    [{ emailReauth: { provider: 'kakao', newEmail: 'x'.repeat(400) } }],
    [{ emailReauth: 'kakao' }],
  ])('ignores a state that is not a provider code and an address: %j', (state) => {
    expect(emailReauthOf(state)).toBeUndefined()
  })
})
