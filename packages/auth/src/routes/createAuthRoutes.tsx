import type { RouteObject } from 'react-router-dom'
import type { AccountApi } from '../account/accountApi'
import type { AuthApi } from '../authApi'
import { RequireAuth } from '../RequireAuth'
import type { SignUpScreenProps } from '../screens/SignUpScreen'
import type { ReactElement, ReactNode } from 'react'
import type { AuthLabels } from '../screens/labels'
import { resolveMethods, type SignInMethodsConfig } from '../screens/methods'
import type { AuthSession } from '../session'
import type { DiscoveryOptions } from './discovery'
import type { SocialLoginFlow } from '../social'
import type { SocialLinkFlow } from '../socialLink'
import { createReauthStore, type ReauthStore } from '../reauth'
import type { ReauthChannel } from '../reauthChannel'
import { onAccountChange } from '../accountChange'
import { authStorageKeys } from '../storageKeys'
import { createSignUpPending } from '../signUpPending'
import {
  AccountPage,
  ConfirmEmailChangePage,
  ConfirmReauthPage,
  ForgotPage,
  MagicLinkPage,
  ResetPage,
  SignInPage,
  SignUpPage,
  SocialCallbackPage,
  SocialLinkCallbackPage,
  VerifyPage,
  WithLabels,
  type AuthPaths,
  type PageContext,
  type SettingsExtras,
} from './pages'

export type { AuthPaths } from './pages'

function safeSessionStorage(): Storage | undefined {
  try {
    return window.sessionStorage
  } catch {
    return undefined
  }
}

export const DEFAULT_AUTH_PATHS: AuthPaths = {
  signIn: '/login',
  signUp: '/sign-up',
  forgotPassword: '/forgot-password',
  resetPassword: '/reset-password',
  verifyEmail: '/verify-email',
  magicLink: '/magic-link',
  socialCallback: '/auth/callback',
  socialLinkCallback: '/account/link-callback',
  confirmEmailChange: '/confirm-email-change',
  confirmReauth: '/confirm-reauth',
  account: '/account',
  confirmDelete: '/confirm-delete',
}

export type AuthPageName =
  | 'signIn'
  | 'signUp'
  | 'forgotPassword'
  | 'resetPassword'
  | 'verifyEmail'
  | 'magicLink'
  | 'socialCallback'
  | 'socialLinkCallback'
  | 'confirmEmailChange'
  | 'confirmReauth'
  | 'account'
  | 'confirmDelete'

export type AuthRoutesOptions = {
  /** 있으면 로그아웃 · 계정 전환 때 다시 인증 보관소를 비운다. 서버 렌더 앱처럼 세션이 이 라우트를 만드는 자리에 없으면 생략한다(보관소가 계정에 묶여 있어 다른 계정은 읽지 못한다) */
  session?: Pick<AuthSession, 'getState' | 'subscribe'>
  /** 저장 키 · 락 · 채널 이름의 접두어(앱 이름 — 기본 `skeleton`). 앱의 토큰 저장소 · 갱신기에도 같은 `authStorageKeys(namespace)` 를 쓴다 */
  namespace?: string
  /** 본인 확인 토큰을 같은 브라우저의 다른 탭에 넘기는 채널(`createBroadcastReauthChannel(keys.reauthChannel)`) — 앱이 브라우저에서 만들어 넘긴다. 없으면 토큰은 링크를 연 탭에 보관된다 */
  reauthChannel?: ReauthChannel | null
  /** 모듈 전역 API 를 쓰는 앱(SPA)이 준다 — 서버 렌더 앱은 대신 `useApis` */
  authApi?: AuthApi
  accountApi?: AccountApi
  /** 요청마다 · 앱마다 API 를 만드는 앱(SSR)의 훅 — 렌더 때 부른다 */
  useApis?: () => { authApi: AuthApi; accountApi: AccountApi }
  /** 계정 페이지를 감싸는 가드(기본 `<RequireAuth redirectTo={signIn} />`). 서버 렌더 앱은 하이드레이션 안전판을 꽂는다 */
  guard?: ReactElement
  /** 켠 로그인 방법 — 화면 · 라우트가 이것을 따른다. 주면 그것이 이기고(환경변수 덮어쓰기) 백엔드에 묻지 않는다 */
  methods?: SignInMethodsConfig
  /**
   * 로그인 방법을 백엔드(`GET /auth/methods`)에서 알아낸다 — `methods` 를 주지 않았을 때만. 라우트를 만들 때는 어떤 방법이 있는지 모르므로
   * 방법이 필요할 수 있는 도착 화면(링크 로그인 · 소셜 콜백)을 모두 둔다. 답이 오기 전에는 로딩 화면, 못 받으면 `fallback` 방법과 「다시 시도」
   */
  discovery?: DiscoveryOptions
  /** 소셜 로그인 흐름(`createSocialLoginFlow`) — 있어야 `/auth/callback` 이 생긴다 */
  socialFlow?: SocialLoginFlow
  /** 소셜 계정 연결 흐름(`createSocialLinkFlow`) */
  socialLinkFlow?: SocialLinkFlow
  labels?: Partial<AuthLabels>
  /** 화면 언어에 따라 문구가 바뀌는 앱: 렌더 때 부르는 훅(보통 `useT()` 로 고른 사전). 있으면 `labels` 보다 먼저 */
  useLabels?: () => Partial<AuthLabels> | undefined
  paths?: Partial<AuthPaths>
  /** 로그인 뒤 기본 목적지(기본 `/`). 가려던 곳이 있으면 그곳이 먼저 */
  afterSignIn?: string
  /** 가입 화면을 둘지(기본 true) 또는 슬롯(캡차 · 동의 · 표시 이름) */
  signUp?: boolean | Partial<SignUpScreenProps>
  /** 비밀번호 찾기 · 재설정을 둘지(기본 true) */
  forgotPassword?: boolean
  /** 설정 화면 값(언어 목록 · 절 켜기 · 삭제 유예 …) */
  settings?: SettingsExtras
  /** 다시 인증 상태(하려던 작업 · 받은 토큰) — 기본은 브라우저의 sessionStorage(탭 하나에 묶인다) */
  reauthStore?: ReauthStore
  /** 라우트마다 붙일 `handle`(SEO `noindex` 등 — 앱이 정한다) */
  handle?: (page: AuthPageName) => unknown
  /** 로그인 화면 위 안내(세션이 끝난 이유 등) */
  signInNotice?: string
}

/**
 * 계정 수명주기 라우트 한 벌 — 앱의 라우트 배열에 펼쳐 넣는다(`...createAuthRoutes({...})`). 로그인 · 가입 · 메일 확인 · 비밀번호 찾기/재설정 ·
 * 링크 로그인 · 소셜 콜백 · 이메일 변경 확인 · 계정 설정(`RequireAuth` 아래) · 삭제 확인. 방법 · 화면은 옵션으로 켜고 끈다.
 */
export function createAuthRoutes(options: AuthRoutesOptions): RouteObject[] {
  const paths = { ...DEFAULT_AUTH_PATHS, ...options.paths }
  const discoveryOn = !!options.discovery && options.methods === undefined
  const methods = resolveMethods(options.methods)
  if (!options.useApis && (!options.authApi || !options.accountApi))
    throw new Error('createAuthRoutes needs authApi and accountApi (or a useApis hook)')
  const keys = authStorageKeys(options.namespace)
  const ctx: PageContext = {
    keys,
    notes: { warned: false },
    signUpPending: createSignUpPending({
      storage: typeof window === 'undefined' ? undefined : safeSessionStorage(),
      key: keys.signUp,
    }),
    reauthChannel: options.reauthChannel,
    authApi: options.authApi as AuthApi,
    accountApi: options.accountApi as AccountApi,
    labels: options.labels,
    paths,
    afterSignIn: options.afterSignIn ?? '/',
    methods: options.methods,
    socialFlow: options.socialFlow,
    socialLinkFlow: options.socialLinkFlow,
    discovery: discoveryOn ? options.discovery : undefined,
    reauth:
      options.reauthStore ??
      createReauthStore({
        storage: typeof window === 'undefined' ? undefined : safeSessionStorage(),
        prefix: keys.reauthPrefix,
      }),
  }
  if (options.session?.subscribe) onAccountChange(options.session, () => ctx.reauth.clear())
  const page = (render: (c: PageContext) => ReactNode) => (
    <WithLabels ctx={ctx} useLabels={options.useLabels} useApis={options.useApis} render={render} />
  )
  const handle = (name: AuthPageName) => (options.handle ? { handle: options.handle(name) } : {})
  const open: RouteObject[] = [
    {
      path: paths.signIn,
      element: page((c) => <SignInPage ctx={c} notice={options.signInNotice} />),
      ...handle('signIn'),
    },
  ]
  if (options.signUp !== false)
    open.push({
      path: paths.signUp,
      element: page((c) => (
        <SignUpPage ctx={c} signUp={typeof options.signUp === 'object' ? options.signUp : {}} />
      )),
      ...handle('signUp'),
    })
  // 가입 · 링크 로그인 · 이메일 변경 메일이 닿는 곳 — 메일 인증은 가입이 있을 때만 의미가 있다
  if (options.signUp !== false)
    open.push({
      path: paths.verifyEmail,
      element: page((c) => <VerifyPage ctx={c} />),
      ...handle('verifyEmail'),
    })
  if (options.forgotPassword !== false)
    open.push(
      {
        path: paths.forgotPassword,
        element: page((c) => <ForgotPage ctx={c} />),
        ...handle('forgotPassword'),
      },
      {
        path: paths.resetPassword,
        element: page((c) => <ResetPage ctx={c} />),
        ...handle('resetPassword'),
      },
    )
  if (methods.magicLink || discoveryOn)
    open.push({
      path: paths.magicLink,
      element: page((c) => <MagicLinkPage ctx={c} />),
      ...handle('magicLink'),
    })
  if (options.socialFlow || discoveryOn)
    open.push({
      path: paths.socialCallback,
      element: page((c) => <SocialCallbackPage ctx={c} />),
      ...handle('socialCallback'),
    })
  open.push({
    path: paths.confirmEmailChange,
    element: page((c) => <ConfirmEmailChangePage ctx={c} />),
    ...handle('confirmEmailChange'),
  })
  const settings: SettingsExtras = options.settings ?? { locales: [] }
  const guarded: RouteObject[] = [
    // 비밀번호 없는 계정의 다시 인증 메일이 닿는 곳 — 로그인한 계정에만 의미가 있다(보관소가 그 계정에 묶인다). 로그아웃 상태로 열면 로그인한 뒤 이 링크로 돌아온다
    {
      path: paths.confirmReauth,
      element: page((c) => <ConfirmReauthPage ctx={c} />),
      ...handle('confirmReauth'),
    },
    {
      path: paths.account,
      element: page((c) => <AccountPage ctx={c} settings={settings} />),
      ...handle('account'),
    },
    {
      path: paths.confirmDelete,
      element: page((c) => <AccountPage ctx={c} settings={settings} confirmDelete />),
      ...handle('confirmDelete'),
    },
  ]
  if (options.socialLinkFlow || discoveryOn)
    guarded.push({
      path: paths.socialLinkCallback,
      element: page((c) => <SocialLinkCallbackPage ctx={c} />),
      ...handle('socialLinkCallback'),
    })
  return [
    ...open,
    { element: options.guard ?? <RequireAuth redirectTo={paths.signIn} />, children: guarded },
  ]
}
