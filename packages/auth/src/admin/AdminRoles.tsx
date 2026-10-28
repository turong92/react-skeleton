import {
  Alert,
  Badge,
  Button,
  Checkbox,
  Dialog,
  EmptyState,
  Field,
  Input,
  PageHeader,
  Skeleton,
  Table,
  Textarea,
} from '@skeleton/ui'
import { useCallback, useId, useState, type FormEvent } from 'react'
import { AccountStateNotice } from '../screens/AccountStateNotice'
import type { AuthLabels } from '../screens/labels'
import { useResource } from '../screens/useResource'
import { adminBlocked } from './adminErrors'
import styles from './AdminRoles.module.css'
import type { AdminRole, AdminRolesApi, PermissionInfo } from './rolesApi'
import { inheritedFrom, permissionsToSend, wouldCycle } from './roleIncludes'
import { isRoleGone, roleErrorMessage } from './rolesErrors'
import { mergeRolesLabels, type AdminRolesLabels } from './rolesLabels'

export type AdminRolesProps = {
  api: AdminRolesApi
  labels?: Partial<AdminRolesLabels>
  /** 403 일 때 보이는 「접근 차단」 안내의 문구 · 문의 링크 */
  authLabels?: Partial<AuthLabels>
  supportHref?: string
  /** 만들기 · 고치기 · 지우기가 성공한 뒤 - 다른 화면의 역할 목록(계정 화면의 줄 수 있는 역할)을 다시 읽게 할 때 */
  onChanged?: () => void
  /** 호출자의 권한 목록(`principal.permissions`) - 주면 서버의 권한 상승 규칙대로 내게 없는 권한의 체크 상자(켜기 · 끄기)와 그런 권한을 가진 역할의 지우기를 잠근다. 안 주면 잠그지 않는다 */
  callerPermissions?: readonly string[]
}

/** `*` 를 가진 전권 역할인가 - 고칠 수 없다(서버가 `protected` 로 알려 주고, 혹시 빠져도 `*` 면 잠근다) */
const isLocked = (role: AdminRole) => role.protected || role.permissions.includes('*')

type Catalog = { groups: { module: string; keys: string[] }[] }

/** 카탈로그 + 역할이 이미 들고 있는데 카탈로그에 없는 키(서버가 모듈을 뺀 경우)를 묶음으로 */
function catalogOf(permissions: PermissionInfo[], extra: readonly string[]): Catalog {
  const byModule = new Map<string, string[]>()
  for (const { key, module } of permissions)
    byModule.set(module, [...(byModule.get(module) ?? []), key])
  const known = new Set(permissions.map((p) => p.key))
  for (const key of extra) {
    if (known.has(key) || key === '*') continue
    const module = key.split('.')[0] ?? key
    byModule.set(module, [...(byModule.get(module) ?? []), key])
  }
  return { groups: [...byModule].map(([module, keys]) => ({ module, keys })) }
}

type FormProps = {
  role: AdminRole | null
  /** 모든 역할 - 포함할 후보와 물려받는 권한을 계산한다 */
  roles: AdminRole[]
  permissions: PermissionInfo[]
  labels: AdminRolesLabels
  busy: boolean
  error: string | null
  onSubmit: (value: {
    name: string
    description: string
    permissions: string[]
    includes: string[]
  }) => void
  onClose: () => void
  outside: (key: string) => boolean
}

const EMPTY_ROLE: AdminRole = {
  name: '',
  description: null,
  permissions: [],
  protected: false,
  holders: null,
}

/** 새 역할을 계산에 넣을 때 쓰는 자리 이름 - 실제 역할 이름과 겹치지 않는다 */
const DRAFT = '\u0000draft'

function RoleDialog({
  role,
  roles,
  permissions,
  labels,
  busy,
  error,
  onSubmit,
  onClose,
  outside,
}: FormProps) {
  const formId = useId()
  const [name, setName] = useState(role?.name ?? '')
  const [description, setDescription] = useState(role?.description ?? '')
  const [picked, setPicked] = useState<string[]>(role?.permissions ?? [])
  const [includes, setIncludes] = useState<string[]>(role?.includes ?? [])
  const self = role?.name ?? (name.trim() || DRAFT)
  const inherited = inheritedFrom(
    [...roles.filter((r) => r.name !== self), { ...(role ?? EMPTY_ROLE), name: self, includes }],
    self,
  )
  const catalog = catalogOf(permissions, [...picked, ...inherited.keys()])
  const candidates = roles.filter((r) => r.name !== role?.name)
  const toggleInclude = (target: string, on: boolean) =>
    setIncludes((now) => (on ? [...now, target] : now.filter((n) => n !== target)))
  const toggle = (key: string, on: boolean) =>
    setPicked((now) => (on ? [...now, key] : now.filter((k) => k !== key)))
  const submit = (event: FormEvent) => {
    event.preventDefault()
    onSubmit({
      name: name.trim(),
      description: description.trim(),
      permissions: permissionsToSend(picked, inherited, role?.permissions ?? []),
      includes,
    })
  }
  return (
    <Dialog
      open
      onClose={onClose}
      title={role ? labels.editTitle(role.name) : labels.createTitle}
      closeLabel={labels.close}
      footer={
        <>
          <Button variant="ghost" onClick={onClose} disabled={busy}>
            {labels.cancel}
          </Button>
          <Button type="submit" form={formId} loading={busy} loadingLabel={labels.loading}>
            {labels.save}
          </Button>
        </>
      }
    >
      <form id={formId} className={styles.form} onSubmit={submit}>
        {error && <Alert tone="danger">{error}</Alert>}
        <Field label={labels.nameLabel} hint={role ? undefined : labels.nameHint}>
          {(control) => (
            <Input
              {...control}
              value={name}
              maxLength={32}
              readOnly={role !== null}
              autoComplete="off"
              onChange={(e) => setName(e.target.value.toUpperCase())}
            />
          )}
        </Field>
        <Field label={labels.descriptionLabel}>
          {(control) => (
            <Textarea
              {...control}
              value={description}
              maxLength={200}
              rows={2}
              onChange={(e) => setDescription(e.target.value)}
            />
          )}
        </Field>
        {candidates.length > 0 && (
          <fieldset className={styles.group}>
            <legend>{labels.includesLegend}</legend>
            <p className={styles.muted}>{labels.includesHint}</p>
            {candidates.map((candidate) => {
              const checked = includes.includes(candidate.name)
              const full = !checked && isLocked(candidate)
              const cycle = !checked && wouldCycle(roles, self, candidate.name)
              const beyond = !checked && candidate.effectivePermissions?.some(outside)
              const reason = full
                ? labels.includeFullAccess
                : cycle
                  ? labels.includeCycle
                  : beyond
                    ? labels.includeOutside
                    : (candidate.description ?? undefined) || undefined
              return (
                <Checkbox
                  key={candidate.name}
                  label={candidate.name}
                  description={reason}
                  disabled={full || cycle || Boolean(beyond)}
                  checked={checked}
                  onChange={(e) => toggleInclude(candidate.name, e.target.checked)}
                />
              )
            })}
          </fieldset>
        )}
        <fieldset className={styles.permissions}>
          <legend>{labels.permissionsLegend}</legend>
          {catalog.groups.map((group) => (
            <fieldset key={group.module} className={styles.group}>
              <legend>{labels.moduleLabels[group.module] ?? group.module}</legend>
              {group.keys.map((key) => (
                <Checkbox
                  key={key}
                  label={labels.permissionLabels[key] ?? key}
                  description={
                    inherited.has(key)
                      ? labels.inheritedFrom(inherited.get(key) as string)
                      : outside(key)
                        ? labels.permissionOutside
                        : labels.permissionLabels[key]
                          ? key
                          : undefined
                  }
                  disabled={inherited.has(key) || outside(key)}
                  checked={inherited.has(key) || picked.includes(key)}
                  onChange={(e) => toggle(key, e.target.checked)}
                />
              ))}
            </fieldset>
          ))}
        </fieldset>
      </form>
    </Dialog>
  )
}

/**
 * 역할 관리 화면 - 목록 · 만들기 · 고치기 · 지우기, 권한은 모듈별 체크 묶음. 전권 역할(`protected`)은 단추가 잠기고 이유가 옆에 적힌다.
 * 서버의 `AUTHZ.*` 오류는 코드마다 문장으로 보인다(창 안). 403 이면 로그아웃이 아니라 「접근 차단」 안내. 백엔드 `skeleton.authz.admin.enabled=true` + `authz.roles`
 */
export function AdminRoles({
  api,
  labels: given,
  authLabels,
  supportHref,
  onChanged,
  callerPermissions,
}: AdminRolesProps) {
  const labels = mergeRolesLabels(given)
  /** 서버 규칙: 자기 권한 밖의 권한은 역할에 더하지도 빼지도 못한다(전권 `*` 은 모두 가진다) */
  const outside = (key: string) =>
    callerPermissions !== undefined &&
    !callerPermissions.includes('*') &&
    !callerPermissions.includes(key)
  const load = useCallback(
    async () => ({ roles: await api.list(), permissions: await api.permissions() }),
    [api],
  )
  const list = useResource(load)
  const [editing, setEditing] = useState<AdminRole | 'new' | null>(null)
  const [deleting, setDeleting] = useState<AdminRole | null>(null)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const noteId = useId()

  const close = () => {
    setEditing(null)
    setDeleting(null)
    setError(null)
  }
  async function run(task: () => Promise<unknown>) {
    setBusy(true)
    setError(null)
    try {
      await task()
      close()
      list.reload()
      onChanged?.()
    } catch (caught) {
      setError(roleErrorMessage(caught, labels))
      if (isRoleGone(caught)) list.reload() // 목록이 낡았다 - 안내는 창에 두고 목록만 새로 읽는다
    } finally {
      setBusy(false)
    }
  }

  if (adminBlocked(list.error))
    return <AccountStateNotice kind="blocked" supportHref={supportHref} labels={authLabels} />

  const roles = list.data?.roles
  return (
    <div className={styles.stack}>
      <PageHeader
        title={labels.title}
        actions={
          <Button onClick={() => setEditing('new')} disabled={!list.data}>
            {labels.create}
          </Button>
        }
      />
      {list.error ? (
        <Alert
          tone="danger"
          action={
            <Button variant="secondary" size="sm" onClick={list.reload}>
              {labels.retry}
            </Button>
          }
        >
          {labels.loadFailed}
        </Alert>
      ) : !roles ? (
        <Skeleton />
      ) : (
        <Table
          caption={labels.caption}
          rows={roles}
          rowKey={(role) => role.name}
          empty={<EmptyState title={labels.empty} headingLevel={2} />}
          columns={[
            {
              key: 'name',
              header: labels.columns.name,
              rowHeader: true,
              render: (role) => role.name,
            },
            {
              key: 'description',
              header: labels.columns.description,
              render: (role) => role.description || '-',
            },
            {
              key: 'permissions',
              header: labels.columns.permissions,
              render: (role) =>
                role.permissions.includes('*') ? (
                  <Badge tone="warning">{labels.allPermissions}</Badge>
                ) : role.permissions.length === 0 ? (
                  <span className={styles.muted}>{labels.noPermissions}</span>
                ) : (
                  <span className={styles.chips}>
                    {role.permissions.map((key) => (
                      <Badge key={key}>{labels.permissionLabels[key] ?? key}</Badge>
                    ))}
                  </span>
                ),
            },
            {
              key: 'includes',
              header: labels.includesColumn,
              render: (role) =>
                role.includes && role.includes.length > 0 ? (
                  <span className={styles.chips}>
                    {role.includes.map((name) => (
                      <Badge key={name}>{name}</Badge>
                    ))}
                  </span>
                ) : (
                  <span className={styles.muted}>{labels.noIncludes}</span>
                ),
            },
            {
              key: 'holders',
              header: labels.columns.holders,
              align: 'end',
              render: (role) => role.holders ?? labels.holdersUnknown,
            },
            {
              key: 'actions',
              header: labels.columns.actions,
              render: (role) => {
                const locked = isLocked(role)
                const outsideKeys = role.permissions.filter(outside)
                const deleteLocked = locked || outsideKeys.length > 0
                const lockProps = locked
                  ? { 'aria-disabled': true as const, 'aria-describedby': `${noteId}-${role.name}` }
                  : {}
                return (
                  <span className={styles.actions}>
                    <Button
                      variant="secondary"
                      size="sm"
                      aria-label={labels.edit(role.name)}
                      {...lockProps}
                      onClick={locked ? undefined : () => setEditing(role)}
                    >
                      {labels.editButton}
                    </Button>
                    <Button
                      variant="danger"
                      size="sm"
                      aria-label={labels.remove(role.name)}
                      {...(deleteLocked
                        ? {
                            'aria-disabled': true as const,
                            'aria-describedby': `${noteId}-${role.name}`,
                          }
                        : {})}
                      onClick={deleteLocked ? undefined : () => setDeleting(role)}
                    >
                      {labels.removeButton}
                    </Button>
                    {deleteLocked && (
                      <span id={`${noteId}-${role.name}`} className={styles.muted}>
                        {locked ? labels.protectedNote : labels.deleteOutside}
                      </span>
                    )}
                  </span>
                )
              },
            },
          ]}
        />
      )}
      {editing !== null && list.data && (
        <RoleDialog
          key={editing === 'new' ? 'new' : editing.name}
          role={editing === 'new' ? null : editing}
          roles={list.data.roles}
          permissions={list.data.permissions}
          labels={labels}
          busy={busy}
          error={error}
          onClose={close}
          outside={outside}
          onSubmit={(value) =>
            run(() =>
              editing === 'new'
                ? api.create(value)
                : api.update(editing.name, {
                    description: value.description,
                    permissions: value.permissions,
                    includes: value.includes,
                  }),
            )
          }
        />
      )}
      <Dialog
        open={deleting !== null}
        onClose={close}
        title={labels.deleteTitle(deleting?.name ?? '')}
        closeLabel={labels.close}
        footer={
          <>
            <Button variant="ghost" onClick={close} disabled={busy}>
              {labels.cancel}
            </Button>
            <Button
              variant="danger"
              loading={busy}
              loadingLabel={labels.loading}
              onClick={() => deleting && void run(() => api.remove(deleting.name))}
            >
              {labels.removeButton}
            </Button>
          </>
        }
      >
        <div className={styles.stack}>
          {error && <Alert tone="danger">{error}</Alert>}
          <p>{labels.deleteBody}</p>
        </div>
      </Dialog>
    </div>
  )
}
