import { POST_SORTS, type PostListParams, type PostSort } from '@skeleton/board'

export const BOARD_PAGE_SIZE = 10

/** 화면 주소의 검색 인자(`?sort=reactions&q=공지&page=2`, 쪽은 1 부터) → 서버 조건. 알 수 없는 값은 버린다 */
export function paramsFromSearch(
  search: URLSearchParams,
): Required<Pick<PostListParams, 'page' | 'size' | 'sort' | 'q'>> {
  const page = Number(search.get('page'))
  const sort = search.get('sort')
  return {
    page: Number.isInteger(page) && page >= 1 ? page - 1 : 0,
    size: BOARD_PAGE_SIZE,
    sort: POST_SORTS.includes(sort as PostSort) ? (sort as PostSort) : 'latest',
    q: search.get('q')?.trim() ?? '',
  }
}

/** 서버 조건 → 주소 인자. 기본값(첫 쪽 · 최신순 · 빈 검색)은 주소에 쓰지 않는다 */
export function searchFromParams(params: PostListParams): URLSearchParams {
  const search = new URLSearchParams()
  if (params.sort && params.sort !== 'latest') search.set('sort', params.sort)
  if (params.q) search.set('q', params.q)
  if (params.page) search.set('page', String(params.page + 1))
  return search
}
