import type { Meta, StoryObj } from '@storybook/react-vite'
import { StrictMode } from 'react'
import { expect, fn, waitFor } from 'storybook/test'
import { ConfirmEmailChangeLanding } from '../screens/ConfirmEmailChangeLanding'
import { ConfirmReauthLanding } from '../screens/ConfirmReauthLanding'
import { SocialLinkPasswordScreen } from '../screens/SocialLinkPasswordScreen'
import { ForgotPasswordScreen } from '../screens/ForgotPasswordScreen'
import { MagicLinkLanding } from '../screens/MagicLinkLanding'
import { ResetPasswordScreen } from '../screens/ResetPasswordScreen'
import { SocialCallbackScreen } from '../screens/SocialCallbackScreen'
import { VerifyEmailScreen } from '../screens/VerifyEmailScreen'
import { FAKE_POLICY, apiError } from '../stories/fakeAccountApi'
import { withRouter } from '../stories/withRouter'

/**
 * 메일 링크가 닿는 화면들 — 이메일 인증 · 링크 로그인 · 이메일 변경 확인 · 본인 확인(비밀번호 없는 계정) · 비밀번호 찾기/재설정 · 소셜 콜백.
 * 링크를 열면 한 번만 서버를 부른다(메일 스캐너의 GET 이 아니라 SPA 의 POST). 서버는 「없는 · 만료 · 이미 씀」을 한 응답(410)으로 주므로 화면도 한 상태로 말하고 새 링크를 받게 한다.
 * 토큰은 주소의 `#token=`(조각) 또는 `?token=`(쿼리)에서 `readLinkToken` 이 읽는다.
 */
const meta = {
  title: 'Patterns/Auth/Mail link landings',
  decorators: [withRouter],
} satisfies Meta
export default meta
type Story = StoryObj<typeof meta>

export const VerifyEmailSuccess: Story = {
  render: () => (
    <VerifyEmailScreen token="tok" onVerify={async () => undefined} signInTo="/login" />
  ),
  play: async ({ canvas, userEvent }) => {
    // 링크를 열기만 해서는 인증하지 않는다 — 사람이 「계속」을 눌러야(메일 스캐너 방어)
    await userEvent.click(await canvas.findByRole('button', { name: 'Continue' }))
    await expect(await canvas.findByText(/Your email is verified/)).toBeVisible()
    await expect(canvas.getByRole('link', { name: 'Go to sign in' })).toHaveAttribute(
      'href',
      '/login',
    )
  },
}

export const VerifyEmailExpiredWithResend: Story = {
  render: () => {
    const onResend = fn(async () => undefined)
    return (
      <VerifyEmailScreen
        token="old"
        signInTo="/login"
        onVerify={async () => {
          throw apiError('ACCOUNT.TOKEN_INVALID', 410)
        }}
        onResend={onResend}
      />
    )
  },
  play: async ({ canvas, userEvent }) => {
    await userEvent.click(await canvas.findByRole('button', { name: 'Continue' }))
    await expect(
      await canvas.findByRole('heading', { name: 'This link does not work' }),
    ).toBeVisible()
    await userEvent.type(canvas.getByLabelText(/Email/), 'ann@example.com')
    await userEvent.click(canvas.getByRole('button', { name: 'Send a new link' }))
    await expect(await canvas.findByText(/new email is on its way/)).toBeVisible()
  },
}

const verifyOnce = fn(async () => undefined)
export const VerifyEmailVerifiesOnce: Story = {
  beforeEach: () => verifyOnce.mockClear(),
  // 더블클릭해도 일회용 토큰은 한 번만 쓴다(두 번째는 410). 주의: 스토리 실행기는 StrictMode 의 이중 effect 를 재현하지 않는다(effect 가 한 번만 돈다) —
  // 그 경로의 보증은 `useOnceOnMount` 의 ref 가드와 개발 서버의 e2e(`account.e2e.ts`)가 맡는다
  render: () => (
    <StrictMode>
      <VerifyEmailScreen token="tok" onVerify={verifyOnce} signInTo="/login" />
    </StrictMode>
  ),
  play: async ({ canvas, userEvent }) => {
    await expect(verifyOnce).not.toHaveBeenCalled() // 열기만 해서는 부르지 않는다
    const button = await canvas.findByRole('button', { name: 'Continue' })
    await userEvent.dblClick(button)
    await expect(await canvas.findByText(/Your email is verified/)).toBeVisible()
    await expect(verifyOnce).toHaveBeenCalledTimes(1)
  },
}

const redeemOnce = fn(async () => undefined)
export const MagicLinkRedeemsOnce: Story = {
  beforeEach: () => redeemOnce.mockClear(),
  render: () => (
    <StrictMode>
      <MagicLinkLanding token="tok" onRedeem={redeemOnce} onDone={fn()} requestTo="/login" />
    </StrictMode>
  ),
  play: async () => {
    await waitFor(() => expect(redeemOnce).toHaveBeenCalledTimes(1))
    await new Promise((resolve) => setTimeout(resolve, 100))
    await expect(redeemOnce).toHaveBeenCalledTimes(1)
  },
}

export const MagicLinkSignsIn: Story = {
  args: {},
  render: () => (
    <MagicLinkLanding
      token="tok"
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

export const ConfirmEmailChange: Story = {
  render: () => (
    <ConfirmEmailChangeLanding token="tok" onConfirm={async () => undefined} signInTo="/login" />
  ),
  play: async ({ canvas, userEvent }) => {
    await userEvent.click(await canvas.findByRole('button', { name: 'Continue' }))
    await expect(await canvas.findByText(/Your email address is changed/)).toBeVisible()
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
        token="tok"
        policy={FAKE_POLICY}
        onReset={onReset}
        signInTo="/login"
        forgotTo="/forgot-password"
      />
    )
  },
  play: async ({ canvas, userEvent }) => {
    await userEvent.type(canvas.getByLabelText(/^New password/), 'Correct-horse-battery-9')
    await userEvent.click(canvas.getByRole('button', { name: 'Set the password' }))
    await expect(await canvas.findByRole('heading', { name: 'Password changed' })).toBeVisible()
    await expect(canvas.getByRole('link', { name: 'Back to sign in' })).toHaveAttribute(
      'href',
      '/login',
    )
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

/** 비밀번호 없는 계정의 본인 확인 링크 — 열자마자 토큰을 하려던 작업에 돌려준다. 이 탭이 그 작업을 모르면(다른 기기 · 닫힌 탭) 설정에서 이어 가게 안내 */
export const ConfirmReauthCompleted: Story = {
  render: () => (
    <ConfirmReauthLanding
      token="tok"
      settingsTo="/account"
      onResolve={async () => ({ status: 'completed', action: 'email-change' })}
    />
  ),
  play: async ({ canvas }) => {
    await expect(await canvas.findByText(/We sent a link to your new address/)).toBeVisible()
  },
}

export const ConfirmReauthHandedOff: Story = {
  render: () => (
    <ConfirmReauthLanding
      token="tok"
      settingsTo="/account"
      onResolve={async () => ({ status: 'handed-off' })}
    />
  ),
  play: async ({ canvas }) => {
    await expect(await canvas.findByText(/continues by itself/)).toBeVisible()
  },
}

export const ConfirmReauthOtherDevice: Story = {
  render: () => (
    <ConfirmReauthLanding
      token="tok"
      settingsTo="/account"
      onResolve={async () => ({ status: 'stashed', resume: null })}
    />
  ),
  play: async ({ canvas }) => {
    await expect(await canvas.findByText(/did not start the action/)).toBeVisible()
    await expect(canvas.getByRole('link', { name: 'Open account settings' })).toHaveAttribute(
      'href',
      '/account',
    )
  },
}

export const ConfirmReauthRefusedOrMissing: Story = {
  render: () => (
    <>
      <ConfirmReauthLanding
        token="stale"
        settingsTo="/account"
        onResolve={async () => ({
          status: 'failed',
          error: apiError('ACCOUNT.REAUTH_FAILED', 400),
        })}
      />
      <ConfirmReauthLanding
        token={null}
        settingsTo="/account"
        onResolve={async () => ({ status: 'handed-off' })}
      />
    </>
  ),
  play: async ({ canvas }) => {
    await expect(
      await canvas.findByText('The password or confirmation is not correct.'),
    ).toBeVisible()
    await expect(canvas.getByRole('heading', { name: 'This link does not work' })).toBeVisible()
  },
}

/** 비밀번호가 있는 계정이 제공자에 다녀온 뒤: 현재 비밀번호를 받아 연결을 마친다(틀리면 같은 인가 코드로 다시) */
export const SocialLinkNeedsPassword: Story = {
  render: () => {
    const onSubmit = fn(async (password: string) => {
      if (password !== 'old-password-1') throw apiError('ACCOUNT.CURRENT_PASSWORD_INVALID', 400)
    })
    return <SocialLinkPasswordScreen provider="Kakao" backTo="/account" onSubmit={onSubmit} />
  },
  play: async ({ canvas, userEvent }) => {
    await userEvent.type(canvas.getByLabelText(/^Current password/), 'wrong')
    await userEvent.click(canvas.getByRole('button', { name: 'Link Kakao' }))
    await expect(await canvas.findByText('The current password is not correct.')).toBeVisible()
    await expect(canvas.getByRole('link', { name: 'Cancel' })).toHaveAttribute('href', '/account')
  },
}
