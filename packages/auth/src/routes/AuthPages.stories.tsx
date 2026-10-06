import type { Meta, StoryObj } from '@storybook/react-vite'
import { StrictMode } from 'react'
import { MemoryRouter, Route, Routes, useLocation } from 'react-router-dom'
import { expect, fn } from 'storybook/test'
import { createReauthStore } from '../reauth'
import { consumeReturnTo, rememberReturnTo } from '../returnTo'
import { createSocialLoginFlow } from '../social'
import { authStorageKeys } from '../storageKeys'
import { createFakeAccountApi } from '../stories/fakeAccountApi'
import { createFakeAuthApi } from '../stories/fakeAuthApi'
import { DEFAULT_AUTH_PATHS } from './createAuthRoutes'
import { ResetPage, SocialCallbackPage, type PageContext } from './pages'

/**
 * 라우트 페이지의 동작(렌더 밖의 일) — 소셜 콜백이 방법을 못 받았을 때의 오류 · 다시 시도, StrictMode 에서도 「가려던 곳」이 남는 이동,
 * 읽은 일회용 토큰 · 인가 코드가 주소창에서 지워지는 것. 실제 브라우저에서 돈다(effect · history).
 */
const meta = { title: 'Packages/Auth/Route pages' } satisfies Meta
export default meta
type Story = StoryObj<typeof meta>

const keys = authStorageKeys('stories')
const memoryStorage = () => {
  const data = new Map<string, string>()
  return {
    getItem: (k: string) => data.get(k) ?? null,
    setItem: (k: string, v: string) => void data.set(k, v),
    removeItem: (k: string) => void data.delete(k),
  }
}
const context = (overrides: Partial<PageContext> = {}): PageContext => ({
  authApi: createFakeAuthApi(),
  accountApi: createFakeAccountApi(),
  paths: DEFAULT_AUTH_PATHS,
  afterSignIn: '/',
  reauth: createReauthStore({}),
  keys,
  notes: { warned: false },
  ...overrides,
})
function Here() {
  const location = useLocation()
  return <p data-testid="here">{location.pathname}</p>
}

export const SocialCallbackWithoutProviderShowsErrorAndRetry: Story = {
  render: () => {
    const retry = fn()
    return (
      <MemoryRouter initialEntries={['/auth/callback?code=unused&state=s']}>
        <SocialCallbackPage
          ctx={context({ discovered: { status: 'failed', signUp: true, retry } })}
        />
      </MemoryRouter>
    )
  },
  play: async ({ canvas, userEvent }) => {
    // 백지가 아니다: 오류 + 다시 시도
    await expect(
      await canvas.findByRole('heading', { name: 'Sign-in did not finish' }),
    ).toBeVisible()
    await userEvent.click(canvas.getByRole('button', { name: 'Try again' }))
    await expect(canvas.getByRole('link', { name: /sign in/i })).toBeVisible()
  },
}

export const SocialCallbackProviderMissingShowsError: Story = {
  render: () => (
    <MemoryRouter initialEntries={['/auth/callback?code=unused&state=s']}>
      <SocialCallbackPage
        ctx={context({ discovered: { status: 'ready', signUp: true, retry: fn() } })}
      />
    </MemoryRouter>
  ),
  play: async ({ canvas }) => {
    await expect(
      await canvas.findByRole('heading', { name: 'Sign-in did not finish' }),
    ).toBeVisible()
    await expect(canvas.queryByRole('button', { name: 'Try again' })).toBeNull() // 방법을 받았는데 그 제공자가 없다 — 다시 물어도 같다
  },
}

export const SocialCallbackKeepsTheWantedPage: Story = {
  beforeEach: () => {
    sessionStorage.clear()
    rememberReturnTo('/notes', undefined, keys.returnTo)
  },
  render: () => {
    const storage = memoryStorage()
    const flow = createSocialLoginFlow({
      providers: { google: { clientId: 'c', redirectUri: 'https://app.test/auth/callback' } },
      session: {
        socialLogin: async () => ({
          accessToken: 't',
          tokenType: 'Bearer',
          expiresAt: '2099-01-01T00:00:00Z',
          principal: { accountId: 'a', roles: [] },
        }),
      },
      storage,
      createState: () => 'st',
    })
    flow.start('google')
    return (
      <StrictMode>
        <MemoryRouter initialEntries={['/auth/callback?code=c&state=st']}>
          <Routes>
            <Route
              path="/auth/callback"
              element={<SocialCallbackPage ctx={context({ socialFlow: flow })} />}
            />
            <Route path="*" element={<Here />} />
          </Routes>
        </MemoryRouter>
      </StrictMode>
    )
  },
  play: async ({ canvas }) => {
    // 이동은 effect 한 번 · 「가려던 곳」은 한 번 읽히고 거기로 간다(렌더에서 읽고 이동하던 옛 방식은 이 스토리가 실패한다)
    await expect(await canvas.findByTestId('here')).toHaveTextContent('/notes')
    await expect(consumeReturnTo('/fallback', undefined, keys.returnTo)).toBe('/fallback') // 한 번 읽으면 지워진다
  },
}

export const ResetPageScrubsTheTokenFromTheAddressBar: Story = {
  beforeEach: () => {
    const url = new URL(location.href)
    url.searchParams.set('token', 'secret-token')
    history.replaceState(history.state, '', url)
  },
  render: () => (
    <MemoryRouter initialEntries={['/reset-password?token=secret-token']}>
      <ResetPage ctx={context()} />
    </MemoryRouter>
  ),
  play: async ({ canvas }) => {
    // 화면은 토큰을 메모리에 쥐고 폼을 그린다
    await expect(await canvas.findByLabelText(/^New password/)).toBeVisible()
    // 주소창 · 히스토리에서는 지워졌다
    await expect(new URL(location.href).searchParams.has('token')).toBe(false)
    await expect(location.href).not.toContain('secret-token')
  },
}
