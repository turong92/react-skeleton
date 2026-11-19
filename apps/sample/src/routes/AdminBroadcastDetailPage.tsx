import { useCan } from '@skeleton/auth'
import { AdminBroadcastDetail } from '@skeleton/notifications/admin'
import { useNavigate, useParams } from 'react-router-dom'
import { broadcastAdminApi } from '../adminBroadcasts/api'
import { broadcastLabelsFor, broadcastTypeLabels } from '../adminBroadcasts/labels'
import { languageOf, useT } from '../i18n'

/** 공지 한 건 - 통계 · 상태별 단추(`AdminBroadcastDetail`). 보내는 중이면 10초마다 다시 읽는다 */
export function AdminBroadcastDetailPage() {
  const { id = '' } = useParams()
  const { t, locale } = useT()
  const language = languageOf(locale)
  const navigate = useNavigate()
  return (
    <AdminBroadcastDetail
      api={broadcastAdminApi}
      id={id}
      onEdit={(draftId) => navigate(`/admin/broadcasts/${encodeURIComponent(draftId)}/edit`)}
      onDeleted={() => navigate('/admin/broadcasts')}
      typeLabels={broadcastTypeLabels(t)}
      can={useCan()}
      labels={broadcastLabelsFor(language)}
      locale={language}
    />
  )
}
