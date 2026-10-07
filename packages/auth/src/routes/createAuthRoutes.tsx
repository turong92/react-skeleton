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
import { onAccountChange } from '../accountChange'
import { authStorageKeys } from '../storageKeys'
import { createSignUpPending } from '../signUpPending'
import {
  AccountPage,
  ForgotPage,
  LegacyLinkPage,
  MagicLinkPage,
  ResetPage,
  SignInPage,
  SignUpPage,
  SocialCallbackPage,
  SocialLinkCallbackPage,
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

/** `Storage` 에서 접두어로 시작하는 키만 지운다(삭제하며 인덱스가 밀리므로 먼저 모은다) */
function removeKeysWithPrefix(storage: Storage, prefix: string) {
  try {
    const keys: string[] = []
    for (let i = 0; i < storage.length; i += 1) {
      const key = storage.key(i)
      if (key?.startsWith(prefix)) keys.push(key)
    }
    for (const key of keys) storage.removeItem(key)
  } catch {
    // 저장소가 막혔다 — 지울 것도 없다
  }
}

export const DEFAULT_AUTH_PATHS: AuthPaths = {
  signIn: '/login',
  signUp: '/sign-up',
  forgotPassword: '/forgot-password',
  resetPassword: '/reset-password',
  magicLink: '/magic-link',
  socialCallback: '/auth/callback',
  socialLinkCallback: '/account/link-callback',
  account: '/account',
}

/** 오래된 메일의 링크(가입 인증 · 이메일 변경 · 본인 확인 · 삭제 확인 — 이제는 6자리 인증번호)가 닿는 길 — 한 장의 안내 화면으로 보낸다 */
export const DEFAULT_LEGACY_LINK_PATHS: readonly string[] = [
  '/verify-email',
  '/confirm-email-change',
  '/confirm-reauth',
  '/confirm-delete',
]

export type AuthPageName =
  | 'signIn'
  | 'signUp'
  | 'forgotPassword'
  | 'resetPassword'
  | 'magicLink'
  | 'socialCallback'
  | 'socialLinkCallback'
  | 'legacyLink'
  | 'account'

export type AuthRoutesOptions = {
  /** 앱의 세션 — 서버 렌더 앱처럼 세션이 이 라우트를 만드는 자리에 없으면 생략한다(제공자 동의 왕복은 state 에 계정 id 를 묶어 다른 계정은 이어 가지 못한다) */
  session?: Pick<AuthSession, 'getState' | 'subscribe'>
  /** 저장 키 · 락의 접두어(앱 이름 — 기본 `skeleton`). 앱의 토큰 저장소 · 갱신기에도 같은 `authStorageKeys(namespace)` 를 쓴다 */
  namespace?: string
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
  /** 새 비밀번호를 한 번 더 입력받는다(가입 · 재설정 · 변경 · 첫 설정, 기본 true) — 끄면 비밀번호 칸 하나. 가입만 따로 바꾸려면 `signUp: { confirmPassword }` */
  confirmPassword?: boolean
  /**
   * 인증번호 남은 시간을 세는 시계 — 서버 보정 시계를 넣는다: `now: () => serverClock.now().getTime()`(응답 `Date` 헤더로 맞춘 `@skeleton/time`).
   * 안 넣으면 기기 시계. 교차 출처라면 백엔드가 `Access-Control-Expose-Headers: Date` 를 내야 브라우저가 `Date` 를 읽는다
   */
  now?: () => number
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
  /** 오래된 메일 링크가 닿는 길(기본 `DEFAULT_LEGACY_LINK_PATHS`) — 한 장의 안내 화면. `false` 면 두지 않는다 */
  legacyLinks?: readonly string[] | false
  /** 라우트마다 붙일 `handle`(SEO `noindex` 등 — 앱이 정한다) */
  handle?: (page: AuthPageName) => unknown
  /** 로그인 화면 위 안내(세션이 끝난 이유 등) */
  signInNotice?: string
}

/**
 * 계정 수명주기 라우트 한 벌 — 앱의 라우트 배열에 펼쳐 넣는다(`...createAuthRoutes({...})`). 로그인 · 가입(6자리 인증번호는 같은 화면) · 비밀번호 찾기/재설정 ·
 * 링크 로그인 · 소셜 콜백 · 계정 설정(`RequireAuth` 아래 — 이메일 변경 · 다시 인증 · 삭제도 같은 화면에서 인증번호를 입력한다) · 오래된 메일 링크 안내.
 * 링크가 남은 곳은 비밀번호 재설정과 링크 로그인뿐이다(그 흐름에는 세션이 없다). 방법 · 화면은 옵션으로 켜고 끈다.
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
    authApi: options.authApi as AuthApi,
    accountApi: options.accountApi as AccountApi,
    labels: options.labels,
    confirmPassword: options.confirmPassword,
    now: options.now,
    paths,
    afterSignIn: options.afterSignIn ?? '/',
    methods: options.methods,
    socialFlow: options.socialFlow,
    socialLinkFlow: options.socialLinkFlow,
    discovery: discoveryOn ? options.discovery : undefined,
  }
  // 로그아웃 · 계정 전환 때 제공자 동의 왕복의 state 기록(하려던 작업 · 연결하려던 제공자의 쓰이지 않은 코드)을 비운다
  if (options.session?.subscribe && typeof window !== 'undefined') {
    const storage = safeSessionStorage()
    if (storage)
      onAccountChange(options.session, () => removeKeysWithPrefix(storage, keys.socialLink))
  }
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
  for (const path of options.legacyLinks === false
    ? []
    : (options.legacyLinks ?? DEFAULT_LEGACY_LINK_PATHS))
    open.push({
      path,
      element: page((c) => <LegacyLinkPage ctx={c} />),
      ...handle('legacyLink'),
    })
  const settings: SettingsExtras = options.settings ?? { locales: [] }
  const guarded: RouteObject[] = [
    {
      path: paths.account,
      element: page((c) => <AccountPage ctx={c} settings={settings} />),
      ...handle('account'),
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
