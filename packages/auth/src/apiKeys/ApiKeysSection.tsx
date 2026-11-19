import {
  Alert,
  Badge,
  Button,
  Checkbox,
  ConfirmDialog,
  CopyButton,
  Dialog,
  Field,
  Input,
  Select,
  SettingsRow,
  Skeleton,
} from '@skeleton/ui'
import { useId, useState, type FormEvent } from 'react'
import type { ReauthCredential, SocialReauth } from '../account/accountApi'
import { isReauthFailure, reauthKindOf, type ReauthSubject } from '../reauth/kind'
import { ReauthProof } from '../screens/ReauthProof'
import { mergeLabels, type AuthLabels } from '../screens/labels'
import { SectionShell } from '../screens/SectionShell'
import type { ProviderAction } from '../socialLink'
import type { ApiKeysApi } from './apiKeysApi'
import { apiKeyErrorMessage, isApiKeysOff } from './errors'
import { expiresAtFor, expiryChoices } from './expiry'
import { mergeApiKeysLabels, type ApiKeysLabels } from './labels'
import { useApiKeys, useApiKeyScopes, useCreateApiKey, useRevokeApiKey } from './queries'
import type { ApiKey, ApiKeyStatus } from './types'
import styles from './ApiKeysSection.module.css'

export type ApiKeysSectionProps = {
  api: Pick<ApiKeysApi, 'list' | 'scopes' | 'create' | 'revoke'>
  /** 다시 인증의 종류를 고르는 `me` 의 부분(`reauthSubjectOf(me)`) */
  subject: ReauthSubject
  /** `POST /account/reauth/confirmation` - 비밀번호 없는 계정의 6자리 메일 */
  requestReauthCode?: () => Promise<unknown>
  /** 범위 키 → 사람이 읽는 이름(앱이 정한다, 예 `{ 'notes.read': '노트 읽기' }`). 없는 키는 키 그대로 보인다 */
  scopeLabels?: Record<string, string>
  /** 앱이 정한 키 수명 상한(일, 백엔드 `max-lifetime`). 주면 그보다 긴 칸과 「없음」을 숨긴다 */
  maxLifetimeDays?: number
  formatDate?: (iso: string) => string
  /**
   * 비밀번호도 이메일도 없는 계정(소셜 로그인만)의 본인 확인 - 이 제공자의 동의 화면으로 보낸다. `action` 은 적던 이름 · 범위 · 만료를 들고 돌아온다
   * (`AccountSettings` 의 `preferenceRows={(trip) => <ApiKeysSection … onProviderReauth={trip.onProviderReauth} resume={trip.resume} onResumeSpent={trip.onResumeSpent} />}` 가 이어 준다).
   * 없으면 그 계정은 키를 만들지 못하고 안내만 본다
   */
  onProviderReauth?: (provider: string, action: ProviderAction) => void
  /** 동의를 마치고 돌아왔다 - 만들기 대화상자가 적던 값 그대로, 본인 확인이 끝난 채 다시 열린다. 인가 코드는 한 번 쓰면 끝이라 쓰고 나면 `onResumeSpent` */
  resume?: { action: ProviderAction; socialReauth: SocialReauth } | null
  onResumeSpent?: () => void
  /** 줄만 그린다(`AccountSettings` 의 카드 안) - 아니면 제목 있는 카드 한 장에 담는다 */
  row?: boolean
  /** 시계 - 만료 시각 계산용(시험 · 스토리에서 고정) */
  now?: () => number
  labels?: Partial<ApiKeysLabels>
  /** 다시 인증 입력(`ReauthProof`) 과 일반 오류 문구 */
  authLabels?: Partial<AuthLabels>
}

const defaultFormat = (iso: string) => new Date(iso).toLocaleDateString()
const statusTone: Record<ApiKeyStatus, 'success' | 'neutral' | 'warning'> = {
  ACTIVE: 'success',
  EXPIRED: 'neutral',
  REVOKED: 'warning',
}

/**
 * 내 API 키 - 목록(상태 · 범위 · 만료 · 마지막 사용), 「키 만들기」 대화상자(이름 · 범위 · 만료 · 다시 인증 → 토큰을 **한 번만** 보여 준다), 회수 확인.
 * 백엔드 `api-key`(`skeleton.api-key.http.enabled`). 서버가 켜지지 않았으면(404) 구역에 안내만 그린다
 */
export function ApiKeysSection({
  api,
  subject,
  requestReauthCode,
  scopeLabels = {},
  maxLifetimeDays,
  formatDate = defaultFormat,
  row,
  now = Date.now,
  onProviderReauth,
  resume,
  onResumeSpent,
  labels: givenLabels,
  authLabels: givenAuth,
}: ApiKeysSectionProps) {
  const t = mergeApiKeysLabels(givenLabels)
  const authLabels = mergeLabels(givenAuth)
  const keys = useApiKeys(api)
  const revoke = useRevokeApiKey(api)
  const [creating, setCreating] = useState(() => resume?.action.kind === 'api-key-create')
  const [revoking, setRevoking] = useState<ApiKey | null>(null)

  const keyLine = (key: ApiKey) => {
    const names = key.scopes.map((scope) => scopeLabels[scope] ?? scope).join(', ')
    return (
      <p className={styles.meta}>
        <span>{key.scopes.length ? t.scopesLine(names) : t.noScopes}</span>
        <span>
          {t.hint(key.hint)} · {t.createdOn(formatDate(key.createdAt))} ·{' '}
          {key.expiresAt ? t.expiresOn(formatDate(key.expiresAt)) : t.neverExpires}
        </span>
        <span>{key.lastUsedAt ? t.lastUsed(formatDate(key.lastUsedAt)) : t.neverUsed}</span>
      </p>
    )
  }

  return (
    <SectionShell row={row} id="api-keys" title={t.title}>
      <SettingsRow
        label={t.title}
        value={<span>{t.description}</span>}
        action={
          <Button variant="secondary" size="sm" onClick={() => setCreating(true)}>
            {t.create}
          </Button>
        }
        dialogs={
          <>
            <CreateKeyDialog
              open={creating}
              onClose={() => setCreating(false)}
              api={api}
              subject={subject}
              requestReauthCode={requestReauthCode}
              scopeLabels={scopeLabels}
              maxLifetimeDays={maxLifetimeDays}
              onProviderReauth={onProviderReauth}
              resume={resume}
              onResumeSpent={onResumeSpent}
              now={now}
              labels={t}
              authLabels={authLabels}
              givenAuth={givenAuth}
            />
            <ConfirmDialog
              open={revoking !== null}
              onClose={() => {
                revoke.reset()
                setRevoking(null)
              }}
              onConfirm={() =>
                revoking &&
                revoke.mutate(revoking.id, {
                  onSuccess: () => setRevoking(null),
                })
              }
              title={revoking ? t.revokeTitle(revoking.name) : t.revoke}
              description={
                <div className={styles.stack}>
                  <p>{t.revokeBody}</p>
                  {revoke.isError && (
                    <Alert tone="danger">{apiKeyErrorMessage(revoke.error, t, authLabels)}</Alert>
                  )}
                </div>
              }
              confirmLabel={t.revokeConfirm}
              cancelLabel={t.cancel}
              closeLabel={t.close}
              loadingLabel={t.loading}
              busy={revoke.isPending}
            />
          </>
        }
      />
      {keys.isPending ? (
        <Skeleton label={t.loading} />
      ) : keys.isError ? (
        <Alert
          tone={isApiKeysOff(keys.error) ? 'info' : 'danger'}
          action={
            isApiKeysOff(keys.error) ? undefined : (
              <Button variant="secondary" size="sm" onClick={() => void keys.refetch()}>
                {t.retry}
              </Button>
            )
          }
        >
          {isApiKeysOff(keys.error) ? t.errors.notEnabled : t.loadFailed}
        </Alert>
      ) : keys.data.length === 0 ? (
        <p className={styles.meta}>{t.empty}</p>
      ) : (
        keys.data.map((key) => (
          <SettingsRow
            key={key.id}
            label={key.name}
            value={
              <span className={styles.row}>
                <Badge tone={statusTone[key.status]}>{t.status[key.status]}</Badge>
                {key.status === 'REVOKED' && (
                  <span>{key.revokedBy === 'OPERATOR' ? t.revokedByOperator : t.revokedByYou}</span>
                )}
              </span>
            }
            action={
              key.status === 'ACTIVE' ? (
                <Button
                  variant="danger"
                  size="sm"
                  aria-label={t.revokeFor(key.name)}
                  onClick={() => {
                    revoke.reset()
                    setRevoking(key)
                  }}
                >
                  {t.revoke}
                </Button>
              ) : undefined
            }
          >
            {keyLine(key)}
          </SettingsRow>
        ))
      )}
    </SectionShell>
  )
}

type CreateKeyDialogProps = Pick<
  ApiKeysSectionProps,
  | 'api'
  | 'subject'
  | 'requestReauthCode'
  | 'maxLifetimeDays'
  | 'onProviderReauth'
  | 'resume'
  | 'onResumeSpent'
> & {
  open: boolean
  onClose: () => void
  scopeLabels: Record<string, string>
  now: () => number
  labels: ApiKeysLabels
  authLabels: AuthLabels
  givenAuth?: Partial<AuthLabels>
}

/** 만들기 대화상자 - 입력 단계 → (성공하면) 토큰을 한 번 보여 주는 단계. 닫으면 토큰도 입력도 버린다 */
function CreateKeyDialog({
  open,
  onClose,
  api,
  subject,
  requestReauthCode,
  scopeLabels,
  maxLifetimeDays,
  onProviderReauth,
  resume,
  onResumeSpent,
  now,
  labels: t,
  authLabels,
  givenAuth,
}: CreateKeyDialogProps) {
  const formId = useId()
  const scopes = useApiKeyScopes(api)
  const create = useCreateApiKey(api)
  // 제공자 동의를 다녀왔으면 적던 값 그대로 - 비밀은 없다(이름 · 범위 · 만료)
  const back = resume?.action.kind === 'api-key-create' ? resume.action : null
  const [name, setName] = useState(back?.name ?? '')
  const [picked, setPicked] = useState<string[]>(back?.scopes ?? [])
  const choices = expiryChoices(maxLifetimeDays)
  const [days, setDays] = useState<number | null>(back ? back.days : choices[0])
  const [proof, setProof] = useState<ReauthCredential | null>(null)
  /** 닫을 때마다 늘어 `ReauthProof` 와 입력을 새로 시작하게 한다 */
  const [round, setRound] = useState(0)
  const kind = reauthKindOf(subject)
  const created = create.data
  const credential: ReauthCredential | null = resume ? { socialReauth: resume.socialReauth } : proof
  const ready = name.trim() !== '' && picked.length > 0 && credential !== null

  function close() {
    if (resume) onResumeSpent?.() // 닫으면 쓰지 않은 인가 코드도 버린다
    create.reset() // 관찰자를 뗀다 - 발급 뮤테이션은 `gcTime: 0` 이라 토큰 · 비밀번호가 캐시에서 바로 빠진다
    setName('')
    setPicked([])
    setDays(choices[0])
    setProof(null)
    setRound((n) => n + 1)
    onClose()
  }

  function submit(event: FormEvent) {
    event.preventDefault()
    if (!ready || create.isPending) return
    create.mutate(
      {
        name: name.trim(),
        scopes: picked,
        expiresAt: expiresAtFor(days, now(), maxLifetimeDays),
        ...credential,
      },
      {
        // 인가 코드는 한 번 쓰면 끝이다 - 결과가 어떻든 비운다(틀렸으면 제공자에 다시 다녀온다)
        onSettled: () => {
          if (resume) onResumeSpent?.()
        },
      },
    )
  }

  const failure = create.isError && isReauthFailure(create.error) ? create.error : undefined

  return (
    <Dialog
      open={open}
      onClose={close}
      title={created ? t.tokenTitle : t.createTitle}
      closeLabel={t.close}
      footer={
        created ? (
          <Button onClick={close}>{t.tokenDone}</Button>
        ) : (
          <>
            <Button variant="ghost" onClick={close} disabled={create.isPending}>
              {t.cancel}
            </Button>
            <Button
              type="submit"
              form={formId}
              disabled={!ready}
              loading={create.isPending}
              loadingLabel={t.loading}
            >
              {t.submit}
            </Button>
          </>
        )
      }
    >
      {!open ? null : created ? (
        <div className={styles.stack}>
          <Alert tone="warning">{t.tokenWarning}</Alert>
          <p className={styles.meta}>{t.tokenLabel}</p>
          <code className={styles.token} data-testid="api-key-token">
            {created.token}
          </code>
          <div className={styles.row}>
            <CopyButton
              value={created.token}
              label={t.copy}
              copiedLabel={t.copied}
              failedLabel={t.copyFailed}
            />
          </div>
          <p role="note">
            <strong>{t.tokenOnce}</strong>
          </p>
        </div>
      ) : (
        <form id={formId} className={styles.stack} onSubmit={submit}>
          {create.isError && !failure && (
            <Alert tone="danger">{apiKeyErrorMessage(create.error, t, authLabels)}</Alert>
          )}
          <Field label={t.nameLabel} hint={t.nameHint} required>
            {(control) => (
              <Input
                {...control}
                value={name}
                maxLength={100}
                onChange={(event) => setName(event.target.value)}
              />
            )}
          </Field>
          <fieldset className={styles.fieldset}>
            <legend className={styles.legend}>{t.scopesLegend}</legend>
            {scopes.isPending ? (
              <Skeleton label={t.loading} />
            ) : scopes.isError ? (
              <Alert tone="danger">{t.loadFailed}</Alert>
            ) : scopes.data.length === 0 ? (
              <p className={styles.meta}>{t.scopesEmpty}</p>
            ) : (
              scopes.data.map((scope) => (
                <Checkbox
                  key={scope.key}
                  label={scopeLabels[scope.key] ?? scope.key}
                  description={scopeLabels[scope.key] ? scope.key : undefined}
                  checked={picked.includes(scope.key)}
                  onChange={(event) =>
                    setPicked((current) =>
                      event.target.checked
                        ? [...current, scope.key]
                        : current.filter((key) => key !== scope.key),
                    )
                  }
                />
              ))
            )}
          </fieldset>
          <Field label={t.expiryLabel}>
            {(control) => (
              <Select
                {...control}
                value={days === null ? 'never' : String(days)}
                onChange={(event) =>
                  setDays(event.target.value === 'never' ? null : Number(event.target.value))
                }
              >
                {choices.map((choice) => (
                  <option key={choice ?? 'never'} value={choice === null ? 'never' : choice}>
                    {choice === null ? t.expiryNone : t.expiryChoice(choice)}
                  </option>
                ))}
              </Select>
            )}
          </Field>
          {kind === 'provider' && !onProviderReauth && !resume ? (
            <Alert tone="warning">{t.providerReauthUnsupported}</Alert>
          ) : (
            <>
              <p className={styles.meta}>{t.reauthHint}</p>
              <ReauthProof
                key={round}
                kind={kind}
                email={subject.email}
                providers={subject.providers}
                requestCode={requestReauthCode}
                onChange={setProof}
                failure={failure}
                onProvider={
                  onProviderReauth &&
                  ((provider) =>
                    onProviderReauth(provider, {
                      kind: 'api-key-create',
                      name: name.trim(),
                      scopes: picked,
                      days,
                    }))
                }
                confirmedWith={resume?.socialReauth.provider}
                labels={givenAuth}
              />
            </>
          )}
        </form>
      )}
    </Dialog>
  )
}
