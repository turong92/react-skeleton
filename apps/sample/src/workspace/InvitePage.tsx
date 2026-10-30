import { useAuth } from '@skeleton/auth'
import { AcceptInvitation } from '@skeleton/workspace'
import { useNavigate } from 'react-router-dom'
import { languageOf, useT } from '../i18n'
import { workspaceApi } from './api'
import { workspaceLabelsFor } from './labels'
import { teamPath } from './paths'

/**
 * `/invite?token=…` (메일의 링크, 로그인 없이 열린다) - `AcceptInvitation` 이 토큰을 이 탭 저장소로 옮기고 주소창에서 지운다.
 * 로그인 · 가입 화면으로 보낼 때 돌아올 곳은 `/invite`(토큰 없이) - 토큰은 이 탭에 남아 있어 돌아와도 이어진다. 수락하면 그 팀으로
 */
export function InvitePage() {
  const { locale } = useT()
  const { status } = useAuth()
  const navigate = useNavigate()
  return (
    <AcceptInvitation
      api={workspaceApi}
      signedIn={status === 'authenticated'}
      onSignIn={() => navigate('/login', { state: { from: { pathname: '/invite' } } })}
      onAccepted={(workspace) => navigate(teamPath(workspace.slug), { replace: true })}
      onGoHome={() => navigate('/')}
      labels={workspaceLabelsFor(languageOf(locale))}
      locale={locale}
    />
  )
}
