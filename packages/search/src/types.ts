/** 하이라이트 한 곳 - `[시작, 끝)`, 문자열의 UTF-16 위치(자바스크립트 `string` 의 인덱스와 같다) */
export type HighlightRange = readonly [start: number, end: number]

export const SEARCH_SORTS = ['relevance', 'recent'] as const
export type SearchSort = (typeof SEARCH_SORTS)[number]

/** 서버 응답 한 줄 - 제목 · 발췌와 각각의 일치 위치. HTML 은 없다 */
export type SearchHit = {
  /** 문서 종류(`[a-z0-9._-]{1,32}`) - 어떤 이름 · 링크로 그릴지는 앱의 `describe` 가 안다 */
  type: string
  id: string
  title: string
  snippet: string
  titleHighlights: HighlightRange[]
  snippetHighlights: HighlightRange[]
  updatedAt: string
}

export type SearchParams = {
  q: string
  /** 비면 모든 종류 */
  types?: string[]
  scope?: string
  sort?: SearchSort
  /** 0 부터 */
  page?: number
  /** ≤ 50 */
  size?: number
}

/** 앱이 종류마다 주는 이름과 링크 */
export type SearchTypeInfo = {
  label: string
  href: (id: string) => string
}
