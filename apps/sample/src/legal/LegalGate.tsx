import { useAuth } from '@skeleton/auth'
import { useSyncExternalStore } from 'react'
import { ReconsentGate } from '@skeleton/legal'
import type { ReactNode } from 'react'
import { emailRequired } from '../api/emailRequired'
import { legalApi } from '../api/legal'
import { reconsent } from '../api/reconsent'
import { useLegalLocale } from './useLegalLocale'

/** 약관 재동의 막(새 판 · 소셜 첫 로그인; 이메일 등록이 끝난 뒤에) — 동의가 끝나면 막혔던 호출이 다시 나가 가던 자리에서 이어진다. `main.tsx` 가 `AuthProvider` 안에 둔다 */
export function LegalGate({ children }: { children: ReactNode }) {
  const auth = useAuth()
  // 순서는 이메일 → 약관: 이 계정이 주소를 요구받는지 서버에 묻기 전이거나(`isReady`) 아직 등록하지 않은 동안은 약관을 묻지 않는다 — `deferCheck` 가 그동안 확인을 미룬다(계정은 그대로 알려 둔다).
  // 등록이 끝나면(또는 주소가 있다고 알면) 그때 `GET /consents/me` 를 확인한다. 이메일 막이 계정 설정에서 걷혀 있는 동안에도 약관 막이 설정을 덮지 않는다
  const emailFirst = useSyncExternalStore(
    emailRequired.subscribe,
    () => emailRequired.getState().status === 'required' || !emailRequired.isReady(),
    () => false,
  )
  const { locale, formatLocale, labels } = useLegalLocale()
  return (
    <ReconsentGate
      controller={reconsent}
      api={legalApi}
      accountId={auth.principal?.accountId ?? null}
      deferCheck={emailFirst}
      onLeave={() => void auth.logout()}
      locale={locale}
      formatLocale={formatLocale}
      labels={labels}
    >
      {children}
    </ReconsentGate>
  )
}
