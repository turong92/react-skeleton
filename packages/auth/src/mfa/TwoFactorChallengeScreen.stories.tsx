import type { Meta, StoryObj } from '@storybook/react-vite'
import { expect, fn } from 'storybook/test'
import { koAuthLabels } from '../screens/labels.ko'
import { FAKE_MFA_TOKEN } from '../stories/fakeAuthApi'
import { FAKE_RECOVERY_CODE, FAKE_TOTP_CODE } from '../stories/fakeMfaApi'
import { withRouter } from '../stories/withRouter'
import { apiError } from '../test/apiFixtures'
import { TwoFactorChallengeScreen } from './TwoFactorChallengeScreen'
import type { MfaRequired } from './types'

/**
 * 로그인의 두 번째 단계 - 비밀번호 · 소셜 · 링크 · 탈퇴 취소 어느 길이든 1단계가 맞으면 서버가 `403 AUTH.MFA_REQUIRED` 로 `mfaToken` 을 준다
 * (`mfaRequiredOf(error)`). 6자리 인증 앱 코드를 채우면 버튼 없이 제출되고, 앱을 잃은 사람은 「복구 코드로 들어가기」로 바꾼다.
 * 틀리면 남은 시도, 대기가 만료되면(5분 · 5번) 처음부터, 계정 한도(429)면 기다릴 시간을 말한다. **`mfaToken` 은 라우터 state 에만** - 주소 · 저장소에 두지 않는다
 */
const mfa: MfaRequired = {
  mfaToken: FAKE_MFA_TOKEN,
  methods: ['totp', 'recovery_code'],
  expiresAt: '2026-10-31T00:05:00Z',
}
const now = () => Date.parse('2026-10-31T00:00:00Z')

const meta = {
  title: 'Packages/auth/TwoFactorChallengeScreen',
  component: TwoFactorChallengeScreen,
  parameters: { layout: 'padded' },
  decorators: [withRouter],
  args: {
    mfa,
    now,
    labels: koAuthLabels,
    onVerify: fn(async () => undefined),
    onRestart: fn(),
  },
} satisfies Meta<typeof TwoFactorChallengeScreen>
export default meta
type Story = StoryObj<typeof meta>

export const AppCode: Story = {
  play: async ({ canvas, userEvent, args }) => {
    await expect(canvas.getByRole('heading', { name: '2단계 인증' })).toBeVisible()
    await expect(canvas.getByText(/남은 시간 05:00/)).toBeVisible()
    await userEvent.type(canvas.getByLabelText('6자리 중 1번째'), FAKE_TOTP_CODE)
    await expect(args.onVerify).toHaveBeenCalledOnce()
    await expect(args.onVerify).toHaveBeenCalledWith({ code: FAKE_TOTP_CODE })
  },
}

export const SwitchToARecoveryCodeAndBack: Story = {
  play: async ({ canvas, userEvent, args }) => {
    await userEvent.click(canvas.getByRole('button', { name: '복구 코드로 들어가기' }))
    await expect(canvas.queryByLabelText('6자리 중 1번째')).toBeNull()
    await userEvent.type(canvas.getByLabelText('복구 코드'), `  ${FAKE_RECOVERY_CODE} `)
    await userEvent.click(canvas.getByRole('button', { name: '확인' }))
    await expect(args.onVerify).toHaveBeenCalledOnce()
    await expect(args.onVerify).toHaveBeenCalledWith({ recoveryCode: FAKE_RECOVERY_CODE })
    await userEvent.click(canvas.getByRole('button', { name: '인증 앱 코드로 들어가기' }))
    await expect(canvas.getByLabelText('6자리 중 1번째')).toBeVisible()
  },
}

export const RecoveryCodeIsRequiredBeforeItIsSent: Story = {
  play: async ({ canvas, userEvent, args }) => {
    await userEvent.click(canvas.getByRole('button', { name: '복구 코드로 들어가기' }))
    await userEvent.click(canvas.getByRole('button', { name: '확인' }))
    await expect(await canvas.findByText('복구 코드를 입력해 주세요.')).toBeVisible()
    await expect(args.onVerify).not.toHaveBeenCalled()
  },
}

export const OnlyTheMethodsTheServerOffers: Story = {
  args: { mfa: { ...mfa, methods: ['totp'] } },
  play: async ({ canvas }) => {
    await expect(canvas.getByLabelText('6자리 중 1번째')).toBeVisible()
    await expect(canvas.queryByRole('button', { name: '복구 코드로 들어가기' })).toBeNull()
  },
}

export const WrongCodeSaysHowManyTriesAreLeft: Story = {
  args: {
    onVerify: fn(async () => {
      throw apiError('MFA.CODE_INVALID', 400, { attemptsLeft: 3 })
    }),
  },
  play: async ({ canvas, userEvent }) => {
    await userEvent.type(canvas.getByLabelText('6자리 중 1번째'), '000000')
    await expect(await canvas.findByText('코드가 맞지 않아요. 남은 시도 3번')).toBeVisible()
    // 칸은 비워지고 첫 칸에서 다시 받는다
    await expect(canvas.getByLabelText('6자리 중 1번째')).toHaveValue('')
  },
}

export const WrongRecoveryCodeSaysSoToo: Story = {
  args: {
    onVerify: fn(async () => {
      throw apiError('MFA.CODE_INVALID', 400, { attemptsLeft: 2 })
    }),
  },
  play: async ({ canvas, userEvent }) => {
    await userEvent.click(canvas.getByRole('button', { name: '복구 코드로 들어가기' }))
    await userEvent.type(canvas.getByLabelText('복구 코드'), 'nope')
    await userEvent.click(canvas.getByRole('button', { name: '확인' }))
    await expect(await canvas.findByText('코드가 맞지 않아요. 남은 시도 2번')).toBeVisible()
  },
}

export const ExpiredChallengeStartsOver: Story = {
  args: {
    onVerify: fn(async () => {
      throw apiError('MFA.CHALLENGE_EXPIRED', 410)
    }),
  },
  play: async ({ canvas, userEvent, args }) => {
    await userEvent.type(canvas.getByLabelText('6자리 중 1번째'), '000000')
    await expect(
      await canvas.findByRole('heading', { name: '처음부터 다시 로그인해 주세요' }),
    ).toBeVisible()
    await userEvent.click(canvas.getByRole('button', { name: '로그인으로 돌아가기' }))
    await expect(args.onRestart).toHaveBeenCalledOnce()
  },
}

export const TheClockRunningOutAlsoStartsOver: Story = {
  args: { mfa: { ...mfa, expiresAt: '2026-10-30T23:59:59Z' } },
  play: async ({ canvas }) => {
    await expect(
      await canvas.findByRole('heading', { name: '처음부터 다시 로그인해 주세요' }),
    ).toBeVisible()
  },
}

export const TooManyWrongAttemptsLocksTheInputForAWhile: Story = {
  args: {
    onVerify: fn(async () => {
      throw apiError('MFA.TOO_MANY_ATTEMPTS', 429, { retryAfterSeconds: 600 })
    }),
  },
  play: async ({ canvas, userEvent }) => {
    await userEvent.type(canvas.getByLabelText('6자리 중 1번째'), '000000')
    await expect(await canvas.findByText(/틀린 시도가 너무 많아 잠시 막았어요/)).toBeVisible()
    await expect(canvas.getByLabelText('6자리 중 1번째')).toBeDisabled()
  },
}

export const ASecondAttemptWhileCheckingIsIgnored: Story = {
  args: {
    onVerify: fn(() => new Promise(() => undefined)), // 끝나지 않는 확인
  },
  play: async ({ canvas, userEvent, args }) => {
    await userEvent.type(canvas.getByLabelText('6자리 중 1번째'), FAKE_TOTP_CODE)
    await expect(await canvas.findByText('코드를 확인하는 중이에요')).toBeVisible()
    await expect(args.onVerify).toHaveBeenCalledOnce()
  },
}

const pendingAfterTheCode = () =>
  apiError('AUTH.ACCOUNT_DELETION_PENDING', 403, {
    purgeAfter: '2026-11-05T00:00:00Z',
    restoreToken: 'restore-opaque',
    restoreTokenExpiresAt: '2026-10-31T00:15:00Z',
  })

export const PendingDeletionAfterTheCodeOffersTheCancelWithItsToken: Story = {
  args: {
    onVerify: fn(async () => {
      throw pendingAfterTheCode()
    }),
    onCancelDeletion: fn(async () => undefined),
  },
  play: async ({ canvas, userEvent, args }) => {
    await userEvent.type(canvas.getByLabelText('6자리 중 1번째'), FAKE_TOTP_CODE)
    await userEvent.click(await canvas.findByRole('button', { name: '탈퇴 취소하고 계속 쓰기' }))
    await expect(args.onCancelDeletion).toHaveBeenCalledOnce()
    await expect(args.onCancelDeletion).toHaveBeenCalledWith('restore-opaque')
  },
}

export const PendingDeletionWhoseTokenExpiredStartsOver: Story = {
  args: {
    onVerify: fn(async () => {
      throw pendingAfterTheCode()
    }),
    onCancelDeletion: fn(async () => {
      throw apiError('ACCOUNT.TOKEN_INVALID', 410)
    }),
  },
  play: async ({ canvas, userEvent, args }) => {
    await userEvent.type(canvas.getByLabelText('6자리 중 1번째'), FAKE_TOTP_CODE)
    await userEvent.click(await canvas.findByRole('button', { name: '탈퇴 취소하고 계속 쓰기' }))
    await expect(await canvas.findByRole('button', { name: '로그인으로 돌아가기' })).toBeVisible()
    await expect(args.onRestart).not.toHaveBeenCalled()
  },
}
