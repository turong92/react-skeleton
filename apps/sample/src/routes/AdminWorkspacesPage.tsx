import { useCan } from '@skeleton/auth'
import { AdminWorkspaces } from '@skeleton/workspace/admin'
import { languageOf, useT } from '../i18n'
import { workspaceAdminApi } from '../workspace/api'
import { workspaceAdminLabelsFor } from '../workspace/labels'

/** 운영자 화면 - 워크스페이스 목록 · 상세(읽기만). 백엔드 `skeleton.workspace.admin.enabled=true`(이 앱은 켠다)와 `workspace.read` 권한이 필요하다. 필요 없는 프로젝트는 이 파일과 라우트 · 메뉴 한 줄을 지운다 */
export function AdminWorkspacesPage() {
  const { locale } = useT()
  return (
    <AdminWorkspaces
      api={workspaceAdminApi}
      can={useCan()}
      labels={workspaceAdminLabelsFor(languageOf(locale))}
    />
  )
}
