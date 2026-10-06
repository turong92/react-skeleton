import { ErrorCodes, isErrorCode } from '@skeleton/api-client'
import { Alert, PageHeader, SectionIndex, Skeleton } from '@skeleton/ui'
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import type { AccountApi } from '../account/accountApi'
import { supportedTimeZones, withCurrent } from '../account/timeZones'
import type { DeletionResult, PasswordPolicy } from '../account/types'
import type { ReauthStore } from '../reauth'
import { listenForReauthToken, type ReauthChannel } from '../reauthChannel'
import type { ReauthLandingOutcome } from '../reauthLanding'
import { AccountStateNotice } from './AccountStateNotice'
import { DeleteAccountSection } from './DeleteAccountSection'
import { EmailSection } from './EmailSection'
import { PasswordSection } from './PasswordSection'
import { ProfileSection } from './ProfileSection'
import type { ReauthSupport } from './ReauthNotices'
import { SessionsSection } from './SessionsSection'
import { SignInMethodsSection } from './SignInMethodsSection'
import styles from './auth.module.css'
import { authErrorMessage } from './errors'
import { mergeLabels, type AuthLabels } from './labels'
import type { SocialProviderButton } from './methods'
import { labelOfMethod } from './methodsList'
import { reloadLater } from './reloadLater'
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
  /** `/confirm-delete?token=` 로 들어왔을 때 */
  confirmationToken?: string
  onDeleted?: (result: DeletionResult) => void
  formatDate?: (iso: string) => string
  /** 접근 불가 · 정지일 때 「문의」 링크 */
  supportHref?: string
  /**
   * 비밀번호 없는 계정의 다시 인증(이메일 변경 · 첫 비밀번호 · 소셜 연결) — 하려던 작업 · 받은 토큰의 보관소.
   * 없으면 이 절들은 서버의 `403 ACCOUNT.REAUTH_REQUIRED` 를 오류 줄로 보일 뿐이다
   */
  reauth?: ReauthStore
  /** 본인 확인 링크를 연 새 탭이 토큰을 이 탭에 넘기는 길(`createBroadcastReauthChannel`) */
  reauthChannel?: ReauthChannel | null
  /** 방금 연결한 소셜 제공자(연결 콜백이 돌아온 직후) — 서버가 계정 주소로 알림 메일을 보냈다는 안내를 보인다 */
  linkedProvider?: string
}

const ALL: AccountSectionName[] = ['profile', 'password', 'email', 'methods', 'sessions', 'delete']

/**
 * 계정 설정 — `AccountApi` 하나로 프로필 · 비밀번호 · 이메일 · 로그인 수단 · 세션 · 삭제를 잇는다.
 * 절마다 끄고 켤 수 있고(`sections`), 서버가 정지(403 `AUTH.ACCOUNT_SUSPENDED`)나 차단(403)을 말하면 안내 화면으로 바뀐다.
 */
export function AccountSettings({
  api,
  labels: given,
  sections,
  socialProviders,
  onLinkSocial,
  locales,
  timeZones,
  graceDays = 30,
  confirmationToken,
  onDeleted,
  formatDate,
  supportHref,
  reauth,
  reauthChannel,
  linkedProvider,
}: AccountSettingsProps) {
  const labels = mergeLabels(given)
  const on = (name: AccountSectionName) => sections?.[name] !== false
  const sessionsOn = sections?.sessions !== false
  const passwordOn = sections?.password !== false
  const me = useResource(useCallback(() => api.me(), [api]))
  const [handoff, setHandoff] = useState<ReauthLandingOutcome | null>(null)
  const [linkNotice, setLinkNotice] = useState<string | null>(null)
  const reload = me.reload
  const pendingSeen = useRef(false)
  const stopLater = useRef<() => void>(() => undefined)
  useEffect(() => () => stopLater.current(), [])
  const pendingEmail = me.data?.pendingEmail
  useEffect(() => {
    pendingSeen.current = !!pendingEmail
  }, [pendingEmail])
  // 하려던 작업을 기억하는 이 탭이 본인 확인 링크를 연 다른 탭의 토큰을 받아 이어 간다
  useEffect(() => {
    if (!reauth || !reauthChannel) return undefined
    return listenForReauthToken({
      channel: reauthChannel,
      store: reauth,
      accountApi: api,
      onOutcome: (outcome) => {
        setHandoff(outcome)
        reload()
        if (outcome.status === 'completed') {
          stopLater.current()
          stopLater.current = reloadLater(
            reload,
            [400, 1500, 4000, 8000],
            () => pendingSeen.current,
          )
        }
      },
    })
  }, [api, reauth, reauthChannel, reload])
  const reauthSupport = useMemo<ReauthSupport | undefined>(
    () =>
      reauth ? { store: reauth, requestMail: () => api.requestReauthConfirmation() } : undefined,
    [api, reauth],
  )
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

  if (me.error) {
    if (isErrorCode(me.error, ErrorCodes.AUTH_ACCOUNT_SUSPENDED))
      return <AccountStateNotice kind="suspended" supportHref={supportHref} labels={given} />
    if (isErrorCode(me.error, ErrorCodes.COMMON_FORBIDDEN))
      return <AccountStateNotice kind="blocked" supportHref={supportHref} labels={given} />
    return <Alert tone="danger">{authErrorMessage(me.error, labels).message}</Alert>
  }
  if (!me.data) return <Skeleton />
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
      {handoff?.status === 'completed' && (
        <Alert tone="success">{labels.confirmReauthEmailChanged}</Alert>
      )}
      {handoff?.status === 'failed' && (
        <Alert tone="danger">{authErrorMessage(handoff.error, labels).message}</Alert>
      )}
      {on('profile') && (
        <ProfileSection
          profile={account}
          locales={locales}
          timeZones={zones}
          labels={given}
          onSave={async (patch) => {
            await api.updateProfile(patch)
            me.reload()
          }}
        />
      )}
      {on('password') && (
        <PasswordSection
          hasPassword={account.hasPassword}
          policy={policy.data}
          email={account.email ?? undefined}
          reauth={reauthSupport}
          labels={given}
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
          hasPassword={account.hasPassword}
          pendingEmail={account.pendingEmail}
          pendingEmailExpiresAt={account.pendingEmailExpiresAt}
          formatDate={formatDate}
          reauth={reauthSupport}
          labels={given}
          onChangeEmail={async (request) => {
            await api.changeEmail(request)
            me.reload() // 대기 중인 새 주소를 서버에서 다시 읽는다 — 서버는 토큰 · 메일을 비동기로 만들어 잠시 뒤에야 보인다
            stopLater.current()
            stopLater.current = reloadLater(
              me.reload,
              [400, 1500, 4000, 8000],
              () => pendingSeen.current,
            )
          }}
        />
      )}
      {on('methods') && (
        <SignInMethodsSection
          identities={account.methods}
          socialProviders={socialProviders}
          onLink={
            onLinkSocial &&
            (async (provider) => {
              setLinkNotice(null)
              // 비밀번호 없는 계정은 제공자에 다녀오기 전에 본인 확인 — 확인 링크를 아직 안 열었으면 메일부터
              if (reauth && !account.hasPassword && !reauth.hasToken()) {
                try {
                  reauth.remember({ kind: 'link-social', provider })
                  await api.requestReauthConfirmation()
                  setLinkNotice(labels.reauthSentBody(account.email ?? ''))
                } catch (error) {
                  setLinkNotice(authErrorMessage(error, labels).message)
                }
                return
              }
              onLinkSocial(provider)
            })
          }
          notice={
            linkNotice ??
            (linkedProvider
              ? labels.methodLinkedNotice(labelOfMethod(linkedProvider, labels))
              : undefined) ??
            (reauth && !account.hasPassword && reauth.hasToken()
              ? `${labels.reauthReadyTitle} — ${labels.reauthReadyBody}`
              : undefined)
          }
          formatDate={formatDate}
          labels={given}
          onUnlink={async (id) => {
            await api.unlinkIdentity(id)
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
          hasPassword={account.hasPassword}
          graceDays={graceDays}
          confirmationToken={confirmationToken}
          formatDate={formatDate}
          labels={given}
          onRequestConfirmation={() => api.requestDeleteConfirmation()}
          onDelete={(credential) => api.deleteAccount(credential)}
          onDeleted={onDeleted}
        />
      )}
    </div>
  )
}
