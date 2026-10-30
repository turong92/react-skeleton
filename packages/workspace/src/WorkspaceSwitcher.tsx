import { Button, RowMenu, type RowMenuItem } from '@skeleton/ui'
import { useWorkspaces } from './hooks'
import { defaultWorkspaceLabels, type WorkspaceLabels } from './labels'
import type { WorkspaceSummary } from './types'
import type { WorkspaceApi } from './workspaceApi'
import styles from './WorkspaceSwitcher.module.css'

export type WorkspaceSwitcherProps = {
  api: Pick<WorkspaceApi, 'list'>
  /** 지금 주소의 slug — 목록에서 이 팀이 체크된다. 첫 화면처럼 팀이 없으면 생략 */
  currentSlug?: string
  /** 팀을 골랐을 때 — 앱이 `/w/<slug>/…` 로 이동한다(라우터를 이 패키지가 모른다) */
  onSelect: (workspace: WorkspaceSummary) => void
  /** 「새 워크스페이스」를 골랐을 때 — 없으면 그 항목을 그리지 않는다 */
  onCreate?: () => void
  labels?: WorkspaceLabels
}

/** 머리줄의 팀 고르기 — 지금 팀 이름이 보이는 단추를 누르면 내 팀 목록 + 「새 워크스페이스」 메뉴 */
export function WorkspaceSwitcher({
  api,
  currentSlug,
  onSelect,
  onCreate,
  labels = defaultWorkspaceLabels,
}: WorkspaceSwitcherProps) {
  const t = labels.switcher
  const query = useWorkspaces(api)
  if (query.isError)
    return (
      <Button variant="secondary" size="sm" onClick={() => void query.refetch()}>
        {labels.retry}
      </Button>
    )
  const workspaces = query.data ?? []
  const currentName = workspaces.find((w) => w.slug === currentSlug)?.name
  const items: RowMenuItem[] = [
    ...workspaces.map((workspace) => ({
      key: workspace.id,
      label: workspace.name,
      checked: workspace.slug === currentSlug,
      onSelect: () => onSelect(workspace),
    })),
    ...(onCreate
      ? [
          {
            key: 'create',
            label: t.create,
            separatorBefore: workspaces.length > 0,
            onSelect: onCreate,
          },
        ]
      : []),
  ]
  return (
    <RowMenu
      label={t.trigger(currentName)}
      align="start"
      disabled={query.isPending}
      items={items}
      trigger={
        <span className={styles.trigger}>
          <span className={styles.name}>
            {query.isPending ? t.loading : (currentName ?? t.choose)}
          </span>
          <span className={styles.chevron} aria-hidden="true">
            ▾
          </span>
        </span>
      }
    />
  )
}
