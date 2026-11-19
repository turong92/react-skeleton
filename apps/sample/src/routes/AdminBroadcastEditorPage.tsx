import { useCan } from '@skeleton/auth'
import { AdminBroadcastEditor } from '@skeleton/notifications/admin'
import { useNavigate, useParams } from 'react-router-dom'
import { broadcastAdminApi } from '../adminBroadcasts/api'
import { broadcastLabelsFor, broadcastTypeLabels } from '../adminBroadcasts/labels'
import { useAssignableRoles } from '../adminRoles/useAssignableRoles'
import { languageOf, useT } from '../i18n'

/** 새 공지 · 임시 저장 고치기 - `AdminBroadcastEditor`. 대상 「역할」 의 선택지는 `GET /admin/accounts/assignable-roles`(`account.roles` 가 있을 때), 없으면 이름을 직접 적는다. `notification-broadcast.send` 필요 */
export function AdminBroadcastEditorPage() {
  const { id } = useParams()
  const { t, locale } = useT()
  const language = languageOf(locale)
  const navigate = useNavigate()
  // 기본 역할(USER 등)도 든 목록 - GET /admin/roles 는 운영 중 만든 역할만 준다
  const roleChoices = useAssignableRoles().map((r) => ({ value: r.name, label: r.name }))
  return (
    <AdminBroadcastEditor
      api={broadcastAdminApi}
      id={id}
      roleChoices={roleChoices.length > 0 ? roleChoices : undefined}
      typeLabels={broadcastTypeLabels(t)}
      onSent={(sent) => navigate(`/admin/broadcasts/${encodeURIComponent(sent)}`)}
      onCancel={() => navigate('/admin/broadcasts')}
      can={useCan()}
      labels={broadcastLabelsFor(language)}
      locale={language}
    />
  )
}
