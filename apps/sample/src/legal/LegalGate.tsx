import { useAuth } from '@skeleton/auth'
import { ReconsentGate } from '@skeleton/legal'
import type { ReactNode } from 'react'
import { legalApi } from '../api/legal'
import { reconsent } from '../api/reconsent'
import { useLegalLocale } from './useLegalLocale'

/** 약관 재동의 막(새 판 · 소셜 첫 로그인) — 동의가 끝나면 막혔던 호출이 다시 나가 가던 자리에서 이어진다. `main.tsx` 가 `AuthProvider` 안에 둔다 */
export function LegalGate({ children }: { children: ReactNode }) {
  const auth = useAuth()
  const { locale, formatLocale, labels } = useLegalLocale()
  return (
    <ReconsentGate
      controller={reconsent}
      api={legalApi}
      accountId={auth.principal?.accountId ?? null}
      onLeave={() => void auth.logout()}
      locale={locale}
      formatLocale={formatLocale}
      labels={labels}
    >
      {children}
    </ReconsentGate>
  )
}
