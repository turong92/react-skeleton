import { AccountStateNotice } from '@skeleton/auth'
import { useAuthLabels } from './useAuthLabels'

/** `RequireRole` 의 `forbidden` — 역할이 없는 로그인 사용자에게 현재 언어로 「접근 차단」 안내 */
export function BlockedNotice() {
  return <AccountStateNotice kind="blocked" labels={useAuthLabels()} />
}
