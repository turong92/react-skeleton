import type { Meta, StoryObj } from '@storybook/react-vite'
import { expect, fn, waitFor } from 'storybook/test'
import { koAuthLabels } from '../screens/labels.ko'
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

/* 인증번호 남은 시간 — 서버가 만료 시각을 안 줘서(오늘 백엔드) 가입 직후는 문서화된 10분으로 **어림**하고 `data-expiry-source="estimate"` 로 남긴다 */
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

/** 서버는 **만료된 시도의 다시 받기를 조용히 무시**한다 — 그래서 가입은 시간이 다 되면 「다시 받기」가 처음부터 다시(주소는 남는다)로 이어진다 */
export const CodeStepExpiredLocksAndFocusesTheRestart: Story = {
  args: codeArgs(),
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
    await expect(args.onResendCode).not.toHaveBeenCalled() // 서버가 어차피 무시하는 호출을 하지 않는다
    await expect(await canvas.findByLabelText(/^Email/)).toHaveValue('ann@example.com')
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
    await expect(summary.closest('[role="alert"]')).toHaveTextContent('Please check the following')
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
    await waitFor(() => expect(canvas.queryByText('Please check the following')).toBeNull())
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
    await expect(canvas.getByText('아래 항목을 확인해 주세요')).toBeVisible()
  },
}
