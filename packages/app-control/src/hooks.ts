import { ApiRequestError } from '@skeleton/api-client'
import { useQuery } from '@tanstack/react-query'
import type { AppControlApi } from './appControlApi'
import { appConfigQuery } from './queries'

/** 이 상태 코드는 오류가 아니라 「이 백엔드에 app-control 이 없다」 — 앱의 전역 오류 토스트가 거른다(`meta.quietStatuses`, 앱의 `createQueryClient`) */
const MODULE_MISSING = { quietStatuses: [401, 403, 404, 405] }

const THIRTY_SECONDS = 30_000

/** 모듈이 없는 백엔드의 답(401 · 403 · 404 · 405)은 다시 물어도 같다. 일시 실패(네트워크 · 5xx)만 두 번 더 해 본다 */
export function appConfigRetry(failureCount: number, error: unknown): boolean {
  if (error instanceof ApiRequestError && [401, 403, 404, 405].includes(error.apiError.status))
    return false
  return failureCount < 2
}

export type UseAppConfigOptions = {
  enabled?: boolean
  /** 점검 중에 다시 읽는 간격(ms, 기본 30초) — 점검이 풀리면 화면이 알아서 돌아간다. 점검이 아니면 창에 돌아올 때만 읽는다 */
  maintenancePollMs?: number
}

/**
 * 앱 설정을 읽는다 — 창에 다시 올라오면(30초가 지났으면) 다시 읽고, 점검 중에는 풀릴 때까지 주기적으로 읽는다.
 * 못 읽어도(`data` 없음) 앱은 막히지 않는다 — 서버가 「그렇다」고 말했을 때만 화면이 바뀐다.
 */
export function useAppConfig(api: AppControlApi, options: UseAppConfigOptions = {}) {
  const { enabled = true, maintenancePollMs = THIRTY_SECONDS } = options
  return useQuery({
    ...appConfigQuery(api),
    enabled,
    staleTime: THIRTY_SECONDS,
    refetchOnWindowFocus: true,
    refetchInterval: (query) => (query.state.data?.maintenance.enabled ? maintenancePollMs : false),
    retry: appConfigRetry,
    meta: MODULE_MISSING,
  })
}

/** 기능 스위치 하나 — 운영자가 클라이언트에 보이기로 한 것만 온다. 키가 없으면(만든 적 없음 · 아직 못 읽음) [fallback](기본 꺼짐) */
export function useFeature(api: AppControlApi, key: string, fallback = false): boolean {
  const { data } = useAppConfig(api)
  return data?.flags[key] ?? fallback
}
