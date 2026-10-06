import { renderToStaticMarkup } from 'react-dom/server'
import { MemoryRouter } from 'react-router-dom'
import { describe, expect, it } from 'vitest'
import { CheckEmailPanel } from './CheckEmailPanel'
import { SignInScreen } from './SignInScreen'
import { SignUpScreen } from './SignUpScreen'

const html = (node: React.ReactNode) => renderToStaticMarkup(<MemoryRouter>{node}</MemoryRouter>)
const noop = async () => undefined

describe('SignInScreen renders whatever methods the app enables', () => {
  it('password only by default: an email + password form, no social, no magic link', () => {
    const out = html(<SignInScreen onPasswordSignIn={noop} />)
    expect(out).toContain('type="password"')
    expect(out).not.toContain('Continue with')
    expect(out).not.toContain('Email me a sign-in link')
  })

  it('social providers become buttons labelled from the labels map', () => {
    const out = html(
      <SignInScreen
        methods={{ social: [{ provider: 'google' }, { provider: 'kakao' }] }}
        onPasswordSignIn={noop}
        onSocialSignIn={() => undefined}
      />,
    )
    expect(out).toContain('Continue with Google')
    expect(out).toContain('Continue with Kakao')
  })

  it('magic link adds its entry point', () => {
    const out = html(
      <SignInScreen
        methods={{ magicLink: true }}
        onPasswordSignIn={noop}
        onMagicLinkRequest={noop}
      />,
    )
    expect(out).toContain('Email me a sign-in link')
  })

  it('a magic-link-only app (password: false) shows no password input at all', () => {
    const out = html(
      <SignInScreen methods={{ password: false, magicLink: true }} onMagicLinkRequest={noop} />,
    )
    expect(out).not.toContain('type="password"')
    expect(out).toContain('Send the link')
  })

  it('app labels replace the English defaults', () => {
    const out = html(
      <SignInScreen
        labels={{ signInTitle: '로그인', signInWithProvider: (p) => `${p} 로 계속하기` }}
        methods={{ social: [{ provider: 'google' }] }}
        onPasswordSignIn={noop}
        onSocialSignIn={() => undefined}
      />,
    )
    expect(out).toContain('로그인')
    expect(out).toContain('Google 로 계속하기')
  })

  it('the sign-up link appears only when the app has a sign-up route', () => {
    expect(html(<SignInScreen onPasswordSignIn={noop} />)).not.toContain('Create one')
    expect(html(<SignInScreen onPasswordSignIn={noop} signUpTo="/sign-up" />)).toContain(
      'href="/sign-up"',
    )
  })
})

describe('SignUpScreen', () => {
  const policy = {
    minLength: 10,
    maxBytes: 72,
    requireLetter: true,
    requireDigit: true,
    requireSymbol: false,
    forbidEmailLocalPart: true,
  }
  it('shows the password requirements from the policy', () => {
    const out = html(
      <SignUpScreen
        policy={policy}
        onSignUp={async () => ({ status: 'VERIFICATION_SENT' })}
        onVerifyCode={noop}
      />,
    )
    expect(out).toContain('Enough characters')
    expect(out).toContain('A digit')
    expect(out).not.toContain('A symbol')
  })

  it('renders the captcha slot and the consent slot when given', () => {
    const out = html(
      <SignUpScreen
        policy={policy}
        onSignUp={async () => ({ status: 'VERIFICATION_SENT' })}
        onVerifyCode={noop}
        renderCaptcha={() => <div>captcha-here</div>}
        consents={[{ id: 'terms', version: '2.0', label: 'I accept the terms', required: true }]}
      />,
    )
    expect(out).toContain('captcha-here')
    expect(out).toContain('I accept the terms')
  })
})

describe('CheckEmailPanel', () => {
  it('names the address and offers a resend only when the app can resend', () => {
    const a = html(<CheckEmailPanel email="a@b.c" />)
    expect(a).toContain('a@b.c')
    expect(a).not.toContain('Send it again')
    const b = html(<CheckEmailPanel email="a@b.c" onResend={noop} />)
    expect(b).toContain('Send it again')
  })
})
