import { ApiRequestError, type ApiPageResponse } from '@skeleton/api-client'
import { isSearchable } from '../query'
import type { SearchApi } from '../searchApi'
import type { HighlightRange, SearchHit, SearchParams } from '../types'

/** 스토리 · 시험용 메모리 안의 가짜 검색 API - 서버가 하는 일(부분 문자열 일치 · 종류 거르기 · 쪽 나누기 · 위치 계산)만 흉내 낸다 */

export const fail = (status: number, code: string) =>
  new ApiRequestError({ code, title: code, status } as never, 'trace', 'span', 'parent')

const hit = (type: string, id: string, title: string, snippet: string): SearchHit => ({
  type,
  id,
  title,
  snippet,
  titleHighlights: [],
  snippetHighlights: [],
  updatedAt: '2026-10-28T12:00:00Z',
})

export const fakeHits: SearchHit[] = [
  hit(
    'note',
    'n1',
    '여름 가방끈 수선 메모',
    '가방끈이 헐거워져서 수선집에 맡기기로 했다. 가방끈 폭은 3cm.',
  ),
  hit('note', 'n2', '가방 고르기', '여행용 가방은 가벼운 것이 좋다. 끈이 넓으면 어깨가 편하다.'),
  hit('product', 'pro', '프로', '모든 기능과 우선 지원이 들어 있는 구독 요금제입니다.'),
  hit('product', 'basic', '베이직', '개인용으로 충분한 구독 요금제입니다.'),
  hit('note', 'n3', '😀 이모지 메모', '😀 이모지가 앞에 있어도 위치가 어긋나지 않는다 — 방끈 😀'),
  hit(
    'note',
    'n4',
    '<script>alert(1)</script> 메모',
    '<img src=x onerror=alert(1)> 는 글자로만 보인다',
  ),
  ...Array.from({ length: 24 }, (_, i) =>
    hit('note', `m${i}`, `회의록 ${i + 1}`, `회의록 ${i + 1}번째 메모 내용입니다.`),
  ),
]

function rangesOf(text: string, terms: string[]): HighlightRange[] {
  const lower = text.toLowerCase()
  const found: HighlightRange[] = []
  for (const term of terms)
    for (let from = lower.indexOf(term); from >= 0; from = lower.indexOf(term, from + term.length))
      found.push([from, from + term.length])
  return found
}

/** `calls` 는 서버에 간 요청(조건 그대로) - 입력 늦춤 · 종류 거르기를 시험이 읽는다 */
export function createFakeSearch(
  hits: SearchHit[] = fakeHits,
  options: { failWith?: Error; delayMs?: number } = {},
) {
  const calls: SearchParams[] = []
  const api: SearchApi = {
    async search(params) {
      calls.push(params)
      if (options.delayMs) await new Promise((resolve) => setTimeout(resolve, options.delayMs))
      if (options.failWith) throw options.failWith
      if (!isSearchable(params.q)) throw fail(400, 'SEARCH.QUERY_TOO_SHORT')
      const terms = params.q
        .normalize('NFKC')
        .toLowerCase()
        .split(/[^\p{L}\p{N}]+/u)
        .filter((term) => term.length >= 2)
      const matched = hits
        .filter((h) => !params.types?.length || params.types.includes(h.type))
        .map((h) => ({
          ...h,
          titleHighlights: rangesOf(h.title, terms),
          snippetHighlights: rangesOf(h.snippet, terms),
        }))
        .filter((h) =>
          terms.every(
            (term) =>
              h.title.toLowerCase().includes(term) || h.snippet.toLowerCase().includes(term),
          ),
        )
      const size = params.size ?? 10
      const page = params.page ?? 0
      const totalPages = Math.ceil(matched.length / size)
      const envelope: ApiPageResponse<SearchHit> = {
        values: matched.slice(page * size, (page + 1) * size),
        pagination: {
          page,
          size,
          totalElements: matched.length,
          totalPages,
          hasNext: page + 1 < totalPages,
          hasPrevious: page > 0,
        },
        meta: { timestamp: '2026-10-30T00:00:00Z' } as ApiPageResponse<SearchHit>['meta'],
      }
      return envelope
    },
  }
  return { api, calls }
}
