import { ApiRequestError } from '@skeleton/api-client'
import { renderToStaticMarkup } from 'react-dom/server'
import { MemoryRouter } from 'react-router-dom'
import { describe, expect, it } from 'vitest'
import { SocialLoginCallbackError } from '../social'
import { EmailSection } from './EmailSection'
import { SocialButtons } from './SocialButtons'
import { SocialCallbackScreen } from './SocialCallbackScreen'
import { SignInScreen } from './SignInScreen'
import { defaultAuthLabels as L, mergeLabels } from './labels'
import { koAuthLabels } from './labels.ko'
import { providerPresentation } from './providers'

const html = (node: React.ReactNode) => renderToStaticMarkup(<MemoryRouter>{node}</MemoryRouter>)
const noop = async () => undefined
const apiError = (code: string, status: number) =>
  new ApiRequestError({ code, title: code, status, timestamp: 't' }, 'trace-1', 's', 'p')

describe('provider presentation: label + inline icon from a registry, neutral for unknown codes', () => {
  it('google, line, x, kakao and naver each have their own mark', () => {
    const marks = ['google', 'line', 'x', 'kakao', 'naver'].map((p) =>
      renderToStaticMarkup(<>{providerPresentation(p).icon}</>),
    )
    for (const mark of marks) expect(mark).toContain('<svg')
    expect(new Set(marks).size).toBe(5)
  })

  it('an unknown provider code gets a neutral mark (no brand) and its own code as the name', () => {
    const neutral = renderToStaticMarkup(<>{providerPresentation('acme-sso').icon}</>)
    expect(neutral).toContain('<svg')
    expect(neutral).not.toBe(renderToStaticMarkup(<>{providerPresentation('google').icon}</>))
  })

  it('the buttons follow the discovery order and the ko labels read "Google로 / LINE으로 / X로 계속하기"', () => {
    const out = html(
      <SocialButtons
        providers={[{ provider: 'x' }, { provider: 'google' }, { provider: 'line' }]}
        labels={mergeLabels(koAuthLabels)}
        onSelect={() => undefined}
      />,
    )
    expect(out.indexOf('X로 계속하기')).toBeGreaterThan(-1)
    expect(out.indexOf('X로 계속하기')).toBeLessThan(out.indexOf('Google로 계속하기'))
    expect(out.indexOf('Google로 계속하기')).toBeLessThan(out.indexOf('LINE으로 계속하기'))
    expect(out).toContain('<svg')
  })

  it('English labels: "Continue with LINE" and an unknown provider falls back to its code', () => {
    const out = html(
      <SocialButtons
        providers={[{ provider: 'line' }, { provider: 'acme-sso' }]}
        labels={L}
        onSelect={() => undefined}
      />,
    )
    expect(out).toContain('Continue with LINE')
    expect(out).toContain('Continue with acme-sso')
  })

  it('an icon given by the app replaces the registry mark', () => {
    const out = html(
      <SocialButtons
        providers={[{ provider: 'google', icon: <i data-mine="1" /> }]}
        labels={L}
        onSelect={() => undefined}
      />,
    )
    expect(out).toContain('data-mine="1"')
    expect(out).not.toContain('<svg')
  })
})

describe('the sign-in screen when the provider cannot start', () => {
  it('renders the buttons from methods.social (order from discovery)', () => {
    const out = html(
      <SignInScreen
        methods={{ social: [{ provider: 'google' }, { provider: 'line' }, { provider: 'x' }] }}
        onPasswordSignIn={noop}
        onSocialSignIn={async () => undefined}
      />,
    )
    expect(out).toContain('Continue with LINE')
    expect(out).toContain('Continue with X')
  })
})

describe('SocialCallbackScreen tells the real reasons', () => {
  const screen = (error: unknown) =>
    html(<SocialCallbackScreen state={{ status: 'error', error }} signInTo="/login" />)

  it('a cancelled consent is not a failure: nothing changed, start again', () => {
    const out = screen(
      new SocialLoginCallbackError('provider_error', 'The user denied', 'access_denied'),
    )
    expect(out).toContain(L.callbackCancelledTitle)
    expect(out).toContain(L.callbackCancelledBody)
  })

  it('any other provider error keeps the failure text', () => {
    const out = screen(new SocialLoginCallbackError('provider_error', 'boom', 'server_error'))
    expect(out).toContain(L.callbackFailedTitle)
  })

  it('a state this tab never issued (another tab, expired, already used) explains the tab rule', () => {
    const out = screen(new SocialLoginCallbackError('state_mismatch', 'mismatch'))
    expect(out).toContain(L.callbackStateBody)
  })

  it('a spent or expired authorization code and a rejected ID token say "start again"', () => {
    expect(screen(apiError('AUTH_SOCIAL.INVALID_AUTHORIZATION_CODE', 401))).toContain(
      L.errorSocialCode,
    )
    expect(screen(apiError('AUTH.SOCIAL_ID_TOKEN_INVALID', 401))).toContain(L.errorSocialCode)
  })

  it('a PKCE / nonce refusal is shown as a request problem, not a wrong code', () => {
    expect(screen(apiError('AUTH.SOCIAL_PKCE_FAILED', 400))).toContain(L.errorSocialRequest)
  })

  it('a provider outage is its own message', () => {
    expect(screen(apiError('AUTH_SOCIAL.PROVIDER_GATEWAY_ERROR', 502))).toContain(
      L.errorSocialGateway,
    )
  })

  it('the existing-account conflict is unchanged', () => {
    expect(screen(apiError('ACCOUNT.SOCIAL_EMAIL_CONFLICT', 409))).toContain(
      L.callbackConflictTitle,
    )
  })
})

describe('an account without an address (LINE / X)', () => {
  const base = {
    verified: false,
    subject: { hasPassword: false, email: null, providers: ['line'] },
    requestReauthCode: noop,
    onChangeEmail: noop,
    onConfirmCode: noop,
    onProviderReauth: () => undefined,
  }

  it('shows "no email address" instead of an empty value, and invites to add one', () => {
    const out = html(<EmailSection {...base} email={null} />)
    expect(out).toContain(L.emailNone)
    expect(out).not.toContain('<strong></strong>')
    expect(out).not.toContain(L.emailUnverified)
    expect(out).toContain(L.emailAddHint)
  })

  it('an account with an address keeps the change wording', () => {
    const out = html(
      <EmailSection
        {...base}
        email="a@b.c"
        verified
        subject={{ ...base.subject, email: 'a@b.c' }}
      />,
    )
    expect(out).toContain('a@b.c')
    expect(out).not.toContain(L.emailNone)
  })
})
