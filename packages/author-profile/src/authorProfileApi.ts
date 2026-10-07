import { newIdempotencyKey, type ApiClient } from '@skeleton/api-client'
import type { AuthorProfile, AuthorProfileConfig, AuthorProfileInput } from './types'

type ProfileClient = Pick<ApiClient, 'value' | 'list' | 'noContent'>

/** 만들기에 붙는 `Idempotency-Key` — 같은 제출을 다시 보낼 때(더블클릭 · 재시도)만 같은 키를 넘긴다. 안 주면 새 키 */
export type CreateOptions = { idempotencyKey?: string }

export type AuthorProfileApi = {
  /** `GET {basePath}/config` */
  getConfig(): Promise<AuthorProfileConfig>
  /** `GET {basePath}` — 내 살아 있는 프로필 */
  list(): Promise<AuthorProfile[]>
  /** `POST {basePath} { name }` — 201. 400 이름 칸 · 409 NAME_TAKEN / LIMIT_REACHED · 429 RATE_LIMITED */
  create(input: AuthorProfileInput, options?: CreateOptions): Promise<AuthorProfile>
  /** `PATCH {basePath}/{id} { name }` — 같은 오류 */
  rename(id: string, input: AuthorProfileInput): Promise<AuthorProfile>
  /** `DELETE {basePath}/{id}` — 204, 되돌릴 수 없다(글은 「삭제된 사용자」로 남는다) */
  remove(id: string): Promise<void>
}

export type AuthorProfileApiOptions = {
  /**
   * 컨트롤러의 경로(기본 `/author-profiles`, `/api/v1` 은 클라이언트의 baseUrl).
   * 백엔드 `skeleton.author-profile.http.base-path` 를 바꿨다면 여기서 맞춘다.
   */
  basePath?: string
}

/** 작성자 프로필 HTTP 호출 모음. 토큰은 클라이언트의 `getAuthHeaders` 가 붙인다 */
export function createAuthorProfileApi(
  client: ProfileClient,
  { basePath = '/author-profiles' }: AuthorProfileApiOptions = {},
): AuthorProfileApi {
  const base = basePath.replace(/\/+$/, '')
  const one = (id: string) => `${base}/${encodeURIComponent(id)}`
  return {
    getConfig: () => client.value<AuthorProfileConfig>(`${base}/config`),
    list: () => client.list<AuthorProfile>(base),
    create: (input, options) =>
      client.value<AuthorProfile>(base, {
        method: 'POST',
        json: input,
        idempotencyKey: options?.idempotencyKey ?? newIdempotencyKey(),
      }),
    rename: (id, input) => client.value<AuthorProfile>(one(id), { method: 'PATCH', json: input }),
    remove: (id) => client.noContent(one(id), { method: 'DELETE' }),
  }
}
