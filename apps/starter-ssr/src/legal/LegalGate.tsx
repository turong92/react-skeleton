import { useAuth } from '@skeleton/auth'
import { koLegalLabels, ReconsentGate, type ReconsentController } from '@skeleton/legal'
import type { ReactNode } from 'react'
import { useLegalApi } from './useLegalApi'

/**
 * 약관 재동의 막 — 새 판이 시행됐거나(403) 소셜 · 링크로 처음 들어와 동의가 없을 때 앱 위를 덮고, 동의가 끝나면 가던 자리에서 이어진다.
 * 서버 렌더는 자식을 그대로 그린다(토큰은 브라우저에만 있어 서버는 확인하지 않는다 — 하이드레이션 뒤에 확인).
 */
export function LegalGate({
  controller,
  children,
}: {
  controller: ReconsentController
  children: ReactNode
}) {
  const auth = useAuth()
  const api = useLegalApi()
  return (
    <ReconsentGate
      controller={controller}
      api={api}
      accountId={auth.principal?.accountId ?? null}
      onLeave={() => void auth.logout()}
      locale="ko"
      labels={koLegalLabels}
    >
      {children}
    </ReconsentGate>
  )
}
