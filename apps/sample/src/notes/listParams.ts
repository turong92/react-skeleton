import { NOTE_STATUSES, type NoteStatus, type NotesQuery } from './types'

export const PAGE_SIZE = 10

/** 화면 주소의 검색 인자(`?q=회의&status=ACTIVE&pinned=true&page=2`, 쪽은 1 부터) → 서버 조건. 알 수 없는 값은 버린다 */
export function queryFromSearch(
  search: URLSearchParams,
): Required<Pick<NotesQuery, 'page' | 'size'>> & NotesQuery {
  const page = Number(search.get('page'))
  const status = search.get('status')
  return {
    page: Number.isInteger(page) && page >= 1 ? page - 1 : 0,
    size: PAGE_SIZE,
    q: search.get('q')?.trim() ?? '',
    status: NOTE_STATUSES.includes(status as NoteStatus) ? (status as NoteStatus) : '',
    pinned: search.get('pinned') === 'true' ? true : undefined,
  }
}

/** 서버 조건 → 주소 인자. 기본값(첫 쪽 · 빈 검색 · 전체)은 주소에 쓰지 않는다 */
export function searchFromQuery(query: NotesQuery): URLSearchParams {
  const search = new URLSearchParams()
  if (query.q) search.set('q', query.q)
  if (query.status) search.set('status', query.status)
  if (query.pinned) search.set('pinned', 'true')
  if (query.page) search.set('page', String(query.page + 1))
  return search
}

export const hasFilters = (query: NotesQuery) => Boolean(query.q || query.status || query.pinned)
