/**
 * 서버 시각 보정. 기기 시계를 못 믿으므로(카운트다운, 마감 판정) 응답의 `Date` 헤더로 오프셋을 추정한다.
 * 정밀도는 초 단위(HTTP-date) — 마감 "몇 분 전" 용도엔 충분.
 *
 * ```ts
 * export const serverClock = createServerClock()
 * createApiClient({ ..., onResponseDate: serverClock.observeDateHeader })
 * serverClock.now()   // 서버 기준 현재 시각
 * ```
 */
export type ServerClock = {
  /** fetch `Response` 관측 */
  observe: (res: Response) => void
  /** `Date` 헤더 값만 관측 (axios 등 다른 HTTP 클라이언트용) */
  observeDateHeader: (header: string | null | undefined) => void
  now: () => Date
  /** 서버 − 기기 (ms). 관측 전엔 0 */
  offsetMs: () => number
}

export function createServerClock(localNow: () => number = () => Date.now()): ServerClock {
  let offset = 0
  return {
    observe(res) {
      this.observeDateHeader(res.headers.get('date'))
    },
    observeDateHeader(header) {
      if (!header) return
      const server = Date.parse(header)
      if (Number.isNaN(server)) return
      offset = server - localNow()
    },
    now: () => new Date(localNow() + offset),
    offsetMs: () => offset,
  }
}
