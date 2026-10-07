import { ErrorCodes, isErrorCode } from '@skeleton/api-client'
import { Alert, PageHeader, SectionIndex, Skeleton } from '@skeleton/ui'
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import type { AccountApi, SocialReauth } from '../account/accountApi'
import { supportedTimeZones, withCurrent } from '../account/timeZones'
import type { AccountMe, DeletionResult, PasswordPolicy } from '../account/types'
import { reauthSubjectOf } from '../reauth/kind'
import type { ProviderAction } from '../socialLink'
import { AccountStateNotice } from './AccountStateNotice'
import { DeleteAccountSection } from './DeleteAccountSection'
import { EmailSection } from './EmailSection'
import { PasswordSection } from './PasswordSection'
import { ProfileSection } from './ProfileSection'
import { SessionsSection } from './SessionsSection'
import { SignInMethodsSection } from './SignInMethodsSection'
import styles from './auth.module.css'
import { authErrorMessage } from './errors'
import { mergeLabels, type AuthLabels } from './labels'
import type { SocialProviderButton } from './methods'
import { labelOfMethod } from './methodsList'
import { useResource } from './useResource'

export type AccountSectionName =
  | 'profile'
  | 'password'
  | 'email'
  | 'methods'
  | 'sessions'
  | 'delete'

export type AccountSettingsProps = {
  api: AccountApi
  labels?: Partial<AuthLabels>
  /** 새 비밀번호를 한 번 더 입력받는다(기본 false — 모듈은 중립이라 앱이 켠다) */
  confirmPassword?: boolean
  /** 끄고 싶은 절만 `false` — 기본은 모두 켠다 */
  sections?: Partial<Record<AccountSectionName, boolean>>
  /** 이 앱이 켜 둔 소셜 제공자(계정 연결 버튼) */
  socialProviders?: SocialProviderButton[]
  onLinkSocial?: (provider: string) => void
  /** 프로필에서 고르는 언어(앱이 지원하는 것) */
  locales: Array<{ value: string; label: string }>
  /** 기본: 브라우저가 아는 시간대 */
  timeZones?: string[]
  /** 서버의 삭제 유예 기간(안내 문장) — 기본 30 */
  graceDays?: number
  /** 서버가 탈퇴 취소(`skeleton.account.deletion.self-restore`)를 켰다 — 삭제 안내에 「기간 안에 다시 로그인하면 취소할 수 있어요」를 더한다. 앱은 서버 설정을 알 때만 켠다(꺼진 서버에서는 거짓이 된다). 기본 false */
  selfRestore?: boolean
  onDeleted?: (result: DeletionResult) => void
  /** 프로필(닉네임 · 언어 · 시간대)을 저장했다 — 저장된 프로필과 함께. 앱이 닉네임이 걸린 자기 캐시 · 화면(게시판 작성자 …)을 다시 읽게 한다 */
  onProfileChanged?: (profile: AccountMe) => void
  formatDate?: (iso: string) => string
  /** 접근 불가 · 정지일 때 「문의」 링크 */
  supportHref?: string
  /** 방금 연결한 소셜 제공자(연결 콜백이 돌아온 직후) — 서버가 계정 주소로 알림 메일을 보냈다는 안내를 보인다 */
  linkedProvider?: string
  /**
   * 주소가 없는 계정의 다시 인증 — 이 제공자의 동의 화면으로 보낸다(앱이 `socialLinkFlow.start(provider, { accountId, action })` 로 state 에 하려던 작업과 계정을 묶는다).
   * 없으면 그 계정은 이메일 변경 · 연결 해제 · 삭제를 못 한다(서버가 `403 ACCOUNT.REAUTH_REQUIRED`)
   */
  onProviderReauth?: (provider: string, action: ProviderAction) => void
  /** 제공자 동의를 마치고 돌아왔다 — 하려던 작업과 그 제공자가 준 새 인가 코드. 이 화면이 한 번만 이어서 한다 */
  resume?: { action: ProviderAction; socialReauth: SocialReauth } | null
  /** `resume` 을 읽었다(앱이 돌아온 주소의 state 를 비운다) */
  onResumeConsumed?: () => void
}

const ALL: AccountSectionName[] = ['profile', 'password', 'email', 'methods', 'sessions', 'delete']

/**
 * 계정 설정 — `AccountApi` 하나로 프로필 · 비밀번호 · 이메일 · 로그인 수단 · 세션 · 삭제를 잇는다.
 * 절마다 끄고 켤 수 있고(`sections`), 서버가 정지(403 `AUTH.ACCOUNT_SUSPENDED`)나 차단(403)을 말하면 안내 화면으로 바뀐다.
 */
export function AccountSettings({
  api,
  labels: given,
  confirmPassword,
  sections,
  socialProviders,
  onLinkSocial,
  locales,
  timeZones,
  graceDays = 30,
  selfRestore = false,
  onDeleted,
  onProfileChanged,
  formatDate,
  supportHref,
  linkedProvider,
  onProviderReauth,
  resume,
  onResumeConsumed,
}: AccountSettingsProps) {
  const labels = mergeLabels(given)
  const on = (name: AccountSectionName) => sections?.[name] !== false
  const sessionsOn = sections?.sessions !== false
  const passwordOn = sections?.password !== false
  const me = useResource(useCallback(() => api.me(), [api]))
  const [resumeError, setResumeError] = useState<unknown>(null)
  // 제공자 동의 왕복에서 돌아온 증거로 이어 갈 작업 — 처음 그릴 때부터 알고 있다(앱이 `resume` 을 첫 렌더에 준다)
  const [emailResume, setEmailResume] = useState<{ newEmail: string; provider: string } | null>(
    () =>
      resume?.action.kind === 'email-change'
        ? { newEmail: resume.action.newEmail, provider: resume.socialReauth.provider }
        : null,
  )
  const [deleteResume, setDeleteResume] = useState<SocialReauth | null>(() =>
    resume?.action.kind === 'delete' ? resume.socialReauth : null,
  )
  const resumed = useRef(false)
  const sessions = useResource(
    useCallback(() => (sessionsOn ? api.sessions() : Promise.resolve([])), [api, sessionsOn]),
  )
  const policy = useResource(
    useCallback(
      (): Promise<PasswordPolicy | undefined> =>
        passwordOn ? api.passwordPolicy() : Promise.resolve(undefined),
      [api, passwordOn],
    ),
  )
  const reloadMe = me.reload
  const reloadSessions = sessions.reload

  // 제공자 동의 왕복에서 돌아왔다 — 하려던 작업을 **한 번만** 이어서 한다(인가 코드는 한 번 쓰면 끝이라 StrictMode 의 두 번째 효과가 다시 내지 않게 ref 로 막는다)
  useEffect(() => {
    if (!resume || resumed.current) return
    resumed.current = true
    const { action, socialReauth } = resume
    onResumeConsumed?.()
    if (action.kind === 'email-change') {
      api.changeEmail({ newEmail: action.newEmail, socialReauth }).then(
        () => {
          setEmailResume(null)
          reloadMe()
        },
        (error: unknown) => {
          setEmailResume(null)
          setResumeError(error)
        },
      )
    } else if (action.kind === 'unlink')
      api.unlinkIdentity(action.identityId, { socialReauth }).then(() => {
        reloadMe()
        reloadSessions() // 서버가 이 계정의 다른 세션을 닫는다
      }, setResumeError)
  }, [resume, api, reloadMe, reloadSessions, onResumeConsumed])

  const requestReauthCode = useCallback(() => api.requestReauthConfirmation(), [api])
  const requestDeleteCode = useCallback(() => api.requestDeleteConfirmation(), [api])
  const subject = useMemo(() => {
    if (!me.data) return null
    const base = reauthSubjectOf(me.data)
    // 앱이 동의 화면을 열 수 있는 제공자만(설정되지 않은 제공자는 왕복을 시작할 수 없다)
    return socialProviders
      ? {
          ...base,
          providers: base.providers.filter((p) => socialProviders.some((s) => s.provider === p)),
        }
      : base
  }, [me.data, socialProviders])

  if (me.error) {
    if (isErrorCode(me.error, ErrorCodes.AUTH_ACCOUNT_SUSPENDED))
      return <AccountStateNotice kind="suspended" supportHref={supportHref} labels={given} />
    if (isErrorCode(me.error, ErrorCodes.COMMON_FORBIDDEN))
      return <AccountStateNotice kind="blocked" supportHref={supportHref} labels={given} />
    return <Alert tone="danger">{authErrorMessage(me.error, labels).message}</Alert>
  }
  if (!me.data || !subject) return <Skeleton />
  const account = me.data
  const zones = withCurrent(timeZones ?? supportedTimeZones(), account.timeZone)
  const items = ALL.filter(on).map((id) => ({
    id,
    label: {
      profile: labels.sectionProfile,
      password: labels.sectionPassword,
      email: labels.sectionEmail,
      methods: labels.sectionMethods,
      sessions: labels.sectionSessions,
      delete: labels.sectionDelete,
    }[id],
  }))

  return (
    <div className={styles.sections}>
      <PageHeader title={labels.settingsTitle} description={account.email ?? undefined} />
      <SectionIndex items={items} label={labels.settingsIndexLabel} />
      {resumeError !== null && (
        <Alert tone="danger">{authErrorMessage(resumeError, labels).message}</Alert>
      )}
      {on('profile') && (
        <ProfileSection
          profile={account}
          locales={locales}
          timeZones={zones}
          labels={given}
          onSave={async (patch) => {
            const saved = await api.updateProfile(patch)
            me.reload()
            onProfileChanged?.(saved)
          }}
        />
      )}
      {on('password') && (
        <PasswordSection
          subject={subject}
          policy={policy.data}
          email={account.email ?? undefined}
          requestReauthCode={requestReauthCode}
          labels={given}
          confirmPassword={confirmPassword}
          onChange={async (request) => {
            await api.changePassword(request)
            me.reload()
            sessions.reload()
          }}
        />
      )}
      {on('email') && (
        <EmailSection
          email={account.email}
          verified={account.emailVerified}
          subject={subject}
          pendingEmail={account.pendingEmail}
          pendingEmailExpiresAt={account.pendingEmailExpiresAt}
          formatDate={formatDate}
          requestReauthCode={requestReauthCode}
          resume={emailResume}
          onProviderReauth={
            onProviderReauth &&
            ((provider, newEmail) => onProviderReauth(provider, { kind: 'email-change', newEmail }))
          }
          labels={given}
          onChangeEmail={async (request) => {
            const sent = await api.changeEmail(request)
            me.reload() // 대기 중인 새 주소(`pendingEmail`)는 요청이 끝나기 전에 서버에 저장된다
            return sent // 응답의 `expiresAt` · `resendAvailableAt` 이 있으면 인증번호 남은 시간이 그 값을 쓴다
          }}
          onConfirmCode={(code) => api.confirmEmailChangeCode(code)}
          onConfirmed={() => {
            me.reload()
            sessions.reload() // 서버가 이 세션만 남기고 다른 세션을 닫는다
          }}
        />
      )}
      {on('methods') && (
        <SignInMethodsSection
          identities={account.methods}
          socialProviders={socialProviders}
          subject={subject}
          requestReauthCode={requestReauthCode}
          onProviderReauth={
            onProviderReauth &&
            ((provider, identityId) => onProviderReauth(provider, { kind: 'unlink', identityId }))
          }
          onLink={onLinkSocial}
          notice={
            linkedProvider
              ? labels.methodLinkedNotice(labelOfMethod(linkedProvider, labels))
              : undefined
          }
          formatDate={formatDate}
          labels={given}
          onUnlink={async (id, reauth) => {
            await api.unlinkIdentity(id, reauth)
            me.reload()
            sessions.reload() // 서버가 이 계정의 다른 세션을 닫는다
          }}
        />
      )}
      {on('sessions') && (
        <SessionsSection
          sessions={sessions.data ?? []}
          formatDate={formatDate}
          labels={given}
          onRevoke={async (id) => {
            await api.revokeSession(id)
            sessions.reload()
          }}
          onRevokeOthers={async () => {
            await api.revokeOtherSessions()
            sessions.reload()
          }}
        />
      )}
      {on('delete') && (
        <DeleteAccountSection
          subject={subject}
          graceDays={graceDays}
          selfRestore={selfRestore}
          formatDate={formatDate}
          labels={given}
          requestDeleteCode={requestDeleteCode}
          onDelete={(credential) => api.deleteAccount(credential)}
          onProviderReauth={
            onProviderReauth && ((provider) => onProviderReauth(provider, { kind: 'delete' }))
          }
          resume={deleteResume}
          onResumeSpent={() => setDeleteResume(null)}
          onDeleted={onDeleted}
        />
      )}
    </div>
  )
}
