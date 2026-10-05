import type { ApiClient, ApiPageResponse } from '@skeleton/api-client'
import type {
  NotificationItem,
  NotificationListParams,
  NotificationReadAllResponse,
  NotificationReadResponse,
} from './types'

export type NotificationsApi = {
  /** `GET {basePath}?page&size&unreadOnly&topic` — 페이지 envelope 전체(`pagination.totalElements` 가 총 개수) */
  list(params?: NotificationListParams): Promise<ApiPageResponse<NotificationItem>>
  /** `PATCH {basePath}/{eventId}/read` */
  markRead(eventId: string): Promise<NotificationReadResponse>
  /** `PATCH {basePath}/read-all` */
  markAllRead(): Promise<NotificationReadAllResponse>
}

export type NotificationsApiOptions = {
  /**
   * 받은편지함 컨트롤러의 경로(기본 `/notifications`, `/api/v1` 은 클라이언트의 baseUrl).
   * 백엔드 `modules/notification` 의 `NotificationInboxController` 가 이 경로를 연다 — 앱이 자기 컨트롤러를 다른 경로로 열었다면 여기서 바꾼다.
   */
  basePath?: string
}

/** 받은편지함 HTTP 호출 모음. 토큰은 클라이언트의 `getAuthHeaders` 가 붙인다 */
export function createNotificationsApi(
  client: Pick<ApiClient, 'page' | 'value'>,
  { basePath = '/notifications' }: NotificationsApiOptions = {},
): NotificationsApi {
  const base = basePath.replace(/\/+$/, '')
  return {
    list: (params = {}) => client.page<NotificationItem>(base, { params: { ...params } }),
    markRead: (eventId) =>
      client.value<NotificationReadResponse>(`${base}/${encodeURIComponent(eventId)}/read`, {
        method: 'PATCH',
      }),
    markAllRead: () =>
      client.value<NotificationReadAllResponse>(`${base}/read-all`, { method: 'PATCH' }),
  }
}
