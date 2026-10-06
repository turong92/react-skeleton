import { useCallback, useEffect, useState } from 'react'
import type { AuthApi } from '../authApi'
import { clearAuthMethodsCache, loadAuthMethods, peekAuthMethods } from '../discovery'
import type { AuthMethodsWire } from '../types'

export type AuthMethodsState =
  | { status: 'loading' }
  | { status: 'ready'; info: AuthMethodsWire }
  | { status: 'failed'; error: unknown; retry: () => void }

/**
 * `GET /auth/methods` 의 상태 — 서버 렌더 · 하이드레이션 때는 늘 `loading`(요청은 브라우저의 effect 에서만)이라 서버와 클라이언트가 어긋나지 않고,
 * 이미 받아 둔 답이 있으면(화면 사이 이동) 처음부터 `ready` 다. `enabled` 가 false 면 아무것도 묻지 않는다(앱이 방법을 직접 정했다).
 */
export function useAuthMethods(api: AuthApi, enabled: boolean): AuthMethodsState | undefined {
  const [attempt, setAttempt] = useState(0)
  const [state, setState] = useState<AuthMethodsState>(() => {
    const known = enabled ? peekAuthMethods(api) : undefined
    return known ? { status: 'ready', info: known } : { status: 'loading' }
  })
  const retry = useCallback(() => {
    clearAuthMethodsCache(api)
    setState({ status: 'loading' })
    setAttempt((n) => n + 1)
  }, [api])

  useEffect(() => {
    if (!enabled) return undefined
    let active = true
    loadAuthMethods(api).then(
      (info) => active && setState({ status: 'ready', info }),
      (error: unknown) => active && setState({ status: 'failed', error, retry }),
    )
    return () => {
      active = false
    }
  }, [api, enabled, attempt, retry])

  return enabled ? state : undefined
}
