import { useAuth } from '@skeleton/auth'
import { Alert, Button, PageHeader, Skeleton } from '@skeleton/ui'
import { CreateWorkspaceForm, pickLandingSlug, useWorkspaces } from '@skeleton/workspace'
import { useMemo } from 'react'
import { Navigate, useNavigate } from 'react-router-dom'
import { languageOf, useT } from '../i18n'
import { workspaceApi } from './api'
import { lastWorkspaceMemoryFor } from './current'
import { workspaceLabelsFor } from './labels'
import { teamPath } from './paths'

/** 새 워크스페이스 만들기 - `/workspaces/new`, 첫 화면에서 팀이 없을 때도 이 폼이다 */
export function NewWorkspace({ onCancel }: { onCancel?: () => void }) {
  const { locale } = useT()
  const navigate = useNavigate()
  const labels = workspaceLabelsFor(languageOf(locale))
  return (
    <>
      <PageHeader title={labels.create.title} />
      <CreateWorkspaceForm
        api={workspaceApi}
        labels={labels}
        onCreated={(workspace) => navigate(teamPath(workspace.slug))}
        onCancel={onCancel}
      />
    </>
  )
}

export function NewWorkspacePage() {
  const navigate = useNavigate()
  return <NewWorkspace onCancel={() => navigate(-1)} />
}

/**
 * `/workspaces` - 첫 화면. 「마지막에 쓴 팀」이 내 목록에 있으면 그 팀으로, 아니면 첫 팀으로 **replace** 이동한다 - 기억은 여기서만 읽는다(주소에 팀이 있는 화면은 읽지 않는다).
 * 팀이 없으면 만들기 폼
 */
export function WorkspacesHomePage() {
  const { t, locale } = useT()
  const { principal } = useAuth()
  const memory = useMemo(() => lastWorkspaceMemoryFor(principal?.accountId ?? ''), [principal])
  const list = useWorkspaces(workspaceApi)
  if (list.isPending)
    return <Skeleton lines={3} label={workspaceLabelsFor(languageOf(locale)).loading} />
  if (list.isError)
    return (
      <Alert
        tone="danger"
        action={
          <Button variant="secondary" size="sm" onClick={() => void list.refetch()}>
            {t('common.retry')}
          </Button>
        }
      >
        {workspaceLabelsFor(languageOf(locale)).loadFailed}
      </Alert>
    )
  const slug = pickLandingSlug(list.data, memory.read())
  return slug ? <Navigate to={teamPath(slug)} replace /> : <NewWorkspace />
}
