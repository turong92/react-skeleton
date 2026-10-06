import type { Meta, StoryObj } from '@storybook/react-vite'
import { expect, fn, waitFor } from 'storybook/test'
import { SignUpScreen } from '../screens/SignUpScreen'
import { FAKE_POLICY, apiError } from '../stories/fakeAccountApi'
import { withRouter } from '../stories/withRouter'

/**
 * 가입 화면 — 비밀번호 규칙은 서버 정책(`GET /account/password/policy`)에서 읽어 체크리스트 · 강도 막대로 보여 준다.
 * 응답은 늘 같은 모양(서버가 주소의 존재를 숨긴다) — 메일로 받은 6자리 인증번호를 **같은 화면에서** 입력하면 가입이 끝나고 바로 로그인한다. 캡차(`renderCaptcha`)와 약관 동의(`consents`)는 슬롯이다 —
 * 동의는 체크한 판(`id` + `version`)을 콜백으로 보고한다(백엔드 동의 모듈은 아직 없다).
 */
const meta = {
  title: 'Patterns/Auth/Sign up',
  component: SignUpScreen,
  decorators: [withRouter],
  args: {
    policy: FAKE_POLICY,
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
    await userEvent.click(canvas.getByRole('button', { name: 'Create account' }))
    await expect(args.onSignUp).not.toHaveBeenCalled() // 슬롯이 아직 「완료」를 알리지 않았다
    await expect(await canvas.findByRole('alert')).toHaveTextContent('Needs the terms')
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
    await userEvent.click(canvas.getByRole('button', { name: 'Create account' }))
    // 서버만 아는 규칙(유출 검사)도 체크리스트에 올라온다
    await expect(await canvas.findByText(/Not in a known data breach/)).toBeVisible()
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
  play: async ({ canvas, userEvent, args }) => {
    await fillAndSubmit(canvas, userEvent)
    await userEvent.click(await canvas.findByRole('button', { name: 'Send a new code' }))
    await waitFor(() => {
      expect(args.onResendCode).toHaveBeenCalledTimes(1)
      expect(args.onResendCode).toHaveBeenCalledWith('sid-1')
    })
    await expect(await canvas.findByRole('button', { name: 'Send a new code' })).toBeDisabled()
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
