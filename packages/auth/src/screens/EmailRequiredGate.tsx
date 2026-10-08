import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  useSyncExternalStore,
  type ReactNode,
} from 'react'
import type { AccountApi } from '../account/accountApi'
import type { AccountMe } from '../account/types'
import { CodeClockProvider } from '../codeClock'
import { codeWindowOf, type CodeWindow } from '../codeWindow'
import type { EmailRequiredController } from '../emailRequired'
import { reauthSubjectOf } from '../reauth/kind'
import { EmailRequiredScreen } from './EmailRequiredScreen'
import { useRestoreFocus } from './useRestoreFocus'
import type { AuthLabels } from './labels'

export type EmailRequiredGateProps = {
  controller: EmailRequiredController
  /** 쓰는 호출: `me`(로그인 직후 `emailRequired` 확인 · 제공자 목록) · `changeEmail` · `confirmEmailChangeCode` — 모두 서버의 허용 목록에 있다 */
  api: Pick<AccountApi, 'me' | 'changeEmail' | 'confirmEmailChangeCode' | 'discardAccount'>
  /** 로그인한 계정 id(없으면 null) — 바뀌어 생기면 한 번 `me.emailRequired` 를 확인한다(비밀번호 · 소셜 · 링크 로그인 모두 같은 길) */
  accountId: string | null
  onSignOut: () => void
  /** 「이 계정 지우고 로그인 화면으로」가 끝났다(`POST /account/discard` 204 - 서버가 모든 세션을 닫았다) - 앱이 로컬 세션을 지우고 로그인 화면으로 보낸다. 인자는 로그인 뒤 설정에서 연결을 이어 갈 제공자 */
  onDiscarded: (provider?: string) => void
  /** 오래된 세션이라 버리기가 제공자 재동의를 요구했다 - 계정 설정으로 보내 그 제공자의 동의 화면을 연다(`discardReauthState`) */
  onDiscardReauth?: (provider: string) => void
  /** 1시간 뒤 재동의: 제공자 동의 화면으로 보낸다 */
  onProviderReauth?: (provider: string, newEmail: string) => void
  /** 등록이 끝났다(토스트 · 캐시 새로고침) — 막혔던 호출은 컨트롤러가 이미 다시 보냈다 */
  onRegistered?: () => void
  /** true 인 동안 막을 걷고 아래 화면을 살린다 — 계정 설정(`/account`)에서 이메일을 등록하는 길. 컨트롤러 상태는 그대로다 */
  standAside?: boolean
  /** 이 앱이 로그인에 켠 소셜 제공자 코드들 — 계정에 연결된 제공자 중 이것만 재동의 단추가 된다(앱이 켜지 않은 제공자의 동의 화면은 열 수 없다). 없으면 거르지 않는다 */
  enabledProviders?: string[]
  /** 인증번호 남은 시간을 세는 시계(서버 보정 시계) */
  now?: () => number
  labels?: Partial<AuthLabels>
  children: ReactNode
}

/**
 * 앱 맨 위(`AuthProvider` 안, 약관 재동의 막 `ReconsentGate` 바깥)에 한 번 둔다. 주소 없는 계정(`me.emailRequired` 또는 403 `ACCOUNT.EMAIL_REQUIRED`)이면
 * 아래를 `inert` 로 두고 「이메일을 등록해 주세요」 화면이 덮는다 — 아래 화면은 그대로 살아 있어(경로 · 입력 유지) 등록이 끝나면 막혔던 호출이 다시 나가 **가던 자리에서 이어진다**.
 * 한 번에 하나만 보인다: 이 막이 약관 막보다 위라 순서는 이메일 → 약관 → 닉네임이다.
 */
export function EmailRequiredGate({
  controller,
  api,
  accountId,
  onSignOut,
  onDiscarded,
  onDiscardReauth,
  onProviderReauth,
  onRegistered,
  standAside = false,
  enabledProviders,
  now,
  labels,
  children,
}: EmailRequiredGateProps) {
  const state = useSyncExternalStore(controller.subscribe, controller.getState, controller.getState)
  const required = state.status === 'required'
  const [allProviders, setProviders] = useState<string[]>([])
  const [pending, setPending] = useState<{ email: string; window: CodeWindow } | null>(null)
  const providers = useMemo(
    () =>
      enabledProviders ? allProviders.filter((p) => enabledProviders.includes(p)) : allProviders,
    [allProviders, enabledProviders],
  )
  const nowRef = useRef(now) // 앱이 매 렌더 새 함수를 줘도 아래 효과를 다시 돌리지 않는다
  useEffect(() => {
    nowRef.current = now
  })
  /** `me` 에서 읽을 것: 재동의에 쓸 제공자 목록, 서버에 남아 있는 대기 중 이메일 변경(만료 전인 것만) */
  const readMe = useCallback((me: AccountMe) => {
    setProviders(reauthSubjectOf(me).providers)
    const window = codeWindowOf({ expiresAt: me.pendingEmailExpiresAt })
    const clock = nowRef.current?.() ?? Date.now()
    setPending(
      me.pendingEmail && window && window.expiresAt > clock
        ? { email: me.pendingEmail, window }
        : null,
    )
  }, [])

  // 지금 계정을 컨트롤러에 알린다 — 계정이 바뀌면(다른 탭에서 다른 계정으로 로그인 · 로그아웃) 이전 계정의 화면 · 붙잡은 호출은 접히고(원래 403 으로 끝난다), 로그아웃 뒤에 늦게 온 403 은 화면을 다시 세우지 않는다
  useEffect(() => {
    controller.setAccount(accountId)
  }, [accountId, controller])
  // 로그인 직후: 이 계정이 주소를 요구받는가. 실패해도 조용히 — 막히면 호출이 403 으로 말한다
  useEffect(() => {
    if (!accountId) return
    let live = true
    api.me().then(
      (me) => {
        if (!live) return
        if (me.emailRequired === true) controller.require()
        readMe(me)
        controller.setReady(true) // 이제 다음 단계(약관 …)가 물어도 된다
      },
      () => live && controller.setReady(true), // 못 읽어도 다음 단계를 막아 두지 않는다
    )
    return () => {
      live = false
      controller.setReady(false) // 계정이 바뀌거나 로그아웃 — 다음 계정은 다시 물어봐야 안다
    }
  }, [accountId, api, controller, readMe])
  // 막이 열려 있는 동안: 열릴 때와 탭이 다시 보일 때마다 서버에 다시 묻는다 — 다른 탭에서 이미 등록했으면 접고 붙잡은 호출을 보낸다. 재동의에 쓸 제공자 목록도 이때 새로 읽는다
  useEffect(() => {
    if (!required || !accountId) return
    let live = true
    const recheck = () =>
      api.me().then(
        (me) => {
          if (!live) return
          if (me.emailRequired !== true) controller.registered()
          else readMe(me)
        },
        () => undefined,
      )
    void recheck()
    const onVisible = () => document.visibilityState === 'visible' && void recheck()
    document.addEventListener('visibilitychange', onVisible)
    window.addEventListener('focus', onVisible)
    return () => {
      live = false
      document.removeEventListener('visibilitychange', onVisible)
      window.removeEventListener('focus', onVisible)
    }
  }, [required, accountId, api, controller, readMe])
  // 로그아웃 · 계정 삭제로 떠나면 접는다(붙잡힌 호출은 403 으로 끝난다). 막이 열린 뒤에 로그아웃을 알게 돼도 접는다(`required` 가 의존)
  useEffect(() => {
    if (!accountId && required) controller.decline()
  }, [accountId, required, controller])

  const covered = required && !standAside
  useRestoreFocus(covered)
  const screen = (
    <EmailRequiredScreen
      providers={providers}
      pending={pending}
      labels={labels}
      onRequestCode={(request) => api.changeEmail(request)}
      onConfirmCode={(code) => api.confirmEmailChangeCode(code)}
      onRegistered={() => {
        controller.registered()
        onRegistered?.()
      }}
      onProviderReauth={onProviderReauth}
      onSignOut={() => {
        controller.decline()
        onSignOut()
      }}
      onDiscard={() => api.discardAccount()}
      onDiscarded={onDiscarded}
      onDiscardReauth={onDiscardReauth}
    />
  )
  return (
    <>
      <div style={{ display: 'contents' }} inert={covered}>
        {children}
      </div>
      {covered && (now ? <CodeClockProvider now={now}>{screen}</CodeClockProvider> : screen)}
    </>
  )
}
