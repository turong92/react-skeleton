import { Button, Card, Field, Input } from '@skeleton/ui'
import type { Meta, StoryObj } from '@storybook/react-vite'
import { useState, type FormEvent } from 'react'
import { expect, fn, waitFor } from 'storybook/test'

/*
 * 로그인 화면 틀 — 이메일 · 비밀번호 · 제출 중 · 잘못된 계정 정보.
 * 복사해서 쓸 때: `onLogin` 은 `useAuth().login` 을 넘기고, `ErrorCodes.AUTH_INVALID_CREDENTIALS` 만 이 화면의 오류 문구로 바꾼다
 * (나머지 에러는 전역 에러 토스트). 어느 칸이 틀렸는지 알려 주지 않으려고 오류는 폼 전체 한 줄이다.
 */
const stack = { display: 'grid', gap: 'var(--space-lg)' } as const
const center = { maxWidth: '24rem', marginInline: 'auto' } as const

function LoginPage({
  onLogin,
}: {
  onLogin: (credentials: { email: string; password: string }) => Promise<void>
}) {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [pending, setPending] = useState(false)
  const [failed, setFailed] = useState(false)

  async function submit(event: FormEvent) {
    event.preventDefault()
    setPending(true)
    setFailed(false)
    try {
      await onLogin({ email, password })
    } catch {
      setFailed(true)
    } finally {
      setPending(false)
    }
  }

  return (
    <div style={center}>
      <Card title="Log in">
        <form onSubmit={submit} style={stack} aria-label="Log in">
          {failed && <p role="alert">The email or password is not correct.</p>}
          <Field label="Email" required>
            {(control) => (
              <Input
                {...control}
                type="email"
                autoComplete="username"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
              />
            )}
          </Field>
          <Field label="Password" required>
            {(control) => (
              <Input
                {...control}
                type="password"
                autoComplete="current-password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
              />
            )}
          </Field>
          <Button type="submit" loading={pending} loadingLabel="Logging in">
            Log in
          </Button>
        </form>
      </Card>
    </div>
  )
}

const meta = {
  title: 'Patterns/Login page',
  component: LoginPage,
  args: { onLogin: fn(async () => undefined) },
} satisfies Meta<typeof LoginPage>
export default meta
// 스토리가 plain 함수로 args 를 덮어쓸 수 있게 컴포넌트 props 로 타입을 잡는다
type Story = StoryObj<typeof LoginPage>

export const Default: Story = {
  play: async ({ canvas, args, userEvent }) => {
    await userEvent.type(canvas.getByLabelText(/Email/), 'demo@example.com')
    await userEvent.type(canvas.getByLabelText(/Password/), 'secret{Enter}') // Enter 로도 제출된다
    await expect(args.onLogin).toHaveBeenCalledWith({
      email: 'demo@example.com',
      password: 'secret',
    })
  },
}

export const InvalidCredentials: Story = {
  args: {
    onLogin: async () => {
      throw new Error('AUTH.INVALID_CREDENTIALS')
    },
  },
  play: async ({ canvas, userEvent }) => {
    await userEvent.type(canvas.getByLabelText(/Email/), 'demo@example.com')
    await userEvent.type(canvas.getByLabelText(/Password/), 'wrong')
    await userEvent.click(canvas.getByRole('button', { name: 'Log in' }))
    await expect(await canvas.findByRole('alert')).toHaveTextContent(
      'The email or password is not correct.',
    )
    await expect(canvas.getByRole('button', { name: 'Log in' })).toBeEnabled()
  },
}

export const Pending: Story = {
  args: { onLogin: () => new Promise<void>(() => undefined) },
  play: async ({ canvas, userEvent }) => {
    await userEvent.type(canvas.getByLabelText(/Email/), 'demo@example.com')
    await userEvent.type(canvas.getByLabelText(/Password/), 'secret')
    await userEvent.click(canvas.getByRole('button', { name: 'Log in' }))
    await waitFor(() => expect(canvas.getByRole('button', { name: /Log in/ })).toBeDisabled())
    await expect(canvas.getByRole('status')).toHaveTextContent('Logging in')
  },
}

export const Dark: Story = {
  globals: { theme: 'dark' },
  play: async ({ canvas }) => {
    await expect(canvas.getByRole('form', { name: 'Log in' })).toBeVisible()
  },
}
