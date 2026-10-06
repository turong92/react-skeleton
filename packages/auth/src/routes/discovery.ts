import { useEffect, useMemo } from 'react'
import type { AccountApi } from '../account/accountApi'
import type { AuthApi, RefreshDelivery } from '../authApi'
import { deliveryMismatch, methodsFromInfo } from '../discovery'
import { resolveMethods, type SignInMethodsConfig } from '../screens/methods'
import { useAuthMethods } from '../screens/useAuthMethods'
import type { AuthSession } from '../session'
import { createSocialLoginFlow, type SocialLoginFlow } from '../social'
import { createSocialLinkFlow, type SocialLinkFlow } from '../socialLink'
import type { TokenStorage } from '../tokenStore'

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
  socialFlow?: SocialLoginFlow
  socialLinkFlow?: SocialLinkFlow
  discovered: DiscoveredState
}

let warned = false

/** 렌더 때 부른다 — 발견을 켠 라우트(`discovery` 가 있고 방법 설정이 없는)에서만 의미가 있다. 켜지 않았으면 undefined */
export function useDiscoveredContext({
  discovery,
  authApi,
  accountApi,
  paths,
}: {
  discovery: DiscoveryOptions | undefined
  authApi: AuthApi
  accountApi: AccountApi
  paths: { socialCallback: string; socialLinkCallback: string }
}): DiscoveredContext | undefined {
  const state = useAuthMethods(authApi, !!discovery)
  const info = state?.status === 'ready' ? state.info : undefined

  useEffect(() => {
    if (!info || !discovery?.delivery || warned) return
    const problem = deliveryMismatch(info, discovery.delivery)
    if (problem) {
      warned = true
      console.warn(`[@skeleton/auth] ${problem}`)
    }
  }, [info, discovery?.delivery])

  const social = discovery?.social
  const resolved = useMemo(() => {
    if (!info) return undefined
    const origin = typeof window === 'undefined' ? '' : window.location.origin
    const found = methodsFromInfo(info, {
      clientIds: social?.clientIds,
      defaultRedirectUri: origin + paths.socialCallback,
    })
    const on = !!social && Object.keys(found.providers).length > 0
    return {
      found,
      socialFlow: on
        ? createSocialLoginFlow({
            providers: found.providers,
            session: social.session,
            storage: social.storage,
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
          })
        : undefined,
    }
  }, [info, social, accountApi, paths.socialCallback, paths.socialLinkCallback])

  if (!discovery || !state) return undefined
  const retry = state.status === 'failed' ? state.retry : () => undefined
  if (state.status === 'ready' && resolved)
    return {
      methods: resolved.found.methods,
      socialFlow: resolved.socialFlow,
      socialLinkFlow: resolved.socialLinkFlow,
      discovered: { status: 'ready', signUp: resolved.found.signUp, retry },
    }
  return {
    methods: resolveMethods(discovery.fallback),
    discovered: { status: state.status === 'failed' ? 'failed' : 'loading', signUp: true, retry },
  }
}
