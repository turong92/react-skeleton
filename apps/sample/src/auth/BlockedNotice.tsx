import { AccountStateNotice } from '@skeleton/auth'
import { useAuthLabels } from './useAuthLabels'

/** `RequirePermission` 의 `forbidden` — 권한이 없는 로그인 사용자에게 현재 언어로 「접근 차단」 안내 */
export function BlockedNotice() {
  return <AccountStateNotice kind="blocked" labels={useAuthLabels()} />
}
