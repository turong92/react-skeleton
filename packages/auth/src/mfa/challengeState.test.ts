import { describe, expect, it } from 'vitest'
import { mfaChallengeOf, mfaChallengeState } from './challengeState'

const mfa = { mfaToken: 'opaque', methods: ['totp' as const], expiresAt: null }

describe('the router state that carries the second step (never the address, never storage)', () => {
  it('round-trips the challenge and the page the person wanted', () => {
    expect(mfaChallengeOf(mfaChallengeState(mfa, '/notes?tab=2'))).toEqual({
      mfa,
      target: '/notes?tab=2',
      arrival: undefined,
    })
  })

  it('has no target by default (the social flow keeps it in its own storage until the end)', () => {
    expect(mfaChallengeOf(mfaChallengeState(mfa))).toEqual({
      mfa,
      target: undefined,
      arrival: undefined,
    })
  })

  it('carries the "continue linking this provider" intent to where the sign-in ends', () => {
    expect(
      mfaChallengeOf(mfaChallengeState(mfa, '/account', { linkProvider: 'google' }))?.arrival,
    ).toEqual({ linkProvider: 'google' })
  })

  it('refuses a target that leaves the site', () => {
    expect(mfaChallengeOf(mfaChallengeState(mfa, '//evil.example'))?.target).toBeUndefined()
    expect(mfaChallengeOf(mfaChallengeState(mfa, 'https://evil.example'))?.target).toBeUndefined()
  })

  it('is null when someone opens the page directly or reloads it - the token is gone, sign in again', () => {
    expect(mfaChallengeOf(null)).toBeNull()
    expect(mfaChallengeOf({})).toBeNull()
    expect(mfaChallengeOf({ mfa: { methods: ['totp'] } })).toBeNull()
  })
})
