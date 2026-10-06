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
import { createReauthStore } from '../reauth'

const html = (node: React.ReactNode) => renderToStaticMarkup(<MemoryRouter>{node}</MemoryRouter>)
const noop = async () => undefined
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

  it('password: asks for the current password only when the account has one', () => {
    expect(html(<PasswordSection hasPassword policy={policy} onChange={noop} />)).toContain(
      'Current password',
    )
    const noPassword = html(<PasswordSection hasPassword={false} policy={policy} onChange={noop} />)
    expect(noPassword).not.toContain('Current password')
    expect(noPassword).toContain('Set a password')
  })

  it('email: shows the address, its verification, and a change form', () => {
    const out = html(<EmailSection email="a@b.c" verified hasPassword onChangeEmail={noop} />)
    expect(out).toContain('a@b.c')
    expect(out).toContain('Verified')
    expect(out).toContain('New email')
  })

  it('email: shows the pending change the server reports, so a reload restores the state', () => {
    const pending = html(
      <EmailSection
        email="a@b.c"
        verified
        hasPassword
        onChangeEmail={noop}
        pendingEmail="new@b.c"
        pendingEmailExpiresAt="2026-10-06T10:00:00Z"
        formatDate={(iso) => `until<${iso}>`}
      />,
    )
    expect(pending).toContain('Confirm the change')
    expect(pending).toContain('new@b.c')
    expect(pending).toContain('until&lt;2026-10-06T10:00:00Z&gt;')
    const none = html(<EmailSection email="a@b.c" verified hasPassword onChangeEmail={noop} />)
    expect(none).not.toContain('Confirm the change')
    const absent = html(
      <EmailSection email="a@b.c" verified hasPassword onChangeEmail={noop} pendingEmail={null} />,
    )
    expect(absent).not.toContain('Confirm the change')
  })

  it('email and password: a passwordless account with a stashed confirmation says it is confirmed', () => {
    const store = createReauthStore({})
    store.stashToken('rt')
    const email = html(
      <EmailSection
        email="a@b.c"
        verified
        hasPassword={false}
        onChangeEmail={noop}
        reauth={{ store, requestMail: noop }}
      />,
    )
    expect(email).toContain('Identity confirmed')
    const password = html(
      <PasswordSection
        hasPassword={false}
        policy={policy}
        onChange={noop}
        reauth={{ store, requestMail: noop }}
      />,
    )
    expect(password).toContain('Identity confirmed')
    const without = html(
      <PasswordSection
        hasPassword={false}
        policy={policy}
        onChange={noop}
        reauth={{ store: createReauthStore({}), requestMail: noop }}
      />,
    )
    expect(without).not.toContain('Identity confirmed')
    expect(without).toContain('We email you a confirmation link')
  })

  it('methods: shows the notice the page passes (the confirmation mail for linking)', () => {
    const out = html(
      <SignInMethodsSection
        identities={[identity()]}
        notice="Check your email to confirm it is you"
        onUnlink={noop}
      />,
    )
    expect(out).toContain('Check your email to confirm it is you')
  })

  it('methods: lists each method; the last one cannot be removed and says why', () => {
    const only = html(<SignInMethodsSection identities={[identity()]} onUnlink={noop} />)
    expect(only).toContain('Password')
    expect(only).toContain('cannot be removed')
    // the confirm dialog always carries one "Remove"; a removable row would add a second
    expect(only.match(/>Remove</g)).toHaveLength(1)
    const two = html(
      <SignInMethodsSection
        identities={[identity(), identity({ id: 'idn_2', method: 'google', subject: null })]}
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

  it('delete: password accounts re-enter the password, passwordless ones get the mail path; both see the grace notice', () => {
    const withPw = html(
      <DeleteAccountSection
        hasPassword
        graceDays={30}
        onDelete={async () => ({
          status: 'DELETION_SCHEDULED',
          purgeAfter: '2026-11-05T00:00:00Z',
        })}
        onRequestConfirmation={noop}
      />,
    )
    expect(withPw).toContain('Enter your password')
    expect(withPw).toContain('erased after 30 days')
    const without = html(
      <DeleteAccountSection
        hasPassword={false}
        graceDays={30}
        onDelete={async () => ({ status: 'DELETION_SCHEDULED', purgeAfter: 'x' })}
        onRequestConfirmation={noop}
      />,
    )
    expect(without).toContain('Email me the link')
    expect(without).not.toContain('Enter your password')
  })
})
