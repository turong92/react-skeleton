import { useCan } from '@skeleton/auth'
import { AdminBroadcasts } from '@skeleton/notifications/admin'
import { useNavigate } from 'react-router-dom'
import { broadcastAdminApi } from '../adminBroadcasts/api'
import { broadcastLabelsFor, broadcastTypeLabels } from '../adminBroadcasts/labels'
import { languageOf, useT } from '../i18n'

/** 공지 목록 - `@skeleton/notifications/admin` 의 `AdminBroadcasts`. 백엔드 `notification-broadcast`(admin 켬) + `notification-broadcast.read`. 필요 없는 프로젝트는 이 파일 · 라우트 · 메뉴 한 줄을 지운다 */
export function AdminBroadcastsPage() {
  const { t, locale } = useT()
  const language = languageOf(locale)
  const navigate = useNavigate()
  return (
    <AdminBroadcasts
      api={broadcastAdminApi}
      onCreate={() => navigate('/admin/broadcasts/new')}
      onOpen={(id) => navigate(`/admin/broadcasts/${encodeURIComponent(id)}`)}
      typeLabels={broadcastTypeLabels(t)}
      can={useCan()}
      labels={broadcastLabelsFor(language)}
      locale={language}
    />
  )
}
