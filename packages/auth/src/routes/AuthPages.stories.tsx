import type { Meta, StoryObj } from '@storybook/react-vite'
import { createOnceRunner } from '../screens/runOnce'
import { StrictMode } from 'react'
import { MemoryRouter, Route, Routes, useLocation } from 'react-router-dom'
import { expect, fn } from 'storybook/test'
import { AuthProvider } from '../AuthProvider'
import { createAuthSession } from '../session'
import { createSocialLinkFlow, type SocialLinkContext } from '../socialLink'
import { createTokenStore } from '../tokenStore'
import { consumeReturnTo, rememberReturnTo } from '../returnTo'
import { createSocialLoginFlow } from '../social'
import { authStorageKeys } from '../storageKeys'
import { createFakeAccountApi } from '../stories/fakeAccountApi'
import { DEFAULT_AUTH_PATHS } from './createAuthRoutes'
import { createFakeAuthApi, FAKE_ACCESS_TOKEN, type FakeAuthOptions } from '../stories/fakeAuthApi'
import { PkceUnavailableError } from '../pkce'
import {
  MagicLinkPage,
  ResetPage,
  SignInPage,
  SocialCallbackPage,
  SocialLinkCallbackPage,
  type PageContext,
} from './pages'

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
  keys,
  notes: { warned: false },
  once: createOnceRunner(),
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
      <AuthProvider session={anonymous()}>
        <MemoryRouter initialEntries={['/auth/callback?code=unused&state=s']}>
          <SocialCallbackPage
            ctx={context({ discovered: { status: 'failed', signUp: true, retry } })}
          />
        </MemoryRouter>
      </AuthProvider>
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
    <AuthProvider session={anonymous()}>
      <MemoryRouter initialEntries={['/auth/callback?code=unused&state=s']}>
        <SocialCallbackPage
          ctx={context({ discovered: { status: 'ready', signUp: true, retry: fn() } })}
        />
      </MemoryRouter>
    </AuthProvider>
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
    // 시작은 비동기(WebCrypto)라 스토리는 시작해 둔 state 를 저장소에 직접 놓는다 — 구조는 `createSocialLoginFlow` 가 쓰는 그대로
    storage.setItem(
      'skeleton.social.st',
      JSON.stringify({
        provider: 'google',
        redirectUri: 'https://app.test/auth/callback',
        purpose: 'login',
        action: 'login',
      }),
    )
    return (
      <StrictMode>
        <AuthProvider session={anonymous()}>
          <MemoryRouter initialEntries={['/auth/callback?code=c&state=st']}>
            <Routes>
              <Route
                path="/auth/callback"
                element={<SocialCallbackPage ctx={context({ socialFlow: flow })} />}
              />
              <Route path="*" element={<Here />} />
            </Routes>
          </MemoryRouter>
        </AuthProvider>
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

/* ── 연결 콜백: 제공자 동의 왕복의 state 는 하려던 작업과 계정에 묶여 있다 ─────────────────────────────── */

function loggedIn() {
  const store = createTokenStore()
  store.set(FAKE_ACCESS_TOKEN)
  return createAuthSession({ api: createFakeAuthApi(), store })
}

/** 로그인하지 않은 세션 — 콜백 페이지는 `useAuth()` 를 읽는다(앱에서는 늘 `AuthProvider` 안) */
const anonymous = () => createAuthSession({ api: createFakeAuthApi(), store: createTokenStore() })

function ShowLocationState() {
  const location = useLocation()
  return <pre data-testid="state">{JSON.stringify(location.state)}</pre>
}

function linkCallback(
  contextOf: SocialLinkContext,
  accountApi = createFakeAccountApi(),
  search = '?code=fresh&state=st',
  proof: { codeVerifier?: string; nonce?: string } = {},
) {
  const storage = memoryStorage()
  const flow = createSocialLinkFlow({
    providers: { naver: { clientId: 'c', redirectUri: 'https://app.test/account/link-callback' } },
    accountApi,
    storage,
    createState: () => 'st',
  })
  storage.setItem(
    'skeleton.social-link.st',
    JSON.stringify({
      provider: 'naver',
      redirectUri: 'https://app.test/account/link-callback',
      purpose: 'link',
      action: contextOf.action.kind === 'link' ? 'link' : 'reauth',
      ...proof,
      context: contextOf,
    }),
  )
  return (
    <StrictMode>
      <AuthProvider session={loggedIn()}>
        <MemoryRouter initialEntries={['/account/link-callback' + search]}>
          <Routes>
            <Route
              path="/account/link-callback"
              element={
                <SocialLinkCallbackPage ctx={context({ socialLinkFlow: flow, accountApi })} />
              }
            />
            <Route path="/account" element={<ShowLocationState />} />
          </Routes>
        </MemoryRouter>
      </AuthProvider>
    </StrictMode>
  )
}

export const LinkCallbackCarriesTheProofBackToTheSettings: Story = {
  render: () =>
    linkCallback({
      accountId: 'acct-demo',
      action: { kind: 'email-change', newEmail: 'next@example.com' },
    }),
  play: async ({ canvas }) => {
    const state = JSON.parse((await canvas.findByTestId('state')).textContent ?? 'null')
    await expect(state.resume.action).toEqual({
      kind: 'email-change',
      newEmail: 'next@example.com',
    })
    await expect(state.resume.socialReauth).toMatchObject({
      provider: 'naver',
      authorizationCode: 'fresh',
    })
  },
}

export const LinkCallbackOfAnotherAccountIsRefused: Story = {
  render: () => linkCallback({ accountId: 'someone-else', action: { kind: 'delete' } }),
  play: async ({ canvas }) => {
    await expect(
      await canvas.findByRole('heading', { name: 'Sign-in did not finish' }),
    ).toBeVisible()
    await expect(canvas.queryByTestId('state')).toBeNull() // 설정 화면으로 이어 가지 않는다
  },
}

export const LinkAfterReconsentLinksOnceEvenUnderStrictMode: Story = {
  render: () => {
    const accountApi = createFakeAccountApi({ noAddress: true })
    ;(window as unknown as { __link: ReturnType<typeof fn> }).__link = fn()
    const linkSocial = accountApi.linkSocial
    accountApi.linkSocial = (...args) => {
      ;(window as unknown as { __link: ReturnType<typeof fn> }).__link(...args)
      return linkSocial(...args)
    }
    return linkCallback(
      {
        accountId: 'acct-demo',
        action: {
          kind: 'link-reauth',
          target: { provider: 'google', authorizationCode: 'target-code' },
        },
      },
      accountApi,
      '?code=fresh-code&state=st',
    )
  },
  play: async ({ canvas }) => {
    await expect(await canvas.findByTestId('state')).toBeVisible() // 연결이 끝나 설정으로 돌아왔다
    const link = (window as unknown as { __link: ReturnType<typeof fn> }).__link
    await expect(link).toHaveBeenCalledTimes(1) // 인가 코드는 한 번만 쓴다
    await expect(link).toHaveBeenCalledWith(
      'google',
      'target-code',
      undefined,
      expect.objectContaining({ socialReauth: expect.objectContaining({ provider: 'naver' }) }),
    )
  },
}

const VERIFIER = 'v'.repeat(43)

export const LinkCallbackCarriesTheVerifierToTheSettings: Story = {
  render: () =>
    linkCallback(
      { accountId: 'acct-demo', action: { kind: 'delete' } },
      createFakeAccountApi(),
      '?code=fresh&state=st',
      { codeVerifier: VERIFIER, nonce: 'nonce-0123456789' },
    ),
  play: async ({ canvas }) => {
    const state = JSON.parse((await canvas.findByTestId('state')).textContent ?? 'null')
    // 삭제의 다시 인증은 그 동의 시도의 verifier · nonce 와 함께 설정 화면으로 돌아간다 — 서버가 PKCE 필수 제공자의 `socialReauth` 에서 요구한다
    await expect(state.resume.socialReauth).toMatchObject({
      authorizationCode: 'fresh',
      codeVerifier: VERIFIER,
      nonce: 'nonce-0123456789',
    })
  },
}

export const LinkAfterReconsentSendsBothAttemptsTheirOwnVerifier: Story = {
  render: () => {
    const accountApi = createFakeAccountApi({ noAddress: true })
    ;(window as unknown as { __link: ReturnType<typeof fn> }).__link = fn()
    const linkSocial = accountApi.linkSocial
    accountApi.linkSocial = (...args) => {
      ;(window as unknown as { __link: ReturnType<typeof fn> }).__link(...args)
      return linkSocial(...args)
    }
    return linkCallback(
      {
        accountId: 'acct-demo',
        action: {
          kind: 'link-reauth',
          target: {
            provider: 'x',
            authorizationCode: 'x-code',
            codeVerifier: 'x'.repeat(43),
          },
        },
      },
      accountApi,
      '?code=fresh-code&state=st',
      { codeVerifier: VERIFIER },
    )
  },
  play: async ({ canvas }) => {
    await expect(await canvas.findByTestId('state')).toBeVisible()
    const link = (window as unknown as { __link: ReturnType<typeof fn> }).__link
    await expect(link).toHaveBeenCalledTimes(1)
    // 연결할 제공자의 verifier 는 최상위에, 다시 인증한 제공자의 verifier 는 socialReauth 안에 — 서로 바뀌면 서버가 PKCE 실패로 거절한다
    await expect(link).toHaveBeenCalledWith(
      'x',
      'x-code',
      undefined,
      expect.objectContaining({
        socialReauth: expect.objectContaining({ codeVerifier: VERIFIER }),
      }),
      { codeVerifier: 'x'.repeat(43) },
    )
  },
}

export const SocialCallbackAfterSignInGoesStraightOn: Story = {
  render: () => (
    <AuthProvider session={loggedIn()}>
      <MemoryRouter initialEntries={['/auth/callback']}>
        <Routes>
          <Route
            path="/auth/callback"
            element={
              <SocialCallbackPage
                ctx={context({ discovered: { status: 'ready', signUp: true, retry: fn() } })}
              />
            }
          />
          <Route path="*" element={<Here />} />
        </Routes>
      </MemoryRouter>
    </AuthProvider>
  ),
  play: async ({ canvas }) => {
    // 로그인이 끝난 뒤 뒤로 가기로 쿼리 없는 콜백에 왔다 — 「로그인을 마치지 못했어요」 대신 가던 길로
    await expect(await canvas.findByTestId('here')).toHaveTextContent('/')
    await expect(canvas.queryByRole('heading', { name: 'Sign-in did not finish' })).toBeNull()
  },
}

export const SocialSignInThatCannotStartShowsWhy: Story = {
  render: () => (
    <AuthProvider
      session={createAuthSession({ api: createFakeAuthApi(), store: createTokenStore() })}
    >
      <MemoryRouter>
        <SignInPage
          ctx={context({
            methods: { password: true, social: [{ provider: 'line' }] },
            socialFlow: {
              start: async () => {
                throw new PkceUnavailableError()
              },
              complete: async () => {
                throw new Error('unused')
              },
            },
          })}
        />
      </MemoryRouter>
    </AuthProvider>
  ),
  play: async ({ canvas, userEvent }) => {
    await userEvent.click(await canvas.findByRole('button', { name: 'Continue with LINE' }))
    await expect(await canvas.findByText(/cannot start a secure sign-in/)).toBeVisible()
    await expect(canvas.getByRole('button', { name: 'Continue with LINE' })).toBeEnabled() // 다시 눌러 볼 수 있다
  },
}

function StoredToken({ store }: { store: ReturnType<typeof createTokenStore> }) {
  return <p data-testid="token">{store.get() ?? 'none'}</p>
}

/* 탈퇴 대기 계정의 로그인(403 AUTH.ACCOUNT_DELETION_PENDING) — 세 길 모두 같은 질문, 취소하면 일반 로그인 성공과 같은 처리(토큰 저장 · 이동) */
function pendingSession(options: FakeAuthOptions = { pendingDeletion: 'with-token' }) {
  const api = createFakeAuthApi(options)
  const store = createTokenStore()
  return { api, store, session: createAuthSession({ api, store }) }
}

export const PasswordSignInOfAPendingDeletionCancelsAndEntersTheApp: Story = {
  render: () => {
    const { api, store, session } = pendingSession()
    return (
      <AuthProvider session={session}>
        <MemoryRouter initialEntries={['/login']}>
          <Routes>
            <Route path="/login" element={<SignInPage ctx={context({ authApi: api })} />} />
            <Route
              path="*"
              element={
                <>
                  <Here />
                  <StoredToken store={store} />
                </>
              }
            />
          </Routes>
        </MemoryRouter>
      </AuthProvider>
    )
  },
  play: async ({ canvas, userEvent }) => {
    await userEvent.type(await canvas.findByLabelText(/Email/), 'demo@example.com')
    await userEvent.type(canvas.getByLabelText(/^Password/), 'demo{Enter}')
    // 세션은 열리지 않았다 — 질문이 먼저
    await expect(await canvas.findByRole('heading', { name: 'Cancel the deletion?' })).toBeVisible()
    await userEvent.click(
      canvas.getByRole('button', { name: 'Cancel the deletion and keep using it' }),
    )
    await expect(await canvas.findByTestId('here')).toHaveTextContent('/')
    await expect(canvas.getByTestId('token')).toHaveTextContent(FAKE_ACCESS_TOKEN)
  },
}

export const MagicLinkOfAPendingDeletionCancelsAndEntersTheApp: Story = {
  render: () => {
    const { api, store, session } = pendingSession()
    return (
      <AuthProvider session={session}>
        <MemoryRouter initialEntries={['/magic-link?token=tok']}>
          <Routes>
            <Route path="/magic-link" element={<MagicLinkPage ctx={context({ authApi: api })} />} />
            <Route
              path="*"
              element={
                <>
                  <Here />
                  <StoredToken store={store} />
                </>
              }
            />
          </Routes>
        </MemoryRouter>
      </AuthProvider>
    )
  },
  play: async ({ canvas, userEvent }) => {
    await expect(await canvas.findByRole('heading', { name: 'Cancel the deletion?' })).toBeVisible()
    await userEvent.click(
      canvas.getByRole('button', { name: 'Cancel the deletion and keep using it' }),
    )
    await expect(await canvas.findByTestId('here')).toHaveTextContent('/')
    await expect(canvas.getByTestId('token')).toHaveTextContent(FAKE_ACCESS_TOKEN)
  },
}

export const SocialCallbackOfAPendingDeletionCancelsAndKeepsTheWantedPage: Story = {
  beforeEach: () => {
    sessionStorage.clear()
    rememberReturnTo('/notes', undefined, keys.returnTo)
  },
  render: () => {
    const { api, store, session } = pendingSession()
    const storage = memoryStorage()
    const flow = createSocialLoginFlow({
      providers: { google: { clientId: 'c', redirectUri: 'https://app.test/auth/callback' } },
      session,
      storage,
      createState: () => 'st',
    })
    storage.setItem(
      'skeleton.social.st',
      JSON.stringify({
        provider: 'google',
        redirectUri: 'https://app.test/auth/callback',
        purpose: 'login',
        action: 'login',
      }),
    )
    return (
      <AuthProvider session={session}>
        <MemoryRouter initialEntries={['/auth/callback?code=c&state=st']}>
          <Routes>
            <Route
              path="/auth/callback"
              element={<SocialCallbackPage ctx={context({ authApi: api, socialFlow: flow })} />}
            />
            <Route
              path="*"
              element={
                <>
                  <Here />
                  <StoredToken store={store} />
                </>
              }
            />
          </Routes>
        </MemoryRouter>
      </AuthProvider>
    )
  },
  play: async ({ canvas, userEvent }) => {
    await expect(await canvas.findByRole('heading', { name: 'Cancel the deletion?' })).toBeVisible()
    await userEvent.click(
      canvas.getByRole('button', { name: 'Cancel the deletion and keep using it' }),
    )
    await expect(await canvas.findByTestId('here')).toHaveTextContent('/notes')
    await expect(canvas.getByTestId('token')).toHaveTextContent(FAKE_ACCESS_TOKEN)
  },
}
