import type { AuthorProfileApi } from './authorProfileApi'

/** 키는 `author-profile` 한 뿌리 아래 — 변경이 이 접두어로 무효화한다 */
export const authorProfileKeys = {
  all: ['author-profile'] as const,
  config: () => [...authorProfileKeys.all, 'config'] as const,
  list: () => [...authorProfileKeys.all, 'list'] as const,
}

/** 쿼리 정의(키 + 함수)를 훅과 따로 둔다 — 가짜 api 로 테스트하고 서버 렌더의 `prefetch` 에도 쓴다 */
export const configQuery = (api: AuthorProfileApi) => ({
  queryKey: authorProfileKeys.config(),
  queryFn: () => api.getConfig(),
})
export const listQuery = (api: AuthorProfileApi) => ({
  queryKey: authorProfileKeys.list(),
  queryFn: () => api.list(),
})
