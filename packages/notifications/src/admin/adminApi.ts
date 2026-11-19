import type { ApiClient } from '@skeleton/api-client'
import type {
  BroadcastAudience,
  Broadcast,
  BroadcastDetail,
  BroadcastInput,
  BroadcastListQuery,
  BroadcastOptions,
} from './types'

export type BroadcastAdminApi = {
  /** `GET {basePath}/options` (`read`) - 종류 · 채널 · 대상 종류 */
  options(): Promise<BroadcastOptions>
  /** `GET {basePath}/audience-count?kind&param` (`read`) - 대상 수 미리보기 */
  audienceCount(audience: BroadcastAudience): Promise<{ count: number }>
  /** `GET {basePath}?status&before&limit` (`read`) - 최근 순(`before` = 마지막 줄의 id) */
  list(query?: BroadcastListQuery): Promise<Broadcast[]>
  /** `GET {basePath}/{id}` (`read`) - 상세 + 통계 */
  get(id: string): Promise<BroadcastDetail>
  /** `POST {basePath}` (`send`) → DRAFT */
  create(input: BroadcastInput): Promise<Broadcast>
  /** `PUT {basePath}/{id}` (`send`) - DRAFT 만(아니면 409 `BROADCAST.INVALID_STATE`) */
  update(id: string, input: BroadcastInput): Promise<Broadcast>
  /** `DELETE {basePath}/{id}` (`send`) - DRAFT 만 */
  remove(id: string): Promise<void>
  /** `POST {basePath}/{id}/test` (`send`) → 202 - 나에게만, 30초에 한 번(아니면 429 `BROADCAST.TEST_TOO_SOON`) */
  sendTest(id: string): Promise<void>
  /** `POST {basePath}/{id}/send {scheduledAt?}` (`send`) - 없으면 지금. 지금 ~ +90일 밖이면 400 `BROADCAST.INVALID_SCHEDULE` */
  send(id: string, scheduledAt?: string | null): Promise<void>
  /** `POST {basePath}/{id}/unschedule` (`send`) - SCHEDULED → DRAFT */
  unschedule(id: string): Promise<void>
  /** `POST {basePath}/{id}/cancel` (`send`) - (SCHEDULED|SENDING) → CANCELLED */
  cancel(id: string): Promise<void>
  /** `POST {basePath}/{id}/resume` (`send`) - FAILED → SENDING, 같은 자리부터 */
  resume(id: string): Promise<void>
}

export type BroadcastAdminApiOptions = {
  /** 공지 컨트롤러의 경로(기본 `/admin/broadcasts`, `/api/v1` 은 클라이언트의 baseUrl). 모듈의 `admin.enabled` 가 꺼져 있으면 404 */
  basePath?: string
}

/** 공지 운영 호출 모음. 토큰은 클라이언트의 `getAuthHeaders` 가 붙인다 */
export function createBroadcastAdminApi(
  client: Pick<ApiClient, 'value' | 'list' | 'noContent'>,
  { basePath = '/admin/broadcasts' }: BroadcastAdminApiOptions = {},
): BroadcastAdminApi {
  const base = basePath.replace(/\/+$/, '')
  const one = (id: string) => `${base}/${encodeURIComponent(id)}`
  /** 상태를 바꾸는 명령 - 본문은 읽지 않는다(화면은 상세를 다시 읽는다) */
  const command = (path: string, json?: unknown) =>
    client.noContent(path, { method: 'POST', ...(json !== undefined ? { json } : {}) })
  const defined = (params: Record<string, string | number | null | undefined>) =>
    Object.fromEntries(Object.entries(params).filter(([, v]) => v != null && v !== ''))
  return {
    options: () => client.value<BroadcastOptions>(`${base}/options`),
    audienceCount: ({ kind, param }) =>
      client.value<{ count: number }>(`${base}/audience-count`, {
        params: defined({ kind, param }),
      }),
    list: (query = {}) => client.list<Broadcast>(base, { params: defined({ ...query }) }),
    get: (id) => client.value<BroadcastDetail>(one(id)),
    create: (input) => client.value<Broadcast>(base, { method: 'POST', json: input }),
    update: (id, input) => client.value<Broadcast>(one(id), { method: 'PUT', json: input }),
    remove: (id) => client.noContent(one(id), { method: 'DELETE' }),
    sendTest: (id) => client.noContent(`${one(id)}/test`, { method: 'POST' }),
    send: (id, scheduledAt) => command(`${one(id)}/send`, scheduledAt ? { scheduledAt } : {}),
    unschedule: (id) => command(`${one(id)}/unschedule`),
    cancel: (id) => command(`${one(id)}/cancel`),
    resume: (id) => command(`${one(id)}/resume`),
  }
}
