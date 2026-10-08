import {
  defaultAuthLabels,
  discardReauthState,
  emailReauthState,
  EmailRequiredGate,
  linkIntentState,
  useAuth,
} from '@skeleton/auth'
import type { ReactNode } from 'react'
import { toast } from 'sonner'
import { emailRequired } from '../api/emailRequired'
import { whenOuterGateSettled } from '../api/gateOrder'
import { loginIdRequired } from '../api/loginIdRequired'
import { serverClock } from '../api/serverClock'
import { queryClient } from '../app/queryClient'
import { useT } from '../i18n'
import { router } from '../routes'
import { refreshAfterProfileChange } from './profileCache'
import { ACCOUNT_PATH, useEnabledProviders, useOnAccountPages } from './gateShared'
import { accountApi } from './session'
import { useAuthLabels } from './useAuthLabels'

/** 이 막이 서버에 묻는 `me` 는 아이디 막이 확인을 마치고 걷힌 뒤에 나간다 — 두 막이 함께 열리면 안쪽 화면이 `inert` 아래에서 떠 첫 포커스를 잃는다(아이디 → 이메일 → 약관) */
const afterLoginId: typeof accountApi = {
  ...accountApi,
  async me() {
    await whenOuterGateSettled(loginIdRequired)
    return accountApi.me()
  },
}

/** 「나중에 하기」로 닫았다 - 붙잡은 쓰기는 403 으로 끝났고 전역 토스트는 이 코드를 거르므로, 아무 말 없이 실패하지 않게 한 줄로 알린다. 같은 id 라 여러 번 눌러도 한 줄이다 */
const DECLINED_TOAST_ID = 'email-required-declined'

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
  return (
    <EmailRequiredGate
      controller={emailRequired}
      api={afterLoginId}
      accountId={auth.principal?.accountId ?? null}
      labels={labels}
      now={() => serverClock.now().getTime()}
      standAside={standAside}
      enabledProviders={enabledProviders}
      onSignOut={() => {
        void auth.logout()
        void router.navigate('/login', { replace: true })
      }}
      // 이미 이 주소로 가입한 계정이 있다 - 서버가 빈 계정을 바로 지우고 모든 세션을 닫았다: 이 기기의 세션도 지우고 로그인 화면으로, 로그인하면 설정에서 그 제공자 연결을 이어 준다
      onDiscarded={(provider) => {
        void auth.logout()
        void router.navigate('/login', {
          replace: true,
          state: linkIntentState(provider, { pathname: ACCOUNT_PATH, hash: '#methods' }),
        })
      }}
      onDiscardReauth={(provider) =>
        void router.navigate(ACCOUNT_PATH, { state: discardReauthState(provider) })
      }
      // 마지막 로그인이 1시간을 넘었다 — 계정 설정이 열리자마자 그 제공자의 동의 화면으로 보낸다(돌아오면 거기서 인증번호를 이어 받는다)
      onProviderReauth={(provider, newEmail) =>
        void router.navigate(ACCOUNT_PATH, { state: emailReauthState(provider, newEmail) })
      }
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
