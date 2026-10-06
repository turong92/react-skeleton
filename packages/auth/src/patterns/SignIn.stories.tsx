import type { Meta, StoryObj } from '@storybook/react-vite'
import { expect, fn, waitFor } from 'storybook/test'
import { SignInScreen } from '../screens/SignInScreen'
import { apiError } from '../stories/fakeAccountApi'
import { withRouter } from '../stories/withRouter'

/**
 * 로그인 화면 — 켜 둔 방법(`methods`)만 그린다: 비밀번호 폼 · 소셜 버튼 · 이메일 링크. 앱이 설정 한 곳에서 방법을 더하고 뺀다.
 * 실패는 던지면 화면이 문구로 바꾼다(`AUTH.*` 코드 → 한 문장, 429 는 카운트다운). 문구는 `labels` prop(기본 영어)로 앱이 번역해 넘긴다.
 */
const meta = {
  title: 'Patterns/Auth/Sign in',
  component: SignInScreen,
  decorators: [withRouter],
  args: {
    signUpTo: '/sign-up',
    forgotPasswordTo: '/forgot-password',
    onPasswordSignIn: fn(async () => undefined),
    onMagicLinkRequest: fn(async () => undefined),
    onSocialSignIn: fn(),
  },
} satisfies Meta<typeof SignInScreen>
export default meta
type Story = StoryObj<typeof SignInScreen>

export const PasswordOnly: Story = {
  play: async ({ canvas, args, userEvent }) => {
    await expect(canvas.queryByRole('button', { name: /Continue with/ })).toBeNull()
    await expect(canvas.queryByRole('button', { name: 'Email me a sign-in link' })).toBeNull()
    await userEvent.type(canvas.getByLabelText(/Email/), 'ann@example.com')
    await userEvent.type(canvas.getByLabelText(/^Password/), 'secret-pass{Enter}')
    await expect(args.onPasswordSignIn).toHaveBeenCalledWith({
      email: 'ann@example.com',
      password: 'secret-pass',
    })
  },
}

/** 「보기」 토글은 입력칸 옆 같은 줄에 — 좁은 화면(20rem)에서도 아래로 밀려 내려가지 않는다 */
export const PasswordToggleBesideInput: Story = {
  decorators: [
    (Story) => (
      <div style={{ width: '20rem' }}>
        <Story />
      </div>
    ),
  ],
  play: async ({ canvas, userEvent }) => {
    const input = canvas.getByLabelText(/^Password/)
    const toggle = canvas.getByRole('button', { name: 'Show' })
    const box = input.getBoundingClientRect()
    const button = toggle.getBoundingClientRect()
    await expect(button.top).toBeGreaterThanOrEqual(box.top - 1)
    await expect(button.bottom).toBeLessThanOrEqual(box.bottom + 1)
    await expect(button.left).toBeGreaterThanOrEqual(box.right - 1)
    await expect(button.right).toBeLessThanOrEqual(
      (input.closest('form') as HTMLElement).getBoundingClientRect().right + 1,
    )
    await userEvent.click(toggle)
    await expect(input).toHaveAttribute('type', 'text')
  },
}

export const AllMethods: Story = {
  args: { methods: { magicLink: true, social: [{ provider: 'google' }, { provider: 'kakao' }] } },
  play: async ({ canvas, args, userEvent }) => {
    await userEvent.click(canvas.getByRole('button', { name: 'Continue with Kakao' }))
    await expect(args.onSocialSignIn).toHaveBeenCalledWith('kakao')
    // 이메일 링크로 바꾸면 비밀번호 칸이 사라진다
    await userEvent.click(canvas.getByRole('button', { name: 'Email me a sign-in link' }))
    await expect(canvas.queryByLabelText(/^Password/)).toBeNull()
    await userEvent.type(canvas.getByLabelText(/Email/), 'ann@example.com')
    await userEvent.click(canvas.getByRole('button', { name: 'Send the link' }))
    await expect(args.onMagicLinkRequest).toHaveBeenCalledWith('ann@example.com')
    await expect(await canvas.findByRole('heading', { name: 'Check your email' })).toBeVisible()
    await expect(canvas.getByText(/ann@example.com/)).toBeVisible()
  },
}

export const MagicLinkOnly: Story = {
  args: { methods: { password: false, magicLink: true } },
  play: async ({ canvas }) => {
    await expect(canvas.queryByLabelText(/^Password/)).toBeNull()
    await expect(canvas.getByRole('button', { name: 'Send the link' })).toBeVisible()
  },
}

export const InvalidCredentials: Story = {
  args: {
    onPasswordSignIn: async () => {
      throw apiError('AUTH.INVALID_CREDENTIALS', 401)
    },
  },
  play: async ({ canvas, userEvent }) => {
    await userEvent.type(canvas.getByLabelText(/Email/), 'ann@example.com')
    await userEvent.type(canvas.getByLabelText(/^Password/), 'wrong{Enter}')
    await expect(await canvas.findByRole('alert')).toHaveTextContent(
      'The email or password is not correct.',
    )
  },
}

/** 인증 안 된 계정은 이제 만들어지지 않는다(가입은 인증번호로 끝나야 계정이 생긴다) — 남은 옛 계정에는 안내만 한다 */
export const EmailNotVerified: Story = {
  args: {
    onPasswordSignIn: async () => {
      throw apiError('AUTH.EMAIL_NOT_VERIFIED', 403)
    },
  },
  play: async ({ canvas, userEvent }) => {
    await userEvent.type(canvas.getByLabelText(/Email/), 'ann@example.com')
    await userEvent.type(canvas.getByLabelText(/^Password/), 'right-pass{Enter}')
    await expect(await canvas.findByRole('alert')).toHaveTextContent(/Sign up again/)
    await expect(canvas.queryByRole('button', { name: /Resend/ })).toBeNull()
  },
}

export const RateLimited: Story = {
  args: {
    onPasswordSignIn: async () => {
      throw apiError('AUTH.TOO_MANY_ATTEMPTS', 429, { retryAfterSeconds: 30 })
    },
  },
  play: async ({ canvas, userEvent }) => {
    await userEvent.type(canvas.getByLabelText(/Email/), 'ann@example.com')
    await userEvent.type(canvas.getByLabelText(/^Password/), 'x{Enter}')
    await expect(await canvas.findByRole('alert')).toHaveTextContent('Try again in 30 s.')
    // 기다리는 동안 제출은 막힌다
    await waitFor(() =>
      expect(canvas.getByRole('button', { name: /Try again in \d+ s/ })).toBeDisabled(),
    )
  },
}

export const Dark: Story = {
  globals: { theme: 'dark' },
  args: { methods: { magicLink: true, social: [{ provider: 'google' }] } },
  play: async ({ canvas }) => {
    await expect(canvas.getByRole('form', { name: 'Sign in' })).toBeVisible()
  },
}
