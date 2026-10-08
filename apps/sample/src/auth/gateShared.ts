import {
  DEFAULT_LOGIN_ID_RULES,
  methodsFromInfo,
  useAuthMethods,
  type LoginIdRules,
} from '@skeleton/auth'
import { useMemo, useSyncExternalStore } from 'react'
import { router } from '../routes'
import { authMethodsOverride, socialClientIds, socialProviderConfigs } from './authConfig'
import { authApi } from './session'

export const ACCOUNT_PATH = '/account'
/** 계정 설정과 그 제공자 콜백(`/account/link-callback`) — 이메일을 등록하거나 아이디를 정하거나 계정을 지우는 길이라 막을 걷는다. `/account-deleted` 는 해당 없다 */
export const onAccountPages = (pathname: string) =>
  pathname === ACCOUNT_PATH || pathname.startsWith(`${ACCOUNT_PATH}/`)

/** 라우터의 지금 경로 — 아이디 · 이메일 막은 라우터 바깥(`main.tsx`)에 있어 훅 대신 구독한다 */
export function usePathname() {
  return useSyncExternalStore(
    router.subscribe,
    () => router.state.location.pathname,
    () => '/',
  )
}

/** 지금 라우터가 계정 설정 쪽에 있다 — 막이 걷히고 설정이 보인다 */
export const useOnAccountPages = () => onAccountPages(usePathname())

/** 이 앱이 로그인에 켠 소셜 제공자 — 환경변수가 방법을 정했으면 그 목록(clientId 가 있는 것만), 아니면 백엔드(`GET /auth/methods`)가 알려 준 것. 아직 모르면 undefined(거르지 않는다) */
export function useEnabledProviders(): string[] | undefined {
  const discovered = useAuthMethods(authApi, authMethodsOverride === undefined)
  const info = discovered?.status === 'ready' ? discovered.info : undefined
  return useMemo(() => {
    if (authMethodsOverride) {
      const configs = socialProviderConfigs(import.meta.env, window.location.origin)
      return (authMethodsOverride.social ?? []).map((p) => p.provider).filter((p) => p in configs)
    }
    if (!info) return undefined
    const found = methodsFromInfo(info, { clientIds: socialClientIds(import.meta.env) })
    return (found.methods.social ?? []).map((p) => p.provider)
  }, [info])
}

/** 서버가 알려 준 아이디 길이 규칙(`GET /auth/methods` 의 `loginId`) — 모르면 서버의 기본(4~20) */
export function useLoginIdRules(): LoginIdRules {
  const discovered = useAuthMethods(authApi, authMethodsOverride === undefined)
  const rules = discovered?.status === 'ready' ? discovered.info.loginId : undefined
  return rules ?? DEFAULT_LOGIN_ID_RULES
}
