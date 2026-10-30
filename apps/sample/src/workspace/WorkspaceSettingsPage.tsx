import { useAuth } from '@skeleton/auth'
import { PageHeader } from '@skeleton/ui'
import { useWorkspace, WorkspaceInvitations, WorkspaceSettings } from '@skeleton/workspace'
import { useNavigate } from 'react-router-dom'
import { languageOf, useT } from '../i18n'
import { workspaceApi } from './api'
import { workspaceLabelsFor } from './labels'

/** `/w/:slug/settings` - 이름 · 주소 이름 · 멤버 · 탈퇴(`WorkspaceSettings`) + 초대(`WorkspaceInvitations`, ADMIN 이상에게만 그려진다). 탈퇴하면 첫 화면(`/workspaces`)으로 */
export function WorkspaceSettingsPage() {
  const { locale } = useT()
  const workspace = useWorkspace()
  const { principal } = useAuth()
  const navigate = useNavigate()
  if (!workspace) return null // Provider 가 풀린 뒤에만 그린다 - 여기는 늘 값이 있다
  const labels = workspaceLabelsFor(languageOf(locale))
  return (
    <div>
      <PageHeader title={workspace.name} />
      <WorkspaceSettings
        api={workspaceApi}
        workspace={workspace}
        accountId={principal?.accountId ?? ''}
        onLeft={() => navigate('/workspaces', { replace: true })}
        labels={labels}
        locale={locale}
      />
      <WorkspaceInvitations api={workspaceApi} workspace={workspace} labels={labels} />
    </div>
  )
}
