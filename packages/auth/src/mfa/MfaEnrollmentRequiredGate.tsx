import { useCallback, useEffect, useState, useSyncExternalStore, type ReactNode } from 'react'
import type { AccountApi } from '../account/accountApi'
import { CodeClockProvider } from '../codeClock'
import { reauthSubjectOf, type ReauthSubject } from '../reauth/kind'
import type { AuthLabels } from '../screens/labels'
import { useRestoreFocus } from '../screens/useRestoreFocus'
import type { MfaApi } from './mfaApi'
import type { MfaEnrollmentRequiredController } from './mfaEnrollmentRequired'
import { MfaEnrollmentRequiredScreen } from './MfaEnrollmentRequiredScreen'

export type MfaEnrollmentRequiredGateProps = {
  controller: MfaEnrollmentRequiredController
  api: MfaApi
  /** 쓰는 호출: `me`(다시 인증의 종류) · `requestReauthConfirmation` - 서버의 허용 목록에 있다 */
  account: Pick<AccountApi, 'me' | 'requestReauthConfirmation'>
  /** 로그인한 계정 id(없으면 null) - 바뀌면 컨트롤러가 접는다 */
  accountId: string | null
  onSignOut: () => void
  /** 소셜 전용 계정이 증거를 요구받았다 - 앱이 계정 설정의 2단계 줄로 보낸다 */
  onProviderReauth?: (provider: string) => void
  /** 켰다(토스트 · 캐시 새로고침) - 막혔던 호출은 컨트롤러가 이미 다시 보냈다 */
  onEnrolled?: () => void
  /** true 인 동안 막을 걷고 아래 화면을 살린다 - 계정 설정(`/account`)에서 켜는 길. 컨트롤러 상태는 그대로다 */
  standAside?: boolean
  /** 인증 앱 코드 · 등록 만료를 세는 시계(서버 보정 시계) */
  now?: () => number
  labels?: Partial<AuthLabels>
  children: ReactNode
}

/**
 * 앱 맨 위(`AuthProvider` 안)에 한 번 둔다. 서버가 403 `MFA.ENROLLMENT_REQUIRED` 로 막으면 아래를 `inert` 로 두고 「2단계 인증을 켜 주세요」 화면이 덮는다 -
 * 아래 화면은 그대로 살아 있어(경로 · 입력 유지) 켜고 복구 코드를 저장하면 막혔던 호출이 다시 나가 **가던 자리에서 이어진다**.
 * 막이 열린 동안 열릴 때와 탭이 다시 보일 때마다 상태(`GET /auth/mfa`)를 다시 읽는다 - 다른 탭 · 계정 설정에서 이미 켰으면 접는다.
 */
export function MfaEnrollmentRequiredGate({
  controller,
  api,
  account,
  accountId,
  onSignOut,
  onProviderReauth,
  onEnrolled,
  standAside = false,
  now,
  labels,
  children,
}: MfaEnrollmentRequiredGateProps) {
  const state = useSyncExternalStore(controller.subscribe, controller.getState, controller.getState)
  const required = state.status === 'required'
  const [read, setRead] = useState<{ for: string; subject: ReauthSubject } | null>(null)
  const [failed, setFailed] = useState(false)
  const subject = read && read.for === accountId ? read.subject : null

  useEffect(() => {
    controller.setAccount(accountId)
  }, [accountId, controller])

  const load = useCallback(() => {
    if (!accountId) return
    account.me().then(
      (me) => setRead({ for: accountId, subject: reauthSubjectOf(me) }),
      () => setFailed(true),
    )
  }, [account, accountId])

  // 막이 열려 있는 동안: 열릴 때와 탭이 다시 보일 때마다 이미 켰는지 서버에 묻는다
  useEffect(() => {
    if (!required || !accountId) return
    load()
    const recheck = () =>
      api.status().then(
        (status) => {
          if (status.enabled) {
            controller.enrolled()
            onEnrolled?.()
          }
        },
        () => undefined,
      )
    void recheck()
    const onVisible = () => document.visibilityState === 'visible' && void recheck()
    document.addEventListener('visibilitychange', onVisible)
    window.addEventListener('focus', onVisible)
    return () => {
      document.removeEventListener('visibilitychange', onVisible)
      window.removeEventListener('focus', onVisible)
    }
  }, [required, accountId, api, controller, load, onEnrolled])
  // 로그아웃으로 떠나면 접는다(붙잡힌 호출은 403 으로 끝난다)
  useEffect(() => {
    if (!accountId && required) controller.decline()
  }, [accountId, required, controller])

  const covered = required && !standAside
  useRestoreFocus(covered)
  const screen = (
    <MfaEnrollmentRequiredScreen
      api={api}
      subject={subject}
      requestReauthCode={() => account.requestReauthConfirmation()}
      onEnrolled={() => {
        controller.enrolled()
        onEnrolled?.()
      }}
      onProviderReauth={onProviderReauth}
      onSignOut={() => {
        controller.decline()
        onSignOut()
      }}
      loadFailed={failed}
      onRetry={() => {
        setFailed(false)
        load()
      }}
      labels={labels}
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
