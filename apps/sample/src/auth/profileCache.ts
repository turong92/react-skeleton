import { boardKeys } from '@skeleton/board'
import type { QueryClient } from '@tanstack/react-query'
import { myProfileKey } from './useMyProfile'

/**
 * 닉네임이 바뀌었다 — 내 프로필(띠 · 인사말 · 쓰기 전 게이트)과 작성자 이름이 걸린 게시판 화면(목록 · 글 · 댓글)을 서버와 다시 맞춘다.
 * 계정 설정(`createAuthRoutes` 의 `settings.onProfileChanged`)과 닉네임 대화상자가 같이 쓴다
 */
export function refreshAfterProfileChange(client: QueryClient) {
  void client.invalidateQueries({ queryKey: myProfileKey })
  void client.invalidateQueries({ queryKey: boardKeys.all })
}
