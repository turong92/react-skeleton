import { defaultAuthLabels, MfaEnrollmentRequiredGate, useAuth } from '@skeleton/auth'
import type { ReactNode } from 'react'
import { toast } from 'sonner'
import { mfaEnrollmentRequired } from '../api/mfaEnrollmentRequired'
import { serverClock } from '../api/serverClock'
import { queryClient } from '../app/queryClient'
import { router } from '../routes'
import { ACCOUNT_PATH, useOnAccountPages } from './gateShared'
import { refreshAfterProfileChange } from './profileCache'
import { accountApi, mfaApi } from './session'
import { useAuthLabels } from './useAuthLabels'

/**
 * 2단계 인증이 필수인데 아직 켜지 않은 계정(이 견본에서는 운영자)이 앱 대신 보는 「2단계 인증을 켜 주세요」 막(`@skeleton/auth` 의 `MfaEnrollmentRequiredGate`).
 * `main.tsx` 가 `AuthProvider` 안, 가장 바깥에 둔다 - 서버 문(MFA.ENROLLMENT_REQUIRED)이 아이디 · 이메일 · 약관보다 먼저 막는다. 켜면 막혔던 호출이 다시 나가 가던 자리에서 이어진다.
 * 본인 확인이 필요한데(로그인 15분이 지났다) 소셜 전용 계정이면 제공자 동의 왕복이 있는 계정 설정(`/account#two-factor`)으로 보낸다 - 거기서는 막이 걷힌다.
 */
export function MfaGate({ children }: { children: ReactNode }) {
  const auth = useAuth()
  const labels = useAuthLabels()
  const standAside = useOnAccountPages()
  return (
    <MfaEnrollmentRequiredGate
      controller={mfaEnrollmentRequired}
      api={mfaApi}
      account={accountApi}
      accountId={auth.principal?.accountId ?? null}
      labels={labels}
      now={() => serverClock.now().getTime()}
      standAside={standAside}
      onProviderReauth={() => void router.navigate(`${ACCOUNT_PATH}#two-factor`)}
      onSignOut={() => {
        void auth.logout()
        void router.navigate('/login', { replace: true })
      }}
      onEnrolled={() => {
        refreshAfterProfileChange(queryClient)
        toast.success(labels.mfaGateDone ?? defaultAuthLabels.mfaGateDone)
      }}
    >
      {children}
    </MfaEnrollmentRequiredGate>
  )
}
