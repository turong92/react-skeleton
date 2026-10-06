import { ErrorCodes, isErrorCode } from '@skeleton/api-client'
import { Alert, PageHeader, SectionIndex, Skeleton } from '@skeleton/ui'
import { useCallback } from 'react'
import type { AccountApi } from '../account/accountApi'
import { supportedTimeZones, withCurrent } from '../account/timeZones'
import type { DeletionResult, PasswordPolicy } from '../account/types'
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
}: AccountSettingsProps) {
  const labels = mergeLabels(given)
  const on = (name: AccountSectionName) => sections?.[name] !== false
  const sessionsOn = sections?.sessions !== false
  const passwordOn = sections?.password !== false
  const me = useResource(useCallback(() => api.me(), [api]))
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
          labels={given}
          onChangeEmail={(request) => api.changeEmail(request)}
        />
      )}
      {on('methods') && (
        <SignInMethodsSection
          identities={account.methods}
          socialProviders={socialProviders}
          onLink={onLinkSocial}
          formatDate={formatDate}
          labels={given}
          onUnlink={async (id) => {
            await api.unlinkIdentity(id)
            me.reload()
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
