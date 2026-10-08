import { useEffect } from 'react'
import type { LoginIdRules } from '../account/loginIdRules'
import type { AccountApi } from '../account/accountApi'
import type { AuthApi, RefreshDelivery } from '../authApi'
import { deliveryMismatch, methodsFromInfo, redirectUriProblems } from '../discovery'
import { resolveMethods, type SignInMethodsConfig } from '../screens/methods'
import { useAuthMethods } from '../screens/useAuthMethods'
import type { AuthSession } from '../session'
import { createSocialLoginFlow, type SocialLoginFlow } from '../social'
import { createSocialLinkFlow, type SocialLinkFlow } from '../socialLink'
import type { TokenStorage } from '../tokenStore'
import type { AuthMethodsWire } from '../types'

export type DiscoveryOptions = {
  /** 백엔드에 못 물었을 때 보여 줄 방법(기본: 비밀번호만) */
  fallback?: SignInMethodsConfig
  /** 이 앱이 설정한 리프레시 전달 방식 — 백엔드와 다르면 개발 콘솔에 경고한다 */
  delivery?: RefreshDelivery
  /** 소셜 버튼 · 콜백을 켜려면: 로그인 세션과 state 를 둘 저장소(sessionStorage). 없으면 소셜 버튼은 그리지 않는다 */
  social?: {
    session: Pick<AuthSession, 'socialLogin'>
    storage?: TokenStorage
    /** 백엔드가 clientId 를 모르는 제공자에 앱이 줄 값 */
    clientIds?: Record<string, string | undefined>
  }
}

/** 화면이 읽는 발견 상태 */
export type DiscoveredState = {
  status: 'loading' | 'ready' | 'failed'
  /** 비밀번호 가입이 열려 있는가(실패하면 true — 서버가 닫혀 있으면 가입 요청이 403 으로 말해 준다) */
  signUp: boolean
  retry: () => void
}

export type DiscoveredContext = {
  methods: SignInMethodsConfig
  /** 로그인 아이디를 켠 서버일 때만 있다(발견에 `loginId` 키) - 길이 규칙. 없으면 화면은 아이디를 모른다 */
  loginId?: LoginIdRules
  socialFlow?: SocialLoginFlow
  socialLinkFlow?: SocialLinkFlow
  discovered: DiscoveredState
}

/** 경고를 한 번만 하려는 기억 + 발견으로 만든 소셜 흐름 — 라우트 한 벌(`createAuthRoutes`)마다 하나(모듈 전역이 아니다) */
export type DiscoveryNotes = {
  warned: boolean
  warnedRedirect?: boolean
  /** 마지막으로 만든 흐름 한 벌과 그 재료 — 같은 재료면 같은 흐름을 돌려준다(`resolveDiscoveredFlows`) */
  flows?: { deps: readonly unknown[]; value: ResolvedDiscovery }
}

type ResolvedDiscovery = {
  found: ReturnType<typeof methodsFromInfo>
  socialFlow: SocialLoginFlow | undefined
  socialLinkFlow: SocialLinkFlow | undefined
}

/**
 * 발견한 방법으로 소셜 로그인 · 연결 흐름을 만든다. 흐름은 「이 콜백의 state 를 이미 썼다」는 기억(진행 중인 로그인 하나만 서버로 나가게 하는 것)을 들고 있어서,
 * **같은 라우트 한 벌 안에서는 재료가 같은 동안 같은 흐름**이어야 한다. 컴포넌트 안(`useMemo`)에 두면 로그인 성공으로 앱의 레이아웃이 본문을 다른 껍데기로 감싸 콜백 페이지가
 * 다시 마운트될 때 흐름이 새로 만들어지고, 새 흐름은 이미 쓰인 state 를 몰라 성공한 로그인이 「이 탭에서 시작한 로그인이 아니다」 오류로 뒤집힌다.
 * 그래서 라우트 한 벌이 쥔 `notes` 에 둔다(모듈 전역이 아니다).
 */
export function resolveDiscoveredFlows(
  notes: DiscoveryNotes,
  input: {
    info: AuthMethodsWire
    social: DiscoveryOptions['social']
    accountApi: AccountApi
    paths: { socialCallback: string; socialLinkCallback: string }
    statePrefixes?: { social: string; socialLink: string }
    origin: string
  },
): ResolvedDiscovery {
  const { info, social, accountApi, paths, statePrefixes, origin } = input
  const deps = [
    info,
    social,
    accountApi,
    paths.socialCallback,
    paths.socialLinkCallback,
    statePrefixes?.social,
    statePrefixes?.socialLink,
    origin,
  ]
  const cached = notes.flows
  if (cached && cached.deps.length === deps.length && cached.deps.every((d, i) => d === deps[i]))
    return cached.value
  const found = methodsFromInfo(info, {
    clientIds: social?.clientIds,
    defaultRedirectUri: origin + paths.socialCallback,
  })
  const on = !!social && Object.keys(found.providers).length > 0
  const value: ResolvedDiscovery = {
    found,
    socialFlow: on
      ? createSocialLoginFlow({
          providers: found.providers,
          session: social.session,
          storage: social.storage,
          ...(statePrefixes ? { storagePrefix: statePrefixes.social } : {}),
        })
      : undefined,
    socialLinkFlow: on
      ? createSocialLinkFlow({
          providers: Object.fromEntries(
            Object.entries(found.providers).map(([name, config]) => [
              name,
              { ...config, redirectUri: origin + paths.socialLinkCallback },
            ]),
          ),
          accountApi,
          storage: social.storage,
          ...(statePrefixes ? { storagePrefix: statePrefixes.socialLink } : {}),
        })
      : undefined,
  }
  notes.flows = { deps, value }
  return value
}

export function warnDeliveryOnce(
  info: AuthMethodsWire,
  configured: RefreshDelivery,
  notes: DiscoveryNotes,
  warn: (message: string) => void = console.warn,
): void {
  if (notes.warned) return
  const problem = deliveryMismatch(info, configured)
  if (!problem) return
  notes.warned = true
  warn(`[@skeleton/auth] ${problem}`)
}

export function warnRedirectOnce(
  info: AuthMethodsWire,
  expected: string,
  notes: DiscoveryNotes,
  warn: (message: string) => void = console.warn,
): void {
  if (notes.warnedRedirect) return
  const problems = redirectUriProblems(info.social, expected)
  if (problems.length === 0) return
  notes.warnedRedirect = true
  for (const problem of problems) warn(`[@skeleton/auth] ${problem.message}`)
}

/** 렌더 때 부른다 — 발견을 켠 라우트(`discovery` 가 있고 방법 설정이 없는)에서만 의미가 있다. 켜지 않았으면 undefined */
export function useDiscoveredContext({
  discovery,
  authApi,
  accountApi,
  paths,
  notes,
  statePrefixes,
}: {
  discovery: DiscoveryOptions | undefined
  authApi: AuthApi
  accountApi: AccountApi
  paths: { socialCallback: string; socialLinkCallback: string }
  notes: DiscoveryNotes
  /** OAuth state 저장 접두어(앱 이름공간) — 없으면 패키지 기본 */
  statePrefixes?: { social: string; socialLink: string }
}): DiscoveredContext | undefined {
  const state = useAuthMethods(authApi, !!discovery)
  const info = state?.status === 'ready' ? state.info : undefined

  useEffect(() => {
    if (info && discovery?.delivery) warnDeliveryOnce(info, discovery.delivery, notes)
  }, [info, discovery?.delivery, notes])
  useEffect(() => {
    if (!info || typeof window === 'undefined') return
    warnRedirectOnce(info, window.location.origin + paths.socialCallback, notes)
  }, [info, paths.socialCallback, notes])

  const resolved = info
    ? resolveDiscoveredFlows(notes, {
        info,
        social: discovery?.social,
        accountApi,
        paths,
        statePrefixes,
        origin: typeof window === 'undefined' ? '' : window.location.origin,
      })
    : undefined

  if (!discovery || !state) return undefined
  const retry = state.status === 'failed' ? state.retry : () => undefined
  if (state.status === 'ready' && resolved)
    return {
      methods: resolved.found.methods,
      ...(resolved.found.loginId ? { loginId: resolved.found.loginId } : {}),
      socialFlow: resolved.socialFlow,
      socialLinkFlow: resolved.socialLinkFlow,
      discovered: { status: 'ready', signUp: resolved.found.signUp, retry },
    }
  return {
    methods: resolveMethods(discovery.fallback),
    discovered: { status: state.status === 'failed' ? 'failed' : 'loading', signUp: true, retry },
  }
}
