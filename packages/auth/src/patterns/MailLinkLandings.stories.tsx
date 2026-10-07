import type { Meta, StoryObj } from '@storybook/react-vite'
import { StrictMode, useEffect, useState } from 'react'
import { expect, fn, waitFor } from 'storybook/test'
import { LegacyLinkNotice } from '../screens/LegacyLinkNotice'
import { SocialLinkProofScreen } from '../screens/SocialLinkProofScreen'
import { ForgotPasswordScreen } from '../screens/ForgotPasswordScreen'
import { createOnceRunner } from '../screens/runOnce'
import { MagicLinkLanding } from '../screens/MagicLinkLanding'
import { ResetPasswordScreen } from '../screens/ResetPasswordScreen'
import { SocialCallbackScreen } from '../screens/SocialCallbackScreen'
import { FAKE_POLICY, apiError } from '../stories/fakeAccountApi'
import { withRouter } from '../stories/withRouter'

/**
 * 메일 링크가 닿는 화면들 — **링크가 남은 곳은 둘뿐이다**: 링크 로그인(세션이 없다)과 비밀번호 재설정(세션이 없다). 가입 인증 · 이메일 변경 · 본인 확인 · 삭제 확인은 6자리 인증번호로 바뀌어
 * 그 자리에서 입력한다 — 오래된 메일의 링크는 한 장의 안내(`LegacyLinkNotice`)로 보낸다. 서버는 「없는 · 만료 · 이미 씀」을 한 응답(410)으로 주므로 화면도 한 상태로 말하고 새 링크를 받게 한다.
 * 토큰은 주소의 `#token=`(조각) 또는 `?token=`(쿼리)에서 `readLinkToken` 이 읽는다.
 */
const meta = {
  title: 'Patterns/Auth/Mail link landings',
  decorators: [withRouter],
} satisfies Meta
export default meta
type Story = StoryObj<typeof meta>

/** 오래된 메일의 링크 — 읽지도 서버로 보내지도 않고, 막다른 길이 되지 않게 한 줄로 알린다 */
export const OldMailLink: Story = {
  render: () => <LegacyLinkNotice signInTo="/login" />,
  play: async ({ canvas }) => {
    await expect(
      await canvas.findByRole('heading', { name: 'This link is no longer used' }),
    ).toBeVisible()
    await expect(canvas.getByText(/6-digit code/)).toBeVisible()
    await expect(canvas.getByRole('link', { name: 'Go to sign in' })).toHaveAttribute(
      'href',
      '/login',
    )
  },
}

const redeemOnce = fn(async () => undefined)
export const MagicLinkRedeemsOnce: Story = {
  beforeEach: () => redeemOnce.mockClear(),
  render: () => (
    <StrictMode>
      <MagicLinkLanding
        token="tok-MagicLinkRedeemsOnce"
        onRedeem={redeemOnce}
        onDone={fn()}
        requestTo="/login"
      />
    </StrictMode>
  ),
  play: async () => {
    await waitFor(() => expect(redeemOnce).toHaveBeenCalledTimes(1))
    await new Promise((resolve) => setTimeout(resolve, 100))
    await expect(redeemOnce).toHaveBeenCalledTimes(1)
  },
}

/** 실제 앱에서 두 번 나가던 경로 — 로그인되는 순간 위쪽(동의 게이트 등)이 화면을 다시 마운트해 **새 인스턴스**가 같은 토큰으로 또 부른다. 같은 토큰의 호출은 모듈 수준에서 한 번이다 */
const redeemAcrossRemount = fn(async () => undefined)
const redeemOnceRunner = createOnceRunner() // 라우트 한 벌이 쥐는 실행기(`createAuthRoutes`)
function RemountsOnce() {
  const [round, setRound] = useState(0)
  useEffect(() => {
    const timer = setTimeout(() => setRound(1), 50) // 첫 호출이 진행 중일 때 인스턴스가 바뀐다
    return () => clearTimeout(timer)
  }, [])
  return (
    <MagicLinkLanding
      key={round}
      token="tok-remount"
      once={redeemOnceRunner}
      onRedeem={redeemAcrossRemount}
      onDone={fn()}
      requestTo="/login"
    />
  )
}
export const MagicLinkRedeemsOnceAcrossARemount: Story = {
  beforeEach: () => redeemAcrossRemount.mockClear(),
  render: () => (
    <StrictMode>
      <RemountsOnce />
    </StrictMode>
  ),
  play: async () => {
    await new Promise((resolve) => setTimeout(resolve, 300))
    await expect(redeemAcrossRemount).toHaveBeenCalledTimes(1)
  },
}

export const MagicLinkSignsIn: Story = {
  args: {},
  render: () => (
    <MagicLinkLanding
      token="tok-MagicLinkSignsIn"
      onRedeem={async () => undefined}
      onDone={fn()}
      requestTo="/login"
    />
  ),
  play: async ({ canvas }) => {
    await expect(await canvas.findByRole('heading', { name: 'Signing you in' })).toBeVisible()
  },
}

export const MagicLinkExpired: Story = {
  render: () => (
    <MagicLinkLanding
      token="old"
      requestTo="/login"
      onDone={fn()}
      onRedeem={async () => {
        throw apiError('ACCOUNT.TOKEN_INVALID', 410)
      }}
    />
  ),
  play: async ({ canvas }) => {
    await expect(
      await canvas.findByRole('heading', { name: 'This sign-in link does not work' }),
    ).toBeVisible()
    await expect(canvas.getByRole('link', { name: 'Request a new link' })).toBeVisible()
  },
}

/** 링크로 들어왔지만 가입이 막힌 주소(403 ACCOUNT.REGISTRATION_BLOCKED) — 일반 오류가 아니라 이유를 말한다 */
export const MagicLinkBlockedAddress: Story = {
  render: () => (
    <MagicLinkLanding
      token="tok-MagicLinkBlockedAddress"
      requestTo="/login"
      onDone={fn()}
      onRedeem={async () => {
        throw apiError('ACCOUNT.REGISTRATION_BLOCKED', 403)
      }}
    />
  ),
  play: async ({ canvas }) => {
    await expect(
      await canvas.findByText('You cannot sign up with this address (account).'),
    ).toBeVisible()
  },
}

/** 소셜 제공자 계정이 막혀 있다 — 같은 안내(실패 제목 아래) */
export const SocialCallbackBlockedAccount: Story = {
  render: () => (
    <SocialCallbackScreen
      state={{ status: 'error', error: apiError('ACCOUNT.REGISTRATION_BLOCKED', 403) }}
      signInTo="/login"
    />
  ),
  play: async ({ canvas }) => {
    await expect(
      await canvas.findByText('You cannot sign up with this address (account).'),
    ).toBeVisible()
    await expect(canvas.getByRole('link', { name: 'Back to sign in' })).toBeVisible()
  },
}

export const ForgotThenSent: Story = {
  render: () => <ForgotPasswordScreen onSubmit={async () => undefined} signInTo="/login" />,
  play: async ({ canvas, userEvent }) => {
    await userEvent.type(canvas.getByLabelText(/Email/), 'ann@example.com')
    await userEvent.click(canvas.getByRole('button', { name: 'Send the link' }))
    await expect(await canvas.findByText(/If ann@example.com has an account/)).toBeVisible()
  },
}

export const ResetPassword: Story = {
  render: () => {
    const onReset = fn(async () => undefined)
    return (
      <ResetPasswordScreen
        token="tok-ResetPassword"
        policy={FAKE_POLICY}
        onReset={onReset}
        signInTo="/login"
        forgotTo="/forgot-password"
      />
    )
  },
  play: async ({ canvas, userEvent }) => {
    await userEvent.type(canvas.getByLabelText(/^New password/), 'Correct-horse-battery-9')
    await userEvent.type(canvas.getByLabelText(/^Confirm password/), 'Correct-horse-battery-9')
    await userEvent.click(canvas.getByRole('button', { name: 'Set the password' }))
    await expect(await canvas.findByRole('heading', { name: 'Password changed' })).toBeVisible()
    await expect(canvas.getByRole('link', { name: 'Back to sign in' })).toHaveAttribute(
      'href',
      '/login',
    )
  },
}

export const ResetMismatchBlocksAndSaysWhy: Story = {
  render: () => {
    const onReset = fn(async () => undefined)
    return (
      <ResetPasswordScreen
        token="tok-ResetMismatchBlocksAndSaysWhy"
        policy={FAKE_POLICY}
        onReset={onReset}
        signInTo="/login"
        forgotTo="/forgot-password"
      />
    )
  },
  play: async ({ canvas, userEvent }) => {
    await userEvent.type(canvas.getByLabelText(/^New password/), 'Correct-horse-battery-9')
    await userEvent.type(canvas.getByLabelText(/^Confirm password/), 'Correct-horse-battery-8')
    await expect(await canvas.findByText('Passwords do not match')).toBeVisible()
    await userEvent.click(canvas.getByRole('button', { name: 'Set the password' }))
    await expect(
      await canvas.findByRole('button', { name: 'Passwords do not match' }),
    ).toBeVisible()
    await waitFor(() => expect(canvas.getByLabelText(/^Confirm password/)).toHaveFocus())
    await expect(canvas.queryByRole('heading', { name: 'Password changed' })).toBeNull()
  },
}

export const ForgotWithoutAnAddressExplainsItself: Story = {
  render: () => <ForgotPasswordScreen onSubmit={async () => undefined} signInTo="/login" />,
  play: async ({ canvas, userEvent }) => {
    await userEvent.click(canvas.getByRole('button', { name: 'Send the link' }))
    await expect(
      await canvas.findByRole('button', { name: 'Enter your email address' }),
    ).toBeVisible()
    await waitFor(() => expect(canvas.getByLabelText(/Email/)).toHaveFocus())
    await userEvent.type(canvas.getByLabelText(/Email/), 'not-an-address')
    await userEvent.click(canvas.getByRole('button', { name: 'Send the link' }))
    await expect(
      await canvas.findByRole('button', { name: 'Enter a valid email address' }),
    ).toBeVisible()
  },
}

export const ResetLinkInvalid: Story = {
  render: () => (
    <ResetPasswordScreen
      token={null}
      policy={FAKE_POLICY}
      onReset={async () => undefined}
      signInTo="/login"
      forgotTo="/forgot-password"
    />
  ),
  play: async ({ canvas }) => {
    await expect(canvas.getByRole('link', { name: 'Request a new link' })).toHaveAttribute(
      'href',
      '/forgot-password',
    )
  },
}

export const SocialCallbackConflict: Story = {
  render: () => (
    <SocialCallbackScreen
      state={{ status: 'error', error: apiError('ACCOUNT.SOCIAL_EMAIL_CONFLICT', 409) }}
      signInTo="/login"
    />
  ),
  play: async ({ canvas }) => {
    await expect(
      await canvas.findByRole('heading', { name: 'You already have an account' }),
    ).toBeVisible()
    await expect(canvas.getByRole('link', { name: 'Back to sign in' })).toBeVisible()
  },
}

/** 계정에 맞는 증거 하나 — 비밀번호 · 메일로 받은 6자리(같은 자리에서) · 주소가 없으면 이미 연결된 제공자의 동의 */
export const SocialLinkNeedsPassword: Story = {
  render: () => {
    const onSubmit = fn(async (c: { currentPassword?: string }) => {
      if (c.currentPassword !== 'old-password-1')
        throw apiError('ACCOUNT.CURRENT_PASSWORD_INVALID', 400)
    })
    return (
      <SocialLinkProofScreen
        provider="Kakao"
        kind="password"
        email="ann@example.com"
        requestCode={async () => undefined}
        backTo="/account"
        onSubmit={onSubmit}
      />
    )
  },
  play: async ({ canvas, userEvent }) => {
    await userEvent.type(canvas.getByLabelText(/^Current password/), 'wrong')
    await userEvent.click(canvas.getByRole('button', { name: 'Link Kakao' }))
    await expect(await canvas.findByText('The current password is not correct.')).toBeVisible()
    await expect(canvas.getByRole('link', { name: 'Cancel' })).toHaveAttribute('href', '/account')
  },
}

export const SocialLinkWithoutTheProofExplainsItself: Story = {
  render: () => (
    <SocialLinkProofScreen
      provider="Kakao"
      kind="password"
      email="ann@example.com"
      requestCode={async () => undefined}
      backTo="/account"
      onSubmit={async () => undefined}
    />
  ),
  play: async ({ canvas, userEvent }) => {
    const submit = canvas.getByRole('button', { name: 'Link Kakao' })
    await expect(submit).toBeEnabled()
    await userEvent.click(submit)
    await expect(
      await canvas.findByRole('button', { name: 'Confirm it is you first (see above)' }),
    ).toBeVisible()
    await waitFor(() => expect(canvas.getByLabelText(/^Current password/)).toHaveFocus())
  },
}

export const SocialLinkNeedsTheMailedCode: Story = {
  render: () => {
    const onSubmit = fn(async (c: { confirmationCode?: string }) => {
      if (c.confirmationCode !== '123456')
        throw apiError('ACCOUNT.CODE_INVALID', 400, { attemptsLeft: 4 })
    })
    return (
      <SocialLinkProofScreen
        provider="Kakao"
        kind="code"
        email="ann@example.com"
        requestCode={async () => undefined}
        backTo="/account"
        onSubmit={onSubmit}
      />
    )
  },
  play: async ({ canvas, userEvent }) => {
    await userEvent.click(canvas.getByRole('button', { name: 'Email me a code' }))
    await userEvent.click(await canvas.findByLabelText('Digit 1 of 6'))
    await userEvent.paste('000000')
    await userEvent.click(canvas.getByRole('button', { name: 'Link Kakao' }))
    await expect(await canvas.findByText(/not right\. 4 attempts left/)).toBeVisible()
    // 같은 인가 코드로 다시 — 새 번호를 입력하면 다시 낼 수 있다
    await userEvent.click(canvas.getByLabelText('Digit 1 of 6'))
    await userEvent.paste('123456')
    await userEvent.click(canvas.getByRole('button', { name: 'Link Kakao' }))
    await waitFor(() => expect(canvas.queryByText(/not right/)).toBeNull())
  },
}

export const SocialLinkReconsentsForAnAddresslessAccount: Story = {
  render: () => (
    <SocialLinkProofScreen
      provider="Google"
      kind="provider"
      email={null}
      reauthProviders={['naver']}
      requestCode={async () => undefined}
      backTo="/account"
      onSubmit={async () => undefined}
      onProvider={fn()}
    />
  ),
  play: async ({ canvas }) => {
    await expect(await canvas.findByRole('button', { name: 'Confirm with Naver' })).toBeVisible()
    await expect(canvas.queryByRole('button', { name: 'Link Google' })).toBeNull()
  },
}
