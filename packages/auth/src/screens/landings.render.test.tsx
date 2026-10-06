import { ApiRequestError } from '@skeleton/api-client'
import { renderToStaticMarkup } from 'react-dom/server'
import { MemoryRouter } from 'react-router-dom'
import { describe, expect, it } from 'vitest'
import { AccountStateNotice } from './AccountStateNotice'
import { ForgotPasswordScreen } from './ForgotPasswordScreen'
import { ResetPasswordScreen } from './ResetPasswordScreen'
import { SocialCallbackScreen } from './SocialCallbackScreen'
import { VerifyEmailScreen } from './VerifyEmailScreen'
import { MagicLinkLanding } from './MagicLinkLanding'
import { ConfirmEmailChangeLanding } from './ConfirmEmailChangeLanding'
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
  it('verify-email starts by checking (the POST happens on mount, not on a GET prefetch)', () => {
    const out = html(
      <VerifyEmailScreen token="t" onVerify={noop} onResend={noop} signInTo="/login" />,
    )
    expect(out).toContain('Checking your link')
  })

  it('a link without a token goes straight to the "does not work" state with a resend form', () => {
    const out = html(
      <VerifyEmailScreen token={null} onVerify={noop} onResend={noop} signInTo="/login" />,
    )
    expect(out).toContain('This link does not work')
    expect(out).toContain('type="email"')
  })

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

  it('confirm-email-change landing', () => {
    expect(
      html(<ConfirmEmailChangeLanding token="t" onConfirm={noop} signInTo="/login" />),
    ).toContain('Confirming the change')
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
