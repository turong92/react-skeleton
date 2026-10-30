import { formatInstant } from '@skeleton/time'
import {
  Alert,
  Badge,
  Button,
  ConfirmDialog,
  EmptyState,
  ErrorReference,
  Field,
  Input,
  RowMenu,
  SectionCard,
  Select,
  Skeleton,
  Table,
  type TableColumn,
} from '@skeleton/ui'
import { useState, type FormEvent } from 'react'
import { workspaceProblem } from './errors'
import {
  useLeaveWorkspace,
  useRemoveMember,
  useSetMemberRole,
  useTransferOwnership,
  useUpdateWorkspace,
  useWorkspaceMembers,
} from './hooks'
import { defaultWorkspaceLabels, type WorkspaceLabels } from './labels'
import { canManageWorkspace, memberActions } from './permissions'
import type { WorkspaceDetail, WorkspaceMember, WorkspaceRole } from './types'
import { validateWorkspaceForm } from './validation'
import type { WorkspaceApi } from './workspaceApi'
import formStyles from './WorkspaceForm.module.css'
import styles from './WorkspaceSettings.module.css'

type SettingsApi = Pick<
  WorkspaceApi,
  'members' | 'update' | 'setMemberRole' | 'removeMember' | 'transfer' | 'leave'
>

export type WorkspaceSettingsProps = {
  api: SettingsApi
  /** 지금 워크스페이스 — `useWorkspace()` 가 준 상세(내 역할 포함) */
  workspace: WorkspaceDetail
  /** 내 계정 id — 내 줄을 알아보려고만 쓰고 화면에는 그리지 않는다 */
  accountId: string
  /** 탈퇴가 끝났을 때 — 앱이 다른 팀(또는 첫 화면)으로 이동한다. 이 팀의 캐시는 일부러 건드리지 않았다 */
  onLeft: () => void
  labels?: WorkspaceLabels
  locale?: string
  formatTime?: (iso: string) => string
}

type Dialog =
  | { kind: 'remove'; member: WorkspaceMember }
  | { kind: 'transfer'; member: WorkspaceMember }
  | { kind: 'leave' }

/**
 * 워크스페이스 설정 — 이름 · 주소 이름(ADMIN 이상), 멤버 표(역할 고르기 · 내보내기 · 소유권 이전), 탈퇴.
 * 단추는 내 역할로 숨긴다(서버가 어차피 막는다). 주소 이름을 바꾸면 Provider 가 새 주소로 바꾸라고 앱에 알린다
 */
export function WorkspaceSettings({
  api,
  workspace,
  accountId,
  onLeft,
  labels = defaultWorkspaceLabels,
  locale,
  formatTime = (iso) => formatInstant(iso, { locale }),
}: WorkspaceSettingsProps) {
  const t = labels.settings
  const members = useWorkspaceMembers(api, workspace.id)
  const setRole = useSetMemberRole(api, workspace.id)
  const remove = useRemoveMember(api, workspace.id)
  const transfer = useTransferOwnership(api, workspace.id)
  const leave = useLeaveWorkspace(api, workspace.id)
  const [dialog, setDialog] = useState<Dialog | null>(null)
  const [memberError, setMemberError] = useState<unknown>(null)
  const isOwner = workspace.role === 'OWNER'

  const closeDialog = () => setDialog(null)
  const failMember = (error: unknown) => {
    setDialog(null)
    setMemberError(error)
  }

  const nameOf = (member: WorkspaceMember) => member.label || t.unnamedMember
  const columns: TableColumn<WorkspaceMember>[] = [
    {
      key: 'member',
      header: t.columnMember,
      rowHeader: true,
      render: (member) => (
        <>
          {nameOf(member)}
          {member.accountId === accountId && <span className={styles.you}>({t.you})</span>}
        </>
      ),
    },
    {
      key: 'role',
      header: t.columnRole,
      render: (member) => {
        if (!memberActions(workspace.role, accountId, member).changeRole)
          return <Badge>{labels.roles[member.role]}</Badge>
        const pending = setRole.isPending && setRole.variables?.accountId === member.accountId
        return (
          <Select
            aria-label={t.roleOf(nameOf(member))}
            value={pending ? setRole.variables.role : member.role}
            disabled={pending}
            onChange={(event) => {
              setMemberError(null)
              setRole.mutate(
                {
                  accountId: member.accountId,
                  role: event.target.value as Exclude<WorkspaceRole, 'OWNER'>,
                },
                { onError: failMember },
              )
            }}
          >
            <option value="ADMIN">{labels.roles.ADMIN}</option>
            <option value="MEMBER">{labels.roles.MEMBER}</option>
          </Select>
        )
      },
    },
    {
      key: 'joined',
      header: t.columnJoined,
      render: (member) => <span className={styles.nowrap}>{formatTime(member.joinedAt)}</span>,
    },
    {
      key: 'actions',
      header: t.columnActions,
      align: 'end',
      render: (member) => {
        const actions = memberActions(workspace.role, accountId, member)
        const items = [
          ...(actions.transfer
            ? [
                {
                  key: 'transfer',
                  label: t.transferAction,
                  onSelect: () => setDialog({ kind: 'transfer', member }),
                },
              ]
            : []),
          ...(actions.remove
            ? [
                {
                  key: 'remove',
                  label: t.removeAction,
                  danger: true,
                  separatorBefore: actions.transfer,
                  onSelect: () => setDialog({ kind: 'remove', member }),
                },
              ]
            : []),
        ]
        return items.length > 0 ? (
          <RowMenu label={t.actionsOf(nameOf(member))} items={items} />
        ) : null
      },
    },
  ]

  return (
    <div className={styles.stack}>
      <SectionCard id="workspace-general" title={t.generalTitle}>
        {canManageWorkspace(workspace.role) ? (
          <GeneralForm api={api} workspace={workspace} labels={labels} />
        ) : (
          <div className={styles.section}>
            <dl className={styles.readonly}>
              <dt className={styles.readonlyTerm}>{labels.form.nameLabel}</dt>
              <dd className={styles.readonlyValue}>{workspace.name}</dd>
              <dt className={styles.readonlyTerm}>{labels.form.slugLabel}</dt>
              <dd className={styles.readonlyValue}>{workspace.slug}</dd>
            </dl>
            <p className={styles.hint}>{t.readOnlyHint}</p>
          </div>
        )}
      </SectionCard>

      <SectionCard
        id="workspace-members"
        title={t.membersTitle}
        aside={members.data ? t.membersCount(members.data.length) : undefined}
      >
        <div className={styles.section}>
          {memberError !== null && (
            <Alert tone="danger" onDismiss={() => setMemberError(null)} dismissLabel={labels.close}>
              {workspaceProblem(memberError) === 'memberGone' ? t.memberGone : t.memberChangeFailed}
              <ErrorReference error={memberError} />
            </Alert>
          )}
          {members.isPending ? (
            <Skeleton lines={3} label={labels.loading} />
          ) : members.isError ? (
            <Alert
              tone="danger"
              action={
                <Button variant="secondary" size="sm" onClick={() => void members.refetch()}>
                  {labels.retry}
                </Button>
              }
            >
              {labels.loadFailed}
            </Alert>
          ) : (
            <Table
              caption={t.membersCaption}
              columns={columns}
              rows={members.data}
              rowKey={(member) => member.accountId}
              empty={<EmptyState title={t.membersTitle} />}
            />
          )}
        </div>
      </SectionCard>

      <SectionCard id="workspace-leave" title={t.leave.title} description={t.leave.description}>
        <div className={styles.section}>
          {leave.isError && (
            <Alert tone="danger">
              {workspaceProblem(leave.error) === 'ownerCannotLeave'
                ? t.leave.ownerCannotLeave
                : t.leave.failed}
              <ErrorReference error={leave.error} />
            </Alert>
          )}
          {isOwner ? (
            <p className={styles.hint}>{t.leave.ownerHint}</p>
          ) : (
            <div className={formStyles.actions}>
              <Button
                variant="danger"
                onClick={() => {
                  leave.reset()
                  setDialog({ kind: 'leave' })
                }}
              >
                {t.leave.action}
              </Button>
            </div>
          )}
        </div>
      </SectionCard>

      <ConfirmDialog
        open={dialog?.kind === 'remove'}
        onClose={closeDialog}
        title={dialog?.kind === 'remove' ? t.removeDialog.title(nameOf(dialog.member)) : ''}
        description={
          dialog?.kind === 'remove' ? t.removeDialog.description(nameOf(dialog.member)) : ''
        }
        confirmLabel={t.removeDialog.confirm}
        cancelLabel={labels.cancel}
        closeLabel={labels.close}
        loadingLabel={labels.loading}
        busy={remove.isPending}
        onConfirm={() => {
          if (dialog?.kind !== 'remove') return
          setMemberError(null)
          remove.mutate(dialog.member.accountId, { onSuccess: closeDialog, onError: failMember })
        }}
      />
      <ConfirmDialog
        open={dialog?.kind === 'transfer'}
        onClose={closeDialog}
        title={t.transferDialog.title}
        description={
          dialog?.kind === 'transfer'
            ? t.transferDialog.description(nameOf(dialog.member), workspace.name)
            : ''
        }
        confirmLabel={t.transferDialog.confirm}
        cancelLabel={labels.cancel}
        closeLabel={labels.close}
        loadingLabel={labels.loading}
        busy={transfer.isPending}
        onConfirm={() => {
          if (dialog?.kind !== 'transfer') return
          setMemberError(null)
          transfer.mutate(dialog.member.accountId, { onSuccess: closeDialog, onError: failMember })
        }}
      />
      <ConfirmDialog
        open={dialog?.kind === 'leave'}
        onClose={closeDialog}
        title={t.leave.dialogTitle(workspace.name)}
        description={t.leave.dialogDescription}
        confirmLabel={t.leave.confirm}
        cancelLabel={labels.cancel}
        closeLabel={labels.close}
        loadingLabel={labels.loading}
        busy={leave.isPending}
        onConfirm={() =>
          leave.mutate(undefined, { onSuccess: onLeft, onSettled: () => setDialog(null) })
        }
      />
    </div>
  )
}

function GeneralForm({
  api,
  workspace,
  labels,
}: {
  api: Pick<WorkspaceApi, 'update'>
  workspace: WorkspaceDetail
  labels: WorkspaceLabels
}) {
  const [name, setName] = useState(workspace.name)
  const [slug, setSlug] = useState(workspace.slug)
  const [attempted, setAttempted] = useState(false)
  const [saved, setSaved] = useState(false)
  const update = useUpdateWorkspace(api, workspace.id)
  const errors = attempted ? validateWorkspaceForm(labels, { name, slug, slugRequired: true }) : {}
  const problem = update.isError ? workspaceProblem(update.error) : null
  const trimmed = name.trim()
  const changed = trimmed !== workspace.name || slug !== workspace.slug

  function submit(event: FormEvent) {
    event.preventDefault()
    setAttempted(true)
    setSaved(false)
    if (Object.keys(validateWorkspaceForm(labels, { name, slug, slugRequired: true })).length > 0)
      return
    update.mutate(
      {
        ...(trimmed !== workspace.name && { name: trimmed }),
        ...(slug !== workspace.slug && { slug }),
      },
      { onSuccess: () => setSaved(true) },
    )
  }

  return (
    <form className={formStyles.form} onSubmit={submit} noValidate>
      <Field label={labels.form.nameLabel} error={errors.name} required>
        {(control) => (
          <Input
            {...control}
            value={name}
            onChange={(event) => {
              setName(event.target.value)
              setSaved(false)
            }}
            autoComplete="off"
          />
        )}
      </Field>
      <Field
        label={labels.form.slugLabel}
        hint={labels.form.slugHint}
        error={errors.slug ?? (problem === 'slugTaken' ? labels.form.slugTaken : undefined)}
        required
      >
        {(control) => (
          <Input
            {...control}
            value={slug}
            onChange={(event) => {
              setSlug(event.target.value)
              setSaved(false)
            }}
            autoComplete="off"
            autoCapitalize="off"
            spellCheck={false}
          />
        )}
      </Field>
      {update.isError && problem !== 'slugTaken' && (
        <Alert tone="danger">
          {labels.form.failed}
          <ErrorReference error={update.error} />
        </Alert>
      )}
      <div className={formStyles.actions}>
        <Button
          type="submit"
          disabled={!changed}
          loading={update.isPending}
          loadingLabel={labels.loading}
        >
          {labels.settings.save}
        </Button>
        {saved && !changed && (
          <span className={formStyles.saved} role="status">
            {labels.settings.saved}
          </span>
        )}
      </div>
    </form>
  )
}
