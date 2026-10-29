import type { BadgeAwardEvent } from './types'

/** 서버가 정한 배지 코드 형식 - `[a-z0-9._-]{1,64}` */
export const BADGE_CODE = /^[a-z0-9._-]{1,64}$/

/**
 * 회수 단추를 달 내역 줄 - 같은 보유 줄(`awardId`)의 **가장 최근 줄**이 「수여」일 때만(내역은 최신순).
 * 이미 회수된 줄을 다시 회수하면 서버가 404 를 내므로 단추를 아예 달지 않는다
 */
export function revocableEventIds(rows: readonly BadgeAwardEvent[]): Set<string> {
  const seen = new Set<string>()
  const out = new Set<string>()
  for (const row of rows) {
    if (seen.has(row.awardId)) continue
    seen.add(row.awardId)
    if (row.action === 'AWARDED') out.add(row.id)
  }
  return out
}
