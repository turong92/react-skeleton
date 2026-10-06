import { useAuth } from '@skeleton/auth'
import { koLegalLabels, ReconsentGate } from '@skeleton/legal'
import type { ReactNode } from 'react'
import { legalApi } from '../api/legal'
import { reconsent } from '../api/reconsent'

/**
 * 약관 재동의 막 — 새 판이 시행됐거나(403) 소셜 · 링크로 처음 들어와 동의가 없을 때 앱 위를 덮고, 동의가 끝나면 가던 자리에서 이어진다.
 * 영어로 쓰려면 `labels` · `locale` 을 바꾼다(`defaultLegalLabels` 가 기본).
 */
export function LegalGate({ children }: { children: ReactNode }) {
  const auth = useAuth()
  return (
    <ReconsentGate
      controller={reconsent}
      api={legalApi}
      accountId={auth.principal?.accountId ?? null}
      onLeave={() => void auth.logout()}
      locale="ko"
      labels={koLegalLabels}
    >
      {children}
    </ReconsentGate>
  )
}
