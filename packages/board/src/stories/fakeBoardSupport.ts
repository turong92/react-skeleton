import { ApiRequestError } from '@skeleton/api-client'
import type { ApiPageResponse } from '@skeleton/api-client'

/** 서버가 던지는 `ApiRequestError`(코드 · 상태) — 화면은 이 코드로 분기한다 */
export const fail = (code: string, status: number, title: string): never => {
  throw new ApiRequestError(
    { code, title, status, timestamp: '2026-01-01T00:00:00Z' },
    'fake-trace',
    'fake-span',
    '00-fake-fake-01',
  )
}

/** 서버의 페이지 envelope — `pageNo` 0 부터 */
export const pageOf = <T>(
  all: T[],
  timestamp: string,
  pageNo = 0,
  size = 20,
): ApiPageResponse<T> => ({
  values: all.slice(pageNo * size, (pageNo + 1) * size),
  pagination: {
    page: pageNo,
    size,
    totalElements: all.length,
    totalPages: Math.ceil(all.length / size),
    hasNext: (pageNo + 1) * size < all.length,
    hasPrevious: pageNo > 0,
  },
  meta: { timestamp },
})

export const total = (counts: Record<string, number>) =>
  Object.values(counts).reduce((a, b) => a + b, 0)

/** 호출마다 `delayMs` 기다리게 감싼다(로딩 · 진행 중 상태를 스토리에서 본다) */
export const withDelay =
  (delayMs: number) =>
  <A extends unknown[], R>(fn: (...args: A) => R) =>
  async (...args: A): Promise<Awaited<R>> => {
    if (delayMs > 0) await new Promise((done) => setTimeout(done, delayMs))
    return await fn(...args)
  }
