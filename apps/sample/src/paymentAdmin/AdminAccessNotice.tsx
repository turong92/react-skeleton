import type { AdminAccessProblem } from '@skeleton/payment/admin'
import { EmptyState } from '@skeleton/ui'
import { BlockedNotice } from '../auth/BlockedNotice'
import { useT } from '../i18n'

/**
 * 운영자 결제 경로를 못 쓸 때의 화면 — 403 은 「접근 차단」(로그아웃하지 않는다 · 계정 도구와 같은 안내),
 * 404(서버가 운영자 경로를 열지 않았다)는 쓸 수 없다는 안내. 결제 한 건 · 상품 한 건이 없다는 404 는 여기로 오지 않는다(`adminAccessProblem` 이 코드로 가른다)
 */
export function AdminAccessNotice({
  problem,
  tool = 'payments',
}: {
  problem: AdminAccessProblem
  /** 어느 운영 도구인가 - 꺼졌을 때의 안내 문구가 달라진다 */
  tool?: 'payments' | 'catalog'
}) {
  const { t } = useT()
  if (problem === 'forbidden') return <BlockedNotice />
  return (
    <EmptyState
      headingLevel={2}
      title={t(tool === 'catalog' ? 'admin.catalog.disabledTitle' : 'admin.payments.disabledTitle')}
      description={t(
        tool === 'catalog' ? 'admin.catalog.disabledBody' : 'admin.payments.disabledBody',
      )}
    />
  )
}
