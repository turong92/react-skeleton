import { ApiRequestError } from '@skeleton/api-client'
import type { QueryClient } from '@tanstack/react-query'
import { appControlKeys } from './queries'

/** 백엔드 점검 응답의 코드 (`503 APP_CONTROL.MAINTENANCE`) */
export const MAINTENANCE_ERROR_CODE = 'APP_CONTROL.MAINTENANCE'

/** 이 오류가 「서버가 점검 중이다」라는 답인가 */
export function isMaintenanceError(error: unknown): boolean {
  return (
    error instanceof ApiRequestError &&
    error.apiError.status === 503 &&
    error.apiError.code === MAINTENANCE_ERROR_CODE
  )
}

/**
 * 어느 쿼리 · 변경이든 점검 응답(503 `APP_CONTROL.MAINTENANCE`)으로 실패하면 [onMaintenance] 를 부른다 — 설정을 다시 읽어 점검 화면으로 바꾸는 데 쓴다.
 * 설정 쿼리 자신의 실패는 세지 않는다(점검 중에도 설정 경로는 열려 있다). 돌려주는 함수가 구독을 푼다.
 */
export function watchMaintenance(client: QueryClient, onMaintenance: () => void): () => void {
  const isOwn = (key: readonly unknown[]) => key[0] === appControlKeys.all[0]
  const stopQueries = client.getQueryCache().subscribe((event) => {
    if (
      event.type === 'updated' &&
      event.action.type === 'error' &&
      !isOwn(event.query.queryKey) &&
      isMaintenanceError(event.action.error)
    )
      onMaintenance()
  })
  const stopMutations = client.getMutationCache().subscribe((event) => {
    if (
      event.type === 'updated' &&
      event.action.type === 'error' &&
      isMaintenanceError(event.action.error)
    )
      onMaintenance()
  })
  return () => {
    stopQueries()
    stopMutations()
  }
}
