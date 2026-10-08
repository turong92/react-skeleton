import type { Meta, StoryObj } from '@storybook/react-vite'
import { expect, fn, waitFor } from 'storybook/test'
import { koAuthLabels } from '../screens/labels.ko'
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

/** 비어 있는 채로 「로그인」 — 서버로 가지 않고, 이유가 버튼 위에 뜨고, 첫 빈 칸으로 포커스가 간다 */
export const EmptySubmitExplainsItself: Story = {
  play: async ({ canvas, args, userEvent }) => {
    await userEvent.click(canvas.getByRole('button', { name: 'Sign in' }))
    await expect(args.onPasswordSignIn).not.toHaveBeenCalled()
    await expect(
      await canvas.findByRole('button', { name: 'Enter your email address' }),
    ).toBeVisible()
    await expect(canvas.getByRole('button', { name: 'Enter your password' })).toBeVisible()
    await waitFor(() => expect(canvas.getByLabelText(/Email/)).toHaveFocus())
    await userEvent.type(canvas.getByLabelText(/Email/), 'ann@example.com')
    await userEvent.click(canvas.getByRole('button', { name: 'Enter your password' }))
    await waitFor(() => expect(canvas.getByLabelText(/^Password/)).toHaveFocus())
  },
}

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

/** 글로벌 서비스: Google · LINE · X — 버튼과 순서는 `GET /auth/methods` 가 정하고, 마크는 제공자 코드로 붙는다(모르는 코드는 중립 마크) */
export const GlobalProviders: Story = {
  args: {
    methods: {
      social: [
        { provider: 'google' },
        { provider: 'line' },
        { provider: 'x' },
        { provider: 'acme-sso' },
      ],
    },
  },
  play: async ({ canvas, args, userEvent }) => {
    const buttons = canvas.getAllByRole('button', { name: /^Continue with/ })
    await expect(buttons.map((b) => b.textContent)).toEqual([
      'Continue with Google',
      'Continue with LINE',
      'Continue with X',
      'Continue with acme-sso',
    ])
    for (const button of buttons) await expect(button.querySelector('svg')).not.toBeNull()
    await userEvent.click(canvas.getByRole('button', { name: 'Continue with X' }))
    await expect(args.onSocialSignIn).toHaveBeenCalledWith('x')
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
  args: {
    methods: {
      magicLink: true,
      social: [{ provider: 'google' }, { provider: 'line' }, { provider: 'x' }],
    },
  },
  play: async ({ canvas }) => {
    await expect(canvas.getByRole('form', { name: 'Sign in' })).toBeVisible()
  },
}

/**
 * 로그인 아이디를 켠 서버(발견에 `loginId` 키) — 칸이 「Username or email」 이고 `type="text"`(브라우저의 이메일 검사가 아이디를 막지 않는다).
 * 입력을 본문으로 바꾸는 곳은 한 군데: `@` 가 있으면 `email`, 없으면 `username`(trim). 비밀번호 찾기 옆에 밑줄 링크 「아이디 찾기」. 키가 없으면 위의 이메일 로그인 그대로
 */
export const LoginIdOnEmailOrId: Story = {
  args: { loginId: true, forgotLoginIdTo: '/forgot-id' },
  play: async ({ canvas, args, userEvent }) => {
    const field = canvas.getByLabelText(/Username or email/)
    await expect(field).toHaveAttribute('type', 'text')
    await expect(canvas.queryByLabelText(/^Email/)).toBeNull()
    // 아이디 - `username`, 앞뒤 공백은 없앤다(대문자 · 정규화는 서버)
    await userEvent.type(field, '  Sumin.Kim ')
    await userEvent.type(canvas.getByLabelText(/^Password/), 'secret-pass{Enter}')
    await expect(args.onPasswordSignIn).toHaveBeenLastCalledWith({
      username: 'Sumin.Kim',
      password: 'secret-pass',
    })
    // 이메일 - `email`
    await userEvent.clear(field)
    await userEvent.type(field, 'ann@example.com')
    await userEvent.click(canvas.getByRole('button', { name: 'Sign in' }))
    await expect(args.onPasswordSignIn).toHaveBeenLastCalledWith({
      email: 'ann@example.com',
      password: 'secret-pass',
    })
  },
}

/** 아이디를 켠 칸은 글자 칸이라 브라우저가 해 주던 앞뒤 공백 제거가 없다 - 모바일 자동완성이 붙인 공백이 400 이 되지 않게 이메일도 다듬어 보낸다(링크 요청도) */
export const LoginIdOnTrimsSpacesAroundAnEmail: Story = {
  args: { loginId: true, forgotLoginIdTo: '/forgot-id', methods: { magicLink: true } },
  play: async ({ canvas, args, userEvent }) => {
    const field = canvas.getByLabelText(/Username or email/)
    await expect(field).toHaveAttribute('autocapitalize', 'none')
    await expect(field).toHaveAttribute('spellcheck', 'false')
    await userEvent.type(field, 'ann@example.com ')
    await userEvent.type(canvas.getByLabelText(/^Password/), 'secret-pass{Enter}')
    await expect(args.onPasswordSignIn).toHaveBeenLastCalledWith({
      email: 'ann@example.com',
      password: 'secret-pass',
    })
    await userEvent.click(canvas.getByRole('button', { name: 'Email me a sign-in link' }))
    await userEvent.click(canvas.getByRole('button', { name: 'Send the link' }))
    await expect(args.onMagicLinkRequest).toHaveBeenLastCalledWith('ann@example.com')
  },
}

export const LoginIdOnForgotLinks: Story = {
  args: { loginId: true, forgotLoginIdTo: '/forgot-id' },
  play: async ({ canvas }) => {
    const idLink = canvas.getByRole('link', { name: 'Forgot your username?' })
    await expect(idLink).toHaveAttribute('href', '/forgot-id')
    await expect(getComputedStyle(idLink).textDecorationLine).toBe('underline')
    await expect(canvas.getByRole('link', { name: 'Forgot your password?' })).toHaveAttribute(
      'href',
      '/forgot-password',
    )
  },
}

/** 켜져 있어도 링크를 걸 곳을 안 주면 링크는 없다. 꺼져 있으면(`loginId` 없음) 주어도 없다 */
export const LoginIdLinkOnlyWhenOnAndGiven: Story = {
  args: { loginId: false, forgotLoginIdTo: '/forgot-id' },
  play: async ({ canvas }) => {
    await expect(canvas.queryByRole('link', { name: 'Forgot your username?' })).toBeNull()
    await expect(canvas.getByLabelText(/^Email/)).toHaveAttribute('type', 'email')
  },
}

/** 아이디를 켜도 이메일 링크 방식은 주소로 보내는 것이라 `@` 가 없으면 서버에 묻지 않고 「이메일을 입력해 주세요」 */
export const LoginIdOnMagicLinkNeedsAnEmail: Story = {
  args: {
    loginId: true,
    forgotLoginIdTo: '/forgot-id',
    labels: koAuthLabels,
    methods: { magicLink: true },
  },
  play: async ({ canvas, args, userEvent }) => {
    await userEvent.click(canvas.getByRole('button', { name: '이메일로 로그인 링크 받기' }))
    await userEvent.type(canvas.getByLabelText(/아이디 또는 이메일/), 'sumin.kim')
    await userEvent.click(canvas.getByRole('button', { name: '링크 보내기' }))
    await expect(args.onMagicLinkRequest).not.toHaveBeenCalled()
    await expect(
      await canvas.findByRole('button', { name: '이메일을 입력해 주세요' }),
    ).toBeVisible()
    await userEvent.clear(canvas.getByLabelText(/아이디 또는 이메일/))
    await userEvent.type(canvas.getByLabelText(/아이디 또는 이메일/), 'sumin@kim.dev')
    await userEvent.click(canvas.getByRole('button', { name: '링크 보내기' }))
    await expect(args.onMagicLinkRequest).toHaveBeenCalledWith('sumin@kim.dev')
  },
}

/** 비어 있으면 「아이디 또는 이메일을 입력해 주세요」, 첫 빈 칸으로 포커스 */
export const LoginIdOnEmptySubmitExplainsItself: Story = {
  args: { loginId: true, forgotLoginIdTo: '/forgot-id', labels: koAuthLabels },
  play: async ({ canvas, args, userEvent }) => {
    await userEvent.click(canvas.getByRole('button', { name: '로그인' }))
    await expect(args.onPasswordSignIn).not.toHaveBeenCalled()
    await expect(
      await canvas.findByRole('button', { name: '아이디 또는 이메일을 입력해 주세요' }),
    ).toBeVisible()
    await waitFor(() => expect(canvas.getByLabelText(/아이디 또는 이메일/)).toHaveFocus())
  },
}

/** 375px · 320px - 두 링크와 방법 바꾸기 단추가 가로로 밀리지 않고 줄을 바꾼다 */
const narrow = (width: number): Story => ({
  args: {
    loginId: true,
    forgotLoginIdTo: '/forgot-id',
    labels: koAuthLabels,
    methods: { magicLink: true, social: [{ provider: 'google' }] },
  },
  decorators: [
    (Story) => (
      <div data-narrow style={{ width, maxWidth: '100%' }}>
        <Story />
      </div>
    ),
  ],
  play: async ({ canvas, canvasElement }) => {
    await expect(canvas.getByRole('link', { name: '아이디 찾기' })).toBeVisible()
    const box = canvasElement.querySelector<HTMLElement>('[data-narrow]')!
    await expect(box.scrollWidth).toBeLessThanOrEqual(box.clientWidth)
  },
})
export const LoginIdNarrow375: Story = narrow(375)
export const LoginIdNarrow320: Story = narrow(320)
