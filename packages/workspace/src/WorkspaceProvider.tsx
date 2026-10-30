import { useEffect, useLayoutEffect, useRef, type ReactNode } from 'react'
import { Alert, Button, EmptyState, Skeleton } from '@skeleton/ui'
import { ApiRequestError } from '@skeleton/api-client'
import type { CurrentWorkspace } from './currentWorkspace'
import { useWorkspaceBySlug } from './hooks'
import { defaultWorkspaceLabels, type WorkspaceLabels } from './labels'
import type { LastWorkspaceMemory } from './lastWorkspace'
import type { WorkspaceDetail } from './types'
import { WorkspaceContext } from './workspaceContext'
import type { WorkspaceApi } from './workspaceApi'

export type WorkspaceProviderProps = {
  api: Pick<WorkspaceApi, 'bySlug'>
  /** 주소 `/w/:slug/…` 의 slug — 팀은 주소에서만 읽는다(탭마다 다르다) */
  slug: string
  /** 풀린 워크스페이스 id 를 요청 헤더 쪽(`createWorkspaceHeaders`)에 건네는 칸 — 앱이 하나 만들어 둘에게 같이 준다 */
  current: CurrentWorkspace
  /** 있으면 풀릴 때마다 지금 slug 를 「마지막에 쓴 팀」으로 적는다 */
  memory?: Pick<LastWorkspaceMemory, 'write'>
  /**
   * 풀린 slug 가 주소와 다를 때(옛 slug 로 들어왔거나 이름을 바꿨다) 한 번 부른다 — 앱이 주소를 **replace** 로 바꾼다.
   * 라우터를 이 패키지가 모르므로 이동은 앱이 한다
   */
  onCanonicalSlug?: (slug: string) => void
  labels?: WorkspaceLabels
  /** 풀리는 동안 · 찾지 못했을 때 그릴 것(기본: 로딩 자리표시 · 「찾을 수 없음」) */
  pending?: ReactNode
  notFound?: ReactNode
  children: ReactNode
}

/**
 * 주소의 slug 를 워크스페이스로 풀고(`GET by-slug`), **풀린 뒤에만** 자식을 그린다 — 자식의 요청이 팀 헤더 없이 나가지 않게.
 * 풀린 id 를 `current` 에 싣고(레이아웃 효과: 자식의 쿼리가 시작되기 전), 언마운트하면 비운다.
 * 멤버가 아니거나 추방되면(404) 다음 갱신에서 「찾을 수 없음」으로 바뀐다. `QueryClientProvider` 아래에서 쓴다
 */
export function WorkspaceProvider({
  api,
  slug,
  current,
  memory,
  onCanonicalSlug,
  labels = defaultWorkspaceLabels,
  pending,
  notFound,
  children,
}: WorkspaceProviderProps) {
  const query = useWorkspaceBySlug(api, slug)
  const missing = query.error instanceof ApiRequestError && query.error.apiError.status === 404
  if (missing)
    return (
      notFound ?? (
        <EmptyState
          headingLevel={2}
          title={labels.notFound.title}
          description={labels.notFound.description}
        />
      )
    )
  if (query.data)
    return (
      <Resolved
        workspace={query.data}
        slug={slug}
        current={current}
        memory={memory}
        onCanonicalSlug={onCanonicalSlug}
      >
        {children}
      </Resolved>
    )
  if (query.isError)
    return (
      <Alert
        tone="danger"
        action={
          <Button variant="secondary" size="sm" onClick={() => void query.refetch()}>
            {labels.retry}
          </Button>
        }
      >
        {labels.loadFailed}
      </Alert>
    )
  return pending ?? <Skeleton lines={3} label={labels.loading} />
}

type ResolvedProps = Pick<
  WorkspaceProviderProps,
  'slug' | 'current' | 'memory' | 'onCanonicalSlug' | 'children'
> & { workspace: WorkspaceDetail }

function Resolved({ workspace, slug, current, memory, onCanonicalSlug, children }: ResolvedProps) {
  // 자식의 effect(쿼리 시작)보다 먼저 — 레이아웃 효과는 모든 passive 효과보다 앞서 돈다
  useLayoutEffect(() => {
    current.set(workspace.id)
    return () => current.set(undefined)
  }, [current, workspace.id])
  /** 가장 최근 렌더의 콜백 · 기억 — 앱이 인라인으로 줘도 효과가 다시 돌지 않게 */
  const latest = useRef({ memory, onCanonicalSlug })
  useEffect(() => {
    latest.current = { memory, onCanonicalSlug }
  })
  useEffect(() => {
    latest.current.memory?.write(workspace.slug)
  }, [workspace.slug])
  useEffect(() => {
    if (workspace.slug !== slug) latest.current.onCanonicalSlug?.(workspace.slug)
  }, [workspace.slug, slug])
  return <WorkspaceContext.Provider value={workspace}>{children}</WorkspaceContext.Provider>
}
