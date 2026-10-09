import {
  defaultAuthLabels,
  discardReauthState,
  emailReauthState,
  EmailRequiredGate,
  linkIntentState,
  useAuth,
} from '@skeleton/auth'
import { useSyncExternalStore, type ReactNode } from 'react'
import { toast } from 'sonner'
import { emailRequired } from '../api/emailRequired'
import { loginIdRequired } from '../api/loginIdRequired'
import { serverClock } from '../api/serverClock'
import { queryClient } from '../app/queryClient'
import { useT } from '../i18n'
import { router } from '../routes'
import { refreshAfterProfileChange } from './profileCache'
import { DECLINED_TOAST_ID } from './accountPath'
import { ACCOUNT_PATH, useEnabledProviders, useOnAccountPages } from './gateShared'
import { accountApi } from './session'
import { useAuthLabels } from './useAuthLabels'

/**
 * 주소 없는 계정이 앱 대신 보는 「이메일을 등록해 주세요」 막(`@skeleton/auth` 의 `EmailRequiredGate`). `main.tsx` 가 `AuthProvider` 안, 약관 막(`LegalGate`) 바깥에 둔다 —
 * 순서는 서버 인터셉터와 같다: (아이디 →) 이메일 → 약관 → 닉네임. 아이디 막(`LoginIdGate`)이 그 바깥이다. 계정 설정(`/account`)에서 이메일을 등록하거나 계정을 지우는 동안은 막이 걷힌다.
 */
export function EmailGate({ children }: { children: ReactNode }) {
  const auth = useAuth()
  const { t } = useT()
  const labels = useAuthLabels()
  const standAside = useOnAccountPages()
  const enabledProviders = useEnabledProviders()
  // 이 막이 서버에 묻는 `me` 는 아이디 막이 확인을 마치고 걷힌 뒤에 나간다 - 두 막이 함께 열리면 안쪽 화면이 `inert` 아래에서 떠 첫 포커스를 잃는다(아이디 → 이메일 → 약관).
  // `deferCheck` 가 그동안 확인을 미룬다: 아이디 막에서 로그아웃하면 계정이 없어져 묻지 않는다(토큰 없는 `me` 가 401 → 「계속하려면 로그인해 주세요」 로 이어지지 않는다)
  const idFirst = useSyncExternalStore(
    loginIdRequired.subscribe,
    () => loginIdRequired.getState().status === 'required' || !loginIdRequired.isReady(),
    () => false,
  )
  return (
    <EmailRequiredGate
      controller={emailRequired}
      api={accountApi}
      accountId={auth.principal?.accountId ?? null}
      deferCheck={idFirst}
      labels={labels}
      now={() => serverClock.now().getTime()}
      standAside={standAside}
      enabledProviders={enabledProviders}
      onSignOut={() => {
        void auth.logout()
        void router.navigate('/login', { replace: true })
      }}
      // 이미 이 주소로 가입한 계정이 있다 - 서버가 빈 계정을 바로 지우고 모든 세션을 닫았다: 이 기기의 세션도 지우고 로그인 화면으로, 로그인하면 설정에서 그 제공자 연결을 이어 준다
      // 로그아웃이 **끝난 뒤에** 이동한다 - 보호된 화면(`/board` 같은 쓰기 화면)에서 로그아웃하면 라우트 가드가 「돌아올 곳」을 들고 로그인으로 보내는데, 그것이 아래 「설정에서 연결을 이어 가기」 의도를 덮지 않게
      onDiscarded={(provider) => {
        void auth.logout().finally(() =>
          router.navigate('/login', {
            replace: true,
            state: linkIntentState(provider, { pathname: ACCOUNT_PATH, hash: '#methods' }),
          }),
        )
      }}
      onDiscardReauth={(provider) =>
        void router.navigate(ACCOUNT_PATH, { state: discardReauthState(provider) })
      }
      // 마지막 로그인이 1시간을 넘었다 — 계정 설정이 열리자마자 그 제공자의 동의 화면으로 보낸다. 지금 있는 자리(경로 + 쿼리)를 실어 보내, 돌아오면 같은 자리에서 막이 다시 열려 인증번호 요청을 이어 간다
      onProviderReauth={(provider, newEmail) => {
        const { pathname, search } = router.state.location
        void router.navigate(ACCOUNT_PATH, {
          state: emailReauthState(provider, newEmail, `${pathname}${search}`),
        })
      }}
      onLater={() =>
        toast.info(labels.emailRequiredDeclined ?? defaultAuthLabels.emailRequiredDeclined, {
          id: DECLINED_TOAST_ID,
        })
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
