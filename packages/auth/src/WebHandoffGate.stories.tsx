import type { Meta, StoryObj } from '@storybook/react-vite'
import { useMemo } from 'react'
import { MemoryRouter, Outlet, Route, Routes, useLocation } from 'react-router-dom'
import { expect, fn } from 'storybook/test'
import { AuthProvider } from './AuthProvider'
import { RequireAuth } from './RequireAuth'
import { WebHandoffGate } from './screens/WebHandoffGate'
import { createAuthSession } from './session'
import { apiError } from './stories/fakeAccountApi'
import { createFakeAuthApi, DEMO_LOGIN, FAKE_ACCESS_TOKEN } from './stories/fakeAuthApi'
import { createTokenStore } from './tokenStore'

/**
 * 앱에서 「웹 결제」로 넘어온 주소(`/pricing#handoff=<코드>`)의 문지기. 로그인 가드(`RequireAuth`) **바깥**에서 코드를 읽어 라우터 위치에서 지우고, 한 번 바꿔 세션을 연 뒤 결제 화면을 보인다.
 * 이미 로그인한 브라우저면 묻고, 쓸 수 없는 코드(410)면 안내 + 로그인 링크 — 그 링크로 나가면 문이 열려 로그인 화면이 그려진다.
 */
function Where() {
  const { search, hash } = useLocation()
  return <p data-testid="where">{`${search}|${hash}`}</p>
}

function Pay() {
  return (
    <>
      <h2>Pay page</h2>
      <Where />
    </>
  )
}

function Login() {
  const back = (useLocation().state as { from?: { hash: string } } | null)?.from
  return (
    <>
      <h2>Login page</h2>
      <p data-testid="came-back">{`came:${back?.hash}`}</p>
    </>
  )
}

function GateLayout({ redeem }: { redeem: (code: string) => Promise<unknown> }) {
  return (
    <WebHandoffGate onRedeem={redeem} signInTo="/login">
      <Outlet />
    </WebHandoffGate>
  )
}

function Demo({
  entry,
  signedIn = false,
  redeem,
}: {
  entry: string
  signedIn?: boolean
  redeem: (code: string) => Promise<unknown>
}) {
  const { session, onRedeem } = useMemo(() => {
    const store = createTokenStore()
    if (signedIn) store.set(FAKE_ACCESS_TOKEN)
    const made = createAuthSession({ api: createFakeAuthApi(), store })
    return {
      session: made,
      onRedeem: async (code: string) => {
        await redeem(code)
        await made.login(DEMO_LOGIN) // 교환이 성공하면 세션이 열린다
      },
    }
  }, [signedIn, redeem])
  return (
    <AuthProvider session={session}>
      <MemoryRouter initialEntries={[entry]}>
        <Routes>
          <Route element={<GateLayout redeem={onRedeem} />}>
            <Route element={<RequireAuth redirectTo="/login" />}>
              <Route path="/pricing" element={<Pay />} />
            </Route>
            <Route path="/login" element={<Login />} />
          </Route>
        </Routes>
      </MemoryRouter>
    </AuthProvider>
  )
}

const meta = {
  title: 'Packages/auth/WebHandoffGate',
} satisfies Meta
export default meta
type Story = StoryObj<typeof meta>

const ENTRY = '/pricing?plan=a#handoff=c1&x=1'

/** 로그인 안 한 브라우저 - 코드를 바꿔 로그인한 뒤 결제 화면. 코드는 주소(라우터 위치)에서 사라지고 나머지는 남는다 */
const redeemed = fn(async () => undefined)
export const SignsInThenShowsPayment: Story = {
  beforeEach: () => redeemed.mockClear(),
  render: () => <Demo entry={ENTRY} redeem={redeemed} />,
  play: async ({ canvas }) => {
    await expect(await canvas.findByRole('heading', { name: 'Pay page' })).toBeVisible()
    await expect(redeemed).toHaveBeenCalledTimes(1)
    await expect(redeemed).toHaveBeenCalledWith('c1')
    await expect(canvas.getByTestId('where')).toHaveTextContent('?plan=a|#x=1')
  },
}

/** 만료 · 이미 씀 · 앱 세션이 닫힘(410) - 안내와 로그인 링크. 링크로 나가면 문이 열려 로그인 화면이 그려지고, 돌아올 위치에 코드가 없다 */
export const ExpiredCodeThenSignInLink: Story = {
  render: () => (
    <Demo
      entry={ENTRY}
      redeem={async () => {
        throw apiError('ACCOUNT.TOKEN_INVALID', 410)
      }}
    />
  ),
  play: async ({ canvas, userEvent }) => {
    await expect(
      await canvas.findByRole('heading', { name: 'This link no longer works' }),
    ).toBeVisible()
    await userEvent.click(canvas.getByRole('link', { name: 'Sign in' }))
    await expect(await canvas.findByRole('heading', { name: 'Login page' })).toBeVisible()
    await expect(canvas.getByTestId('came-back')).not.toHaveTextContent('handoff')
  },
}

/** 이미 로그인해 있다 - 묻지 않고 바꾸지 않는다. 취소하면 코드를 버리고 지금 화면 */
const notCalled = fn(async () => undefined)
export const SignedInIsAskedAndCanCancel: Story = {
  beforeEach: () => notCalled.mockClear(),
  render: () => <Demo entry={ENTRY} signedIn redeem={notCalled} />,
  play: async ({ canvas, userEvent }) => {
    await expect(
      await canvas.findByRole('heading', { name: 'Continue with the account from the app?' }),
    ).toBeVisible()
    await expect(notCalled).not.toHaveBeenCalled()
    await userEvent.click(canvas.getByRole('button', { name: 'Cancel' }))
    await expect(await canvas.findByRole('heading', { name: 'Pay page' })).toBeVisible()
    await expect(notCalled).not.toHaveBeenCalled()
    await expect(canvas.getByTestId('where')).toHaveTextContent('?plan=a|#x=1')
  },
}

/** 계속하면 이 기기에서 먼저 나가고 앱의 계정으로 코드를 바꾼다 */
const continued = fn(async () => undefined)
export const SignedInContinues: Story = {
  beforeEach: () => continued.mockClear(),
  render: () => <Demo entry={ENTRY} signedIn redeem={continued} />,
  play: async ({ canvas, userEvent }) => {
    await userEvent.click(await canvas.findByRole('button', { name: 'Sign out and continue' }))
    await expect(await canvas.findByRole('heading', { name: 'Pay page' })).toBeVisible()
    await expect(continued).toHaveBeenCalledWith('c1')
  },
}

/** 코드가 없으면 문지기는 아무것도 하지 않는다 */
const idle = fn(async () => undefined)
export const NoCodeDoesNothing: Story = {
  beforeEach: () => idle.mockClear(),
  render: () => <Demo entry="/pricing" signedIn redeem={idle} />,
  play: async ({ canvas }) => {
    await expect(await canvas.findByRole('heading', { name: 'Pay page' })).toBeVisible()
    await expect(idle).not.toHaveBeenCalled()
  },
}
