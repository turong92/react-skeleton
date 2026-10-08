import { ErrorCodes, isErrorCode } from '@skeleton/api-client'
import { Alert, PageHeader, SectionIndex, Skeleton } from '@skeleton/ui'
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import type { AccountApi, SocialReauth } from '../account/accountApi'
import { supportedTimeZones, withCurrent } from '../account/timeZones'
import type { AccountMe, DeletionResult, PasswordPolicy } from '../account/types'
import { reauthSubjectOf } from '../reauth/kind'
import type { ProviderAction } from '../socialLink'
import { AccountStateNotice } from './AccountStateNotice'
import { ContactEmailSection } from './ContactEmailSection'
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
  | 'contact'
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
  /** 계정 닉네임 줄을 보인다(기본 true) — 글 · 댓글의 이름을 작성자 닉네임(`@skeleton/author-profile`)으로 따로 쓰는 앱은 끈다. 언어 · 시간대는 남는다 */
  showDisplayName?: boolean
  /** 프로필(닉네임 · 언어 · 시간대)을 저장했다 — 저장된 프로필과 함께. 앱이 닉네임이 걸린 자기 캐시 · 화면(게시판 작성자 …)을 다시 읽게 한다 */
  onProfileChanged?: (profile: AccountMe) => void
  formatDate?: (iso: string) => string
  /**
   * 「연락받을 이메일」 구역을 둔다(기본 false — 서버가 `skeleton.account.contact-email.enabled` 를 켠 앱만). 서버가 기능을 껐으면 `me` 에 `contactEmail` 키가 없어 구역은 그려지지 않는다(옛 서버가 404 로 답하면 구역은 스스로 사라진다)
   */
  contactEmail?: boolean
  /** 주소가 없던 계정의 첫 이메일이 확인됐다(이메일 필수 앱의 막을 걷는다 — 보통 `emailRequired.registered()`) */
  onEmailRegistered?: () => void
  /** 접근 불가 · 정지일 때 「문의」 링크 */
  supportHref?: string
  /** 방금 연결한 소셜 제공자(연결 콜백이 돌아온 직후) — 서버가 계정 주소로 알림 메일을 보냈다는 안내를 보인다 */
  linkedProvider?: string
  /** 「같은 이메일의 계정이 있다」 안내에서 로그인하고 온 사용자 — 로그인 수단 구역이 그 제공자의 「연결」을 이어서 하라고 강조한다 */
  linkIntent?: { provider: string }
  /**
   * 주소가 없는 계정의 다시 인증 — 이 제공자의 동의 화면으로 보낸다(앱이 `socialLinkFlow.start(provider, { accountId, action })` 로 state 에 하려던 작업과 계정을 묶는다).
   * 없으면 그 계정은 이메일 변경 · 연결 해제 · 삭제를 못 한다(서버가 `403 ACCOUNT.REAUTH_REQUIRED`)
   */
  onProviderReauth?: (provider: string, action: ProviderAction) => void
  /** 제공자 동의를 마치고 돌아왔다 — 하려던 작업과 그 제공자가 준 새 인가 코드. 이 화면이 한 번만 이어서 한다 */
  resume?: { action: ProviderAction; socialReauth: SocialReauth } | null
  /** 등록 미완료 계정 버리기가 끝났다(제공자 재동의에서 돌아와 이어서 부른 `POST /account/discard` 가 204) - 서버가 모든 세션을 닫았다. 앱이 로컬 세션을 지우고 로그인 화면으로 보낸다. 인자는 그 제공자(로그인 뒤 연결을 이어 가려고) */
  onDiscarded?: (provider: string) => void
  /** `resume` 을 읽었다(앱이 돌아온 주소의 state 를 비운다) */
  onResumeConsumed?: () => void
}

const ALL: AccountSectionName[] = [
  'profile',
  'password',
  'email',
  'contact',
  'methods',
  'sessions',
  'delete',
]

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
  showDisplayName,
  onDeleted,
  onProfileChanged,
  formatDate,
  supportHref,
  contactEmail: contactOn = false,
  onEmailRegistered,
  linkedProvider,
  linkIntent,
  onProviderReauth,
  resume,
  onResumeConsumed,
  onDiscarded,
}: AccountSettingsProps) {
  const labels = mergeLabels(given)
  const on = (name: AccountSectionName) =>
    sections?.[name] !== false && (name !== 'contact' || contactOn)
  // 연락받을 이메일 구역은 서버가 `me.contactEmail` 키를 줄 때만 그린다(키 없음 = 서버가 기능을 껐다 · 옛 서버) - 404 를 받아야 꺼진 줄 알게 두지 않는다
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
  const [contactResume] = useState<{
    email: string
    socialReauth: SocialReauth
  } | null>(() =>
    resume?.action.kind === 'contact-email'
      ? { email: resume.action.email, socialReauth: resume.socialReauth }
      : null,
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
    } else if (action.kind === 'discard') {
      api
        .discardAccount({ socialReauth })
        .then(() => onDiscarded?.(socialReauth.provider), setResumeError)
    } else if (action.kind === 'unlink')
      api.unlinkIdentity(action.identityId, { socialReauth }).then(() => {
        reloadMe()
        reloadSessions() // 서버가 이 계정의 다른 세션을 닫는다
      }, setResumeError)
  }, [resume, api, reloadMe, reloadSessions, onResumeConsumed, onDiscarded])

  // 주소의 해시(`#delete` · `#email` …)가 가리키는 구역으로 간다 — 구역이 그려진 뒤(`me` 를 읽은 뒤)에, 해시가 바뀔 때도. 제목에 포커스를 두어 낭독이 도착한 자리를 알린다
  const ready = !!me.data
  useEffect(() => {
    if (!ready) return
    const go = () => {
      const id = window.location.hash.slice(1)
      if (!(ALL as string[]).includes(id)) return
      const section = document.getElementById(id)
      section?.scrollIntoView({ block: 'start' })
      document.getElementById(`${id}-title`)?.focus({ preventScroll: true })
    }
    go()
    window.addEventListener('hashchange', go)
    return () => window.removeEventListener('hashchange', go)
  }, [ready])

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
      contact: labels.sectionContactEmail,
      methods: labels.sectionMethods,
      sessions: labels.sectionSessions,
      delete: labels.sectionDelete,
    }[id],
  }))

  const emailSection = (
    <EmailSection
      email={account.email}
      verified={account.emailVerified}
      subject={subject}
      pendingEmail={account.pendingEmail}
      pendingEmailExpiresAt={account.pendingEmailExpiresAt}
      formatDate={formatDate}
      requestReauthCode={requestReauthCode}
      resume={emailResume}
      required={account.emailRequired !== undefined}
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
        onEmailRegistered?.()
      }}
    />
  )
  const deleteSection = (
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
  )

  // 이메일이 필수인 앱에서 아직 주소가 없다 — 서버가 이 두 가지(이메일 등록 · 계정 삭제)만 열어 둔다. 나머지 구역은 호출이 403 이라 그리지 않는다.
  // 같은 자리(순서)에 그려서 등록이 끝나 모든 구역이 열려도 이메일 구역이 그대로 남아 「등록했어요」 안내를 이어 보인다
  const restricted = account.emailRequired === true
  return (
    <div className={styles.sections}>
      <PageHeader
        title={labels.settingsTitle}
        description={restricted ? undefined : (account.email ?? undefined)}
      />
      {restricted && <Alert tone="warning">{labels.emailRequiredSettingsNotice}</Alert>}
      {!restricted && <SectionIndex items={items} label={labels.settingsIndexLabel} />}
      {resumeError !== null && (
        <Alert tone="danger">{authErrorMessage(resumeError, labels).message}</Alert>
      )}
      {!restricted && on('profile') && (
        <ProfileSection
          profile={account}
          locales={locales}
          timeZones={zones}
          labels={given}
          showDisplayName={showDisplayName}
          onSave={async (patch) => {
            const saved = await api.updateProfile(patch)
            me.reload()
            onProfileChanged?.(saved)
          }}
        />
      )}
      {!restricted && on('password') && (
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
      {(restricted || on('email')) && emailSection}
      {!restricted && on('contact') && account.contactEmail !== undefined && (
        <ContactEmailSection
          contactEmail={account.contactEmail ?? null}
          labels={given}
          onRequestCode={(email, proof) => api.requestContactEmail(email, proof)}
          providers={subject.providers}
          onProviderReauth={
            onProviderReauth &&
            ((provider, email) => onProviderReauth(provider, { kind: 'contact-email', email }))
          }
          resume={contactResume}
          onConfirmCode={(code) => api.confirmContactEmail(code)}
          onRemove={() => api.removeContactEmail()}
          onChanged={me.reload}
        />
      )}
      {!restricted && on('methods') && (
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
          linkIntent={linkIntent}
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
      {!restricted && on('sessions') && (
        <SessionsSection
          sessions={sessions.data ?? []}
          formatDate={formatDate}
          labels={given}
          onRevoke={async (id) => {
            await api.revokeSession(id)
            sessions.reload()
          }}
          contactNote={on('contact') && account.contactEmail !== undefined}
          onRevokeOthers={async () => {
            await api.revokeOtherSessions()
            sessions.reload()
            me.reload() // 주인의 복구 동작이 연락받을 이메일을 비웠을 수 있다
          }}
        />
      )}
      {(restricted || on('delete')) && deleteSection}
    </div>
  )
}
