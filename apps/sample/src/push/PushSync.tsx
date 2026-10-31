import { useAuth } from '@skeleton/auth'
import { usePushSync } from '@skeleton/push'
import { pushApi } from './api'

function Sync({ accountId }: { accountId: string }) {
  // 로그인한 화면에서 한 번 — 켠 표시가 있고 권한이 허용이면 구독을 서버와 맞춘다(권한은 묻지 않는다)
  usePushSync(pushApi, { accountId })
  return null
}

/** 로그인한 사람의 푸시 구독 맞추기 — 화면은 없다 */
export function PushSync() {
  const { principal } = useAuth()
  return principal?.accountId ? <Sync accountId={principal.accountId} /> : null
}
