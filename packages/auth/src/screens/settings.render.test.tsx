import { renderToStaticMarkup } from 'react-dom/server'
import { MemoryRouter } from 'react-router-dom'
import { describe, expect, it } from 'vitest'
import type { AccountSession, SignInIdentity } from '../account/types'
import { DeleteAccountSection } from './DeleteAccountSection'
import { EmailSection } from './EmailSection'
import { PasswordSection } from './PasswordSection'
import { ProfileSection } from './ProfileSection'
import { SessionsSection } from './SessionsSection'
import { SignInMethodsSection } from './SignInMethodsSection'
import { canUnlink, labelOfMethod } from './methodsList'
import { defaultAuthLabels } from './labels'
import type { ReauthSubject } from '../reauth/kind'

const html = (node: React.ReactNode) => renderToStaticMarkup(<MemoryRouter>{node}</MemoryRouter>)
const noop = async () => undefined
const withPassword: ReauthSubject = { hasPassword: true, email: 'a@b.c', providers: [] }
const passwordless: ReauthSubject = { hasPassword: false, email: 'a@b.c', providers: [] }
const noAddress: ReauthSubject = { hasPassword: false, email: null, providers: ['naver'] }
const policy = {
  minLength: 10,
  maxBytes: 72,
  requireLetter: true,
  requireDigit: true,
  requireSymbol: false,
  forbidEmailLocalPart: true,
}
const identity = (over: Partial<SignInIdentity> = {}): SignInIdentity => ({
  id: 'idn_1',
  method: 'password',
  subject: 'a@b.c',
  verified: true,
  createdAt: '2026-01-01T00:00:00Z',
  lastUsedAt: null,
  removable: true,
  ...over,
})

describe('methodsList', () => {
  it('canUnlink: the server removable flag AND never the only remaining method', () => {
    expect(canUnlink(identity(), [identity()])).toBe(false)
    expect(canUnlink(identity(), [identity(), identity({ id: 'idn_2', method: 'google' })])).toBe(
      true,
    )
    expect(canUnlink(identity({ removable: false }), [identity(), identity({ id: 'idn_2' })])).toBe(
      false,
    )
  })
  it('labelOfMethod: the app method names, then provider names, then the raw code', () => {
    expect(labelOfMethod('password', defaultAuthLabels)).toBe('Password')
    expect(labelOfMethod('google', defaultAuthLabels)).toBe('Google')
    expect(labelOfMethod('weird_thing', defaultAuthLabels)).toBe('weird_thing')
  })
})

describe('settings sections', () => {
  it('profile: name, language and time zone', () => {
    const out = html(
      <ProfileSection
        profile={{ displayName: 'Ann', locale: 'ko', timeZone: 'Asia/Seoul' }}
        locales={[
          { value: 'ko', label: '한국어' },
          { value: 'en', label: 'English' },
        ]}
        timeZones={['Asia/Seoul', 'UTC']}
        onSave={noop}
      />,
    )
    expect(out).toContain('Ann')
    expect(out).toContain('한국어')
    expect(out).toContain('Asia/Seoul')
  })

  const password = (subject: ReauthSubject) =>
    html(
      <PasswordSection
        subject={subject}
        policy={policy}
        onChange={noop}
        requestReauthCode={noop}
      />,
    )
  it('password: asks for the current password only when the account has one; a passwordless one gets a mailed code instead', () => {
    expect(password(withPassword)).toContain('Current password')
    const noPassword = password(passwordless)
    expect(noPassword).not.toContain('Current password')
    expect(noPassword).toContain('Set a password')
    expect(noPassword).toContain('Email me a code')
    expect(noPassword).toContain('a@b.c')
  })

  it('password: an account without any address cannot set one (the server wants a verified address) and says so', () => {
    const out = password(noAddress)
    expect(out).toContain('needs a verified email address')
    expect(out).not.toContain('type="password"')
  })

  const email = (subject: ReauthSubject, extra: Partial<Parameters<typeof EmailSection>[0]> = {}) =>
    html(
      <EmailSection
        email="a@b.c"
        verified
        subject={subject}
        requestReauthCode={noop}
        onChangeEmail={noop}
        onConfirmCode={noop}
        {...extra}
      />,
    )
  it('email: shows the address, its verification, and a change form with the proof that fits the account', () => {
    const out = email(withPassword)
    expect(out).toContain('a@b.c')
    expect(out).toContain('Verified')
    expect(out).toContain('New email')
    expect(out).toContain('Current password')
    expect(email(passwordless)).toContain('Email me a code')
    const none = email(noAddress)
    expect(none).toContain('Confirm with Naver')
    expect(none).not.toContain('Current password')
  })

  it('email: the pending change the server reports opens the code step, so a reload restores the state', () => {
    const pending = email(withPassword, {
      pendingEmail: 'new@b.c',
      pendingEmailExpiresAt: '2026-10-06T10:00:00Z',
      formatDate: (iso) => `until<${iso}>`,
    })
    expect(pending).toContain('Enter the code for your new address')
    expect(pending).toContain('new@b.c')
    expect(pending).toContain('until&lt;2026-10-06T10:00:00Z&gt;')
    expect(pending).toContain('Digit 1 of 6') // the code cells
    expect(pending).toContain('Send the code again')
    expect(pending).not.toContain('New email') // the form is replaced by the code step
    const none = email(withPassword)
    expect(none).not.toContain('Enter the code for your new address')
    expect(email(withPassword, { pendingEmail: null })).not.toContain('Digit 1 of 6')
  })

  it('methods: shows the notice the page passes (the notice mail after linking)', () => {
    const out = html(
      <SignInMethodsSection
        identities={[identity()]}
        notice="Linked: check your inbox"
        subject={withPassword}
        requestReauthCode={noop}
        onUnlink={noop}
      />,
    )
    expect(out).toContain('Linked: check your inbox')
  })

  it('methods: lists each method; the last one cannot be removed and says why', () => {
    const only = html(
      <SignInMethodsSection
        identities={[identity()]}
        subject={withPassword}
        requestReauthCode={noop}
        onUnlink={noop}
      />,
    )
    expect(only).toContain('Password')
    expect(only).toContain('cannot be removed')
    // the confirm dialog always carries one "Remove"; a removable row would add a second
    expect(only.match(/>Remove</g)).toHaveLength(1)
    const two = html(
      <SignInMethodsSection
        identities={[identity(), identity({ id: 'idn_2', method: 'google', subject: null })]}
        subject={withPassword}
        requestReauthCode={noop}
        onUnlink={noop}
      />,
    )
    expect(two.match(/>Remove</g)).toHaveLength(3) // two rows + the dialog
  })

  it('methods: offers linking only for configured providers that are not linked yet', () => {
    const out = html(
      <SignInMethodsSection
        identities={[identity(), identity({ id: 'idn_2', method: 'google', subject: null })]}
        socialProviders={[{ provider: 'google' }, { provider: 'kakao' }]}
        onLink={() => undefined}
        subject={withPassword}
        requestReauthCode={noop}
        onUnlink={noop}
      />,
    )
    expect(out).toContain('Link Kakao')
    expect(out).not.toContain('Link Google')
  })

  const session = (over: Partial<AccountSession>): AccountSession => ({
    id: 'ses_1',
    deviceName: 'Pixel',
    userAgent: null,
    ip: '203.0.113.7',
    createdAt: '2026-01-01T00:00:00Z',
    lastUsedAt: '2026-01-02T00:00:00Z',
    current: false,
    ...over,
  })
  it('sessions: marks this device, cannot revoke it from the list, offers sign out others', () => {
    const out = html(
      <SessionsSection
        sessions={[session({ current: true }), session({ id: 'ses_2', deviceName: null })]}
        onRevoke={noop}
        onRevokeOthers={noop}
      />,
    )
    expect(out).toContain('This device')
    expect(out).toContain('Unknown device')
    expect(out).toContain('Sign out all other devices')
    expect(out.match(/>Sign out</g)).toHaveLength(1)
  })

  const del = (subject: ReauthSubject) =>
    html(
      <DeleteAccountSection
        subject={subject}
        graceDays={30}
        onDelete={async () => ({
          status: 'DELETION_SCHEDULED',
          purgeAfter: '2026-11-05T00:00:00Z',
        })}
        requestDeleteCode={noop}
      />,
    )
  it('delete: password accounts re-enter the password, passwordless ones get a mailed code, address-less ones re-consent; all see the grace notice', () => {
    const withPw = del(withPassword)
    expect(withPw).toContain('Enter your password')
    expect(withPw).toContain('erased after 30 days')
    const code = del(passwordless)
    expect(code).toContain('Email me a code')
    expect(code).not.toContain('Enter your password')
    expect(del(noAddress)).toContain('Confirm with Naver')
  })

  it('delete: the button stays off until the proof is there (a typed phrase follows in the dialog)', () => {
    expect(del(withPassword)).toMatch(/disabled=""[^>]*>[^<]*Delete my account/)
  })
})
