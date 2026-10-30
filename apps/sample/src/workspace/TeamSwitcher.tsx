import { WorkspaceSwitcher } from '@skeleton/workspace'
import { useLocation, useNavigate } from 'react-router-dom'
import { languageOf, useT } from '../i18n'
import { workspaceApi } from './api'
import { workspaceLabelsFor } from './labels'
import { slugFromPath, teamPath } from './paths'

/** 머리줄의 팀 고르기 - 지금 팀은 주소에서 읽는다. 고르면 그 팀의 노트로, 「새 워크스페이스」는 만들기 화면으로 */
export function TeamSwitcher() {
  const { locale } = useT()
  const { pathname } = useLocation()
  const navigate = useNavigate()
  return (
    <WorkspaceSwitcher
      api={workspaceApi}
      currentSlug={slugFromPath(pathname)}
      onSelect={(workspace) => navigate(teamPath(workspace.slug))}
      onCreate={() => navigate('/workspaces/new')}
      labels={workspaceLabelsFor(languageOf(locale))}
    />
  )
}
