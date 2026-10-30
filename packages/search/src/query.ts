/**
 * 서버가 질의로 받아 주는가 - 글자 · 숫자가 이어진 덩어리 중 2글자 이상이 하나라도 있어야 한다(국내 관행, 서버 `SearchText`).
 * 아니면 서버는 400 `SEARCH.QUERY_TOO_SHORT` 라 아예 묻지 않고 안내만 보인다.
 */
export function isSearchable(q: string): boolean {
  return /[\p{L}\p{N}]{2}/u.test(q.normalize('NFKC'))
}
