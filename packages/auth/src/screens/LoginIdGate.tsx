import {
  useCallback,
  useEffect,
  useMemo,
  useState,
  useSyncExternalStore,
  type ReactNode,
} from 'react'
import type { AccountApi } from '../account/accountApi'
import { DEFAULT_LOGIN_ID_RULES, type LoginIdRules } from '../account/loginIdRules'
import type { AccountMe } from '../account/types'
import type { LoginIdRequiredController } from '../loginIdRequired'
import { reauthSubjectOf } from '../reauth/kind'
import { LoginIdRequiredScreen } from './LoginIdRequiredScreen'
import { useRestoreFocus } from './useRestoreFocus'
import type { AuthLabels } from './labels'

export type LoginIdGateProps = {
  controller: LoginIdRequiredController
  /** 쓰는 호출: `me`(로그인 직후 `loginId` 확인 · 제공자 목록) · `setLoginId` · `checkLoginId` · `discardAccount` — 모두 서버의 허용 목록에 있다 */
  api: Pick<AccountApi, 'me' | 'setLoginId' | 'checkLoginId' | 'discardAccount'>
  /** 로그인한 계정 id(없으면 null) — 바뀌어 생기면 한 번 `me.loginId` 를 확인한다(비밀번호 · 소셜 · 링크 로그인 모두 같은 길) */
  accountId: string | null
  /** `GET /auth/methods` 의 `loginId` 길이 규칙. 없으면 서버의 기본(4~20) */
  rules?: LoginIdRules
  onSignOut: () => void
  /** 「이미 계정이 있나요?」가 끝났다(`POST /account/discard` 204 - 서버가 모든 세션을 닫았다) - 앱이 로컬 세션을 지우고 로그인 화면으로 보낸다. 인자는 로그인 뒤 설정에서 연결을 이어 갈 제공자 */
  onDiscarded: (provider?: string) => void
  /** 오래된 세션이라 버리기가 제공자 재동의를 요구했다 - 계정 설정으로 보내 그 제공자의 동의 화면을 연다 */
  onDiscardReauth?: (provider: string) => void
  /** 아이디를 정했다(토스트 · 캐시 새로고침) — 막혔던 호출은 컨트롤러가 이미 다시 보냈다 */
  onChosen?: () => void
  /** true 인 동안 막을 걷고 아래 화면을 살린다 — 계정 설정(`/account`). 컨트롤러 상태는 그대로다 */
  standAside?: boolean
  /** 이 앱이 로그인에 켠 소셜 제공자 - 계정에 연결된 제공자 중 이것만 재동의 단추가 된다. 없으면 거르지 않는다 */
  enabledProviders?: string[]
  /** 「계정 설정」 링크의 목적지(기본 `/account`) */
  settingsTo?: string
  labels?: Partial<AuthLabels>
  children: ReactNode
}

/**
 * 앱 맨 위(`AuthProvider` 안, 이메일 막 `EmailRequiredGate` 바깥)에 한 번 둔다. 아이디가 없는 계정(`me.loginId === null` 또는 403 `ACCOUNT.LOGIN_ID_REQUIRED`)이면
 * 아래를 `inert` 로 두고 「아이디를 정해 주세요」 화면이 덮는다 — 아래 화면은 그대로 살아 있어(경로 · 입력 유지) 정하고 나면 막혔던 호출이 다시 나가 **가던 자리에서 이어진다**.
 * 서버 인터셉터와 같은 순서다: 아이디 → 이메일 → 약관. `me` 에 `loginId` 키가 없으면(꺼진 서버 · 옛 서버) 열리지 않는다.
 */
export function LoginIdGate({
  controller,
  api,
  accountId,
  rules = DEFAULT_LOGIN_ID_RULES,
  onSignOut,
  onDiscarded,
  onDiscardReauth,
  onChosen,
  standAside = false,
  enabledProviders,
  settingsTo,
  labels,
  children,
}: LoginIdGateProps) {
  const state = useSyncExternalStore(controller.subscribe, controller.getState, controller.getState)
  const required = state.status === 'required'
  const [allProviders, setProviders] = useState<string[]>([])
  /** 주소 없는 계정이 이메일 필수를 켠 앱에 있다 → 「이미 계정이 있나요?」 길(`DiscardPath` 의 조건 그대로) */
  const [discardable, setDiscardable] = useState(false)
  const providers = useMemo(
    () =>
      enabledProviders ? allProviders.filter((p) => enabledProviders.includes(p)) : allProviders,
    [allProviders, enabledProviders],
  )
  const readMe = useCallback((me: AccountMe) => {
    setProviders(reauthSubjectOf(me).providers)
    setDiscardable(!me.email && (me.emailRequired === true || me.emailRequiredToWrite === true))
  }, [])

  // 지금 계정을 컨트롤러에 알린다 — 계정이 바뀌면 이전 계정의 화면 · 붙잡은 호출은 접히고(원래 403 으로 끝난다), 로그아웃 뒤에 늦게 온 403 은 화면을 다시 세우지 않는다
  useEffect(() => {
    controller.setAccount(accountId)
  }, [accountId, controller])
  // 로그인 직후: 이 계정이 아이디를 정해야 하는가(`loginId === null`). 실패해도 조용히 — 막히면 호출이 403 으로 말한다
  useEffect(() => {
    if (!accountId) return
    let live = true
    api.me().then(
      (me) => {
        if (!live) return
        if (me.loginId === null) controller.require()
        readMe(me)
        controller.setReady(true) // 이제 다음 단계(이메일 · 약관 …)가 물어도 된다
      },
      () => live && controller.setReady(true), // 못 읽어도 다음 단계를 막아 두지 않는다
    )
    return () => {
      live = false
      controller.setReady(false) // 계정이 바뀌거나 로그아웃 — 다음 계정은 다시 물어봐야 안다
    }
  }, [accountId, api, controller, readMe])
  // 막이 열려 있는 동안: 열릴 때와 탭이 다시 보일 때마다 서버에 다시 묻는다 — 다른 탭에서 이미 정했으면(`loginId` 가 문자열) 접고 붙잡은 호출을 보낸다
  const recheck = useCallback(
    () =>
      api.me().then(
        (me) => {
          if (typeof me.loginId === 'string') controller.chosen()
          else readMe(me)
        },
        () => undefined,
      ),
    [api, controller, readMe],
  )
  useEffect(() => {
    if (!required || !accountId) return
    let live = true
    const check = () => live && void recheck()
    check()
    const onVisible = () => document.visibilityState === 'visible' && check()
    document.addEventListener('visibilitychange', onVisible)
    window.addEventListener('focus', onVisible)
    return () => {
      live = false
      document.removeEventListener('visibilitychange', onVisible)
      window.removeEventListener('focus', onVisible)
    }
  }, [required, accountId, recheck])
  // 로그아웃 · 계정 삭제로 떠나면 접는다(붙잡힌 호출은 403 으로 끝난다)
  useEffect(() => {
    if (!accountId && required) controller.decline()
  }, [accountId, required, controller])

  const covered = required && !standAside
  useRestoreFocus(covered)
  return (
    <>
      <div style={{ display: 'contents' }} inert={covered}>
        {children}
      </div>
      {covered && (
        <LoginIdRequiredScreen
          rules={rules}
          api={api}
          labels={labels}
          settingsTo={settingsTo}
          onSubmit={(loginId) => api.setLoginId(loginId)}
          onChosen={() => {
            controller.chosen()
            onChosen?.()
          }}
          onAlreadySet={() => void recheck()}
          onSignOut={() => {
            controller.decline()
            onSignOut()
          }}
          discard={
            discardable
              ? {
                  providers,
                  onDiscard: () => api.discardAccount(),
                  onDiscarded,
                  onDiscardReauth,
                }
              : undefined
          }
        />
      )}
    </>
  )
}
