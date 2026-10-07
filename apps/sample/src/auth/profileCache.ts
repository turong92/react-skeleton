import { boardKeys } from '@skeleton/board'
import type { QueryClient } from '@tanstack/react-query'
import { myProfileKey } from './useMyProfile'

/**
 * 계정 정보(언어 · 시간대)를 저장했다 — 내 계정 읽기와 게시판 화면(목록 · 글 · 댓글)을 서버와 다시 맞춘다.
 * 계정 설정(`createAuthRoutes` 의 `settings.onProfileChanged`)이 쓴다
 */
export function refreshAfterProfileChange(client: QueryClient) {
  void client.invalidateQueries({ queryKey: myProfileKey })
  void client.invalidateQueries({ queryKey: boardKeys.all })
}
