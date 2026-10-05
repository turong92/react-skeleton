import { createServerClock } from '@skeleton/time'

/** 서버 시각 보정(응답 `Date` 헤더). 카운트다운 · 마감 판정은 `serverClock.now()` 로 */
export const serverClock = createServerClock()
