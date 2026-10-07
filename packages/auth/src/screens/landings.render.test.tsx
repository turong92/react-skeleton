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
import { DeletionPendingScreen } from './DeletionPendingScreen'
import { koAuthLabels } from './labels.ko'
import { apiError } from '../stories/fakeAccountApi'

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

describe('deletion pending — a correct sign-in during the grace never opens a session', () => {
  const fmt = (iso: string) => `on ${iso.slice(0, 10)}`
  const withToken = { purgeAfter: '2026-11-05T00:00:00Z', restoreToken: 'opaque' }

  it('asks whether to cancel: the date, a cancel button and a way to leave', () => {
    const out = html(
      <DeletionPendingScreen
        pending={withToken}
        onCancel={noop}
        leaveTo="/login"
        formatDate={fmt}
      />,
    )
    expect(out).toContain('Cancel the deletion?')
    expect(out).toContain('It is erased for good on on 2026-11-05.')
    expect(out).toContain('Cancel the deletion and keep using it')
    expect(out).toContain('Leave it as it is')
    expect(out).toContain('href="/login"')
  })

  it('reads in Korean, with the date placed by the app', () => {
    const out = html(
      <DeletionPendingScreen
        pending={withToken}
        onCancel={noop}
        leaveTo="/login"
        formatDate={() => '2026년 11월 5일'}
        labels={koAuthLabels}
      />,
    )
    expect(out).toContain('탈퇴를 취소할까요?')
    expect(out).toContain('이 계정은 탈퇴 처리 중이에요. 2026년 11월 5일에 완전히 지워져요.')
    expect(out).toContain('탈퇴 취소하고 계속 쓰기')
    expect(out).toContain('그대로 두기')
  })

  it('without a restore token (the server has self-restore off) only informs — no cancel button', () => {
    const out = html(
      <DeletionPendingScreen
        pending={{ purgeAfter: '2026-11-05T00:00:00Z' }}
        onCancel={noop}
        leaveTo="/login"
        formatDate={fmt}
      />,
    )
    expect(out).toContain('This account is being deleted')
    expect(out).toContain('It is erased on on 2026-11-05.')
    expect(out).toContain('please contact us')
    expect(out).not.toContain('Cancel the deletion')
    expect(out).toContain('Back to sign in')
  })

  it('a token but nobody to cancel with (no handler) also only informs', () => {
    const out = html(<DeletionPendingScreen pending={withToken} leaveTo="/login" />)
    expect(out).not.toContain('Cancel the deletion and keep using it')
  })

  it('never writes the restore token into the page (not in the markup, not in a link)', () => {
    const out = html(<DeletionPendingScreen pending={withToken} onCancel={noop} leaveTo="/login" />)
    expect(out).not.toContain('opaque')
  })

  it('the social callback shows it for a deletion-pending sign-in instead of a failure', () => {
    const error = apiError('AUTH.ACCOUNT_DELETION_PENDING', 403, withToken)
    const out = html(
      <SocialCallbackScreen
        state={{ status: 'error', error }}
        signInTo="/login"
        onCancelDeletion={noop}
      />,
    )
    expect(out).toContain('Cancel the deletion?')
    expect(out).not.toContain('Sign-in did not finish')
  })
})
