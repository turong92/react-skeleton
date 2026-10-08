import { renderToStaticMarkup } from 'react-dom/server'
import { MemoryRouter } from 'react-router-dom'
import { describe, expect, it } from 'vitest'
import { ForgotLoginIdScreen } from './ForgotLoginIdScreen'
import { SignInScreen } from './SignInScreen'

const html = (node: React.ReactNode) => renderToStaticMarkup(<MemoryRouter>{node}</MemoryRouter>)
const noop = async () => undefined

describe('SignInScreen with the login id on', () => {
  const on = (extra = {}) =>
    html(
      <SignInScreen
        loginId
        forgotPasswordTo="/forgot-password"
        forgotLoginIdTo="/forgot-id"
        onPasswordSignIn={noop}
        {...extra}
      />,
    )

  it('the field is "Username or email" and a plain text input, so the browser does not reject an id', () => {
    const out = on()
    expect(out).toContain('Username or email')
    expect(out).not.toContain('type="email"')
    expect(out).toContain('type="text"')
    expect(out).toContain('autoComplete="username"')
  })

  it('shows the underlined "forgot username" link next to the password one', () => {
    const out = on()
    expect(out).toContain('href="/forgot-id"')
    expect(out).toContain('Forgot your username?')
    expect(out).toContain('href="/forgot-password"')
  })

  it('no link without a destination for it', () => {
    expect(on({ forgotLoginIdTo: undefined })).not.toContain('Forgot your username?')
  })
})

describe('SignInScreen with the login id off (the key was not there)', () => {
  const off = html(
    <SignInScreen
      forgotPasswordTo="/forgot-password"
      forgotLoginIdTo="/forgot-id"
      onPasswordSignIn={noop}
    />,
  )

  it('is the screen it always was: email field, no id link', () => {
    expect(off).toContain('type="email"')
    expect(off).not.toContain('Username or email')
    expect(off).not.toContain('/forgot-id')
    expect(off).not.toContain('Forgot your username?')
  })

  it('keeps the old markup around the password link (no wrapper added)', () => {
    expect(off).not.toMatch(/<span[^>]*><a[^>]*forgot-password/)
    expect(off).toMatch(/<a [^>]*href="\/forgot-password"/)
  })
})

describe('ForgotLoginIdScreen', () => {
  it('one email field, one filled submit button, a way back', () => {
    const out = html(<ForgotLoginIdScreen onSubmit={noop} signInTo="/login" />)
    expect(out).toContain('Find your username')
    expect(out).toContain('type="email"')
    expect(out).toContain('Send my username')
    expect(out).toContain('href="/login"')
  })

  it('draws the captcha slot where the password reset does', () => {
    const out = html(
      <ForgotLoginIdScreen
        onSubmit={noop}
        signInTo="/login"
        renderCaptcha={() => <div data-testid="captcha-slot" />}
      />,
    )
    expect(out).toContain('captcha-slot')
  })
})

describe('SignInScreen with the login id on - the box is plain text now, so the phone must not touch it', () => {
  const html2 = (extra = {}) =>
    html(<SignInScreen loginId forgotLoginIdTo="/forgot-id" onPasswordSignIn={noop} {...extra} />)

  it('does not capitalize or spell-check what is typed', () => {
    const out = html2()
    expect(out).toContain('autoCapitalize="none"')
    expect(out).toContain('spellCheck="false"')
  })

  it('the off screen keeps its markup (no new attributes)', () => {
    const off = html(<SignInScreen onPasswordSignIn={noop} />)
    expect(off).not.toContain('autoCapitalize')
    expect(off).not.toContain('spellCheck')
  })

  it('a sign-in that only has the email link keeps the email label and the email box (an id cannot be used there)', () => {
    const out = html2({
      methods: { password: false, magicLink: true },
      onPasswordSignIn: undefined,
      onMagicLinkRequest: noop,
    })
    expect(out).not.toContain('Username or email')
    expect(out).toContain('type="email"')
  })
})
