import { renderToStaticMarkup } from 'react-dom/server'
import { MemoryRouter } from 'react-router-dom'
import { describe, expect, it } from 'vitest'
import { ReauthProof } from './ReauthProof'
import { MagicLinkLanding } from './MagicLinkLanding'
import { ResetPasswordScreen } from './ResetPasswordScreen'
import { SignInScreen } from './SignInScreen'
import { SignUpScreen } from './SignUpScreen'
import { DeleteAccountSection } from './DeleteAccountSection'
import { SocialCallbackScreen } from './SocialCallbackScreen'

// React 는 서버 출력에 `autoComplete` 로 쓴다 — HTML 속성은 대소문자를 가리지 않으므로 소문자로 맞춰 읽는다
const html = (node: React.ReactNode) =>
  renderToStaticMarkup(<MemoryRouter>{node}</MemoryRouter>).replaceAll(
    'autoComplete=',
    'autocomplete=',
  )
const noop = async () => undefined

describe('M2 — mail-scanner safety: the only link that acts on arrival is the magic link (the contract allows its POST on mount)', () => {
  it('magic-link keeps signing in on arrival (the contract allows the POST on mount)', () => {
    const out = html(
      <MagicLinkLanding token="t" onRedeem={noop} onDone={() => undefined} requestTo="/login" />,
    )
    expect(out).toContain('Signing you in')
    expect(out).not.toContain('>Continue<')
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
      html(
        <SignUpScreen
          onSignUp={async () => ({ status: 'CREATED' })}
          onVerifyCode={noop}
          signInTo="/login"
        />,
      ),
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
  it('delete confirmation: current-password for the password; the mailed code goes into one-time-code cells', () => {
    const base = {
      graceDays: 30,
      requestDeleteCode: noop,
      onDelete: async () => ({ scheduledFor: '2030-01-01T00:00:00Z' }) as never,
    }
    const subject = { email: 'a@b.c', providers: [] }
    expect(
      html(<DeleteAccountSection subject={{ ...subject, hasPassword: true }} {...base} />),
    ).toContain('autocomplete="current-password"')
    // the code cells appear once the code is requested; with no mail step (an already-sent code) they are there at once
    expect(html(<ReauthProof kind="code" email="a@b.c" onChange={() => undefined} />)).toContain(
      'autocomplete="one-time-code"',
    )
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
