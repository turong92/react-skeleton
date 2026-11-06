import { newIdempotencyKey, type ApiClient } from '@skeleton/api-client'
import type { AuthorProfile, AuthorProfileConfig, AuthorProfileInput, AvatarAddress } from './types'

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
  /** `PATCH {basePath}/{id} { avatarKey }` - 이 프로필의 사진: 문자열 = 설정, `null` = 지움(이름은 그대로). 400 = 내 업로드가 아니거나 · 계정 id 가 든 키이거나 · 계정/다른 프로필이 쓰는 키이거나 · 서버에 사진 기능이 없다 */
  setAvatar(id: string, avatarKey: string | null): Promise<AuthorProfile>
  /** `GET {basePath}/{id}/avatar` - 내 사진을 볼 서명 주소. 사진이 없거나 서명 읽기가 꺼졌으면 404 */
  avatarAddress(id: string): Promise<AvatarAddress>
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
    setAvatar: (id, avatarKey) =>
      client.value<AuthorProfile>(one(id), { method: 'PATCH', json: { avatarKey } }),
    avatarAddress: (id) => client.value<AvatarAddress>(`${one(id)}/avatar`),
    remove: (id) => client.noContent(one(id), { method: 'DELETE' }),
  }
}
