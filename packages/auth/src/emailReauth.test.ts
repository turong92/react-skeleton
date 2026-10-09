import { describe, expect, it } from 'vitest'
import { discardReauthOf, discardReauthState, emailReauthOf, emailReauthState } from './emailReauth'

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

describe('where the person was when the gate sent them to the provider', () => {
  it('carries the same-origin path and query, so the return lands on the same page', () => {
    expect(emailReauthOf(emailReauthState('line', 'a@b.c', '/board?page=2'))).toEqual({
      provider: 'line',
      newEmail: 'a@b.c',
      returnTo: '/board?page=2',
    })
  })

  it.each([['https://evil.example/x'], ['//evil.example'], ['board'], ['/a\\b']])(
    'drops a place that is not a same-origin path (%s) but keeps the hand-off',
    (returnTo) => {
      expect(emailReauthOf(emailReauthState('line', 'a@b.c', returnTo))).toEqual({
        provider: 'line',
        newEmail: 'a@b.c',
      })
    },
  )
})

describe('discard re-confirmation hand-off (router state only)', () => {
  it('carries only the provider', () => {
    expect(discardReauthOf(discardReauthState('line'))).toEqual({ provider: 'line' })
  })

  it.each([[null], [{}], [{ discardReauth: { provider: '<x>' } }], [{ discardReauth: 'line' }]])(
    'ignores %j',
    (state) => {
      expect(discardReauthOf(state)).toBeUndefined()
    },
  )

  it('is not mistaken for the email hand-off, nor the other way round', () => {
    expect(emailReauthOf(discardReauthState('line'))).toBeUndefined()
    expect(discardReauthOf(emailReauthState('line', 'a@b.c'))).toBeUndefined()
  })
})
