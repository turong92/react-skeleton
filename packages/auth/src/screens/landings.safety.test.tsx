import { renderToStaticMarkup } from 'react-dom/server'
import { MemoryRouter } from 'react-router-dom'
import { describe, expect, it } from 'vitest'
import { ConfirmEmailChangeLanding } from './ConfirmEmailChangeLanding'
import { MagicLinkLanding } from './MagicLinkLanding'
import { ResetPasswordScreen } from './ResetPasswordScreen'
import { SignInScreen } from './SignInScreen'
import { SignUpScreen } from './SignUpScreen'
import { VerifyEmailScreen } from './VerifyEmailScreen'
import { DeleteAccountSection } from './DeleteAccountSection'
import { SocialCallbackScreen } from './SocialCallbackScreen'

// React 는 서버 출력에 `autoComplete` 로 쓴다 — HTML 속성은 대소문자를 가리지 않으므로 소문자로 맞춰 읽는다
const html = (node: React.ReactNode) =>
  renderToStaticMarkup(<MemoryRouter>{node}</MemoryRouter>).replaceAll(
    'autoComplete=',
    'autocomplete=',
  )
const noop = async () => undefined

describe('M2 — mail-scanner safety: an explicit click before a link verifies something', () => {
  it('confirm-email-change waits for a Continue click instead of confirming on mount', () => {
    const out = html(<ConfirmEmailChangeLanding token="t" onConfirm={noop} signInTo="/login" />)
    expect(out).toContain('>Continue<')
    expect(out).not.toContain('Confirming the change')
  })

  it('the prop opts out (a deployment that accepts the scanner risk)', () => {
    const out = html(
      <ConfirmEmailChangeLanding
        token="t"
        onConfirm={noop}
        signInTo="/login"
        requireConfirm={false}
      />,
    )
    expect(out).toContain('Confirming the change')
  })

  it('magic-link keeps signing in on arrival (the contract allows the POST on mount)', () => {
    const out = html(
      <MagicLinkLanding token="t" onRedeem={noop} onDone={() => undefined} requestTo="/login" />,
    )
    expect(out).toContain('Signing you in')
    expect(out).not.toContain('>Continue<')
  })

  it('verify-email (an old mailed link) waits for a Continue click too', () => {
    const out = html(<VerifyEmailScreen token="t" onVerify={noop} signInTo="/login" />)
    expect(out).toContain('>Continue<')
    expect(out).not.toContain('Checking your link')
  })
})

describe('autocomplete attributes (password managers and one-time codes)', () => {
  it('sign-in: username + current-password', () => {
    const out = html(<SignInScreen onPasswordSignIn={noop} />)
    expect(out).toContain('autocomplete="username"')
    expect(out).toContain('autocomplete="current-password"')
  })
  it('sign-up and reset: new-password', () => {
    expect(
      html(<SignUpScreen onSignUp={async () => ({ status: 'CREATED' })} signInTo="/login" />),
    ).toContain('autocomplete="new-password"')
    expect(
      html(
        <ResetPasswordScreen
          token="t"
          onReset={noop}
          signInTo="/login"
          forgotTo="/forgot-password"
        />,
      ),
    ).toContain('autocomplete="new-password"')
  })
  it('delete confirmation: current-password for the password, one-time-code for the mailed code', () => {
    const base = {
      graceDays: 30,
      onRequestConfirmation: noop,
      onDelete: async () => ({ scheduledFor: '2030-01-01T00:00:00Z' }) as never,
    }
    expect(html(<DeleteAccountSection hasPassword {...base} />)).toContain(
      'autocomplete="current-password"',
    )
    expect(
      html(<DeleteAccountSection hasPassword={false} confirmationToken="tok" {...base} />),
    ).toContain('autocomplete="one-time-code"')
  })
  it('the social callback error screen has no form fields at all', () => {
    expect(
      html(
        <SocialCallbackScreen
          state={{ status: 'error', error: new Error('x') }}
          signInTo="/login"
        />,
      ),
    ).not.toContain('<input')
  })
})
