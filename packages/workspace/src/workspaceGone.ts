import { ErrorCodes, isErrorCode } from '@skeleton/api-client'
import type { QueryClient } from '@tanstack/react-query'
import { workspaceKeys } from './queries'

/**
 * 앱의 전역 오류 처리에서 부른다 — 팀 요청이 404(`WORKSPACE.NOT_FOUND`: 추방 · 탈퇴 · 닫힘)를 받았다면 풀어 둔 팀과 내 팀 목록을 낡았다고 표시해
 * Provider 가 다시 묻고(404 → 「찾을 수 없음」) 스위처가 그 팀을 지우게 한다. 추방은 다음 요청부터 바로 반영돼야 한다.
 * 그 팀의 앱 데이터 캐시를 비우는 것은 앱의 몫(키를 앱이 안다). 처리했으면 true. 오류 토스트는 그대로 앱이 띄운다
 */
export function refreshOnWorkspaceGone(client: QueryClient, error: unknown): boolean {
  if (!isErrorCode(error, ErrorCodes.WORKSPACE_NOT_FOUND)) return false
  void client.invalidateQueries({ queryKey: workspaceKeys.all })
  return true
}
