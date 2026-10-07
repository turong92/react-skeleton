import type { QueryClient } from '@tanstack/react-query'
import { isAuthorNotAllowedError } from './errors'
import { authorProfileKeys } from './queries'

/**
 * 앱의 전역 오류 처리에서 부른다 — 게시판이 작성자 id 를 거절했다면(`BOARD.AUTHOR_NOT_ALLOWED`: 다른 탭에서 지운 프로필로 쓰려 했다) 프로필 목록 캐시를 낡았다고 표시해
 * 선택기가 낡은 목록을 그리지 않게 한다(활성 선택기는 곧 다시 가져온다). 거절이었으면 true. 오류 토스트는 그대로 앱이 띄운다.
 */
export function refreshProfilesOnAuthorRefusal(client: QueryClient, error: unknown): boolean {
  if (!isAuthorNotAllowedError(error)) return false
  void client.invalidateQueries({ queryKey: authorProfileKeys.list() })
  return true
}
