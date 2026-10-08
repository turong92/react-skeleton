import { emailReauthState, EmailRequiredGate, useAuth } from '@skeleton/auth'
import { useSyncExternalStore, type ReactNode } from 'react'
import { toast } from 'sonner'
import { emailRequired } from '../api/emailRequired'
import { serverClock } from '../api/serverClock'
import { queryClient } from '../app/queryClient'
import { useT } from '../i18n'
import { router } from '../routes'
import { refreshAfterProfileChange } from './profileCache'
import { accountApi } from './session'
import { useAuthLabels } from './useAuthLabels'

const ACCOUNT_PATH = '/account'
/** 계정 설정과 그 제공자 콜백(`/account/link-callback`) — 이메일을 등록하거나 계정을 지우는 길이라 막을 걷는다. `/account-deleted` 는 해당 없다 */
const onAccountPages = (pathname: string) =>
  pathname === ACCOUNT_PATH || pathname.startsWith(`${ACCOUNT_PATH}/`)

/** 라우터의 지금 경로 — 이 막은 라우터 바깥(`main.tsx`)에 있어 훅 대신 구독한다 */
function usePathname() {
  return useSyncExternalStore(
    router.subscribe,
    () => router.state.location.pathname,
    () => '/',
  )
}

/**
 * 주소 없는 계정이 앱 대신 보는 「이메일을 등록해 주세요」 막(`@skeleton/auth` 의 `EmailRequiredGate`). `main.tsx` 가 `AuthProvider` 안, 약관 막(`LegalGate`) 바깥에 둔다 —
 * 순서는 서버 인터셉터와 같다: 이메일 → 약관 → 닉네임. 계정 설정(`/account`)에서 이메일을 등록하거나 계정을 지우는 동안은 막이 걷힌다.
 */
export function EmailGate({ children }: { children: ReactNode }) {
  const auth = useAuth()
  const { t } = useT()
  const labels = useAuthLabels()
  const standAside = onAccountPages(usePathname())
  return (
    <EmailRequiredGate
      controller={emailRequired}
      api={accountApi}
      accountId={auth.principal?.accountId ?? null}
      labels={labels}
      now={() => serverClock.now().getTime()}
      standAside={standAside}
      onSignOut={() => {
        void auth.logout()
        void router.navigate('/login', { replace: true })
      }}
      onDelete={() => void router.navigate(`${ACCOUNT_PATH}#delete`)}
      // 마지막 로그인이 1시간을 넘었다 — 계정 설정이 열리자마자 그 제공자의 동의 화면으로 보낸다(돌아오면 거기서 인증번호를 이어 받는다)
      onProviderReauth={(provider, newEmail) =>
        void router.navigate(ACCOUNT_PATH, { state: emailReauthState(provider, newEmail) })
      }
      onRegistered={() => {
        refreshAfterProfileChange(queryClient)
        toast.success(t('emailRequired.done'))
      }}
    >
      {children}
    </EmailRequiredGate>
  )
}
