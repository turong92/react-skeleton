import { retryAfterSeconds } from '@skeleton/api-client'
import { formatInstant } from '@skeleton/time'
import {
  Alert,
  Badge,
  Button,
  ConfirmDialog,
  EmptyState,
  ErrorReference,
  Field,
  Select,
  SectionCard,
  Skeleton,
  Table,
  Textarea,
  type TableColumn,
} from '@skeleton/ui'
import { useState, type FormEvent } from 'react'
import { invitationProblem } from './errors'
import {
  useInviteMembers,
  useResendInvitation,
  useRevokeInvitation,
  useWorkspaceInvitations,
} from './hooks'
import { MAX_INVITE_EMAILS, parseInviteEmails, seatUsage } from './inviteInput'
import { defaultWorkspaceLabels, type WorkspaceLabels } from './labels'
import { canInvite, invitableRoles } from './permissions'
import type { InvitationRole, InviteResult, WorkspaceDetail, WorkspaceInvitation } from './types'
import type { WorkspaceApi } from './workspaceApi'
import formStyles from './WorkspaceForm.module.css'
import styles from './WorkspaceInvitations.module.css'

type InvitationsApi = Pick<
  WorkspaceApi,
  'invitations' | 'invite' | 'resendInvitation' | 'revokeInvitation'
>

export type WorkspaceInvitationsProps = {
  api: InvitationsApi
  /** 지금 워크스페이스 — `useWorkspace()` 가 준 상세(내 역할 · 좌석 포함) */
  workspace: WorkspaceDetail
  labels?: WorkspaceLabels
  locale?: string
  formatTime?: (iso: string) => string
}

/**
 * 사람 초대하기 — 주소를 여러 개(한 번에 20개) 적어 보내고, 기다리는 초대 표에서 다시 보내기 · 취소.
 * ADMIN 이상에게만 그려진다(서버가 어차피 막는다): 관리자는 멤버로만 초대하고 소유자는 관리자로도 초대한다.
 * 좌석 상한이 있으면 `n / 상한`(멤버 + 대기 초대)을 보이고, 다 찼으면 보내지 못한다
 */
export function WorkspaceInvitations(props: WorkspaceInvitationsProps) {
  const labels = props.labels ?? defaultWorkspaceLabels
  if (!canInvite(props.workspace.role))
    return (
      <SectionCard id="workspace-invitations" title={labels.invitations.title}>
        <p className={styles.hint}>{labels.invitations.noPermission}</p>
      </SectionCard>
    )
  return <InvitationsBody {...props} labels={labels} />
}

type Notice =
  | { kind: 'resent'; email: string }
  | { kind: 'resendFailed'; error: unknown }
  | { kind: 'revokeFailed'; error: unknown }

function InvitationsBody({
  api,
  workspace,
  labels,
  locale,
  formatTime = (iso) => formatInstant(iso, { locale }),
}: WorkspaceInvitationsProps & { labels: WorkspaceLabels }) {
  const t = labels.invitations
  const roles = invitableRoles(workspace.role)
  const pending = useWorkspaceInvitations(api, workspace.id)
  const invite = useInviteMembers(api, workspace.id)
  const resend = useResendInvitation(api, workspace.id)
  const revoke = useRevokeInvitation(api, workspace.id)
  const [text, setText] = useState('')
  const [role, setRole] = useState<InvitationRole>('MEMBER')
  const [attempted, setAttempted] = useState(false)
  const [result, setResult] = useState<InviteResult | null>(null)
  const [notice, setNotice] = useState<Notice | null>(null)
  const [revoking, setRevoking] = useState<WorkspaceInvitation | null>(null)
  const seats = seatUsage(workspace)
  const parsed = parseInviteEmails(text)
  const problem = invite.isError ? invitationProblem(invite.error) : null

  const textError = !attempted
    ? undefined
    : parsed.invalid.length > 0
      ? t.emailsInvalid(parsed.invalid.join(', '))
      : parsed.tooMany
        ? t.emailsTooMany(MAX_INVITE_EMAILS)
        : parsed.emails.length === 0
          ? t.emailsRequired
          : undefined

  function submit(event: FormEvent) {
    event.preventDefault()
    setAttempted(true)
    setResult(null)
    invite.reset()
    if (parsed.emails.length === 0 || parsed.invalid.length > 0 || parsed.tooMany) return
    invite.mutate(
      { emails: parsed.emails, role: roles.includes(role) ? role : 'MEMBER' },
      {
        onSuccess: (done) => {
          setResult(done)
          // 좌석이 모자라 못 보낸 주소만 칸에 남긴다 — 자리를 만든 뒤 바로 다시 보낼 수 있게
          setText(done.seatLimited.join('\n'))
          setAttempted(false)
        },
      },
    )
  }

  const columns: TableColumn<WorkspaceInvitation>[] = [
    {
      key: 'email',
      header: t.columnEmail,
      rowHeader: true,
      render: (row) => row.email,
    },
    { key: 'role', header: t.columnRole, render: (row) => <Badge>{labels.roles[row.role]}</Badge> },
    {
      key: 'expires',
      header: t.columnExpires,
      render: (row) =>
        row.expired ? (
          <Badge tone="warning">{t.expired}</Badge>
        ) : (
          <span className={styles.nowrap}>{formatTime(row.expiresAt)}</span>
        ),
    },
    { key: 'sent', header: t.columnSent, render: (row) => t.sentCount(row.sentCount) },
    {
      key: 'actions',
      header: t.columnActions,
      align: 'end',
      render: (row) => {
        const resending = resend.isPending && resend.variables === row.id
        return (
          <div className={styles.rowActions}>
            <Button
              variant="secondary"
              size="sm"
              aria-label={t.resendFor(row.email)}
              loading={resending}
              loadingLabel={labels.loading}
              onClick={() => {
                setNotice(null)
                resend.mutate(row.id, {
                  onSuccess: () => setNotice({ kind: 'resent', email: row.email }),
                  onError: (error) => setNotice({ kind: 'resendFailed', error }),
                })
              }}
            >
              {t.resend}
            </Button>
            <Button
              variant="danger"
              size="sm"
              aria-label={t.revokeFor(row.email)}
              onClick={() => {
                setNotice(null)
                setRevoking(row)
              }}
            >
              {t.revoke}
            </Button>
          </div>
        )
      },
    },
  ]

  return (
    <div className={styles.stack}>
      <SectionCard id="workspace-invite" title={t.title} description={t.description}>
        <form className={styles.form} onSubmit={submit} noValidate>
          {seats && <p className={styles.seats}>{t.seats(seats.used, seats.limit)}</p>}
          {seats?.full && <Alert tone="warning">{t.seatsFull}</Alert>}
          <Field label={t.emailsLabel} hint={t.emailsHint} error={textError} required>
            {(control) => (
              <Textarea
                {...control}
                rows={4}
                value={text}
                onChange={(event) => setText(event.target.value)}
                autoComplete="off"
                autoCapitalize="off"
                spellCheck={false}
              />
            )}
          </Field>
          {roles.length > 1 && (
            <Field label={t.roleLabel}>
              {(control) => (
                <Select
                  {...control}
                  value={role}
                  onChange={(event) => setRole(event.target.value as InvitationRole)}
                >
                  {roles.map((r) => (
                    <option key={r} value={r}>
                      {labels.roles[r]}
                    </option>
                  ))}
                </Select>
              )}
            </Field>
          )}
          {invite.isError && (
            <Alert tone="danger">
              {problem === 'tooManyPending'
                ? t.tooManyPending
                : problem === 'forbidden'
                  ? t.forbidden
                  : t.sendFailed}
            </Alert>
          )}
          {invite.isError && <ErrorReference error={invite.error} />}
          {result && <ResultNotice result={result} labels={labels} />}
          <div className={formStyles.actions}>
            <Button
              type="submit"
              disabled={seats?.full}
              loading={invite.isPending}
              loadingLabel={labels.loading}
            >
              {t.send}
            </Button>
          </div>
        </form>
      </SectionCard>

      <SectionCard
        id="workspace-pending"
        title={t.pendingTitle}
        aside={pending.data ? t.pendingCount(pending.data.length) : undefined}
      >
        <div className={styles.section}>
          {notice?.kind === 'resent' && (
            <Alert tone="success" onDismiss={() => setNotice(null)} dismissLabel={labels.close}>
              {t.resent(notice.email)}
            </Alert>
          )}
          {notice?.kind === 'resendFailed' && (
            <Alert tone="warning" onDismiss={() => setNotice(null)} dismissLabel={labels.close}>
              {invitationProblem(notice.error) === 'resendTooSoon'
                ? t.resendTooSoon(retryAfterSeconds(notice.error))
                : t.resendFailed}
            </Alert>
          )}
          {notice?.kind === 'resendFailed' &&
            invitationProblem(notice.error) !== 'resendTooSoon' && (
              <ErrorReference error={notice.error} />
            )}
          {notice?.kind === 'revokeFailed' && (
            <Alert tone="danger" onDismiss={() => setNotice(null)} dismissLabel={labels.close}>
              {t.revokeFailed}
            </Alert>
          )}
          {notice?.kind === 'revokeFailed' && <ErrorReference error={notice.error} />}
          {pending.isPending ? (
            <Skeleton lines={2} label={labels.loading} />
          ) : pending.isError ? (
            <Alert
              tone="danger"
              action={
                <Button variant="secondary" size="sm" onClick={() => void pending.refetch()}>
                  {labels.retry}
                </Button>
              }
            >
              {labels.loadFailed}
            </Alert>
          ) : (
            <Table
              caption={t.pendingCaption}
              columns={columns}
              rows={pending.data}
              rowKey={(row) => row.id}
              empty={<EmptyState title={t.pendingEmpty} />}
            />
          )}
        </div>
      </SectionCard>

      <ConfirmDialog
        open={revoking !== null}
        onClose={() => setRevoking(null)}
        title={revoking ? t.revokeDialog.title(revoking.email) : ''}
        description={t.revokeDialog.description}
        confirmLabel={t.revokeDialog.confirm}
        cancelLabel={labels.cancel}
        closeLabel={labels.close}
        loadingLabel={labels.loading}
        busy={revoke.isPending}
        onConfirm={() => {
          if (!revoking) return
          revoke.mutate(revoking.id, {
            onSuccess: () => setRevoking(null),
            onError: (error) => {
              setRevoking(null)
              setNotice({ kind: 'revokeFailed', error })
            },
          })
        }}
      />
    </div>
  )
}

/** 보낸 결과 — 주소마다 보냄 · 이미 기다리는 초대 · 좌석 모자람. 한 줄이라도 못 보낸 게 있으면 경고색 */
function ResultNotice({ result, labels }: { result: InviteResult; labels: WorkspaceLabels }) {
  const t = labels.invitations.result
  const lines = [
    result.invited.length > 0 && {
      key: 'invited',
      text: t.invited(result.invited.length),
      list: [],
    },
    result.alreadyInvited.length > 0 && {
      key: 'already',
      text: t.alreadyInvited(result.alreadyInvited.length),
      list: result.alreadyInvited,
    },
    result.seatLimited.length > 0 && {
      key: 'seat',
      text: t.seatLimited(result.seatLimited.length),
      list: result.seatLimited,
    },
  ].filter((line) => line !== false)
  const skipped = result.alreadyInvited.length > 0 || result.seatLimited.length > 0
  return (
    <Alert tone={skipped ? 'warning' : 'success'}>
      <ul className={styles.results}>
        {lines.map((line) => (
          <li key={line.key}>
            {line.text}
            {line.list.length > 0 && `: ${line.list.join(', ')}`}
          </li>
        ))}
      </ul>
    </Alert>
  )
}
