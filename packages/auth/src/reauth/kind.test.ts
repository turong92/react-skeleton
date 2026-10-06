import { describe, expect, it } from 'vitest'
import type { AccountMe, SignInIdentity } from '../account/types'
import { isReauthFailure, reauthKindOf, reauthSubjectOf } from './kind'
import { apiError } from '../stories/fakeAccountApi'

const method = (id: string, name: string): SignInIdentity => ({
  id,
  method: name,
  subject: null,
  verified: true,
  createdAt: 't',
  lastUsedAt: null,
  removable: true,
})
const me = (over: Partial<AccountMe>): AccountMe =>
  ({
    id: 'acc_1',
    email: 'a@b.c',
    emailVerified: true,
    hasPassword: true,
    methods: [method('1', 'password')],
    ...over,
  }) as AccountMe

describe('which re-authentication fits the account (the server enforces the same rule)', () => {
  it('a password account proves it with the current password', () => {
    expect(reauthKindOf(reauthSubjectOf(me({})))).toBe('password')
  })

  it('a passwordless account WITH an address proves it with a code mailed to that address', () => {
    const passwordless = me({ hasPassword: false, methods: [method('1', 'magic_link')] })
    expect(reauthKindOf(reauthSubjectOf(passwordless))).toBe('code')
  })

  it('an account WITHOUT an address re-consents with a provider it already has linked (password and magic link are not providers)', () => {
    const subject = reauthSubjectOf(
      me({
        hasPassword: false,
        email: null,
        methods: [method('1', 'magic_link'), method('2', 'naver'), method('3', 'kakao')],
      }),
    )
    expect(reauthKindOf(subject)).toBe('provider')
    expect(subject.providers).toEqual(['naver', 'kakao'])
  })

  it('a blank address counts as no address', () => {
    expect(
      reauthKindOf(
        reauthSubjectOf(me({ hasPassword: false, email: '', methods: [method('2', 'naver')] })),
      ),
    ).toBe('provider')
  })
})

describe('isReauthFailure — the errors the proof input itself explains', () => {
  it('is true for a wrong password, a wrong or expired code, a failed provider proof and a missing proof', () => {
    for (const [code, status] of [
      ['ACCOUNT.CURRENT_PASSWORD_INVALID', 400],
      ['ACCOUNT.CODE_INVALID', 400],
      ['ACCOUNT.CODE_EXPIRED', 410],
      ['ACCOUNT.REAUTH_FAILED', 400],
      ['ACCOUNT.REAUTH_REQUIRED', 403],
    ] as const)
      expect(isReauthFailure(apiError(code, status)), code).toBe(true)
  })
  it('is false for anything else', () => {
    expect(isReauthFailure(apiError('ACCOUNT.EMAIL_TAKEN', 409))).toBe(false)
    expect(isReauthFailure(new Error('x'))).toBe(false)
  })
})
