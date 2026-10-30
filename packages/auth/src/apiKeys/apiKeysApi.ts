import type { ApiClient } from '@skeleton/api-client'
import type { ReauthCredential } from '../account/accountApi'
import type { ApiKey, ApiKeyScope, CreatedApiKey } from './types'

/** 발급 요청 - 다시 인증 증거(`currentPassword` · `confirmationCode` · `socialReauth`)는 같은 본문에 싣는다(서버가 강제한다) */
export type CreateApiKeyInput = ReauthCredential & {
  name: string
  scopes: string[]
  /** ISO-8601. 없으면 만료 없음(앱이 `max-lifetime` 을 두면 서버가 거절한다) */
  expiresAt?: string
}

export type ApiKeysApi = {
  /** `GET /api-keys` - 내 키(토큰 · 해시 없음) */
  list(): Promise<ApiKey[]>
  /** `GET /api-keys/scopes` - 앱 · 모듈이 선언한 범위 */
  scopes(): Promise<ApiKeyScope[]>
  /** `POST /api-keys` → 201 `{key, token}` - 토큰은 이 응답에만 있다 */
  create(input: CreateApiKeyInput): Promise<CreatedApiKey>
  /** `DELETE /api-keys/{id}` → 204 - 남의 키는 404 */
  revoke(id: string): Promise<void>
}

/** API 키 사용자 HTTP(백엔드 `skeleton.api-key.http.enabled`). 키로 온 요청은 이 경로들을 못 쓴다 - 로그인한 사람만 */
export function createApiKeysApi(
  client: Pick<ApiClient, 'list' | 'value' | 'noContent'>,
  { base = '/api-keys' }: { base?: string } = {},
): ApiKeysApi {
  const root = base.replace(/\/+$/, '')
  return {
    list: () => client.list<ApiKey>(root),
    scopes: () => client.list<ApiKeyScope>(`${root}/scopes`),
    create: (input) => client.value<CreatedApiKey>(root, { method: 'POST', json: input }),
    revoke: (id) => client.noContent(`${root}/${encodeURIComponent(id)}`, { method: 'DELETE' }),
  }
}
