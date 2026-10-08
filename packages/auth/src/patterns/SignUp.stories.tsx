import type { Meta, StoryObj } from '@storybook/react-vite'
import { useMemo } from 'react'
import { expect, fn, waitFor, within } from 'storybook/test'
import { koAuthLabels } from '../screens/labels.ko'
import { SignUpScreen } from '../screens/SignUpScreen'
import { FAKE_POLICY, apiError, createFakeAccountApi, fieldError } from '../stories/fakeAccountApi'
import { withRouter } from '../stories/withRouter'

/**
 * 가입 화면 — 비밀번호 규칙은 서버 정책(`GET /account/password/policy`)에서 읽어 체크리스트 · 강도 막대로 보여 준다.
 * 응답은 늘 같은 모양(서버가 주소의 존재를 숨긴다) — 메일로 받은 6자리 인증번호를 **같은 화면에서** 입력하면 가입이 끝나고 바로 로그인한다. 캡차(`renderCaptcha`)와 약관 동의(`consents`)는 슬롯이다 —
 * 동의는 체크한 판(`id` + `version`)을 콜백으로 보고한다(서버 문서와 이어 쓰는 모양은 `@skeleton/legal` 의 `SignUpConsents`).
 */
const meta = {
  title: 'Patterns/Auth/Sign up',
  component: SignUpScreen,
  decorators: [withRouter],
  args: {
    policy: FAKE_POLICY,
    confirmPassword: true, // 모듈 기본은 꺼짐 — 이 스토리들은 앱이 켠 모양
    signInTo: '/login',
    onSignUp: fn(async () => ({ status: 'VERIFICATION_SENT' as const, signUpId: 'sid-1' })),
    onVerifyCode: fn(async () => undefined),
  },
} satisfies Meta<typeof SignUpScreen>
export default meta
type Story = StoryObj<typeof SignUpScreen>

export const PolicyHints: Story = {
  play: async ({ canvas, userEvent }) => {
    const password = canvas.getByLabelText(/^Password/)
    await userEvent.type(password, 'abc')
    await expect(canvas.getByText(/Enough characters/).closest('li')).toHaveAttribute(
      'data-met',
      'false',
    )
    await expect(canvas.getByRole('img', { name: /Strength: Weak/ })).toBeVisible()
    await userEvent.clear(password)
    await userEvent.type(password, 'Correct-horse-battery-9')
    await waitFor(() =>
      expect(canvas.getByText(/Enough characters/).closest('li')).toHaveAttribute(
        'data-met',
        'true',
      ),
    )
    await expect(canvas.getByRole('img', { name: /Strength: Strong/ })).toBeVisible()
  },
}

export const AsksForTheCodeRightAfterSigningUp: Story = {
  play: async ({ canvas, args, userEvent }) => {
    await userEvent.type(canvas.getByLabelText(/Email/), 'new@example.com')
    await userEvent.type(canvas.getByLabelText(/^Password/), 'Correct-horse-battery-9')
    await userEvent.type(canvas.getByLabelText(/^Confirm password/), 'Correct-horse-battery-9')
    await userEvent.click(canvas.getByRole('button', { name: 'Create account' }))
    await expect(
      await canvas.findByRole('heading', { name: 'Enter the 6-digit code' }),
    ).toBeVisible()
    await expect(canvas.getByText(/new@example.com/)).toBeVisible()
    await expect(args.onSignUp).toHaveBeenCalledWith(
      expect.objectContaining({ email: 'new@example.com', consents: [] }),
    )
    // 비밀번호는 코드 단계에 남지 않는다
    await expect(canvas.queryByLabelText(/^Password/)).toBeNull()
  },
}

export const ConsentAndCaptchaSlots: Story = {
  args: {
    consents: [
      { id: 'terms', version: '2.0', label: 'I accept the Terms of Service', required: true },
      { id: 'marketing', version: '1.0', label: 'Send me product news' },
    ],
    onConsentsChange: fn(),
    renderCaptcha: ({ onToken }) => (
      <button type="button" onClick={() => onToken('captcha-ok')}>
        Solve captcha
      </button>
    ),
  },
  play: async ({ canvas, args, userEvent }) => {
    await userEvent.type(canvas.getByLabelText(/Email/), 'new@example.com')
    await userEvent.type(canvas.getByLabelText(/^Password/), 'Correct-horse-battery-9')
    await userEvent.type(canvas.getByLabelText(/^Confirm password/), 'Correct-horse-battery-9')
    // 필수 동의를 안 하면 보내지 않는다
    await userEvent.click(canvas.getByRole('button', { name: 'Create account' }))
    await expect(args.onSignUp).not.toHaveBeenCalled()
    await userEvent.click(canvas.getByRole('checkbox', { name: /Terms of Service/ }))
    await expect(args.onConsentsChange).toHaveBeenLastCalledWith([{ id: 'terms', version: '2.0' }])
    await userEvent.click(canvas.getByRole('button', { name: 'Solve captcha' }))
    await userEvent.click(canvas.getByRole('button', { name: 'Create account' }))
    await expect(args.onSignUp).toHaveBeenCalledWith(
      expect.objectContaining({
        captchaToken: 'captcha-ok',
        consents: [{ id: 'terms', version: '2.0' }],
      }),
    )
  },
}

/** 서버가 문서를 쥘 때(`@skeleton/legal` 의 `SignUpConsents`) — 동의 자리가 통째로 슬롯이다. 필수가 안 채워진 동안은 보내지 않고, 보낼 때는 `{id, version, locale}` 를 싣는다 */
export const ConsentSlotFromTheBackend: Story = {
  args: {
    renderConsents: (slot) => (
      <div data-refresh={slot.refreshKey}>
        <button
          type="button"
          onClick={() =>
            slot.onChange([{ id: 'terms', version: '2026-10-01', locale: 'ko' }], true)
          }
        >
          Agree to the terms
        </button>
        {slot.showError && <p role="alert">Needs the terms</p>}
      </div>
    ),
  },
  play: async ({ canvas, args, userEvent }) => {
    await userEvent.type(canvas.getByLabelText(/Email/), 'new@example.com')
    await userEvent.type(canvas.getByLabelText(/^Password/), 'Correct-horse-battery-9')
    await userEvent.type(canvas.getByLabelText(/^Confirm password/), 'Correct-horse-battery-9')
    await userEvent.click(canvas.getByRole('button', { name: 'Create account' }))
    await expect(args.onSignUp).not.toHaveBeenCalled() // 슬롯이 아직 「완료」를 알리지 않았다
    await expect(await canvas.findByText('Needs the terms')).toBeVisible()
    await userEvent.click(canvas.getByRole('button', { name: 'Agree to the terms' }))
    await userEvent.click(canvas.getByRole('button', { name: 'Create account' }))
    await expect(args.onSignUp).toHaveBeenCalledWith(
      expect.objectContaining({
        consents: [{ id: 'terms', version: '2026-10-01', locale: 'ko' }],
      }),
    )
  },
}

/** 서버가 `400 LEGAL.CONSENT_REQUIRED`(문서가 그 사이 바뀌었다)로 거절하면 문구를 보이고 슬롯에 「다시 읽어라」(refreshKey) 를 알린다 */
export const ConsentRequiredAsksTheSlotToReload: Story = {
  args: {
    onSignUp: async () => {
      throw apiError('LEGAL.CONSENT_REQUIRED', 400, {
        missing: [{ type: 'terms', version: '2026-12-01', reason: 'STALE' }],
      })
    },
    renderConsents: (slot) => (
      <div data-testid="slot" data-refresh={slot.refreshKey}>
        <button type="button" onClick={() => slot.onChange([], true)}>
          Ready
        </button>
      </div>
    ),
  },
  play: async ({ canvas, userEvent }) => {
    await userEvent.type(canvas.getByLabelText(/Email/), 'new@example.com')
    await userEvent.type(canvas.getByLabelText(/^Password/), 'Correct-horse-battery-9')
    await userEvent.type(canvas.getByLabelText(/^Confirm password/), 'Correct-horse-battery-9')
    await userEvent.click(canvas.getByRole('button', { name: 'Ready' }))
    await userEvent.click(canvas.getByRole('button', { name: 'Create account' }))
    await expect(await canvas.findByText(/agreements changed/i)).toBeVisible()
    await expect(canvas.getByTestId('slot')).toHaveAttribute('data-refresh', '1')
  },
}

export const ServerRejectsPassword: Story = {
  args: {
    onSignUp: async () => {
      throw apiError('ACCOUNT.PASSWORD_POLICY', 400, { violations: ['BREACHED'] })
    },
  },
  play: async ({ canvas, userEvent }) => {
    await userEvent.type(canvas.getByLabelText(/Email/), 'new@example.com')
    await userEvent.type(canvas.getByLabelText(/^Password/), 'Correct-horse-battery-9')
    await userEvent.type(canvas.getByLabelText(/^Confirm password/), 'Correct-horse-battery-9')
    await userEvent.click(canvas.getByRole('button', { name: 'Create account' }))
    // 서버만 아는 규칙(유출 검사)도 체크리스트에 올라온다
    const lines = await canvas.findAllByText(/Not in a known data breach/)
    await expect(lines.length).toBeGreaterThanOrEqual(1)
    // 요약에도 같은 이유가 올라오고 비밀번호 칸으로 포커스가 간다
    await expect(
      await canvas.findByRole('button', { name: /Not in a known data breach/ }),
    ).toBeVisible()
    await waitFor(() => expect(canvas.getByLabelText(/^Password/)).toHaveFocus())
  },
}

export const SignUpClosed: Story = {
  args: {
    onSignUp: async () => {
      throw apiError('ACCOUNT.SIGN_UP_CLOSED', 403)
    },
  },
  play: async ({ canvas, userEvent }) => {
    await userEvent.type(canvas.getByLabelText(/Email/), 'new@example.com')
    await userEvent.type(canvas.getByLabelText(/^Password/), 'Correct-horse-battery-9')
    await userEvent.type(canvas.getByLabelText(/^Confirm password/), 'Correct-horse-battery-9')
    await userEvent.click(canvas.getByRole('button', { name: 'Create account' }))
    await expect(await canvas.findByRole('heading', { name: 'Sign-up is closed' })).toBeVisible()
  },
}

/* 가입 = 6자리 인증번호, 같은 화면: 가입 응답의 signUpId → 코드 입력 → 맞으면 로그인 */
const codeArgs = () => ({
  onSignUp: fn(async () => ({ status: 'VERIFICATION_SENT' as const, signUpId: 'sid-1' })),
  onVerifyCode: fn(async (_id: string, code: string) => {
    if (code === '123456') return undefined
    throw apiError('ACCOUNT.CODE_INVALID', 400, { attemptsLeft: 4 })
  }),
  onResendCode: fn(async () => undefined),
})

async function fillAndSubmit(
  canvas: Parameters<NonNullable<Story['play']>>[0]['canvas'],
  userEvent: Parameters<NonNullable<Story['play']>>[0]['userEvent'],
) {
  await userEvent.type(canvas.getByLabelText(/^Email/), 'ann@example.com')
  await userEvent.type(canvas.getByLabelText(/^Password/), 'Correct-horse-battery-9')
  await userEvent.type(canvas.getByLabelText(/^Confirm password/), 'Correct-horse-battery-9')
  await userEvent.click(canvas.getByRole('button', { name: /Create account|Sign up/ }))
}

export const CodeStepSignsInOnTheRightCode: Story = {
  args: codeArgs(),
  play: async ({ canvas, userEvent, args }) => {
    await fillAndSubmit(canvas, userEvent)
    await expect(
      await canvas.findByRole('heading', { name: 'Enter the 6-digit code' }),
    ).toBeVisible()
    await expect(canvas.getByLabelText('Digit 1 of 6')).toHaveAttribute(
      'autocomplete',
      'one-time-code',
    )
    await userEvent.click(canvas.getByLabelText('Digit 1 of 6'))
    await userEvent.paste('123456') // 붙여넣으면 채워지고 버튼 없이 제출된다
    await waitFor(() => {
      expect(args.onVerifyCode).toHaveBeenCalledTimes(1)
      expect(args.onVerifyCode).toHaveBeenCalledWith('sid-1', '123456')
    })
  },
}

export const CodeStepWrongCodeShowsAttemptsLeft: Story = {
  args: codeArgs(),
  play: async ({ canvas, userEvent }) => {
    await fillAndSubmit(canvas, userEvent)
    await userEvent.click(await canvas.findByLabelText('Digit 1 of 6'))
    await userEvent.keyboard('000000')
    await expect(await canvas.findByRole('alert')).toHaveTextContent('4 attempts left')
    await expect(canvas.getByLabelText('Digit 1 of 6')).toHaveValue('') // 비우고 다시 칠 수 있게
  },
}

export const CodeStepExpiredStartsOver: Story = {
  args: {
    ...codeArgs(),
    onVerifyCode: fn(async () => {
      throw apiError('ACCOUNT.CODE_EXPIRED', 410)
    }),
  },
  play: async ({ canvas, userEvent }) => {
    await fillAndSubmit(canvas, userEvent)
    await userEvent.click(await canvas.findByLabelText('Digit 1 of 6'))
    await userEvent.keyboard('111111')
    await expect(await canvas.findByText(/expired or was used up/)).toBeVisible()
    await userEvent.click(canvas.getByRole('button', { name: 'Start over' }))
    // 주소는 남고 비밀번호는 비워진 가입 폼으로
    await expect(await canvas.findByLabelText(/^Email/)).toHaveValue('ann@example.com')
    await expect(canvas.getByLabelText(/^Password/)).toHaveValue('')
  },
}

/** 막힌 주소(403 ACCOUNT.REGISTRATION_BLOCKED, 메일함을 증명한 사람에게만 보인다) — 일반 오류가 아니라 「가입할 수 없어요」 */
export const CodeStepBlockedAddressSaysItCannotSignUp: Story = {
  args: {
    ...codeArgs(),
    onVerifyCode: fn(async () => {
      throw apiError('ACCOUNT.REGISTRATION_BLOCKED', 403)
    }),
  },
  play: async ({ canvas, userEvent }) => {
    await fillAndSubmit(canvas, userEvent)
    await userEvent.click(await canvas.findByLabelText('Digit 1 of 6'))
    await userEvent.keyboard('123456')
    await expect(
      await canvas.findByText('You cannot sign up with this address (account).'),
    ).toBeVisible()
    await expect(canvas.queryByText('Something went wrong. Try again.')).toBeNull()
  },
}

/** 주소당 추측 상한(429)은 틀린 번호가 아니다 — 남은 횟수 대신 기다릴 시간을 말하고 입력을 잠근다 */
export const CodeStepRateLimitedShowsTheWaitNotAWrongCode: Story = {
  args: {
    ...codeArgs(),
    onVerifyCode: fn(async () => {
      throw apiError('ACCOUNT.RATE_LIMITED', 429, { retryAfterSeconds: 90 })
    }),
  },
  play: async ({ canvas, userEvent }) => {
    await fillAndSubmit(canvas, userEvent)
    await userEvent.click(await canvas.findByLabelText('Digit 1 of 6'))
    await userEvent.keyboard('111111')
    await expect(await canvas.findByRole('alert')).toHaveTextContent('Try again in 90 s')
    await expect(canvas.getByRole('alert')).not.toHaveTextContent('attempts left')
    await expect(canvas.getByLabelText('Digit 1 of 6')).toBeDisabled()
  },
}

export const CodeStepResendHasACooldown: Story = {
  args: codeArgs(),
  // 가입 직후 30초는 서버도 조용히 무시하는 구간이라 버튼이 잠겨 있다 — 쿨다운이 끝난 뒤(새로고침 뒤 등)에 누르는 경우를 본다
  render: (args) => (
    <SignUpScreen
      {...args}
      initialPending={{
        email: 'ann@example.com',
        signUpId: 'sid-1',
        expiresAt: Date.now() + 300_000,
        resendAvailableAt: Date.now() - 1_000,
      }}
    />
  ),
  play: async ({ canvas, userEvent, args }) => {
    await expect(await canvas.findByText(/^Time left 0[45]:\d\d$/)).toBeVisible()
    await userEvent.click(await canvas.findByRole('button', { name: 'Send a new code' }))
    await waitFor(() => {
      expect(args.onResendCode).toHaveBeenCalledTimes(1)
      expect(args.onResendCode).toHaveBeenCalledWith('sid-1')
    })
    // 쿨다운은 버튼 글자에 초로 — 초마다 읽어 주는 영역이 아니다
    await expect(
      await canvas.findByRole('button', { name: /^Send a new code \(\d+ s\)$/ }),
    ).toBeDisabled()
    // 다시 받으면 남은 시간이 새로(어림 10분) 시작한다
    await expect(await canvas.findByText(/^Time left (10:00|09:5\d)$/)).toBeVisible()
  },
}

/* 인증번호 남은 시간 — 옛 서버처럼 응답에 만료 시각이 없으면 가입 직후는 문서화된 10분으로 **어림**하고 `data-expiry-source="estimate"` 로 남긴다 */
export const CodeStepCountsDownFromAnEstimatedTenMinutes: Story = {
  args: codeArgs(),
  play: async ({ canvas, userEvent, canvasElement }) => {
    await fillAndSubmit(canvas, userEvent)
    await expect(await canvas.findByText(/^Time left (10:00|09:5\d)$/)).toBeVisible()
    await expect(canvasElement.querySelector('[data-expiry-source]')).toHaveAttribute(
      'data-expiry-source',
      'estimate',
    )
  },
}

/** 새로고침으로 돌아왔다: 보관한 **절대 시각**에서 남은 시간을 이어 센다(처음부터 10분이 아니다). 코드는 보관하지 않는다 */
export const CodeStepReloadResumesTheRemainingTime: Story = {
  args: codeArgs(),
  render: (args) => (
    <SignUpScreen
      {...args}
      initialPending={{
        email: 'ann@example.com',
        signUpId: 'sid-1',
        expiresAt: Date.now() + 342_000,
        estimated: true,
      }}
    />
  ),
  play: async ({ canvas }) => {
    await expect(await canvas.findByText(/^Time left 05:4\d$/)).toBeVisible()
  },
}

export const CodeStepUnderAMinuteIsEmphasised: Story = {
  args: codeArgs(),
  render: (args) => (
    <SignUpScreen
      {...args}
      initialPending={{
        email: 'ann@example.com',
        signUpId: 'sid-1',
        expiresAt: Date.now() + 45_000,
      }}
    />
  ),
  play: async ({ canvas }) => {
    const time = await canvas.findByText(/^Time left 00:4\d$/)
    await expect(time).toHaveAttribute('data-stage', 'minute')
    await expect(canvas.getByRole('status')).toHaveTextContent('One minute left')
  },
}

/**
 * 시간이 다 된 뒤 「다시 받기」 — 새 백엔드는 만료된 시도에도 **새 번호를 보내고** 응답에 새 `expiresAt` 을 준다: 그 자리에서 타이머가 다시 시작한다(양식으로 돌려보내지 않는다).
 * 옛 서버는 만료된 시도의 다시 받기를 조용히 무시한다 — 응답에 시각이 없으면 처음부터 다시(주소는 남는다)로 이어진다
 */
export const CodeStepExpiredResendRestartsTheTimerWhenTheServerSendsANewCode: Story = {
  args: {
    ...codeArgs(),
    onResendCode: fn(async () => ({
      expiresAt: new Date(Date.now() + 600_000).toISOString(),
      resendAvailableAt: new Date(Date.now() + 30_000).toISOString(),
    })),
  },
  render: (args) => (
    <SignUpScreen
      {...args}
      initialPending={{
        email: 'ann@example.com',
        signUpId: 'sid-1',
        expiresAt: Date.now() + 2_000,
      }}
    />
  ),
  play: async ({ canvas, userEvent, args }) => {
    await expect(await canvas.findByRole('alert', {}, { timeout: 6000 })).toHaveTextContent(
      'Time is up. Please get a new code.',
    )
    await userEvent.click(canvas.getByRole('button', { name: 'Send a new code' }))
    await waitFor(() => expect(args.onResendCode).toHaveBeenCalledWith('sid-1'))
    // 같은 단계에 머문다 — 새 10분이 시작되고 입력이 다시 열린다
    await expect(await canvas.findByText(/^Time left (10:00|09:5\d)$/)).toBeVisible()
    await waitFor(() => expect(canvas.getByLabelText('Digit 1 of 6')).toBeEnabled())
    await expect(canvas.queryByLabelText(/^Email/)).toBeNull()
    await expect(
      document.querySelector('[data-testid="verify-code"] [data-expiry-source]'),
    ).toHaveAttribute('data-expiry-source', 'server')
  },
}

export const CodeStepExpiredLocksAndFocusesTheRestart: Story = {
  args: codeArgs(), // onResendCode 가 시각 없이 돌아온다 = 옛 서버(만료된 시도의 다시 받기를 무시)
  render: (args) => (
    <SignUpScreen
      {...args}
      initialPending={{
        email: 'ann@example.com',
        signUpId: 'sid-1',
        expiresAt: Date.now() + 2_000,
      }}
    />
  ),
  play: async ({ canvas, userEvent, args }) => {
    await expect(await canvas.findByRole('alert', {}, { timeout: 6000 })).toHaveTextContent(
      'Time is up. Please get a new code.',
    )
    await expect(canvas.getByLabelText('Digit 1 of 6')).toBeDisabled()
    await waitFor(() =>
      expect(canvas.getByRole('button', { name: 'Send a new code' })).toHaveFocus(),
    )
    await userEvent.click(canvas.getByRole('button', { name: 'Send a new code' }))
    await waitFor(() => expect(args.onResendCode).toHaveBeenCalledWith('sid-1')) // 새 서버일 수도 있어 먼저 물어본다
    await expect(await canvas.findByLabelText(/^Email/)).toHaveValue('ann@example.com') // 시각이 없다 = 옛 서버: 처음부터
  },
}

/** 새 백엔드가 예산을 다 쓴 시도의 다시 받기를 조용히 무시하면 **지나간** `expiresAt` 과 `resendAvailableAt: null` 을 준다 — 「새 번호를 보냈어요」 + 잠긴 칸이 아니라 처음부터 다시 */
export const CodeStepExpiredResendIgnoredByTheServerGoesBackToTheForm: Story = {
  args: {
    ...codeArgs(),
    onResendCode: fn(async () => ({
      status: 'ACCEPTED',
      expiresAt: new Date(Date.now() - 5_000).toISOString(),
      resendAvailableAt: null,
    })),
  },
  render: (args) => (
    <SignUpScreen
      {...args}
      initialPending={{
        email: 'ann@example.com',
        signUpId: 'sid-1',
        expiresAt: Date.now() + 1_500,
      }}
    />
  ),
  play: async ({ canvas, userEvent }) => {
    await expect(await canvas.findByRole('alert', {}, { timeout: 6000 })).toHaveTextContent(
      'Time is up',
    )
    await userEvent.click(canvas.getByRole('button', { name: 'Send a new code' }))
    await expect(await canvas.findByLabelText(/^Email/)).toHaveValue('ann@example.com')
    await expect(canvas.queryByText('A new code is on its way.')).toBeNull()
  },
}

/** 두 번 눌러도 요청은 하나 — 진행 중에는 다시 보내지 않는다 */
export const CodeStepResendIgnoresADoublePress: Story = {
  args: {
    ...codeArgs(),
    onResendCode: fn(async () => {
      await new Promise((resolve) => setTimeout(resolve, 300))
      return {
        status: 'ACCEPTED',
        expiresAt: new Date(Date.now() + 600_000).toISOString(),
        resendAvailableAt: new Date(Date.now() + 30_000).toISOString(),
      }
    }),
  },
  render: (args) => (
    <SignUpScreen
      {...args}
      initialPending={{
        email: 'ann@example.com',
        signUpId: 'sid-1',
        expiresAt: Date.now() + 500_000,
      }}
    />
  ),
  play: async ({ canvas, args, userEvent }) => {
    const button = await canvas.findByRole('button', { name: 'Send a new code' })
    await userEvent.dblClick(button)
    await new Promise((resolve) => setTimeout(resolve, 600))
    await expect(args.onResendCode).toHaveBeenCalledTimes(1)
  },
}

export const CodeStepReloadKeepsTheResendCooldown: Story = {
  args: codeArgs(),
  render: (args) => (
    <SignUpScreen
      {...args}
      initialPending={{
        email: 'ann@example.com',
        signUpId: 'sid-1',
        expiresAt: Date.now() + 500_000,
        resendAvailableAt: Date.now() + 27_000,
      }}
    />
  ),
  play: async ({ canvas }) => {
    await expect(
      await canvas.findByRole('button', { name: /^Send a new code \(2\d s\)$/ }),
    ).toBeDisabled()
  },
}

export const CodeStepResumesAfterAReload: Story = {
  args: { ...codeArgs(), initialPending: { email: 'ann@example.com', signUpId: 'sid-1' } },
  play: async ({ canvas }) => {
    await expect(await canvas.findByText(/ann@example.com/)).toBeVisible()
    await expect(canvas.getByLabelText('Digit 6 of 6')).toBeVisible()
  },
}

export const Dark: Story = {
  globals: { theme: 'dark' },
  play: async ({ canvas }) => {
    await expect(canvas.getByRole('form', { name: 'Create your account' })).toBeVisible()
  },
}

/** 필수 약관을 안 체크하고 「가입하기」 — 아무 일도 없어 보이면 안 된다(실제로 겪은 문제). 요약 · 포커스 · 표시가 모두 뜨고, 체크하면 바로 사라진다 */
export const SubmitWithoutTheRequiredConsentExplainsItself: Story = {
  args: {
    consents: [
      { id: 'terms', version: '2.0', label: 'I accept the Terms of Service', required: true },
      { id: 'marketing', version: '1.0', label: 'Send me product news' },
    ],
  },
  play: async ({ canvas, args, userEvent }) => {
    await userEvent.type(canvas.getByLabelText(/Email/), 'new@example.com')
    await userEvent.type(canvas.getByLabelText(/^Password/), 'Correct-horse-battery-9')
    await userEvent.type(canvas.getByLabelText(/^Confirm password/), 'Correct-horse-battery-9')
    const submit = canvas.getByRole('button', { name: 'Create account' })
    await expect(submit).toBeEnabled() // 꺼진 버튼은 이유를 말하지 못한다
    await userEvent.click(submit)
    await expect(args.onSignUp).not.toHaveBeenCalled()
    // ① 버튼 바로 위 요약
    const summary = await canvas.findByRole('button', { name: 'Agree to the required terms' })
    await expect(summary.closest('[role="group"]')).toHaveTextContent('Please check the following')
    await expect(
      summary.compareDocumentPosition(submit) & Node.DOCUMENT_POSITION_FOLLOWING,
    ).toBeTruthy()
    // ② 틀린 칸으로 포커스 ③ 틀린 칸 표시
    const terms = canvas.getByRole('checkbox', { name: /Terms of Service/ })
    await waitFor(() => expect(terms).toHaveFocus())
    await expect(terms).toHaveAttribute('aria-invalid', 'true')
    await expect(canvas.getByRole('checkbox', { name: /product news/ })).not.toHaveAttribute(
      'aria-invalid',
    )
    // ④ 요약의 줄은 그 칸으로 데려간다
    await userEvent.click(canvas.getByLabelText(/^Password/))
    await userEvent.click(summary)
    await waitFor(() => expect(terms).toHaveFocus())
    // ⑤ 체크하면 바로 사라지고 제출된다
    await userEvent.click(terms)
    await waitFor(() =>
      expect(canvas.queryByRole('group', { name: 'Please check the following' })).toBeNull(),
    )
    await expect(terms).not.toHaveAttribute('aria-invalid')
    await userEvent.click(submit)
    await waitFor(() => expect(args.onSignUp).toHaveBeenCalledTimes(1))
  },
}

export const EmptyFormListsEverythingThatIsMissing: Story = {
  args: { consents: [{ id: 'terms', version: '2.0', label: 'Terms', required: true }] },
  play: async ({ canvas, args, userEvent }) => {
    await userEvent.click(canvas.getByRole('button', { name: 'Create account' }))
    await expect(args.onSignUp).not.toHaveBeenCalled()
    for (const name of [
      'Enter your email address',
      'Enter your password',
      'Agree to the required terms',
    ])
      await expect(await canvas.findByRole('button', { name })).toBeVisible()
    await waitFor(() => expect(canvas.getByLabelText(/Email/)).toHaveFocus()) // 첫 틀린 칸
    await expect(canvas.getByLabelText(/Email/)).toHaveAttribute('aria-invalid', 'true')
    // 이메일을 채우면 그 줄만 사라진다
    await userEvent.type(canvas.getByLabelText(/Email/), 'new@example.com')
    await waitFor(() =>
      expect(canvas.queryByRole('button', { name: 'Enter your email address' })).toBeNull(),
    )
    await expect(canvas.getByRole('button', { name: 'Enter your password' })).toBeVisible()
  },
}

export const ConfirmShowsMismatchLiveAndBlocksSubmit: Story = {
  play: async ({ canvas, args, userEvent }) => {
    await userEvent.type(canvas.getByLabelText(/Email/), 'new@example.com')
    await userEvent.type(canvas.getByLabelText(/^Password/), 'Correct-horse-battery-9')
    const confirm = canvas.getByLabelText(/^Confirm password/)
    // 건드리기 전에는 조용하다
    await expect(canvas.queryByText('Passwords do not match')).toBeNull()
    await userEvent.type(confirm, 'Correct-horse-battery-')
    await expect(await canvas.findByText('Passwords do not match')).toBeVisible()
    await expect(confirm).toHaveAttribute('aria-invalid', 'true')
    // 제출은 막히고 요약이 이유를 말한다
    await userEvent.click(canvas.getByRole('button', { name: 'Create account' }))
    await expect(args.onSignUp).not.toHaveBeenCalled()
    await expect(
      await canvas.findByRole('button', { name: 'Passwords do not match' }),
    ).toBeVisible()
    await waitFor(() => expect(confirm).toHaveFocus())
    // 맞게 고치면 일치 표시, 오류 · 요약은 사라진다
    await userEvent.type(confirm, '9')
    await expect(await canvas.findByText('Passwords match')).toBeVisible()
    await expect(canvas.queryByText('Passwords do not match')).toBeNull()
    // 비밀번호를 바꾸면 곧바로 다시 어긋난다
    await userEvent.type(canvas.getByLabelText(/^Password/), 'x')
    await expect((await canvas.findAllByText('Passwords do not match')).length).toBeGreaterThan(0)
  },
}

export const ConfirmFieldBehavesLikeAPasswordField: Story = {
  play: async ({ canvas, userEvent }) => {
    const password = canvas.getByLabelText(/^Password/)
    const confirm = canvas.getByLabelText(/^Confirm password/)
    await expect(password).toHaveAttribute('autocomplete', 'new-password')
    await expect(confirm).toHaveAttribute('autocomplete', 'new-password')
    await expect(confirm).toHaveAttribute('type', 'password')
    // 붙여넣기를 막지 않는다
    await userEvent.click(confirm)
    await userEvent.paste('Pasted-secret-1')
    await expect(confirm).toHaveValue('Pasted-secret-1')
    // 「보기」 하나가 두 칸을 함께 보인다
    await userEvent.type(password, 'abc')
    await userEvent.click(canvas.getByRole('button', { name: 'Show' }))
    await expect(password).toHaveAttribute('type', 'text')
    await expect(confirm).toHaveAttribute('type', 'text')
    await userEvent.click(canvas.getByRole('button', { name: 'Hide' }))
    await expect(confirm).toHaveAttribute('type', 'password')
  },
}

export const ConfirmValueIsNeverSentAndBothAreClearedAfterwards: Story = {
  args: {
    onSignUp: fn(async () => ({ status: 'VERIFICATION_SENT' as const, signUpId: 'sid-1' })),
  },
  play: async ({ canvas, args, userEvent }) => {
    await userEvent.type(canvas.getByLabelText(/Email/), 'new@example.com')
    await userEvent.type(canvas.getByLabelText(/^Password/), 'Correct-horse-battery-9')
    await userEvent.type(canvas.getByLabelText(/^Confirm password/), 'Correct-horse-battery-9')
    await userEvent.click(canvas.getByRole('button', { name: 'Create account' }))
    await waitFor(() => expect(args.onSignUp).toHaveBeenCalledTimes(1))
    const sent = (args.onSignUp as ReturnType<typeof fn>).mock.calls[0][0] as Record<
      string,
      unknown
    >
    await expect(Object.keys(sent).sort()).toEqual(['consents', 'email', 'password'])
    // 코드 단계에서 「처음부터」 로 돌아오면 두 칸 모두 비어 있다
    await userEvent.click(await canvas.findByRole('button', { name: 'Wrong address? Start over' }))
    await expect(await canvas.findByLabelText(/^Password/)).toHaveValue('')
    await expect(canvas.getByLabelText(/^Confirm password/)).toHaveValue('')
  },
}

export const ConfirmCanBeTurnedOff: Story = {
  args: { confirmPassword: false },
  play: async ({ canvas, args, userEvent }) => {
    await expect(canvas.queryByLabelText(/Confirm password/)).toBeNull()
    await userEvent.type(canvas.getByLabelText(/Email/), 'new@example.com')
    await userEvent.type(canvas.getByLabelText(/^Password/), 'Correct-horse-battery-9')
    await userEvent.click(canvas.getByRole('button', { name: 'Create account' }))
    await waitFor(() => expect(args.onSignUp).toHaveBeenCalledTimes(1))
  },
}

export const KoreanLabels: Story = {
  args: {
    labels: koAuthLabels,
    consents: [{ id: 'terms', version: '2.0', label: '이용약관에 동의', required: true }],
  },
  play: async ({ canvas, userEvent }) => {
    await userEvent.type(canvas.getByLabelText(/^비밀번호\s*\*?$/), 'Correct-horse-battery-9')
    await userEvent.type(canvas.getByLabelText(/^비밀번호 확인/), 'Correct-horse-battery-8')
    await expect(await canvas.findByText('비밀번호가 일치하지 않아요')).toBeVisible()
    await userEvent.click(canvas.getByRole('button', { name: '가입하기' }))
    await expect(
      await canvas.findByRole('button', { name: '필수 약관에 동의해 주세요' }),
    ).toBeVisible()
    await expect(canvas.getAllByText('아래 항목을 확인해 주세요').length).toBeGreaterThan(0)
  },
}

/** 닉네임 — `displayName="required"` 면 비우고 제출할 수 없다(요약 + 칸 오류 + 포커스). 앞뒤 공백은 떼고 보낸다 */
export const NicknameRequiredBlocksAnEmptyOne: Story = {
  args: { displayName: 'required' },
  play: async ({ canvas, args, userEvent }) => {
    const nickname = canvas.getByLabelText(/^Nickname/)
    await expect(canvas.getByLabelText(/^Nickname\s*\*/)).toBe(nickname) // 필수 표시(*)
    await userEvent.type(canvas.getByLabelText(/^Email/), 'new@example.com')
    await userEvent.type(canvas.getByLabelText(/^Password/), 'Correct-horse-battery-9')
    await userEvent.type(canvas.getByLabelText(/^Confirm password/), 'Correct-horse-battery-9')
    await userEvent.type(nickname, '   ')
    await userEvent.click(canvas.getByRole('button', { name: 'Create account' }))
    await expect(
      await canvas.findByText('Enter a nickname', { selector: 'p, span, div' }),
    ).toBeVisible()
    await expect(args.onSignUp).not.toHaveBeenCalled()
    await expect(nickname).toHaveFocus()
    await userEvent.type(nickname, '  수민  ')
    await userEvent.click(canvas.getByRole('button', { name: 'Create account' }))
    await waitFor(() =>
      expect(args.onSignUp).toHaveBeenCalledWith(expect.objectContaining({ displayName: '수민' })),
    )
  },
}

export const NicknameIsOptionalWhenAskedNicely: Story = {
  args: { displayName: 'optional' },
  play: async ({ canvas, args, userEvent }) => {
    await expect(canvas.getByLabelText(/^Nickname\s*$/)).toBeVisible() // 필수 표시(*)가 없다
    await userEvent.type(canvas.getByLabelText(/^Email/), 'new@example.com')
    await userEvent.type(canvas.getByLabelText(/^Password/), 'Correct-horse-battery-9')
    await userEvent.type(canvas.getByLabelText(/^Confirm password/), 'Correct-horse-battery-9')
    await userEvent.click(canvas.getByRole('button', { name: 'Create account' }))
    await waitFor(() => expect(args.onSignUp).toHaveBeenCalledTimes(1))
    await expect(args.onSignUp).toHaveBeenCalledWith(
      expect.not.objectContaining({ displayName: expect.anything() }),
    )
  },
}

/**
 * 닉네임 중복 금지(서버 선택 기능)에서 인증번호 단계가 409 를 받아도 **시도는 닫히지 않는다**(FINAL-5 R1) — 양식으로 돌려보내지 않고 그 자리에서 닉네임만 다시 입력받아
 * 같은 `signUpId` · 같은 인증번호로 다시 확인한다. 비밀번호는 다시 묻지 않고, 인증번호 남은 시간은 계속 흐른다.
 */
const verifyCalls: Array<[string, string, { displayName?: string } | undefined]> = []
const verifyWithNickname = async (
  signUpId: string,
  code: string,
  options?: { displayName?: string },
) => {
  verifyCalls.push([signUpId, code, options])
  if (options?.displayName === undefined || options.displayName === '수민')
    throw apiError('ACCOUNT.DISPLAY_NAME_TAKEN', 409)
  return undefined
}
export const NicknameTakenAtTheCodeStepAsksForAnotherInPlace: Story = {
  args: {
    displayName: 'required',
    labels: koAuthLabels,
    onVerifyCode: verifyWithNickname,
    onPendingChange: fn(),
  },
  beforeEach: () => {
    verifyCalls.length = 0
  },
  play: async ({ canvas, args, userEvent }) => {
    await userEvent.type(canvas.getByLabelText(/^이메일/), 'ann@example.com')
    await userEvent.type(canvas.getByLabelText(/^닉네임/), '수민')
    await userEvent.type(canvas.getByLabelText(/^비밀번호\s*\*?$/), 'Correct-horse-battery-9')
    await userEvent.type(canvas.getByLabelText(/^비밀번호 확인/), 'Correct-horse-battery-9')
    await userEvent.click(canvas.getByRole('button', { name: '가입하기' }))
    await canvas.findByLabelText('6자리 중 1번째')
    await userEvent.click(canvas.getByLabelText('6자리 중 1번째'))
    await userEvent.paste('123456')
    // 양식으로 돌아가지 않는다 — 인증번호 단계 그대로, 닉네임 칸만 작게 열린다
    const retry = await canvas.findByRole('form', { name: '닉네임' })
    await expect(within(retry).getByText('이미 쓰고 있는 닉네임이에요')).toBeVisible()
    await expect(canvas.queryByLabelText(/^비밀번호/)).toBeNull() // 비밀번호는 다시 묻지 않는다
    await expect(canvas.getByText(/^남은 시간 \d+:\d\d/)).toBeVisible() // 남은 시간은 계속 흐른다
    await expect(args.onPendingChange).not.toHaveBeenCalledWith(null)
    const field = within(retry).getByLabelText(/^닉네임/)
    await userEvent.clear(field)
    await userEvent.type(field, '다른수민')
    await userEvent.click(within(retry).getByRole('button', { name: '이 닉네임으로 계속' }))
    await waitFor(() => expect(args.onPendingChange).toHaveBeenLastCalledWith(null))
    // 같은 시도 · 같은 코드, 다른 닉네임
    await new Promise((resolve) => setTimeout(resolve, 300))
    await expect(verifyCalls).toEqual([
      ['sid-1', '123456', undefined], // 처음 한 번(겹침)
      ['sid-1', '123456', { displayName: '다른수민' }], // 같은 시도 · 같은 코드로 닉네임만 바꿔 다시
    ])
  },
}

/** 서버가 더 다시 보낼 수 없다고 알렸다(`resendAvailableAt: null`, FINAL-5 R2) — 「다시 받기」는 숨기고 안내, 시간이 다 되면 처음부터 */
export const CodeStepWithNoMoreResendsHidesTheButtonAndSaysWhatNext: Story = {
  args: codeArgs(),
  render: (args) => (
    <SignUpScreen
      {...args}
      initialPending={{
        email: 'ann@example.com',
        signUpId: 'sid-1',
        expiresAt: Date.now() + 2_000,
        resendExhausted: true,
      }}
    />
  ),
  play: async ({ canvas, userEvent }) => {
    await expect(
      await canvas.findByText(
        /This code cannot be sent again\. When it expires, please sign up again/,
      ),
    ).toBeVisible()
    await expect(canvas.queryByRole('button', { name: /Send a new code/ })).toBeNull()
    await expect(
      await canvas.findByRole('button', { name: 'Start over' }, { timeout: 6000 }),
    ).toBeVisible()
    await userEvent.click(canvas.getByRole('button', { name: 'Start over' }))
    await expect(await canvas.findByRole('button', { name: 'Create account' })).toBeVisible()
  },
}

export const NicknameTakenOnSubmitShowsUnderTheField: Story = {
  args: {
    displayName: 'required',
    onSignUp: fn(async () => {
      throw apiError('ACCOUNT.DISPLAY_NAME_TAKEN', 409)
    }),
  },
  play: async ({ canvas, userEvent }) => {
    await userEvent.type(canvas.getByLabelText(/^Email/), 'new@example.com')
    await userEvent.type(canvas.getByLabelText(/^Nickname/), 'Ann')
    await userEvent.type(canvas.getByLabelText(/^Password/), 'Correct-horse-battery-9')
    await userEvent.type(canvas.getByLabelText(/^Confirm password/), 'Correct-horse-battery-9')
    await userEvent.click(canvas.getByRole('button', { name: 'Create account' }))
    await expect(await canvas.findByText('That nickname is already taken.')).toBeVisible()
    await expect(canvas.getByLabelText(/^Nickname/)).toHaveFocus()
  },
}

/*
 * 로그인 아이디(서버가 켰을 때만 - 발견에 `loginId` 키가 있을 때 `loginId` prop 이 생긴다): 이메일 다음, 비밀번호 앞에 칸 하나와 실시간 확인.
 * 키가 없으면(꺼진 서버 · 옛 서버) 화면도 요청 본문도 지금과 같다. 인증번호 단계에서 아이디가 그 사이 나가면 그 자리에서 아이디만 다시 받는다.
 */
const idRules = { minLength: 4, maxLength: 20 }
type SignUpApi = ReturnType<typeof createFakeAccountApi>

/** 아이디를 켠 서버 - 가입 · 인증 · 실시간 확인이 모두 가짜 `AccountApi` 하나를 거친다(`onSignUp` · `onVerifyCode` 는 부른 값을 기록하는 `fn`) */
function WithLoginId(
  args: Parameters<typeof SignUpScreen>[0] & { width?: number; api?: SignUpApi },
) {
  const { width, api: given, onSignUp, onVerifyCode, ...rest } = args
  const api = useMemo(
    () =>
      given ??
      createFakeAccountApi({
        loginId: { ...idRules, taken: ['admin'], takenOnConfirm: ['racer'] },
      }),
    [given],
  )
  return (
    <div data-narrow="" style={width ? { width, maxWidth: '100%' } : undefined}>
      <SignUpScreen
        {...rest}
        labels={koAuthLabels}
        loginId={{ rules: idRules, api }}
        onSignUp={async (submit) => {
          onSignUp(submit)
          return api.signUp({ ...submit, consents: [] })
        }}
        onVerifyCode={async (signUpId, code, options) => {
          onVerifyCode(signUpId, code, options)
          return api.verifySignUpCode(signUpId, code, options)
        }}
      />
    </div>
  )
}
const withIdArgs = { onSignUp: fn(), onVerifyCode: fn(), onPendingChange: fn() }

const fillIdForm = async (
  canvas: Parameters<NonNullable<Story['play']>>[0]['canvas'],
  userEvent: Parameters<NonNullable<Story['play']>>[0]['userEvent'],
  loginId: string,
) => {
  await userEvent.type(canvas.getByLabelText(/^이메일/), 'ann@example.com')
  await userEvent.type(canvas.getByLabelText(/^아이디/), loginId)
  await userEvent.type(canvas.getByLabelText(/^비밀번호\s*\*?$/), 'Correct-horse-battery-9')
  await userEvent.type(canvas.getByLabelText(/^비밀번호 확인/), 'Correct-horse-battery-9')
}

/** 키가 없는 서버 - 아이디 칸이 없고, 요청 본문에도 `loginId` 가 없다(지금과 같다) */
export const LoginIdOffLeavesTheFormAsItWas: Story = {
  args: { ...codeArgs() },
  play: async ({ canvas, userEvent, args }) => {
    await expect(canvas.queryByLabelText(/Username/)).toBeNull()
    await expect(canvas.getByLabelText(/^Email/)).toHaveAttribute('autocomplete', 'email')
    await fillAndSubmit(canvas, userEvent)
    await waitFor(() => expect(args.onSignUp).toHaveBeenCalledTimes(1))
    const request = (args.onSignUp as ReturnType<typeof fn>).mock.calls[0][0]
    await expect(Object.keys(request)).not.toContain('loginId')
  },
}

export const LoginIdFieldBetweenEmailAndPassword: Story = {
  args: withIdArgs,
  render: (args) => <WithLoginId {...args} />,
  play: async ({ canvas, userEvent, args }) => {
    const email = canvas.getByLabelText(/^이메일/)
    const id = canvas.getByLabelText(/^아이디/)
    const password = canvas.getByLabelText(/^비밀번호\s*\*?$/)
    await expect(email.compareDocumentPosition(id) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy()
    await expect(
      id.compareDocumentPosition(password) & Node.DOCUMENT_POSITION_FOLLOWING,
    ).toBeTruthy()
    await expect(email).toHaveAttribute('autocomplete', 'email')
    await expect(id).toHaveAttribute('autocomplete', 'username')
    await fillIdForm(canvas, userEvent, 'Sumin.Kim')
    await expect(await canvas.findByText(/쓸 수 있는 아이디예요/)).toBeVisible()
    await expect(canvas.getByText(/sumin\.kim \(으\)로 저장돼요/)).toBeVisible()
    await userEvent.click(canvas.getByRole('button', { name: '가입하기' }))
    await waitFor(() =>
      expect(args.onSignUp).toHaveBeenCalledWith(
        expect.objectContaining({ email: 'ann@example.com', loginId: 'sumin.kim' }),
      ),
    )
    await expect(
      await canvas.findByRole('heading', { name: '인증번호 6자리를 입력해 주세요' }),
    ).toBeVisible()
  },
}

export const LoginIdTakenBlocksTheSubmit: Story = {
  args: withIdArgs,
  render: (args) => <WithLoginId {...args} />,
  play: async ({ canvas, userEvent, args }) => {
    await fillIdForm(canvas, userEvent, 'admin')
    const id = canvas.getByLabelText(/^아이디/)
    await waitFor(() => expect(id).toBeInvalid())
    await expect(
      canvas.getAllByText('이미 쓰고 있거나 쓸 수 없는 아이디예요').length,
    ).toBeGreaterThan(0)
    await userEvent.click(canvas.getByRole('button', { name: '가입하기' }))
    await expect(args.onSignUp).not.toHaveBeenCalled()
    await waitFor(() => expect(id).toHaveFocus()) // 첫 틀린 칸으로
  },
}

export const LoginIdFormatProblemOnSubmit: Story = {
  args: withIdArgs,
  render: (args) => <WithLoginId {...args} />,
  play: async ({ canvas, userEvent, args }) => {
    await fillIdForm(canvas, userEvent, 'ab')
    await userEvent.click(canvas.getByRole('button', { name: '가입하기' }))
    await expect(args.onSignUp).not.toHaveBeenCalled()
    await expect(await canvas.findAllByText('아이디는 4~20자로 정해 주세요')).not.toHaveLength(0)
  },
}

/** 실시간 확인은 「쓸 수 있다」였는데 서버가 가입 요청에서 409 - 같은 칸 옆 오류, 값을 고치면 사라진다 */
export const LoginIdServerConflictSitsBesideTheField: Story = {
  args: withIdArgs,
  render: (args) => {
    const api = {
      ...createFakeAccountApi({ loginId: idRules }),
      signUp: async () => {
        throw apiError('ACCOUNT.LOGIN_ID_TAKEN', 409)
      },
    } as SignUpApi
    return <WithLoginId {...args} api={api} />
  },
  play: async ({ canvas, userEvent }) => {
    await fillIdForm(canvas, userEvent, 'sumin.kim')
    await expect(await canvas.findByText(/쓸 수 있는 아이디예요/)).toBeVisible()
    await userEvent.click(canvas.getByRole('button', { name: '가입하기' }))
    const id = canvas.getByLabelText(/^아이디/)
    await waitFor(() => expect(id).toBeInvalid())
    await expect(
      canvas.getAllByText('이미 쓰고 있거나 쓸 수 없는 아이디예요').length,
    ).toBeGreaterThan(0)
    await waitFor(() => expect(id).toHaveFocus())
    await userEvent.type(id, '2')
    await waitFor(() => expect(id).not.toBeInvalid())
  },
}

/** 서버의 필드 오류(`errors[].field = loginId`)도 칸 옆에 - 서버의 영어 message 는 보이지 않는다 */
export const LoginIdServerFieldError: Story = {
  args: withIdArgs,
  render: (args) => {
    const api = {
      ...createFakeAccountApi({ loginId: idRules }),
      signUp: async () => {
        throw fieldError('loginId', 'Pattern', 'English from the server')
      },
    } as SignUpApi
    return <WithLoginId {...args} api={api} />
  },
  play: async ({ canvas, userEvent }) => {
    await fillIdForm(canvas, userEvent, 'sumin.kim')
    await userEvent.click(canvas.getByRole('button', { name: '가입하기' }))
    await waitFor(() => expect(canvas.getByLabelText(/^아이디/)).toBeInvalid())
    await expect(canvas.queryByText(/English from the server/)).toBeNull()
  },
}

/** 코드는 맞았는데 아이디가 그 사이 나갔다(409) - 양식으로 돌아가지 않고 그 자리에서 아이디만 다시 받아 같은 코드로 낸다 */
export const LoginIdTakenAtTheCodeStepAsksForAnotherInPlace: Story = {
  args: withIdArgs,
  render: (args) => <WithLoginId {...args} />,
  play: async ({ canvas, args, userEvent }) => {
    await fillIdForm(canvas, userEvent, 'racer')
    await userEvent.click(canvas.getByRole('button', { name: '가입하기' }))
    await canvas.findByLabelText('6자리 중 1번째')
    await userEvent.click(canvas.getByLabelText('6자리 중 1번째'))
    await userEvent.paste('123456')
    const retry = await canvas.findByRole('form', { name: '아이디' })
    await expect(within(retry).getByText(/그 사이 다른 분이 이 아이디를 정했어요/)).toBeVisible()
    await expect(
      within(retry).getAllByText('이미 쓰고 있거나 쓸 수 없는 아이디예요').length,
    ).toBeGreaterThan(0)
    await expect(canvas.queryByLabelText(/^비밀번호/)).toBeNull() // 비밀번호는 다시 묻지 않는다
    await expect(canvas.getByText(/^남은 시간 \d+:\d\d/)).toBeVisible()
    await expect(args.onPendingChange).not.toHaveBeenCalledWith(null)
    const field = within(retry).getByLabelText(/^아이디/)
    await userEvent.clear(field)
    await userEvent.type(field, 'racer.two')
    await expect(await within(retry).findByText(/쓸 수 있는 아이디예요/)).toBeVisible() // 실시간 확인이 여기서도
    await userEvent.click(within(retry).getByRole('button', { name: '이 아이디로 정하기' }))
    await waitFor(() => expect(args.onPendingChange).toHaveBeenLastCalledWith(null))
    // 같은 시도 · 같은 코드, 다른 아이디
    await expect(args.onVerifyCode).toHaveBeenNthCalledWith(1, 'sid-1', '123456', undefined)
    await expect(args.onVerifyCode).toHaveBeenNthCalledWith(2, 'sid-1', '123456', {
      loginId: 'racer.two',
    })
  },
}

/**
 * 인증번호 단계에서 아이디와 닉네임이 **둘 다** 겹쳤다 - 하나를 고치면 다음 답이 다른 쪽이다. 두 칸이 함께 열리고, 마지막 제출에는 둘 다 실린다(한쪽만 열고 막히지 않는다)
 */
const nameAndId = (order: 'id-first' | 'name-first') => {
  const calls: Array<{ loginId?: string; displayName?: string } | undefined> = []
  return {
    calls,
    api: (): SignUpApi => {
      const base = createFakeAccountApi({ loginId: idRules })
      return {
        ...base,
        verifySignUpCode: async (signUpId, code, replacement) => {
          calls.push(replacement)
          const idTaken = replacement?.loginId === undefined
          const nameTaken = replacement?.displayName === undefined
          if (order === 'id-first') {
            if (idTaken) throw apiError('ACCOUNT.LOGIN_ID_TAKEN', 409)
            if (nameTaken) throw apiError('ACCOUNT.DISPLAY_NAME_TAKEN', 409)
          } else {
            if (nameTaken) throw apiError('ACCOUNT.DISPLAY_NAME_TAKEN', 409)
            if (idTaken) throw apiError('ACCOUNT.LOGIN_ID_TAKEN', 409)
          }
          return base.verifySignUpCode(signUpId, code, replacement)
        },
      }
    },
  }
}

const toTheCodeStep = async (
  canvas: Parameters<NonNullable<Story['play']>>[0]['canvas'],
  userEvent: Parameters<NonNullable<Story['play']>>[0]['userEvent'],
) => {
  await userEvent.type(canvas.getByLabelText(/^이메일/), 'ann@example.com')
  await userEvent.type(canvas.getByLabelText(/^닉네임/), '수민')
  await userEvent.type(canvas.getByLabelText(/^아이디/), 'racer')
  await userEvent.type(canvas.getByLabelText(/^비밀번호\s*\*?$/), 'Correct-horse-battery-9')
  await userEvent.type(canvas.getByLabelText(/^비밀번호 확인/), 'Correct-horse-battery-9')
  await userEvent.click(canvas.getByRole('button', { name: '가입하기' }))
  await canvas.findByLabelText('6자리 중 1번째')
  await userEvent.click(canvas.getByLabelText('6자리 중 1번째'))
  await userEvent.paste('123456')
}

export const IdThenNicknameBothTakenAtTheCodeStep: Story = {
  args: { ...withIdArgs, displayName: 'required' },
  render: (args) => {
    const { api } = nameAndId('id-first')
    return <WithLoginId {...args} api={api()} />
  },
  play: async ({ canvas, args, userEvent }) => {
    await toTheCodeStep(canvas, userEvent)
    const idForm = await canvas.findByRole('form', { name: '아이디' })
    await userEvent.clear(within(idForm).getByLabelText(/^아이디/))
    await userEvent.type(within(idForm).getByLabelText(/^아이디/), 'racer.two')
    await within(idForm).findByText(/쓸 수 있는 아이디예요/)
    await userEvent.click(within(idForm).getByRole('button', { name: '이 아이디로 정하기' }))
    // 아이디는 받아들여졌고 이번엔 닉네임이 겹친다 - 닉네임 칸이 열린다(아이디 칸은 그대로)
    const nameForm = await canvas.findByRole('form', { name: '닉네임' })
    await expect(within(nameForm).getByText('이미 쓰고 있는 닉네임이에요')).toBeVisible()
    const field = within(nameForm).getByLabelText(/^닉네임/)
    await userEvent.clear(field)
    await userEvent.type(field, '다른수민')
    await userEvent.click(within(nameForm).getByRole('button', { name: '이 닉네임으로 계속' }))
    await waitFor(() => expect(args.onPendingChange).toHaveBeenLastCalledWith(null))
    // 마지막 제출에는 둘 다 실린다
    await expect(args.onVerifyCode).toHaveBeenLastCalledWith('sid-1', '123456', {
      displayName: '다른수민',
      loginId: 'racer.two',
    })
  },
}

export const NicknameThenIdBothTakenAtTheCodeStep: Story = {
  args: { ...withIdArgs, displayName: 'required' },
  render: (args) => {
    const { api } = nameAndId('name-first')
    return <WithLoginId {...args} api={api()} />
  },
  play: async ({ canvas, args, userEvent }) => {
    await toTheCodeStep(canvas, userEvent)
    const nameForm = await canvas.findByRole('form', { name: '닉네임' })
    const field = within(nameForm).getByLabelText(/^닉네임/)
    await userEvent.clear(field)
    await userEvent.type(field, '다른수민')
    await userEvent.click(within(nameForm).getByRole('button', { name: '이 닉네임으로 계속' }))
    // 닉네임은 받아들여졌고 이번엔 아이디가 겹친다 - 「문제가 생겼어요」가 닉네임 칸에 뜨지 않고 아이디 칸이 열린다
    const idForm = await canvas.findByRole('form', { name: '아이디' })
    await expect(
      within(idForm).getAllByText('이미 쓰고 있거나 쓸 수 없는 아이디예요').length,
    ).toBeGreaterThan(0)
    await expect(within(nameForm).queryByText(/문제가 생겼어요/)).toBeNull()
    const id = within(idForm).getByLabelText(/^아이디/)
    await userEvent.clear(id)
    await userEvent.type(id, 'racer.two')
    await within(idForm).findByText(/쓸 수 있는 아이디예요/)
    await userEvent.click(within(idForm).getByRole('button', { name: '이 아이디로 정하기' }))
    await waitFor(() => expect(args.onPendingChange).toHaveBeenLastCalledWith(null))
    await expect(args.onVerifyCode).toHaveBeenLastCalledWith('sid-1', '123456', {
      displayName: '다른수민',
      loginId: 'racer.two',
    })
  },
}

/** 서버가 409 로 「쓸 수 없다」고 한 값은, 고쳤다가 같은 값으로 되돌려도 「쓸 수 있어요」로 돌아오지 않는다 */
export const LoginIdServerConflictStaysTakenWhenTypedBack: Story = {
  args: withIdArgs,
  render: (args) => {
    const api = {
      ...createFakeAccountApi({ loginId: idRules }),
      signUp: async () => {
        throw apiError('ACCOUNT.LOGIN_ID_TAKEN', 409)
      },
    } as SignUpApi
    return <WithLoginId {...args} api={api} />
  },
  play: async ({ canvas, userEvent }) => {
    await fillIdForm(canvas, userEvent, 'sumin.kim')
    await expect(await canvas.findByText(/쓸 수 있는 아이디예요/)).toBeVisible()
    await userEvent.click(canvas.getByRole('button', { name: '가입하기' }))
    const id = canvas.getByLabelText(/^아이디/)
    await waitFor(() => expect(id).toBeInvalid())
    await userEvent.type(id, '2')
    await waitFor(() => expect(id).not.toBeInvalid())
    await userEvent.type(id, '{Backspace}') // 서버가 거절한 값으로 돌아왔다
    await waitFor(() => expect(id).toBeInvalid())
    await expect(canvas.queryByText(/쓸 수 있는 아이디예요/)).toBeNull()
  },
}

/** 375px · 320px - 긴 아이디 · 긴 안내도 가로로 밀리지 않는다 */
const noSidewaysScroll = async (canvasElement: HTMLElement) => {
  const box = canvasElement.querySelector<HTMLElement>('[data-narrow]')!
  await waitFor(() => expect(box.scrollWidth).toBeLessThanOrEqual(box.clientWidth))
}
export const LoginIdNarrow375: Story = {
  args: { ...withIdArgs, width: 375 } as never,
  render: (args) => <WithLoginId {...args} />,
  play: async ({ canvas, canvasElement, userEvent }) => {
    await userEvent.type(canvas.getByLabelText(/^아이디/), 'Sumin.Kim.With.A.Rather.Lng')
    await userEvent.tab()
    await canvas.findAllByRole('alert')
    await noSidewaysScroll(canvasElement)
  },
}
export const LoginIdNarrow320: Story = {
  args: { ...withIdArgs, width: 320 } as never,
  render: (args) => <WithLoginId {...args} />,
  play: async ({ canvas, canvasElement, userEvent }) => {
    await userEvent.type(canvas.getByLabelText(/^아이디/), 'Sumin.Kim.Lng')
    await expect(await canvas.findByText(/으\)로 저장돼요/)).toBeVisible()
    await noSidewaysScroll(canvasElement)
  },
}
