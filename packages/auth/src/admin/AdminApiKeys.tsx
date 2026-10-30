import {
  Alert,
  Badge,
  Button,
  Dialog,
  EmptyState,
  Field,
  Input,
  PageHeader,
  Select,
  Skeleton,
  Table,
} from '@skeleton/ui'
import { ApiRequestError } from '@skeleton/api-client'
import { useId, useMemo, useState, type FormEvent, type ReactNode } from 'react'
import { isApiKeysOff } from '../apiKeys/errors'
import type { AdminApiKey, ApiKeyStatus } from '../apiKeys/types'
import type { AdminApiKeysApi } from './adminApiKeysApi'
import { mergeAdminApiKeysLabels, type AdminApiKeysLabels } from './adminApiKeysLabels'
import { useAdminApiKeys, useRevokeAdminApiKey } from './adminApiKeysQueries'
import { API_KEY_PERMISSIONS } from './apiKeyPermissions'
import styles from './AdminApiKeys.module.css'

export type AdminApiKeysProps = {
  api: Pick<AdminApiKeysApi, 'list' | 'revoke'>
  /** 호출자의 권한 질문(`useCan()`). 기본 모두 허용 - 읽기 권한이 없으면 안내만, 회수 권한이 없으면 단추가 없다 */
  can?: (key: string) => boolean
  formatDate?: (iso: string) => string
  /** 주인 칸을 그 계정 화면으로 잇는다(라우터 링크). 없으면 글자 */
  renderOwnerLink?: (ownerId: string, children: ReactNode) => ReactNode
  /** 범위 키 → 사람이 읽는 이름(없으면 키 그대로) */
  scopeLabels?: Record<string, string>
  labels?: Partial<AdminApiKeysLabels>
}

const tone: Record<ApiKeyStatus, 'success' | 'neutral' | 'warning'> = {
  ACTIVE: 'success',
  EXPIRED: 'neutral',
  REVOKED: 'warning',
}
const defaultFormat = (iso: string) => new Date(iso).toLocaleDateString()

/**
 * 운영자 API 키 화면 - 전체 키 표(주인 id · 상태로 걸러 보기, 「더 보기」)와 「회수」 대화상자(사유 필수).
 * 백엔드 `skeleton.api-key.admin.enabled=true`(꺼져 있으면 404 → 안내) · `api-key.read` / `api-key.revoke`. 계정 이름은 서버가 `account.read` 도 가진 운영자에게만 준다
 */
export function AdminApiKeys({
  api,
  can = () => true,
  formatDate = defaultFormat,
  renderOwnerLink,
  scopeLabels = {},
  labels: given,
}: AdminApiKeysProps) {
  const t = mergeAdminApiKeysLabels(given)
  const canRead = can(API_KEY_PERMISSIONS.read)
  const canRevoke = can(API_KEY_PERMISSIONS.revoke)
  const [ownerDraft, setOwnerDraft] = useState('')
  const [ownerId, setOwnerId] = useState('')
  const [status, setStatus] = useState<ApiKeyStatus | ''>('')
  const [revoking, setRevoking] = useState<AdminApiKey | null>(null)
  const keys = useAdminApiKeys(api, { ownerId, status })
  const revoke = useRevokeAdminApiKey(api)
  const rows = useMemo(() => keys.data?.pages.flatMap((page) => page.values) ?? [], [keys.data])

  if (!canRead)
    return (
      <div className={styles.page}>
        <PageHeader title={t.title} />
        <Alert tone="warning">{t.noAccess}</Alert>
      </div>
    )

  const ownerText = (row: AdminApiKey) => row.ownerName || row.ownerId
  const ownerCell = (row: AdminApiKey) =>
    renderOwnerLink ? renderOwnerLink(row.ownerId, ownerText(row)) : ownerText(row)

  return (
    <div className={styles.page}>
      <PageHeader title={t.title} />
      <form
        className={styles.filters}
        onSubmit={(event) => {
          event.preventDefault()
          setOwnerId(ownerDraft.trim())
        }}
      >
        <Field label={t.filterOwner} hint={t.filterOwnerHint}>
          {(control) => (
            <Input
              {...control}
              value={ownerDraft}
              onChange={(e) => setOwnerDraft(e.target.value)}
            />
          )}
        </Field>
        <Field label={t.filterStatus}>
          {(control) => (
            <Select
              {...control}
              value={status}
              onChange={(e) => setStatus(e.target.value as ApiKeyStatus | '')}
            >
              <option value="">{t.allStatuses}</option>
              {(['ACTIVE', 'EXPIRED', 'REVOKED'] as const).map((s) => (
                <option key={s} value={s}>
                  {t.status[s]}
                </option>
              ))}
            </Select>
          )}
        </Field>
        <Button type="submit" variant="secondary">
          {t.apply}
        </Button>
      </form>
      {keys.isPending ? (
        <Skeleton label={t.loading} />
      ) : keys.isError ? (
        <Alert
          tone="danger"
          action={
            isApiKeysOff(keys.error) ? undefined : (
              <Button variant="secondary" size="sm" onClick={() => void keys.refetch()}>
                {t.retry}
              </Button>
            )
          }
        >
          {isApiKeysOff(keys.error) ? t.notEnabled : t.loadFailed}
        </Alert>
      ) : (
        <>
          <div
            className={keys.isPlaceholderData ? styles.stale : undefined}
            aria-busy={keys.isPlaceholderData}
          >
            <Table
              caption={t.caption}
              rows={rows}
              rowKey={(row) => row.id}
              empty={<EmptyState title={t.empty} headingLevel={2} />}
              columns={[
                { key: 'name', header: t.columns.name, rowHeader: true, render: (r) => r.name },
                { key: 'owner', header: t.columns.owner, render: ownerCell },
                {
                  key: 'scopes',
                  header: t.columns.scopes,
                  render: (r) => r.scopes.map((s) => scopeLabels[s] ?? s).join(', ') || '-',
                },
                {
                  key: 'status',
                  header: t.columns.status,
                  render: (r) => (
                    <>
                      <Badge tone={tone[r.status]}>{t.status[r.status]}</Badge>
                      {r.status === 'REVOKED' && (
                        <>
                          {' '}
                          {r.revokedBy === 'OPERATOR' ? t.revokedByOperator : t.revokedByUser}
                          {r.revokedReason && (
                            <>
                              <br />
                              <small>{t.revokedReason(r.revokedReason)}</small>
                            </>
                          )}
                        </>
                      )}
                    </>
                  ),
                },
                {
                  key: 'expires',
                  header: t.columns.expires,
                  render: (r) => (r.expiresAt ? formatDate(r.expiresAt) : t.neverExpires),
                },
                {
                  key: 'lastUsed',
                  header: t.columns.lastUsed,
                  render: (r) => (r.lastUsedAt ? formatDate(r.lastUsedAt) : t.neverUsed),
                },
                {
                  key: 'actions',
                  header: t.columns.actions,
                  render: (r) =>
                    canRevoke &&
                    r.status === 'ACTIVE' && (
                      <Button
                        variant="danger"
                        size="sm"
                        aria-label={t.revokeFor(r.name, ownerText(r))}
                        onClick={() => {
                          revoke.reset()
                          setRevoking(r)
                        }}
                      >
                        {t.revoke}
                      </Button>
                    ),
                },
              ]}
            />
          </div>
          {keys.hasNextPage && (
            <div>
              <Button
                variant="secondary"
                loading={keys.isFetchingNextPage}
                loadingLabel={t.loading}
                onClick={() => void keys.fetchNextPage()}
              >
                {t.more}
              </Button>
            </div>
          )}
        </>
      )}
      {revoking && (
        <RevokeDialog
          row={revoking}
          labels={t}
          busy={revoke.isPending}
          error={
            revoke.isError
              ? revoke.error instanceof ApiRequestError && revoke.error.apiError.status === 404
                ? t.errors.notFound
                : t.errors.generic
              : null
          }
          onClose={() => {
            revoke.reset()
            setRevoking(null)
          }}
          onSubmit={(reason) =>
            revoke.mutate({ id: revoking.id, reason }, { onSuccess: () => setRevoking(null) })
          }
        />
      )}
    </div>
  )
}

function RevokeDialog({
  row,
  labels: t,
  busy,
  error,
  onClose,
  onSubmit,
}: {
  row: AdminApiKey
  labels: AdminApiKeysLabels
  busy: boolean
  error: string | null
  onClose: () => void
  onSubmit: (reason: string) => void
}) {
  const formId = useId()
  const [reason, setReason] = useState('')
  const trimmed = reason.trim()
  const submit = (event: FormEvent) => {
    event.preventDefault()
    if (trimmed) onSubmit(trimmed)
  }
  return (
    <Dialog
      open
      onClose={onClose}
      title={t.revokeTitle}
      closeLabel={t.close}
      footer={
        <>
          <Button variant="ghost" onClick={onClose} disabled={busy}>
            {t.cancel}
          </Button>
          <Button
            type="submit"
            form={formId}
            variant="danger"
            disabled={trimmed === ''}
            loading={busy}
            loadingLabel={t.loading}
          >
            {t.revokeConfirm}
          </Button>
        </>
      }
    >
      <form id={formId} className={styles.form} onSubmit={submit}>
        <p>{`${row.name} · ${row.ownerName || row.ownerId}`}</p>
        {error && <Alert tone="danger">{error}</Alert>}
        <Field label={t.revokeReason} hint={t.revokeReasonHint} required>
          {(control) => (
            <Input
              {...control}
              value={reason}
              maxLength={200}
              onChange={(e) => setReason(e.target.value)}
            />
          )}
        </Field>
      </form>
    </Dialog>
  )
}
