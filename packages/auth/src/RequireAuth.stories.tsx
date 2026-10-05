import { Button } from '@skeleton/ui'
import type { Meta, StoryObj } from '@storybook/react-vite'
import { useMemo } from 'react'
import { MemoryRouter, Route, Routes, useLocation, useNavigate } from 'react-router-dom'
import { expect, waitFor } from 'storybook/test'
import { AuthProvider } from './AuthProvider'
import { RequireAuth } from './RequireAuth'
import { createAuthSession } from './session'
import { createFakeAuthApi, DEMO_LOGIN, FAKE_ACCESS_TOKEN } from './stories/fakeAuthApi'
import { createTokenStore } from './tokenStore'
import { useAuth } from './useAuth'

/**
 * 라우트 가드. 로그인한 사람만 아래 라우트를 보고, 아니면 `redirectTo`(기본 `/login`)로 보내며 돌아올 위치를 `location.state.from` 에 담는다.
 * 레이아웃 라우트의 `element: <RequireAuth />` 로 쓰는 것이 정본이다. 세션은 가짜 `AuthApi`(`stories/fakeAuthApi.ts`) 위에서 돈다.
 */
function Login() {
  const { login } = useAuth()
  const navigate = useNavigate()
  const from = (useLocation().state as { from?: { pathname: string } } | null)?.from?.pathname
  return (
    <>
      <h2>Login page</h2>
      {from && <p>Came from {from}</p>}
      <Button
        onClick={async () => {
          await login(DEMO_LOGIN)
          navigate(from ?? '/secret', { replace: true }) // 돌아올 위치로
        }}
      >
        Log in as demo
      </Button>
    </>
  )
}

function Secret() {
  const { principal, logout } = useAuth()
  return (
    <>
      <h2>Secret page</h2>
      <p>Signed in as {principal?.email}</p>
      <Button variant="ghost" onClick={logout}>
        Log out
      </Button>
    </>
  )
}

function Demo({ signedIn }: { signedIn: boolean }) {
  const session = useMemo(() => {
    const store = createTokenStore()
    if (signedIn) store.set(FAKE_ACCESS_TOKEN)
    return createAuthSession({ api: createFakeAuthApi(), store })
  }, [signedIn])
  return (
    <AuthProvider session={session}>
      <MemoryRouter initialEntries={['/secret']}>
        <Routes>
          <Route element={<RequireAuth redirectTo="/login" />}>
            <Route path="/secret" element={<Secret />} />
          </Route>
          <Route path="/login" element={<Login />} />
        </Routes>
      </MemoryRouter>
    </AuthProvider>
  )
}

const meta = {
  title: 'Packages/auth/RequireAuth',
  component: RequireAuth,
} satisfies Meta<typeof RequireAuth>
export default meta
type Story = StoryObj<typeof meta>

export const AnonymousIsSentToLogin: Story = {
  render: () => <Demo signedIn={false} />,
  play: async ({ canvas }) => {
    await expect(await canvas.findByRole('heading', { name: 'Login page' })).toBeVisible()
    await expect(canvas.getByText('Came from /secret')).toBeVisible()
    await expect(canvas.queryByText('Secret page')).toBeNull()
  },
}

export const AuthenticatedSeesTheRoute: Story = {
  render: () => <Demo signedIn />,
  play: async ({ canvas }) => {
    await waitFor(() => expect(canvas.getByRole('heading', { name: 'Secret page' })).toBeVisible())
    await expect(canvas.getByText('Signed in as demo@example.com')).toBeVisible()
  },
}

export const LoginThenLogout: Story = {
  render: () => <Demo signedIn={false} />,
  play: async ({ canvas, userEvent }) => {
    await userEvent.click(await canvas.findByRole('button', { name: 'Log in as demo' }))
    await expect(await canvas.findByRole('heading', { name: 'Secret page' })).toBeVisible()
    await userEvent.click(canvas.getByRole('button', { name: 'Log out' }))
    await expect(await canvas.findByRole('heading', { name: 'Login page' })).toBeVisible()
  },
}
