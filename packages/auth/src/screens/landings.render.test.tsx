import { ApiRequestError } from '@skeleton/api-client'
import { renderToStaticMarkup } from 'react-dom/server'
import { MemoryRouter } from 'react-router-dom'
import { describe, expect, it } from 'vitest'
import { AccountStateNotice } from './AccountStateNotice'
import { ForgotPasswordScreen } from './ForgotPasswordScreen'
import { ResetPasswordScreen } from './ResetPasswordScreen'
import { SocialCallbackScreen } from './SocialCallbackScreen'
import { MagicLinkLanding } from './MagicLinkLanding'
import { LegacyLinkNotice } from './LegacyLinkNotice'
import { SocialLinkProofScreen } from './SocialLinkProofScreen'
import { readLinkToken } from './linkToken'

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

describe('readLinkToken', () => {
  it('prefers the URL fragment (never sent to servers, not in referrers) over the query the backend mails', () => {
    expect(readLinkToken({ hash: '#token=frag', search: '?token=query' })).toBe('frag')
    expect(readLinkToken({ hash: '', search: '?token=query' })).toBe('query')
  })
  it('is null without a token, or with an empty one', () => {
    expect(readLinkToken({ hash: '', search: '' })).toBeNull()
    expect(readLinkToken({ hash: '#token=', search: '?token=' })).toBeNull()
  })
})

describe('one-time link landings', () => {
  it('magic link landing starts by checking; without a token it offers a new request', () => {
    expect(
      html(
        <MagicLinkLanding token="t" onRedeem={noop} onDone={() => undefined} requestTo="/login" />,
      ),
    ).toContain('Checking your link')
    const none = html(
      <MagicLinkLanding token={null} onRedeem={noop} onDone={() => undefined} requestTo="/login" />,
    )
    expect(none).toContain('This sign-in link does not work')
    expect(none).toContain('href="/login"')
  })
})

describe('old mailed links (verification, email change, re-auth, delete — now codes)', () => {
  it('say the link is no longer used, explain the code, and point at sign-in — and read no token', () => {
    const out = html(<LegacyLinkNotice signInTo="/login" />)
    expect(out).toContain('This link is no longer used')
    expect(out).toContain('6-digit code')
    expect(out).toContain('href="/login"')
    expect(out).not.toContain('type="email"')
  })
})

describe('social link: the proof after the provider redirect', () => {
  const props = {
    provider: 'Kakao',
    email: 'a@b.c',
    requestCode: noop,
    onSubmit: noop,
    backTo: '/account',
  }
  it('a password account types the current password for the provider being linked, with a way back', () => {
    const out = html(<SocialLinkProofScreen {...props} kind="password" />)
    expect(out).toContain('Confirm it is you')
    expect(out).toContain('Kakao')
    expect(out).toContain('type="password"')
    expect(out).toContain('href="/account"')
  })
  it('a passwordless account with an address gets a code mailed to it — entered right here', () => {
    const out = html(<SocialLinkProofScreen {...props} kind="code" />)
    expect(out).toContain('Email me a code')
    expect(out).toContain('a@b.c')
    expect(out).not.toContain('type="password"')
  })
  it('an account without an address re-consents with a provider it already has', () => {
    const out = html(
      <SocialLinkProofScreen {...props} kind="provider" email={null} reauthProviders={['naver']} />,
    )
    expect(out).toContain('Confirm with Naver')
  })
})

describe('password reset', () => {
  it('forgot: an email form', () => {
    const out = html(<ForgotPasswordScreen onSubmit={noop} signInTo="/login" />)
    expect(out).toContain('Reset your password')
    expect(out).toContain('type="email"')
  })

  it('reset: new password with the policy requirements; no token → invalid link state', () => {
    const ok = html(
      <ResetPasswordScreen
        token="t"
        policy={policy}
        onReset={noop}
        signInTo="/login"
        forgotTo="/forgot"
      />,
    )
    expect(ok).toContain('Choose a new password')
    expect(ok).toContain('Enough characters')
    const bad = html(
      <ResetPasswordScreen
        token={null}
        policy={policy}
        onReset={noop}
        signInTo="/login"
        forgotTo="/forgot"
      />,
    )
    expect(bad).toContain('This link does not work')
    expect(bad).toContain('href="/forgot"')
  })
})

describe('social callback', () => {
  const conflict = new ApiRequestError(
    { code: 'ACCOUNT.SOCIAL_EMAIL_CONFLICT', title: 'c', status: 409, timestamp: 't' },
    't',
    's',
    'p',
  )
  it('pending, failed and the email-conflict states', () => {
    expect(
      html(<SocialCallbackScreen state={{ status: 'pending' }} signInTo="/login" />),
    ).toContain('Finishing sign-in')
    expect(
      html(
        <SocialCallbackScreen
          state={{ status: 'error', error: new Error('x') }}
          signInTo="/login"
        />,
      ),
    ).toContain('Sign-in did not finish')
    const out = html(
      <SocialCallbackScreen state={{ status: 'error', error: conflict }} signInTo="/login" />,
    )
    expect(out).toContain('You already have an account')
    expect(out).toContain('href="/login"')
  })
})

describe('AccountStateNotice', () => {
  it('suspended and blocked each say what is going on and where to go', () => {
    expect(
      html(<AccountStateNotice kind="suspended" supportHref="mailto:help@example.com" />),
    ).toContain('Account suspended')
    const blocked = html(<AccountStateNotice kind="blocked" />)
    expect(blocked).toContain('Access blocked')
    expect(blocked).not.toContain('Contact support')
  })
})
