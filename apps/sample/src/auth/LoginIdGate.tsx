import {
  discardReauthState,
  linkIntentState,
  LoginIdGate as LoginIdRequiredGate,
  useAuth,
} from '@skeleton/auth'
import type { ReactNode } from 'react'
import { toast } from 'sonner'
import { loginIdRequired } from '../api/loginIdRequired'
import { queryClient } from '../app/queryClient'
import { useT } from '../i18n'
import { router } from '../routes'
import { ACCOUNT_PATH, useEnabledProviders, useLoginIdRules, useOnAccountPages } from './gateShared'
import { refreshAfterProfileChange } from './profileCache'
import { accountApi } from './session'
import { useAuthLabels } from './useAuthLabels'

/**
 * 아이디 없는 계정(소셜 첫 로그인 · 매직 링크 가입 · 기능을 켜기 전부터 있던 계정)이 앱 대신 보는 「아이디를 정해 주세요」 막(`@skeleton/auth` 의 `LoginIdGate`).
 * `main.tsx` 가 `AuthProvider` 안, 이메일 막(`EmailGate`) **바깥**에 둔다 — 서버 인터셉터와 같은 순서(아이디 → 이메일 → 약관)이고, 안쪽 막은 이 막이 걷힐 때까지 묻지 않는다.
 * 이 막은 라우터 바깥이라 「계정 설정」은 `onOpenSettings` 로 SPA 이동한다. 계정 설정(`/account`)에서는 막이 걷힌다(거기서도 정할 수 있고, 계정을 지울 수도 있다).
 */
export function LoginIdGate({ children }: { children: ReactNode }) {
  const auth = useAuth()
  const { t } = useT()
  const labels = useAuthLabels()
  const standAside = useOnAccountPages()
  const enabledProviders = useEnabledProviders()
  const rules = useLoginIdRules()
  return (
    <LoginIdRequiredGate
      controller={loginIdRequired}
      api={accountApi}
      accountId={auth.principal?.accountId ?? null}
      rules={rules}
      labels={labels}
      standAside={standAside}
      enabledProviders={enabledProviders}
      onOpenSettings={() => void router.navigate(ACCOUNT_PATH)}
      onSignOut={() => {
        void auth.logout()
        void router.navigate('/login', { replace: true })
      }}
      // 아이디를 정하기 전에 나가는 길(이미 이 주소로 가입한 계정이 있다) - 이메일 막의 같은 길과 같다: 서버가 빈 계정을 바로 지우고 모든 세션을 닫았다
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
      onChosen={() => {
        refreshAfterProfileChange(queryClient)
        toast.success(t('loginId.done'))
      }}
    >
      {children}
    </LoginIdRequiredGate>
  )
}
