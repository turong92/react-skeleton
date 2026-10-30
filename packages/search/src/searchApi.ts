import type { ApiClient, ApiPageResponse } from '@skeleton/api-client'
import type { SearchHit, SearchParams } from './types'

type SearchClient = Pick<ApiClient, 'page'>

export type SearchApi = {
  /** `GET {basePath}?q&types&scope&sort&page&size` - 쪽 envelope. 로그인한 호출자만(서버가 `allow-anonymous-read` 로 열지 않으면 401) */
  search(params: SearchParams): Promise<ApiPageResponse<SearchHit>>
}

export type SearchApiOptions = {
  /** 검색 컨트롤러의 경로(기본 `/search`, `/api/v1` 은 클라이언트의 baseUrl). 백엔드 `skeleton.search.http.base-path` 와 맞춘다 */
  basePath?: string
}

/** 정한 조건만 보낸다 - 빈 종류 목록은 「모든 종류」라 아무 말도 하지 않는다 */
function toQuery({ types, ...rest }: SearchParams) {
  const defined = Object.fromEntries(
    Object.entries(rest).filter(([, value]) => value !== undefined && value !== ''),
  )
  return types && types.length > 0 ? { ...defined, types: types.join(',') } : defined
}

/** 검색 HTTP 호출. 토큰은 클라이언트의 `getAuthHeaders` 가 붙인다 */
export function createSearchApi(
  client: SearchClient,
  { basePath = '/search' }: SearchApiOptions = {},
): SearchApi {
  const base = basePath.replace(/\/+$/, '')
  return {
    search: (params) => client.page<SearchHit>(base, { params: toQuery(params) }),
  }
}
