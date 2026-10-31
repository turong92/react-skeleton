import type { ApiClient } from '@skeleton/api-client'
import type {
  PushAdvertising,
  PushConfig,
  PushDevice,
  PushPreference,
  WebPushRegistration,
} from './types'

export type PushApi = {
  /** `GET {basePath}/config` — 구독에 쓸 공개 키 */
  config(): Promise<PushConfig>
  /** `GET {basePath}/devices` — 내 기기, 최근 순 */
  devices(): Promise<{ items: PushDevice[] }>
  /** `PUT {basePath}/devices/{installationId}` — 등록(=갱신). 화면이 열릴 때마다 부른다 */
  registerDevice(installationId: string, body: WebPushRegistration): Promise<PushDevice>
  /** `DELETE {basePath}/devices/{installationId}` — 내 것만 지운다(없어도 204) */
  removeDevice(installationId: string): Promise<void>
  /** `POST {basePath}/devices/{installationId}/test` — 시험 알림 하나(202). 60초에 한 번, 아니면 429 `PUSH.TEST_TOO_SOON` */
  sendTest(installationId: string): Promise<void>
  /** `GET {basePath}/preferences` — `push.types` 의 종류마다(광고 종류는 없다) */
  preferences(): Promise<{ items: PushPreference[] }>
  /** `PUT {basePath}/preferences/{type}` 본문 `{ enabled }` — 푸시만 끈다/켠다(알림함에는 그대로 쌓인다). 목록 밖 종류는 404 */
  setPreference(type: string, enabled: boolean): Promise<PushPreference>
  /** `GET {basePath}/advertising` — 광고 수신 동의 상태(`notification-push-legal` + 광고 종류가 설정된 서버만, 아니면 404). 동의 · 철회는 `legal` 경로 */
  getAdvertising(): Promise<PushAdvertising>
}

export type PushApiOptions = {
  /** 푸시 컨트롤러의 경로(기본 `/push`, `/api/v1` 은 클라이언트의 baseUrl) */
  basePath?: string
}

/** 푸시 HTTP 호출 모음. 토큰은 클라이언트의 `getAuthHeaders` 가 붙인다 */
export function createPushApi(
  client: Pick<ApiClient, 'value' | 'noContent'>,
  { basePath = '/push' }: PushApiOptions = {},
): PushApi {
  const base = basePath.replace(/\/+$/, '')
  const device = (installationId: string) => `${base}/devices/${encodeURIComponent(installationId)}`
  return {
    config: () => client.value<PushConfig>(`${base}/config`),
    devices: () => client.value<{ items: PushDevice[] }>(`${base}/devices`),
    registerDevice: (installationId, body) =>
      client.value<PushDevice>(device(installationId), { method: 'PUT', json: body }),
    removeDevice: (installationId) =>
      client.noContent(device(installationId), { method: 'DELETE' }),
    sendTest: (installationId) =>
      client.noContent(`${device(installationId)}/test`, { method: 'POST' }),
    preferences: () => client.value<{ items: PushPreference[] }>(`${base}/preferences`),
    setPreference: (type, enabled) =>
      client.value<PushPreference>(`${base}/preferences/${encodeURIComponent(type)}`, {
        method: 'PUT',
        json: { enabled },
      }),
    getAdvertising: () => client.value<PushAdvertising>(`${base}/advertising`),
  }
}
